'use strict'
const { app, BrowserWindow, Menu, TouchBar, ipcMain, dialog, session, systemPreferences } = require('electron');
const { TouchBarLabel, TouchBarButton, TouchBarSpacer } = TouchBar;
const path  = require('path');
const fs    = require('fs');
const yauzl = require('yauzl');
const http = require('axios');
const execa = require('execa');
const log = require('electron-log');
const menu = require('./components/menu.js');
const installRPackages = require('./components/install-r.js');
const minAPIVersion = 1;

const DataStore = require('./DataStore');
const ConfigManager = require('./ConfigManager');
const unzip     = require('./Unzip');
const { randomPort, waitFor, isNull } = require('./helpers');

const isMac = process.platform === 'darwin';
const DEVELOPMENT_MODE = !app.isPackaged;
const miroWorkspaceDir = path.join(app.getPath('home'), '.miro');
(async () => {
  try{
    if ( !fs.existsSync(miroWorkspaceDir) ) {
        fs.mkdirSync(miroWorkspaceDir);
        if ( process.platform === 'win32' ) {
          await execa("attrib", ["+h", miroWorkspaceDir]);
        }
    }
  } catch (e) {
    log.error('Could not create miro workspace!');
  }
})();
let errMsg;
const appRootDir = DEVELOPMENT_MODE ? 
   app.getAppPath(): path.dirname(process.execPath);
const configData = (() => { try { 
  return new ConfigManager(appRootDir, miroWorkspaceDir);
} catch(e) { 
  console.error(e);
  errMsg = `Couldn't create configuration file in workspace: ${miroWorkspaceDir}\
    Please make sure you have sufficient permissions and restart MIRO.`;
}})();

if ( ! errMsg ) {
  (async _ => {
    const logPath = await configData.get('logpath');
    if ( !fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, {recursive: true});
    }
    log.transports.file.file = path.join(logPath, 
      'launcher.log');
    log.info(`MIRO launcher is being started (execPath: ${appRootDir}, \
pid: ${process.pid}, Log path: ${logPath}, \
platform: ${process.platform}, arch: ${process.arch}, \
version: ${process.getSystemVersion()})...`);
  })();
}
const appDataPath = errMsg? null :
   path.join(configData.getConfigPath(), 'miro_apps');
const appsData = errMsg? null : 
   new DataStore(configData.getConfigPath());

const resourcesPath = DEVELOPMENT_MODE? app.getAppPath(): process.resourcesPath;

let shutdown = false
let miroProcesses = [];
const processIdMap = {};

let rPackagesInstalled = true;
const libPath = path.join(appRootDir, 'r', 'library');

const miroResourcePath = DEVELOPMENT_MODE? path.join(app.getAppPath(), 'miro'):
   path.join(process.resourcesPath, 'miro');

log.info(`MIRO launcher is being started (rootDir: ${appRootDir}, pid: ${process.pid}, \
platform: ${process.platform}, arch: ${process.arch}, \
version: ${process.getSystemVersion()})...`);

// enable overlay scrollbar
app.commandLine.appendSwitch('--enable-features', 'OverlayScrollbar')

const tryStartWebserver = async (progressCallback, onErrorStartup,
  onErrorLater, appData, rpath, onSuccess) => {
  let internalPid = processIdMap[appData.id];

  log.debug(`Request to start web server with internal pid: ${internalPid} submitted.`);

  if ( internalPid ) {
    log.error('Process for this model already running. This should not happen. Reference not freed.');
    return;
  }
  internalPid = miroProcesses.findIndex(isNull);
  if ( internalPid === -1 ) {
    internalPid = miroProcesses.length;
  }
  processIdMap[appData.id] = internalPid;
  if (miroProcesses[internalPid] != null) {
    await onErrorStartup(appData.id)
    return
  }

  let shinyPort = randomPort();
  log.debug(`Process: ${internalPid} is being started on port: ${shinyPort}.`);
  const gamspath = configData.get('gamspath');
  const logpath = configData.get('logpath');
  const launchExternal = configData.get('launchExternal');

  await progressCallback({internalPid: internalPid, code: 'start'})

  let shinyRunning = false

  const onError = async (e) => {
    log.error(`Process: ${internalPid} crashed during startup. Error message: ${e.message}.`);
    miroProcesses[internalPid] = null;
    delete processIdMap[appData.id];
  }

  let shinyProcessAlreadyDead = false
  miroProcesses[internalPid] = execa(path.join(rpath, 'bin', 'Rscript'),
    ['--vanilla', path.join(miroResourcePath, 'start-shiny.R')],
    { env: {
      'WITHIN_ELECTRON': '1',
      'R_HOME_DIR': rpath,
      'RE_SHINY_PORT': shinyPort,
      'RE_SHINY_PATH': miroResourcePath,
      'R_LIBS': libPath,
      'R_LIBS_USER': libPath,
      'R_LIBS_SITE': libPath,
      'R_LIB_PATHS': libPath,
      'NODEBUG': 'true',
      'USETMPDIR': appData.useTmpDir,
      'DBPATH': appData.dbPath,
      'GAMS_SYS_DIR': await gamspath,
      'LOGPATH': await logpath,
      'LAUNCHINBROWSER': await launchExternal,
      'GMSMODE': appData.mode === 'hcube'? 'hcube': 'base',
      'GMSMODELNAME': path.join(appDataPath, appData.id, 
        `${appData.id}.gms`)},
       stdio: 'inherit' }).catch((e) => {
        shinyProcessAlreadyDead = true
        onError(e)
      })
  const url = `http://127.0.0.1:${shinyPort}`
  await waitFor(1000)
  for (let i = 0; i <= 25; i++) {
    if (shinyProcessAlreadyDead) {
      break
    }
    await waitFor(1000)
    try {
      const res = await http.head(url, {timeout: 1000})
      // TODO: check that it is really shiny and not some other webserver
      if (res.status === 200) {
        await progressCallback({
          code: 'success', port: shinyPort})
        shinyRunning = true
        onSuccess(url)
        return
      }
    } catch (e) {
      log.debug(`Process: ${internalPid} not responding after ${i + 1} seconds.`);
      if ( i > 5 ) {
        await progressCallback({
        code: 'notresponding'})
      }
    }
  }
  await onErrorStartup(appData.id);
  try {
    miroProcesses[internalPid].kill()
  } catch (e) {}
}

function launchApp ( appData ) {
  if ( !appData.id ) {
    log.error('Launch app request was submitted but no app ID transmitted.');
    showErrorMsg({
        type: 'error',
        title: 'Unexpected error',
        message: 'No MIRO app configuration was found. If this problem persists, please contact GAMS!'
    });
    return;
  }

}

let newAppConf

function validateMIROApp ( filePath ) {
    log.debug(`Validating new MIRO app (filePath: ${filePath}).`);
    filePath = filePath.filter( el => el.toLowerCase().endsWith('.miroapp') )
    if ( filePath.length === 0 ) {
      log.error('Validation of MIRO app failed due to invalid file path.');
      return showErrorMsg({
            type: 'info',
            title: 'Invalid MIRO app file',
            message: 'The file you selected is not a valid MIRO app!'
        });
    } else if ( filePath.length > 1 ) {
      log.error('Validation of MIRO app failed due to invalid file path.');
      return showErrorMsg({
            type: 'info',
            title: 'Invalid MIRO app file',
            message: 'Please drop only a single MIRO app file!'
        });
    }
    try {
      yauzl.open(filePath[0], (err, zipfile) => {
        let appFileNames = [];
        const incAmt = 0.8/zipfile.entryCount;
        let fileCnt = 0;
        let skipCnt = 0;
        newAppConf = {
          modesAvailable: [],
          useTmpDir: true
        }
        if (err) throw err;
        zipfile.on('error', (err) => {
          log.error(`MIRO app could not be extracted. Error message: ${err.message}.`);
          throw err;
        });
        zipfile.on('entry', (entry) => {
          if ( !mainWindow ) {
            zipfile.close()
          }
          mainWindow.setProgressBar(++fileCnt * incAmt);
          appFileNames.push(entry.fileName);
          if ( skipCnt < 2 ) {
            if ( path.dirname(entry.fileName) === 'static' ) {
              const logoExt = entry.fileName.toLowerCase().match(/.*_logo\.(jpg|jpeg|png)$/);
              if ( logoExt ) {
                newAppConf.logoPath = entry.fileName;
                log.debug('Logo in new MIRO app found.');
                const logoPathTmp = path.join(app.getPath('temp'), `logo.${logoExt[1]}`);
                zipfile.openReadStream(entry, function(err, readStream) {
                  if (err) throw err;
                  readStream.pipe(fs.createWriteStream(logoPathTmp));
                  readStream.on('end', () => {
                    newAppConf.logoPathTmp = logoPathTmp;
                    if ( mainWindow ) {
                      mainWindow.webContents.send('validated-logo-received', {path: logoPathTmp});
                    }
                  });
                });
                skipCnt++
              }
            } else if ( entry.fileName === '.no_tmp' ) {
              log.debug('no_tmp indicator in in new MIRO app found.');
              newAppConf.useTmpDir = false;
              skipCnt++
            }
          }
        });
        zipfile.once('end', () => {
          log.debug('New MIRO app extracted successfully.');
          if ( !mainWindow ) {
            return
          }
          let errMsg
          const errMsgTemplate = 'The MIRO app you want to add is invalid. Please make sure to upload a valid MIRO app!'
          const miroConfFormat = /(.*)_(\d+)_(\d+\.\d+\.\d+)(_hcube)?\.miroconf$/;
          for ( const fileName of appFileNames ) {
            if ( fileName.endsWith('.miroconf') ) {
              const miroConfMatch = fileName.match(miroConfFormat);
              if ( miroConfMatch && miroConfMatch[1].length ) {
                newAppConf.path = filePath[0];
                newAppConf.id = miroConfMatch[1];
                newAppConf.APIVersion = parseInt(miroConfMatch[2], 10);
                newAppConf.MIROVersion = miroConfMatch[3];
                log.info(`New MIRO app successfully identified. Id: ${newAppConf.path}, \
API version: ${newAppConf.APIVersion}, \
MIRO version: ${newAppConf.MIROVersion}.`);
                if ( miroConfMatch[4] ) {
                  log.debug('Hypercube configuration in new MIRO app found.');
                  newAppConf.modesAvailable.push('hcube');
                } else {
                  log.debug('Base mode configuration in new MIRO app found.');
                  newAppConf.modesAvailable.push('base')
                }
                break
              } else {
                log.debug(`Invalid MIROconf file found in new MIRO app: ${fileName}.`);
                errMsg = errMsgTemplate;
                break
              }
            }
          }
          mainWindow.setProgressBar(0.9);
          if ( !mainWindow ){
            return
          }
          if ( !newAppConf.id || errMsg ) {
            mainWindow.setProgressBar(-1);
            showErrorMsg({
                type: 'info',
                title: 'Invalid app',
                message: errMsgTemplate
            });
            return
          }
          if ( !newAppConf.APIVersion ||
            newAppConf.APIVersion < minAPIVersion ) {
            mainWindow.setProgressBar(-1);
            showErrorMsg({
                type: 'info',
                title: 'MIRO app incompatible',
                message: 'The MIRO app you want to add is not compatible \
with the MIRO version you installed. Please ask the developer of the app \
to update it and try again!'
            });
            return;
          }
          if ( !mainWindow ){
            return
          }

          mainWindow.setProgressBar(-1);
          if ( mainWindow ) {
            log.debug('New MIRO app configuration sent to renderer process.')
            mainWindow.webContents.send('app-validated', newAppConf)
          }
        });
      })
    } catch (e) {
      log.debug(`Problems extracting and validating new MIRO app. Error message: ${e.message}`);
      if ( mainWindow ) {
        mainWindow.setProgressBar(-1);
      }
      showErrorMsg({
          type: 'error',
          title: 'Unexpected error',
          message: `There was a problem reading the MIRO app file. Error message: '${e.message}'`
      });
    }
}

function validateAppLogo(filePath, id = null){
  log.debug(`Request to validate MIRO app logo received (file path: ${filePath}, id: ${id}).`);
    const filteredPath = filePath.filter( el => el
        .toLowerCase()
        .match(/\.(jpg|jpeg|png)$/) );
    if ( filteredPath.length === 0 ) {
      log.info('App logo not valid due to bad format.');
      showErrorMsg({
            type: 'info',
            title: 'Invalid MIRO app logo',
            message: 'The file you selected is not a valid MIRO logo. Only jpg/jpeg and png supported!'
        })
       return
    } else if ( filteredPath.length > 1 ) {
      log.info('App logo not valid due to multiple files being dropped.');
      showErrorMsg({
            type: 'info',
            title: 'Invalid MIRO app logo',
            message: 'Please drop only a single MIRO app logo!'
        })
      return
    }
    const logoSize = fs.statSync(filteredPath[0]).size / 1000000.0;
    if ( logoSize > 10 ) {
      log.info(`App logo not valid due to file size being too large (${logoSize}MB)`);
      showErrorMsg({
            type: 'info',
            title: 'Logo too large',
            message: 'Logos must not be larger than 10MB!'
        })
        return
    }
    log.info('MIRO app logo successfully validate.');
    mainWindow.webContents.send('validated-logopath-received', 
      {id: id, path: filteredPath[0]});
}

function activateEditMode( openNewAppForm = false ){
  log.debug(`Activating edit mode. Open 'new app' form: ${openNewAppForm}.`);
  if ( mainWindow ) {
    mainWindow.send('activate-edit-mode', openNewAppForm);
  }
}

const btAddApp = new TouchBarButton({
  label: '➕ Add MIRO app',
  backgroundColor: '#F39619',
  click: () => {
    log.debug(`Add new MIRO app button clicked on TouchBar.`);
    activateEditMode(true);
  }
})
const btManageApps = new TouchBarButton({
  label: '⚙️ Edit apps',
  click: () => {
    log.debug(`Edit apps button clicked on TouchBar.`);
    activateEditMode();
  }
})
const mainWindowTouchBar = new TouchBar({
  items: [
    btAddApp,
    btManageApps
  ]
});
const dockMenu = Menu.buildFromTemplate([
  {
    label: '➕ Add MIRO app',
    click: () => {
          log.debug(`Add new MIRO app button clicked in dock menu.`);
          activateEditMode(true);
        }
  },
  {
    label: '⚙️ Edit apps',
    click: () => {
          log.debug(`Edit apps button clicked in dock menu.`);
          activateEditMode();
        }
  }
]);

let mainWindow
let settingsWindow
let fileToOpen
let appLoaded = false;

function createSettingsWindow() {
  log.debug('Creating settings window..');
  if ( settingsWindow ) {
    log.debug('Settings window already open.');
    settingsWindow.show();
    return;
  }
  settingsWindow = new BrowserWindow({
    title: 'Settings',
    width: 570,
    height: 675,
    resizable: DEVELOPMENT_MODE,
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      nodeIntegration: true
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 
    'renderer', 'settings.html'));

  settingsWindow.once('ready-to-show', async () => {
    log.debug('Settings window ready to show.');
    settingsWindow.webContents.send('settings-loaded', 
      await configData.getAll(), 
      await configData.getAll(true));
    log.debug('Settings window settings loaded.');
    settingsWindow.show();
  })
  if ( DEVELOPMENT_MODE ) {
     settingsWindow.webContents.openDevTools();
  }
  settingsWindow.on('page-title-updated', (e) => {
    e.preventDefault();
  });

  settingsWindow.on('closed', () => {
    log.debug('Settings window closed.');
    settingsWindow = null
  })
}
function createMainWindow () {
  log.debug('Creating main window..');
  if ( mainWindow ) {
    log.debug('Main window already open.');
    mainWindow.show();
    return;
  }
  mainWindow = new BrowserWindow({
    title: 'GAMS MIRO',
    width: 900,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true
    }
  })
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  mainWindow.once('ready-to-show', () => {
    log.debug('Main window ready to show.');
    mainWindow.show();
  })
  if ( DEVELOPMENT_MODE ) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('apps-received', 
      appsData.apps, appDataPath, true);
    log.debug(`App data (${appsData.apps.length} app(s)) loaded into main window.`);
    if ( appLoaded ) {
      return;
    }
    appLoaded = true;
    if (process.platform == 'win32' && 
      process.argv.length >= 2 && !DEVELOPMENT_MODE ) {
      log.debug(`MIRO launcher opened by double clicking MIRO app at path: ${process.argv[1]}.`);
      activateEditMode();
      validateMIROApp([process.argv[1]]);
    }else if( fileToOpen ) {
      activateEditMode();
      log.debug(`MIRO launcher opened by double clicking MIRO app at path: ${fileToOpen}.`);
      validateMIROApp([fileToOpen]);
    }
  });
  mainWindow.setTouchBar(mainWindowTouchBar);
  if ( isMac ) {
    app.dock.setMenu(dockMenu);
  }
  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault();
  });
  mainWindow.on('closed', () => {
    log.debug('Main window closed.');
    mainWindow = null
  })
}

let miroAppWindows = []

async function createMIROAppWindow(appData) {
  log.debug(`Request to launch MIRO app with id: ${appData.id} received.`);
  const progressCallback = async (event) => {
    log.info(event);
  }
  if ( processIdMap[appData.id] != null ) {
    log.info(`Process with internal pid: ${processIdMap[appData.id]} already running for MIRO app: ${appData.id}`);
    mainWindow.send('hide-loading-screen', appData.id);
    showErrorMsg({
      type: 'info',
      title: 'App running',
      message: 'A MIRO process is already running for your app. Currently, only one instance per app can be launched at a time.'
    });
    return;
  }
  const rpath = await configData.get('rpath');
  if ( !rpath ) {
    log.info('No R path set.');
    mainWindow.send('hide-loading-screen', appData.id);
    mainWindow.send('invalid-r');
    return;
  }
  if ( process.platform === 'linux' && rPackagesInstalled !== true) {
    log.info('MIRO app launch requested without packages being installed.');
    mainWindow.send('hide-loading-screen', appData.id);
    rPackagesInstalled = installRPackages(rpath, libPath, mainWindow);
    return;
  }

  const onErrorLater = async (appID) => {
    log.debug(`Error after launching MIRO app with ID: ${appData.id}.`);
    if ( !miroAppWindows[appID] ) {
      return
    }
    if ( mainWindow ) {
      mainWindow.send('hide-loading-screen', appData.id);
      showErrorMsg({
        type: 'error',
        title: 'Unexpected error',
        message: 'The MIRO app could not be started. Please report to GAMS when this problem persists!'
      });
    }
    miroProcesses[processIdMap[appID]] = null;
    delete processIdMap[appID];
    miroAppWindows[appID].destroy();
  }

  const onErrorStartup = async (appID, message) => {
    log.debug(`Error during startup of MIRO app with ID: ${appData.id}.\
${message? `Message: ${message}` : ''}`);
    if ( mainWindow ) {
      mainWindow.send('hide-loading-screen', appData.id);
    }
    showErrorMsg({
        type: 'error',
        title: 'Unexpected error',
        message: message? message: 'The MIRO app could not be started. Please report to GAMS when this problem persists!'
    });
    miroProcesses[processIdMap[appID]] = null;
    delete processIdMap[appID];
  }

  const onProcessFinished = async(appID) => {
    const internalPid = processIdMap[appID];
    if ( !Number.isInteger(internalPid) || !miroProcesses[internalPid] ) {
      return;
    }
    try {
      await miroProcesses[internalPid];
    } catch (e) {
      log.error(`Problems while waiting for process of MIRO app with ID: ${appID}\
to finish. Error message: ${e.message}`)
    }
    log.debug(`Process of MIRO app with ID: ${appID} and internal pid ${internalPid} ended.`);
    miroProcesses[processIdMap[appID]] = null;
    delete processIdMap[appID];
    if ( mainWindow ) {
      mainWindow.send('app-closed', appID);
    }
  }
  try {
    await tryStartWebserver(progressCallback, onErrorStartup, onErrorLater, appData, rpath, (url) => {
      if ( configData.getSync('launchExternal') === true ) {
        log.debug(`MIRO app with ID: ${appData.id} being opened in external browser.`);
        if ( mainWindow ) {
          mainWindow.send('hide-loading-screen', appData.id, true);
          onProcessFinished(appData.id)
        }
        return;
      }
      const appID = appData.id;
      log.debug(`MIRO app with ID: ${appID} being opened in launcher.`);
      miroAppWindows[appID] = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      miroAppWindows[appID].loadURL(url)

      miroAppWindows[appID].on('close', (e) => {
        e.preventDefault();
        log.debug(`Window of MIRO app with ID: ${appID} closed.`);
        miroAppWindows[appID].destroy();
      });

      miroAppWindows[appID].on('closed', () => {
        if ( mainWindow ) {
          mainWindow.send('app-closed', appID);
        }
        const internalPid = processIdMap[appID];
        if ( Number.isInteger(internalPid) ) {
          try {
            miroProcesses[internalPid].kill('SIGTERM', {
              forceKillAfterTimeout: 2000
            });
          } catch (e) {}
          miroProcesses[internalPid] = null;
        }
        delete processIdMap[appID];
        miroAppWindows[appID] = null;
      })
      miroAppWindows[appID].once('ready-to-show', () => {
        miroAppWindows[appID].show();
        miroAppWindows[appID].maximize();
        log.debug(`Window for MIRO app with ID: ${appID} created.`);
        if ( mainWindow ) {
          mainWindow.send('hide-loading-screen', appID, true);
          onProcessFinished(appID);
        }
      });
    })
  } catch (e) {
    onErrorStartup(appData.id, `Problems launching MIRO app.\
 Error message: ${e.message}.`);
  }
}

function showErrorMsg (options) {
  if ( mainWindow ){
    dialog.showMessageBoxSync(mainWindow, options)
  }  
}
ipcMain.on('show-error-msg', (e, options) => {
  log.debug(`New error message received. Title: ${options.title}, message: ${options.message}.`);
  showErrorMsg(options)
})

ipcMain.on('browse-app', (e, options, callback, id = null) => {
  const filePaths = dialog.showOpenDialogSync(mainWindow, options)
  if ( filePaths ) {
    if( callback === 'validateLogo' ) {
      validateAppLogo(filePaths, id);
    } else if( callback === 'validateApp' ) {
      validateMIROApp(filePaths);
    } else {
      e.reply(callback, {id: id, path: filePaths});
    }
  }
})

ipcMain.on('add-app', (e, app) => {
  log.debug('Add app request received.');
  try {
     if ( !appsData.isUniqueId(app.id) ) {
       throw new Error('DuplicatedId');
     }
     let appConf = app;
     const appDir = path.join(appDataPath, appConf.id)
     unzip(appConf.path, appDir, () => {
       delete appConf.path;
       if ( appConf.logoNeedsMove ) {
        const newLogoPath = path.join('static', 
          appConf.id + '_logo' + path.extname(appConf.logoPath));
         fs.copyFileSync(appConf.logoPath, path.join(appDir, newLogoPath));
         appConf.logoPath = newLogoPath;
         delete appConf.logoNeedsMove;
       }
       const updatedApps = appsData.addApp(appConf).apps;
       mainWindow.send('apps-received', updatedApps, appDataPath);
     });
  } catch (e) {
    log.error(`Add app request failed. Error message: ${e.message}`);
     if ( e.message === 'DuplicatedId' ) {
        dialog.showMessageBoxSync(mainWindow, {
          type: 'info',
          title: 'Model exists',
          message: 'A model with the same name already exists. Please first delete this model before trying again.'
        })
        return
     } else if ( e.code === 'EACCES' ) {
         dialog.showMessageBoxSync(mainWindow, {
            type: 'error',
            title: 'No write permissions',
            message: `Model could not be saved as you don't have permissions\
 to write to this location: '${configData.getConfigPath()}.'`
          });
     return
     }
     dialog.showMessageBoxSync(mainWindow, {
        type: 'error',
        title: 'Unexpected error',
        message: `An unexpected error occurred. Error message: '${e.message}'`
      })
     return
  }
});
ipcMain.on('update-app', (e, app) => {
  log.debug('Update app request received.');
  try{
     let appConf = app;
     if ( appConf.logoNeedsMove ) {
      const newLogoPath = path.join('static', 
        appConf.id + '_logo' + path.extname(appConf.logoPath));
       fs.copyFileSync(appConf.logoPath, path.join(appDataPath, appConf.id, newLogoPath));
       appConf.logoPath = newLogoPath;
       delete appConf.logoNeedsMove;
     }
     const updatedApps = appsData.updateApp(appConf).apps;
     mainWindow.send('apps-received', updatedApps, appDataPath);
  } catch (e) {
    log.error(`Update app request failed. Error message: ${e.message}`);
     dialog.showMessageBoxSync(mainWindow, {
        type: 'error',
        title: 'Unexpected error',
        message: `An unexpected error occurred. Error message: '${e.message}'`
      })
     return
  }
});
[ 'gams', 'r' ].forEach((el) => {
  ipcMain.on(`validate-${el}`, async (e, pathToValidate) => {
    const idUpper = el.toUpperCase();
    log.debug(`Request to validate ${idUpper} path at location: ${pathToValidate} received.`);
    try {
      if ( await configData.validate(el, pathToValidate) !== false && settingsWindow ) {
        log.debug(`${idUpper} path is valid!`);
        settingsWindow.webContents.send(`${el}path-validated`, pathToValidate);
      } else {
        log.debug(`${idUpper} path is invalid!`);
        dialog.showMessageBoxSync(settingsWindow, 
        {
          type: 'error',
          title: `${idUpper} path invalid`,
          message: `The path you selected is not a valid ${idUpper} path. \
Note that in order to run MIRO at least ${idUpper} version \
${configData.getMinimumVersion(el)} is required.`
        });
      }
    } catch (e) {
      log.error(`Error while validating ${idUpper} version. Error message: ${e.message}`);
      if ( settingsWindow ) {
         dialog.showMessageBoxSync(settingsWindow, 
        {
          type: 'error',
          title: 'Unexpected error',
          message: `An unexpected error occurred while validating the ${idUpper} path you selected. \
    Error message: ${e.message}.`
        });
       }
    }
  });
});

ipcMain.on('save-path-config', async (e, newConfigData, needRestart) => {
  log.debug('Save path config request received.');
  try {
    configData.set(newConfigData);
    if ( settingsWindow ){
      if ( needRestart === true ) {
        dialog.showMessageBoxSync(settingsWindow, 
        {
          type: 'info',
          title: 'Configuration updated',
          message: 'Your configuration has been updated successfully. MIRO is restarted to apply your changes.'
        });
        app.relaunch();
        app.exit();
      } else {
        settingsWindow.webContents.send('settings-loaded', 
        await configData.getAll(),
        await configData.getAll(true));
        dialog.showMessageBoxSync(settingsWindow, 
           {
             type: 'info',
             title: 'Configuration updated',
             message: 'Your configuration has been updated successfully.'
           });
      }
    }
  } catch (e) {
    log.info(`Save path config request failed. Error message: ${e.message}`);
    if ( settingsWindow ){
      dialog.showMessageBoxSync(settingsWindow, 
      {
        type: 'error',
        title: 'Unexpected error',
        message: `Configuration data could not be saved.\
 Do you miss write permissions in this location: ${configData.getConfigPath()}?`
      })
    } 
  }
});
ipcMain.on('validate-app', (e, filePath) => {
  validateMIROApp(filePath);
});
ipcMain.on('validate-logo', (e, filePath, id) => {
  validateAppLogo(filePath, id);
});
ipcMain.on('delete-app', (e, appId) => {
  log.debug(`Delete app (ID: ${appId}) request received`);
  const deleteAppConfirmedId = dialog.showMessageBoxSync(mainWindow, {
   buttons: [ 'Remove', 'Cancel' ],
   message: 'Are you sure you want to permanently remove the app?'
  });
  if ( deleteAppConfirmedId !== 0 ) {
    return
  }
  try {
    const updatedApps = appsData.deleteApp(appId).apps;
    mainWindow.send('apps-received', updatedApps, appDataPath);
    log.debug(`App: ${appId} removed.`);
  } catch (e) {
    log.error(`Delete app (ID: ${appId}) request failed. Error message: ${e.message}`);
  }
});

ipcMain.on('launch-app', (e, appData) => {
  createMIROAppWindow(appData);
});

app.on('will-finish-launching', () => {
  app.on('open-file', (e, path) => {
    e.preventDefault();
    if ( appLoaded ) {
      activateEditMode();
      validateMIROApp(filePath);
      return;
    }
    fileToOpen = path;
  });
});

app.on('ready', async () => {
  if ( errMsg ) {
    dialog.showMessageBoxSync({
      type: 'error',
      title: 'Error initialising MIRO',
      message: errMsg
    });
    app.quit();
    return;
  }
  configData.removeOldLogs();
  session.defaultSession.webRequest.onHeadersReceived((_, callback) => {
    callback({
      responseHeaders: `
        default-src 'none';
        script-src 'self';
        img-src 'self' data:;
        style-src 'self';
        font-src 'self';
      `})
  })

  // Deny all permission requests
  session.defaultSession.setPermissionRequestHandler((_1, _2, callback) => {
    callback(false)
  });
  Menu.setApplicationMenu(menu(activateEditMode, 
    createSettingsWindow));
  createMainWindow();
  log.info('MIRO launcher started successfully.');

  if ( 
    fs.readdir(path.join(libPath, '..'), (err, items) => {
      if (err) throw err;
      log.info(items);
      items.find(item => item === 'library_src')}) ) {
    try{
      rPackagesInstalled = installRPackages(
        await configData.get('rpath'), libPath, mainWindow);
    } catch(e) {
      log.error(`Problems creating prompt to install R packages. Error message: ${e.message}.`)
    }
  }
});

app.on('window-all-closed', () => {
  log.debug('All windows closed.');
  if (process.platform !== 'darwin') {
    shutdown = true
    miroProcesses.forEach(function(miroProcess) {
      if ( !miroProcess ) {
        return;
      }
      try {
        miroProcess.kill('SIGTERM', {
           forceKillAfterTimeout: 2000
       });
       } catch (e) {}
     });
    app.quit()
  }
});

app.on('activate', () => {
  log.debug('Main window activated.');
  if (mainWindow === null) {
    createMainWindow()
  }
});
