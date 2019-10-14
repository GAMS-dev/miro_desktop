'use strict'
const { app, BrowserWindow, Menu, TouchBar, ipcMain, dialog } = require('electron');
const { TouchBarLabel, TouchBarButton, TouchBarSpacer } = TouchBar;
const path  = require("path");
const fs    = require("fs");
const yauzl = require("yauzl");

const DataStore = require('./DataStore');
const unzip     = require('./Unzip');
const { isFunction } = require('./util');


const isMac = process.platform === 'darwin';
const appDataPath = path.join(app.getPath("userData"), "miro_apps")
const DEVELOPMENT_MODE = !app.isPackaged;

const template = [
  // { role: 'appMenu' }
  ...(isMac ? [{
    label: app.getName(),
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideothers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }] : []),
  // { role: 'fileMenu' }
  {
    label: 'File',
    submenu: [
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  },
  {
    label: 'Edit',
    submenu: [
    {
      label: '➕ Add MIRO app',
      accelerator: 'CmdOrCtrl+A',
      click: async () => {
          await activateEditMode(true);
        }
    },
    {
      label: '⚙️ Edit apps',
      accelerator: 'CmdOrCtrl+E',
      click: async () => {
          await activateEditMode();
      }
    }]
  },
  // { role: 'viewMenu' }
  {
    label: 'View',
    accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11',
    submenu: [
      { role: 'togglefullscreen' }
    ]
  },
  // { role: 'windowMenu' }
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac ? [
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ] : [
        { role: 'close' }
      ])
    ]
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Documentation',
        click: async () => {
          const { shell } = require('electron')
          await shell.openExternal('https://gams.com/miro')
        }
      }
    ]
  }
]

const appsData = new DataStore()

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

let newAppConf

function validateMIROApp ( filePath ) {
    filePath = filePath.filter( el => el.toLowerCase().endsWith('.miroapp') )
    if ( filePath.length === 0 ) {
      return showErrorMsg({
            type: "info",
            title: "Invalid MIRO app file",
            message: "The file you selected is not a valid MIRO app!"
        });
    } else if ( filePath.length > 1 ) {
      return showErrorMsg({
            type: "info",
            title: "Invalid MIRO app file",
            message: "Please drop only a single MIRO app file!"
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
        zipfile.on("error", (err) => {
          throw err;
        });
        zipfile.on("entry", (entry) => {
          if ( !mainWindow ) {
            zipfile.close()
          }
          mainWindow.setProgressBar(++fileCnt * incAmt);
          appFileNames.push(entry.fileName);
          if ( skipCnt < 2 ) {
            if ( path.dirname(entry.fileName) === "static" ) {
              const logoExt = entry.fileName.toLowerCase().match(/.*_logo\.(jpg|jpeg|png)$/);
              if ( logoExt ) {
                newAppConf.logoPath = entry.fileName;
                const logoPathTmp = path.join(app.getPath("temp"), `logo.${logoExt[1]}`);
                zipfile.openReadStream(entry, function(err, readStream) {
                  if (err) throw err;
                  readStream.pipe(fs.createWriteStream(logoPathTmp));
                  readStream.on("end", () => {
                    newAppConf.logoPathTmp = logoPathTmp;
                    if ( mainWindow ) {
                      mainWindow.webContents.send("validated-logo-received", {path: logoPathTmp});
                    }
                  });
                });
                skipCnt++
              }
            } else if ( entry.fileName === ".no_tmp" ) {
              newAppConf.useTmpDir = false;
              skipCnt++
            }
          }
        });
        zipfile.once("end", () => {
          if ( !mainWindow ) {
            return
          }
          let errMsg
          const errMsgTemplate = "The MIRO app you want to add is invalid. Please make sure to upload a valid MIRO app!"
          const miroConfFormat = /(.*)_(\d+)_(\d+\.\d+\.\d+)(_hcube)?\.miroconf$/;
          for ( const fileName of appFileNames ) {
            if ( fileName.endsWith(".miroconf") ) {
              const miroConfMatch = fileName.match(miroConfFormat);
              if ( miroConfMatch && miroConfMatch[1].length ) {
                newAppConf.path = filePath[0];
                newAppConf.id = miroConfMatch[1];
                newAppConf.APIVersion = parseInt(miroConfMatch[2], 10);
                newAppConf.MIROVersion = miroConfMatch[3];
                if ( miroConfMatch[4] ) {
                  newAppConf.modesAvailable.push("hcube")
                } else {
                  newAppConf.modesAvailable.push("base")
                }
                break
              } else {
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
                type: "info",
                title: "Invalid app",
                message: errMsgTemplate
            });
            return
          }
          if ( !mainWindow ){
            return
          }

          mainWindow.setProgressBar(-1);
          if ( mainWindow ) {
            mainWindow.webContents.send('app-validated', newAppConf)
          }
        });
      })
    } catch (e) {
      if ( mainWindow ) {
        mainWindow.setProgressBar(-1);
      }
      showErrorMsg({
          type: "error",
          title: "Unexpected error",
          message: `There was a problem reading the MIRO app file. Error message: '${e.message}'`
      });
    }
}

function validateAppLogo(filePath, id = null){
    const filteredPath = filePath.filter( el => el
        .toLowerCase()
        .match(/\.(jpg|jpeg|png)$/) );
    if ( filteredPath.length === 0 ) {
      showErrorMsg({
            type: "info",
            title: "Invalid MIRO app logo",
            message: "The file you selected is not a valid MIRO logo. Only jpg/jpeg and png supported!"
        })
       return
    } else if ( filteredPath.length > 1 ) {
      showErrorMsg({
            type: "info",
            title: "Invalid MIRO app logo",
            message: "Please drop only a single MIRO app logo!"
        })
      return
    }
    const logoSize = fs.statSync(filteredPath[0]).size / 1000000.0;
    if ( logoSize > 10 ) {
      showErrorMsg({
            type: "info",
            title: "Logo too large",
            message: "Logos must not be larger than 10MB!"
        })
        return
    }
    mainWindow.webContents.send("validated-logopath-received", 
      {id: id, path: filteredPath[0]});
}

function activateEditMode( openNewAppForm = false ){
  if ( mainWindow ) {
    mainWindow.send('activate-edit-mode', openNewAppForm);
  }
}

const btAddApp = new TouchBarButton({
  label: '➕ Add MIRO app',
  backgroundColor: '#F39619',
  click: () => {
    activateEditMode(true);
  }
})
const btManageApps = new TouchBarButton({
  label: '⚙️ Edit apps',
  click: () => {
    activateEditMode();
  }
})

const mainWindowTouchBar = new TouchBar({
  items: [
    btAddApp,
    btManageApps
  ]
})

let mainWindow
let fileToOpen
let appLoaded = false;

function createMainWindow () {
  mainWindow = new BrowserWindow({
    title: "GAMS MIRO",
    width: 800,
    height: 620,
    minWidth: 500,
    minHeight: 300,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true
    }
  })
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"))
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  })
  if ( DEVELOPMENT_MODE ) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('apps-received', appsData.apps, appDataPath);
    if ( appLoaded ) {
      return;
    }
    appLoaded = true;
    if (process.platform == 'win32' && 
      process.argv.length >= 2 && !DEVELOPMENT_MODE ) {
      activateEditMode();
      validateMIROApp(process.argv[1]);
    }else if( fileToOpen ) {
      activateEditMode();
      validateMIROApp(fileToOpen);
    }
  })
  mainWindow.setTouchBar(mainWindowTouchBar)
  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault();
  });
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function showErrorMsg (options) {
  if ( mainWindow ){
    dialog.showMessageBoxSync(mainWindow, options)
  }  
}
ipcMain.on('show-error-msg', (e, options) => {
  showErrorMsg(options)
})

ipcMain.on("browse-app", (e, options, callback, id = null) => {
  const filePaths = dialog.showOpenDialogSync(mainWindow, options.options)
  if ( filePaths ) {
    if( callback === "validateLogo" ) {
      validateAppLogo(filePaths, id);
    } else if( callback === "validateApp" ) {
      validateMIROApp(filePaths);
    } else if ( id ) {
      e.reply(callback, {id: id, path: filePaths});
    } else {
      e.reply(callback, filePaths);
    }
  }
})

ipcMain.on("add-app", (e, app) => {
  try {
     if ( !appsData.isUniqueId(app.id) ) {
       throw new Error('DuplicatedId');
     }
     let appConf = app;
     const appDir = path.join(appDataPath, appConf.id)
     unzip(appConf.path, appDir, () => {
       delete appConf.path;
       if ( appConf.logoNeedsMove ) {
        const newLogoPath = path.join("static", 
          appConf.id + "_logo" + path.extname(appConf.logoPath));
         fs.copyFileSync(appConf.logoPath, path.join(appDir, newLogoPath));
         appConf.logoPath = newLogoPath;
         delete appConf.logoNeedsMove;
       }
       const updatedApps = appsData.addApp(appConf).apps;
       mainWindow.send('apps-received', updatedApps, appDataPath);
     });
  } catch (e) {
     if ( e.message === "DuplicatedId" ) {
        dialog.showMessageBoxSync(mainWindow, {
          type: "info",
          title: "Model exists",
          message: "A model with the same name already exists. Please first delete this model before trying again."
        })
        return
     }
     dialog.showMessageBoxSync(mainWindow, {
        type: "error",
        title: "Unexpected error",
        message: `An unexpected error occurred. Error message: '${e.message}'`
      })
     return
  }
});
ipcMain.on('update-app', (e, app) => {
  try{
     let appConf = app;
     if ( appConf.logoNeedsMove ) {
      const newLogoPath = path.join("static", 
        appConf.id + "_logo" + path.extname(appConf.logoPath));
       fs.copyFileSync(appConf.logoPath, path.join(appDataPath, appConf.id, newLogoPath));
       appConf.logoPath = newLogoPath;
       delete appConf.logoNeedsMove;
     }
     const updatedApps = appsData.updateApp(appConf).apps;
     mainWindow.send('apps-received', updatedApps, appDataPath);
  } catch (e) {
     dialog.showMessageBoxSync(mainWindow, {
        type: "error",
        title: "Unexpected error",
        message: `An unexpected error occurred. Error message: '${e.message}'`
      })
     return
  }
});

ipcMain.on('validate-app', (e, filePath) => {
  validateMIROApp(filePath);
});
ipcMain.on('validate-logo', (e, filePath, id) => {
  validateAppLogo(filePath, id);
});

ipcMain.on('delete-app', (e, appId) => {
  const deleteAppConfirmedId = dialog.showMessageBoxSync(mainWindow, {
   buttons: [ "Remove", "Cancel" ],
   message: "Are you sure you want to permanently remove the app?"
  });
  if ( deleteAppConfirmedId !== 0 ) {
    return
  }
  const updatedApps = appsData.deleteApp(appId).apps;
  mainWindow.send('apps-received', updatedApps, appDataPath);
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

app.on('ready', createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow()
  }
})
