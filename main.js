'use strict'
const { app, BrowserWindow, Menu, TouchBar, ipcMain, dialog, session, systemPreferences } = require('electron');
const { TouchBarLabel, TouchBarButton, TouchBarSpacer } = TouchBar;
const path  = require('path');
const fs    = require('fs-extra');
const yauzl = require('yauzl');
const http = require('axios');
const execa = require('execa');
const util = require('util');
const kill = util.promisify(require('tree-kill'));
const log = require('electron-log');
const menu = require('./components/menu.js');
const installRPackages = require('./components/install-r.js');
const requiredAPIVersion = 1;
const miroVersion = '0.9.31';
const libVersion = '1.0';
const exampleAppsData = [
  {
    id: 'pickstock',
    title: 'Stock Selection Optimization',
    description: `Optimization model to pick a small subset of the stocks together with \
some weights, such that this portfolio has a similar behavior to our \
overall Dow Jones index.`,
    logoPath: path.join('static_pickstock', 'pickstock.png'),
    miroversion: miroVersion,
    apiversion: requiredAPIVersion,
    usetmpdir: true,
    modesAvailable: [ 'base', 'hcube' ]
  },
  {
    id: 'transport',
    title: 'Transportation problem',
    description: `This problem finds a least cost shipping schedule that meets
requirements at markets and supplies at factories.`,
    miroversion: miroVersion,
    apiversion: requiredAPIVersion,
    usetmpdir: true,
    modesAvailable: [ 'base', 'hcube' ]
  }];

const AppDataStore = require('./AppDataStore');
const ConfigManager = require('./ConfigManager');
const unzip     = require('./Unzip');
const { randomPort, waitFor, isNull } = require('./helpers');

const isMac = process.platform === 'darwin';
const DEVELOPMENT_MODE = !app.isPackaged;
const miroWorkspaceDir = path.join(app.getPath('home'), '.miro');
const miroBuildMode = process.env.MIRO_BUILD === 'true';
const miroDevelopMode = process.env.MIRO_DEV_MODE === 'true' || miroBuildMode;
if ( !DEVELOPMENT_MODE ) {
  log.transports.console.level = false;
}
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
   new AppDataStore(configData.getConfigPath());

const resourcesPath = DEVELOPMENT_MODE? app.getAppPath(): process.resourcesPath;

let shutdown = false
let miroProcesses = [];
const processIdMap = {};

let rPackagesInstalled = true;
let libPath = path.join(appRootDir, 'r', 'library');

const miroResourcePath = DEVELOPMENT_MODE? path.join(app.getAppPath(), 'miro'):
   path.join(process.resourcesPath, 'miro');

log.info(`MIRO launcher is being started (rootDir: ${appRootDir}, pid: ${process.pid}, \
platform: ${process.platform}, arch: ${process.arch}, \
version: ${process.getSystemVersion()})...`);

// enable overlay scrollbar
app.commandLine.appendSwitch('--enable-features', 'OverlayScrollbar')

/*
MIT License

Copyright (c) 2018 Dirk Schumacher, Noam Ross, Rich FitzJohn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const tryStartWebserver = async (progressCallback, onErrorStartup,
  onErrorLater, appData, rpath, onSuccess) => {
  let internalPid = processIdMap[appData.id];

  if ( internalPid ) {
    log.error('Process for this model already running. This should not happen. Reference not freed.');
    return;
  }
  internalPid = miroProcesses.findIndex(isNull);
  if ( internalPid === -1 ) {
    internalPid = miroProcesses.length;
  }
  log.debug(`Request to start web server with internal pid: ${internalPid} submitted.`);
  processIdMap[appData.id] = internalPid;
  if (miroProcesses[internalPid] != null) {
    await onErrorStartup(appData.id)
    return
  }
  let shinyPort = randomPort();
  log.debug(`Process: ${internalPid} is being started on port: ${shinyPort}.`);
  const gamspath = configData.get('gamspath');
  const logpath = configData.get('logpath');
  const generalConfig = {
    launchExternal: configData.get('launchExternal'),
    language: configData.get('language'),
    logLevel: configData.get('logLevel')
  }
  await progressCallback({internalPid: internalPid, code: 'start'})

  let shinyRunning = false

  const onError = async (e) => {
    if ( miroProcesses[internalPid] === null ) {
      return;
    }
    log.error(`Process: ${internalPid} crashed during startup. Stdout: ${e.stdout}.\nStderr: ${e.stderr}`);
    miroProcesses[internalPid] = null;
    delete processIdMap[appData.id];
    if ( miroBuildMode || miroDevelopMode ) {
      log.debug(`Exiting with error code: ${e.exitCode}.`)
      app.exit(e.exitCode)
    } else if ( mainWindow ) {
      mainWindow.send('hide-loading-screen', appData.id);
      showErrorMsg({
        type: 'error',
        title: 'Unexpected error',
        message: 'The MIRO app could not be started. Please report to GAMS when this problem persists!'
      });
    }
  }

  let shinyProcessAlreadyDead = false
  let noError = false
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
      'NODEBUG': !miroDevelopMode,
      'MIRO_USE_TMP': appData.usetmpdir,
      'DBPATH': appData.dbPath,
      'MIRO_BUILD': miroBuildMode,
      'MIRO_BUILD_ARCHIVE':  appData.buildArchive === 'true',
      'GAMS_SYS_DIR': await gamspath,
      'LOGPATH': await logpath,
      'LAUNCHINBROWSER': await generalConfig.launchExternal,
      'MIRO_LANG': await generalConfig.language,
      'MIRO_LOG_LEVEL': await generalConfig.logLevel,
      'MIRO_VERSION_STRING': appData.miroversion,
      'MIRO_MODE': appData.mode? appData.mode: 'base',
      'MIRO_MODEL_PATH': miroDevelopMode? appData.modelPath:
       path.join(appDataPath, appData.id, `${appData.id}.gms`)},
       stdout: miroDevelopMode? 'inherit': 'pipe',
       stderr: miroDevelopMode? 'inherit': 'pipe',
       cleanup: false
     });
  miroProcesses[internalPid].catch((e) => {
    shinyProcessAlreadyDead = true
    onError(e)
  }).then(async () => {
    shinyProcessAlreadyDead = true
    noError = true
    if ( miroBuildMode ) {
      app.exit(0)
    }
  });
  const url = `http://127.0.0.1:${shinyPort}`;
  await waitFor(1000)
  for (let i = 0; i <= 50; i++) {
    if (shinyProcessAlreadyDead) {
      if ( noError ) {
          return;
      }
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
          usetmpdir: true
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
          if ( skipCnt < 1 ) {
            if ( path.dirname(entry.fileName).startsWith('static_') ) {
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
          const miroConfFormat = /(.*)_(\d)_(\d+)_(\d+\.\d+\.\d+)(_hcube)?\.miroconf$/;
          let skipCnt = 0;
          for ( const fileName of appFileNames ) {
            if ( skipCnt > 1 ) {
              break
            }
            if ( fileName.endsWith('.miroconf') ) {
              const miroConfMatch = fileName.match(miroConfFormat);
              if ( miroConfMatch && miroConfMatch[1].length ) {
                if ( miroConfMatch[5] ) {
                  log.debug('Hypercube configuration in new MIRO app found.');
                  newAppConf.modesAvailable.push('hcube');
                } else {
                  log.debug('Base mode configuration in new MIRO app found.');
                  newAppConf.modesAvailable.push('base')
                }
                if ( newAppConf.id ) {
                  skipCnt++
                  continue
                }
                newAppConf.path = filePath[0];
                newAppConf.id = miroConfMatch[1];
                newAppConf.usetmpdir = miroConfMatch[2] === '1';
                newAppConf.apiversion = parseInt(miroConfMatch[3], 10);
                newAppConf.miroversion = miroConfMatch[4];
                log.info(`New MIRO app successfully identified. Id: ${newAppConf.path}, \
API version: ${newAppConf.apiversion}, \
MIRO version: ${newAppConf.miroversion}.`);
                skipCnt++
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
          if ( !newAppConf.apiversion ||
            newAppConf.apiversion !== requiredAPIVersion ) {
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
function addExampleApps(){
  try {
    exampleAppsData.forEach((exampleApp) => {
      if ( !appsData.isUniqueId(exampleApp.id) ) {
        throw exampleApp.id;
      }
    });
  } catch (e) {
     return showErrorMsg({
      type: 'info',
        title: 'Model exists',
        message: `A model with the name: ${e} already exists. \
Please first delete this model before trying again.`
    });
  }
  fs.copy(path.join(miroResourcePath, 'examples'), 
    appDataPath, (e) => {
       if (e) {
        log.error(`Unexpected error while copying example apps from: \
${path.join(miroResourcePath, 'examples')} to: ${appDataPath}. Error mesage: ${e.message}`);
        if ( e.code === 'EACCES' ) {
         showErrorMsg({
            type: 'error',
            title: 'No write permissions',
            message: `Model could not be added as you don't have permissions\
      to write to this location: '${appDataPath}.'`
          });
         return
        }
        return showErrorMsg({
            type: 'error',
            title: 'Unexpected error',
            message: `An unexpected error occurred. Error message: '${e.message}'`});
      };
      try {
        exampleAppsData.forEach((exampleApp) => {
            appsData.addApp(exampleApp);
        });
        const updatedApps = appsData.getApps();
        mainWindow.send('apps-received', updatedApps, appDataPath);
      } catch (e) {
        log.error(`Problems writing app data: \
    ${path.join(miroResourcePath, 'examples')} to: ${appDataPath}. Error mesage: ${e.message}`);
        if ( e.code === 'EACCES' ) {
         showErrorMsg({
            type: 'error',
            title: 'No write permissions',
            message: `Model could not be added as you don't have permissions\
    to write to this location: '${configData.getConfigPath()}.'`
          });
          return
        }
        return showErrorMsg({
            type: 'error',
            title: 'Unexpected error',
            message: `An unexpected error occurred. Error message: '${e.message}'`});
      }
  });
}
function activateEditMode( openNewAppForm = false, scrollToBottom = false ){
  log.debug(`Activating edit mode. Open 'new app' form: ${openNewAppForm}.`);
  if ( mainWindow ) {
    mainWindow.send('activate-edit-mode', openNewAppForm, scrollToBottom);
  }
}

const btAddApp = new TouchBarButton({
  label: '➕ Add MIRO app',
  backgroundColor: '#F39619',
  click: () => {
    log.debug(`Add new MIRO app button clicked on TouchBar.`);
    activateEditMode(true, true);
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
          activateEditMode(true, true);
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
    title: 'Preferences',
    width: 570,
    height: 620,
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
async function terminateProcesses () {
  shutdown = true
  for (let i = 0; i < miroProcesses.length; i++) {
     if ( !miroProcesses[i] ) {
      return;
    }
    const pid = miroProcesses[i].pid;
    try{
      kill(pid)
      log.debug(`R process with pid: ${pid} killed.`);
    } catch ( e ) {
      log.debug(`Problems killing R process with pid: ${pid}. Error message: ${e.message}`);
    }
    miroProcesses[i] = null;
  }
}
function quitLauncher () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
}
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, argv, cwd) => {
    log.debug('Second MIRO instance launched.');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if ( process.platform == 'win32' &&
        argv.length >= 2 && !DEVELOPMENT_MODE && !miroDevelopMode ) {
        const newMiroAppPath = argv[argv.length - 1];
        if ( newMiroAppPath.startsWith('--') ) {
          return;
        }
        log.debug(`MIRO launcher opened by double clicking MIRO app at path: ${newMiroAppPath}.`);
        activateEditMode(false, true);
        validateMIROApp([newMiroAppPath]);
      }
    }
  });
}

function createMainWindow (showRunningApps = false) {
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
  mainWindow.webContents.on('did-finish-load', async () => {
    let appsActive = [];
    if ( showRunningApps ) {
      appsActive = Object.keys(processIdMap);
    }
    mainWindow.webContents.send('apps-received', 
      appsData.apps, appDataPath, true, true, appsActive);
    log.debug(`App data (${appsData.apps.length} app(s)) loaded into main window.`);
    if ( appLoaded || miroDevelopMode ) {
      return;
    }
    appLoaded = true;
    if ( process.platform == 'win32' &&
      process.argv.length >= 2 && !DEVELOPMENT_MODE ) {
      log.debug(`MIRO launcher opened by double clicking MIRO app at path: ${process.argv[1]}.`);
      activateEditMode(false, true);
      validateMIROApp([process.argv[1]]);
    } else if( fileToOpen ) {
      activateEditMode(false, true);
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
    quitLauncher();
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
  if ( !appData.apiversion ||
    parseInt(appData.apiversion, 10) !== requiredAPIVersion ) {
    log.info(`MIRO app: ${appData.id} has API version: ${appData.apiversion} \
and is incompatible with MIRO version installed which requires API version: \
${requiredAPIVersion}.`);
    mainWindow.send('hide-loading-screen', appData.id);
    showErrorMsg({
        type: 'info',
        title: 'MIRO app incompatible',
        message: 'The MIRO app you want to launch is not compatible \
with the MIRO version you installed. Please ask the developer of the app \
to update it and try again!'
    });
    return;
  }
  if ( process.platform === 'linux' && rPackagesInstalled !== true) {
    log.info('MIRO app launch requested without packages being installed.');
    mainWindow.send('hide-loading-screen', appData.id);
    rPackagesInstalled = await installRPackages(rpath, appRootDir, 
      libPath, mainWindow);
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
    if ( miroAppWindows[appID] ) {
      miroAppWindows[appID].destroy();
      miroAppWindows[appID] = null;
    }
    
    if ( miroDevelopMode ) {
      // in development mode terminate when R process finished
      app.exit(1);
      return;
    }
  }

  const onErrorStartup = async (appID, message) => {
    log.debug(`Error during startup of MIRO app with ID: ${appData.id}. \
${message? `Message: ${message}` : ''}`);
    if ( mainWindow && !miroDevelopMode) {
      mainWindow.send('hide-loading-screen', appData.id);
      showErrorMsg({
        type: 'error',
        title: 'Unexpected error',
        message: message? message: 'The MIRO app could not be started. Please report to GAMS when this problem persists!'
      });
    }
    if ( miroDevelopMode ) {
      // in development mode terminate when R process finished
      app.exit(1);
      return;
    }
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
    if ( miroDevelopMode ) {
      // in development mode terminate when R process finished
      app.exit(0);
      return;
    }
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
          onProcessFinished(appData.id);
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

      miroAppWindows[appID].on('closed', async () => {
        if ( mainWindow ) {
          mainWindow.send('app-closed', appID);
        }
        const internalPid = processIdMap[appID];
        if ( Number.isInteger(internalPid) ) {
            const pid = miroProcesses[internalPid].pid;
            miroProcesses[internalPid] = null;
            try{
              await kill(pid)
              log.debug(`R process with pid: ${pid} killed.`);
            } catch ( e ) {
              log.debug(`Problems killing R process with pid: ${pid}. Error message: ${e.message}`);
            }
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

function showErrorMsg (optionsTmp) {
  if ( mainWindow ){
    let options = optionsTmp;
    if ( !options.buttons ) {
      options.buttons = ['OK'];
    }
    dialog.showMessageBoxSync(mainWindow, options)
  }  
}
async function searchLibPath (devMode = false) {
  if ( process.platform === 'linux' ) {
    let libPathFiles = [];
    let libsInstalled = true;
    if ( fs.existsSync(libPath) ) {
      try {
        libPathFiles = await fs.promises.readdir(libPath);
        if ( libPathFiles.find(item => item === 'INSTALLING') ) {
          libsInstalled = false;
        }
      } catch (e) {
        log.error(`Problems reading libPath. Error message: ${e.message}.`);
        showErrorMsg({
          type: 'error',
          title: 'Unexpected error',
          message: 'The MIRO installation could not be started. Please check the log files and \
report to GAMS when this problem persists!'
        });
        return;
      }
    } else {
      libsInstalled = false;
      try {
        await fs.promises.mkdir(libPath, { recursive: true });
      } catch (e) {
        const libPathTmp = path.join(app.getPath('appData'), 'miro-library', libVersion);
        if ( fs.existsSync(libPathTmp) ) {
          try {
            libPathFiles = await fs.promises.readdir(libPathTmp);
            if ( libPathFiles.find(item => item === 'INSTALLING') ) {
              libsInstalled = false;
            } else {
              libsInstalled = true;
              libPath = libPathTmp;
              log.debug(`Libpath set to: ${libPath}`);
            }
          } catch (e) {
            log.error(`Problems reading libPath. Error message: ${e.message}.`);
            showErrorMsg({
              type: 'error',
              title: 'Unexpected error',
              message: 'The MIRO installation could not be started. Please check the log files and \
report to GAMS when this problem persists!'
            });
            return;
          }
        } else {
          libsInstalled = false;
        }
        if ( !libsInstalled ) {
          const installType = dialog.showMessageBoxSync(mainWindow, {
            type: 'info',
            title: 'Installation',
            message: `You don't have permissions to install libraries inside: \
${libPath}. \nWould you like to install MIRO locally instead (${libPathTmp})?\n \
In case you want to install MIRO globally, consider starting AppImage with sudo and --no-sandbox flag: \
sudo ./GAMS-MIRO-${miroVersion}.AppImage --no-sandbox`,
            buttons: ['Yes, local installation', 'No, quit']
          });
          if ( installType === 1 ) {
            app.exit(0);
            return;
          }
          try {
            await fs.promises.mkdir(libPathTmp, { recursive: true });
          } catch (e) {
            log.error(`Problems creating libPath: ${libPathTmp}. Error message: ${e.message}.`);
            showErrorMsg({
              type: 'error',
              title: 'Unexpected error',
              message: 'The MIRO installation could not be started. Please check the log files and \
report to GAMS when this problem persists!'
            });
            return;
          }
          libPath = libPathTmp;
          log.debug(`Libpath set to: ${libPath}`);
        }
      }
      if ( !libsInstalled ) {
        try {
          await fs.promises.writeFile(path.join(libPath, 'INSTALLING'),
            '', 'utf8');
        } catch (e) {
          fs.rmdirSync(libPath)
          log.error(`Could not write INSTALLING metadata file to: ${libPath}.\
     Error message: ${e.message}.`);
          return;
        }
      }
    }
    if ( !libsInstalled ) {
      try{
        rPackagesInstalled = await installRPackages(
          await configData.get('rpath'), appRootDir, 
          libPath, mainWindow, devMode);
      } catch(e) {
        log.error(`Problems creating prompt to install R packages. \
  Error message: ${e.message}.`)
      }
    }
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
        const newLogoPath = path.join(`static_${appConf.id}`, 
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
      showErrorMsg({
        type: 'info',
          title: 'Model exists',
          message: 'A model with the same name already exists. \
Please first delete this model before trying again.'
      });
      return
     } else if ( e.code === 'EACCES' ) {
      showErrorMsg({
            type: 'error',
            title: 'No write permissions',
            message: `Model could not be saved as you don't have permissions\
 to write to this location: '${configData.getConfigPath()}.'`})
      return
     }
     showErrorMsg({
        type: 'error',
        title: 'Unexpected error',
        message: `An unexpected error occurred. Error message: '${e.message}'`});
     return
  }
});
ipcMain.on('add-example-apps', (e) => {
  log.debug('Received request to add example apps.')
  addExampleApps();
});
ipcMain.on('update-app', (e, app) => {
  log.debug('Update app request received.');
  try{
     let appConf = app;
     if ( appConf.logoNeedsMove ) {
      const newLogoPath = path.join(`static_${appConf.id}`, 
        appConf.id + '_logo' + path.extname(appConf.logoPath));
      const newLogoPathFull = path.join(appDataPath, appConf.id, newLogoPath);
      if ( !fs.existsSync(path.dirname(newLogoPathFull)) ) {
        fs.mkdirSync(path.dirname(newLogoPathFull));
      }
       fs.copyFileSync(appConf.logoPath, newLogoPathFull);
       appConf.logoPath = newLogoPath;
       delete appConf.logoNeedsMove;
     }
     const updatedApps = appsData.updateApp(appConf).apps;
     mainWindow.send('apps-received', updatedApps, appDataPath);
  } catch (e) {
    log.error(`Update app request failed. Error message: ${e.message}`);
    if ( e.code === 'EACCES' ) {
      showErrorMsg({
        type: 'error',
        title: 'No write permissions',
        message: `Model could not be updated as you don't have permissions\
 to write to this location: '${configData.getConfigPath()}.'`
      });
      return
     }
     showErrorMsg({
      type: 'error',
        title: 'Unexpected error',
        message: `An unexpected error occurred. Error message: '${e.message}'`
      });
     return
  }
});
[ 'gams', 'r' ].forEach((el) => {
  ipcMain.on(`validate-${el}`, async (e, pathToValidate) => {
    const idUpper = el.toUpperCase();
    log.debug(`Request to validate ${idUpper} path at location: ${pathToValidate} received.`);
    try {
      const validatedPath = await configData.validate(el, pathToValidate);
      if ( validatedPath !== false && validatedPath != null && settingsWindow ) {
        log.debug(`${idUpper} path is valid!`);
        settingsWindow.webContents.send(`${el}path-validated`, validatedPath);
      } else {
        log.debug(`${idUpper} path is invalid!`);
        dialog.showMessageBoxSync(settingsWindow, 
        {
          type: 'error',
          title: `${idUpper} path invalid`,
          message: `The path you selected is not a valid ${idUpper} path. \
Note that in order to run MIRO at least ${idUpper} version \
${configData.getMinimumVersion(el)} is required.`,
          buttons: ['OK']
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
    Error message: ${e.message}.`,
          buttons: ['OK']
        });
       }
    }
  });
});

ipcMain.on('save-general-config', async (e, newConfigData, needRestart) => {
  log.debug('Save general config request received.');
  try {
    configData.set(newConfigData);
    if ( settingsWindow ){
      if ( needRestart === true ) {
        dialog.showMessageBoxSync(settingsWindow, 
        {
          type: 'info',
          title: 'Configuration updated',
          message: 'Your configuration has been updated successfully. MIRO is restarted to apply your changes.',
          buttons: ['OK']
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
             message: 'Your configuration has been updated successfully.',
             buttons: ['OK']
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
 Do you miss write permissions in this location: ${configData.getConfigPath()}?`,
        buttons: ['OK']
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
ipcMain.on('delete-app', async (e, appId) => {
  log.debug(`Delete app (ID: ${appId}) request received`);
  const deleteAppConfirmedId = dialog.showMessageBoxSync(mainWindow, {
   buttons: [ 'Remove', 'Cancel' ],
   message: 'Are you sure you want to permanently remove the app?'
  });
  if ( deleteAppConfirmedId !== 0 ) {
    return
  }
  try {
    const rmPromise = fs.remove(path.join(appDataPath, appId));
    const updatedApps = appsData.deleteApp(appId).apps;
    await rmPromise;
    mainWindow.send('apps-received', updatedApps, appDataPath, false, false);
    log.debug(`App: ${appId} removed.`);
  } catch (e) {
    log.error(`Delete app (ID: ${appId}) request failed. Error message: ${e.message}`);
    if ( e.code === 'EACCES' ) {
      showErrorMsg({
            type: 'error',
            title: 'No write permissions',
            message: `Model could not be removed as you don't have permissions\
 to write to this location: '${configData.getConfigPath()}.'`
          });
     return
     }
  }
});

ipcMain.on('launch-app', (e, appData) => {
  createMIROAppWindow(appData);
});

app.on('will-finish-launching', () => {
  app.on('open-file', (e, path) => {
    e.preventDefault();
    if ( appLoaded ) {
      activateEditMode(false, true);
      validateMIROApp([ path ]);
      return;
    }
    fileToOpen = path;
  });
});

app.on('ready', async () => {
  if ( process.platform === 'linux') {
    try {
      libPath = path.join(await configData.get('rpath'),
        'miro-library', libVersion);
    } catch (e) {
      errMsg = `Couldn't retrieve R path. Error message: ${e.message}.`;
    }
  }

  if ( errMsg ) {
    dialog.showMessageBoxSync({
      type: 'error',
      title: 'Error initialising MIRO',
      message: errMsg,
      buttons: [ 'OK' ]
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
   
   Menu.setApplicationMenu(menu(addExampleApps,
     activateEditMode, createSettingsWindow));
   
  if ( miroDevelopMode ) {
    if(!gotTheLock){
      return;
    }
    mainWindow = new BrowserWindow({ show: false, width: 0, height: 0});
    mainWindow.hide();
    const modelPath = process.env.MIRO_MODEL_PATH;
    await searchLibPath(true);
    if ( !rPackagesInstalled ){
      showErrorMsg({
        type: 'error',
        title: 'Failed to install R packages',
        message: 'The R packages required to run MIRO could not be installed. Check log file for more information.'
      });
      app.exit(1);
      return;
    }
    if ( !modelPath ) {
      showErrorMsg({
        type: 'error',
        title: 'No model path',
        message: 'You need to specify the path to the main gms file via\
 the environment variable: MIRO_MODEL_PATH'
      });
      app.exit(1);
      return;
    }
    createMIROAppWindow({
      id: path.basename(modelPath, 'gms'),
      modelPath: modelPath,
      mode: process.env.MIRO_MODE,
      dbPath: path.join(app.getPath('home'), '.miro'),
      usetmpdir: process.env.MIRO_USE_TMP ? process.env.MIRO_USE_TMP: false,
      apiversion: requiredAPIVersion,
      miroversion: miroVersion,
      buildArchive: process.env.MIRO_BUILD_ARCHIVE
    });
  } else {
    createMainWindow();
    searchLibPath();
  }

  log.info('MIRO launcher started successfully.');
});

app.on('window-all-closed', () => {
  log.debug('All windows closed.');
  quitLauncher();
});
app.on('will-quit', async (e) => {
  e.preventDefault();
  log.debug('Terminating potentially open R processes.');
  await terminateProcesses();
  app.exit(0);
});
app.on('activate', () => {
  log.debug('Main window activated.');
  if (mainWindow === null) {
    createMainWindow(true)
  }
});
