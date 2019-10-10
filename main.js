'use strict'
const { app, BrowserWindow, Menu, TouchBar, ipcMain, dialog } = require('electron');
const { TouchBarLabel, TouchBarButton, TouchBarSpacer } = TouchBar;
const path  = require("path");
const fs    = require("fs");
const yauzl = require("yauzl");

const DataStore = require('./DataStore');
const unzip     = require('./Unzip');


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
      label: 'Add new MIRO application',
      click: async () => {
          await createAddAppWindow()
        }
    },
    {
      label: 'Update app settings',
      click: async () => {
          await createSettingsWindow()
      }
    }]
  },
  // { role: 'viewMenu' }
  {
    label: 'View',
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
      return showErrorMsg({id: 'add-app', options: {
            type: "info",
            title: "Invalid MIRO app file",
            message: "The file you selected is not a valid MIRO app!"
        }});
    } else if ( filePath.length > 1 ) {
      return showErrorMsg({id: 'add-app', options: {
            type: "info",
            title: "Invalid MIRO app file",
            message: "Please drop only a single MIRO app file!"
        }});
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
          if ( !addAppWindow ) {
            zipfile.close()
          }
          addAppWindow.setProgressBar(++fileCnt * incAmt);
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
                    if ( addAppWindow ) {
                      addAppWindow.webContents.send("validated-logo-received", logoPathTmp);
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
          if ( !addAppWindow ) {
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
          addAppWindow.setProgressBar(0.9);
          if ( !addAppWindow ){
            return
          }
          if ( !newAppConf.id || errMsg ) {
            addAppWindow.setProgressBar(-1);
            showErrorMsg({id: 'add-app', options: {
                type: "info",
                title: "Invalid app",
                message: errMsgTemplate
            }});
            return
          }
          if ( !addAppWindow ){
            return
          }

          addAppWindow.setProgressBar(-1);
          if ( addAppWindow ) {
            addAppWindow.webContents.send('app-validated', newAppConf)
          }
        });
      })
    } catch (e) {
      if ( addAppWindow ) {
        addAppWindow.setProgressBar(-1);
      }
      showErrorMsg({id: 'add-app', options: {
          type: "error",
          title: "Unexpected error",
          message: `There was a problem reading the MIRO app file. Error message: '${e.message}'`
      }});
    }
}

const btAddApp = new TouchBarButton({
  label: '➕ Add app',
  backgroundColor: '#F39619',
  click: () => {
    createAddAppWindow()
  }
})
const btManageApps = new TouchBarButton({
  label: '⚙️ Manage apps',
  click: () => {
    createSettingsWindow()
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
    if (process.platform == 'win32' && 
      process.argv.length >= 2 && !DEVELOPMENT_MODE ) {
      createAddAppWindow(process.argv[1]);
    }else if( fileToOpen ) {
      createAddAppWindow(fileToOpen);
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

let settingsWindow

function createSettingsWindow () {
  if ( settingsWindow != null ) {
    return
  }
  settingsWindow = new BrowserWindow({
    title: "Settings",
    width: 1000,
    height: 600,
    titleBarStyle: 'hidden',
    resizable: false,
    parent: mainWindow,
    webPreferences: {
      nodeIntegration: true
    }
  })
  settingsWindow.loadFile(path.join(__dirname, "renderer", "manage.html"));
  if ( DEVELOPMENT_MODE ) {
    settingsWindow.webContents.openDevTools();
  }
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show()
  })
  settingsWindow.webContents.on('did-finish-load', () => {
    settingsWindow.webContents.send('manage-apps-received', appsData.apps)
  })
  settingsWindow.on('page-title-updated', (e) => {
    e.preventDefault();
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

let addAppWindow

function createAddAppWindow ( filePath = null ) {
  if ( addAppWindow != null ) {
    return
  }
  addAppWindow = new BrowserWindow({
    title: "Add MIRO application",
    width: 525,
    height: 800,
    resizable:false,
    titleBarStyle: 'hidden',
    parent: mainWindow,
    webPreferences: {
      nodeIntegration: true
    }
  });
  if ( DEVELOPMENT_MODE ) {
    addAppWindow.webContents.openDevTools()
  }
  addAppWindow.loadFile(path.join(__dirname, "renderer", "add.html"))
  addAppWindow.once('ready-to-show', () => {
    addAppWindow.show();
  })
  addAppWindow.webContents.on('did-finish-load', () => {
    if (filePath ) {
      validateMIROApp([filePath]);
    }
  });
  addAppWindow.on('page-title-updated', (e) => {
    e.preventDefault();
  });
  addAppWindow.on('closed', () => {
    addAppWindow = null
  })
}
function showErrorMsg (options) {
  let parentWin
  if( options.id ){
    if ( options.id === "add-app" ) {
      parentWin = addAppWindow
    } else if ( options.id === 'manage' ) {
      parentWin = settingsWindow
    } else {
      parentWin = mainWindow
    }
  }
  if ( parentWin ){
    dialog.showMessageBoxSync(parentWin, options.options)
  }  
}
ipcMain.on('show-error-msg', (e, options) => {
  showErrorMsg(options)
})

ipcMain.on("browse-app", (e, options, callback) => {
  let parentWin
  if( options.id ){
    if ( options.id === "add-app" ) {
      parentWin = addAppWindow
    } else if ( options.id === 'manage' ) {
      parentWin = settingsWindow
    } else {
      errWin = mainWindow
    }
  }
  const filePaths = dialog.showOpenDialogSync(parentWin, options.options)
  if ( filePaths ) {
    if( callback ) {
      e.reply(callback, filePaths);
    } else {
      validateMIROApp(filePaths);
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
       mainWindow.send('apps-received', updatedApps, appDataPath)
       addAppWindow.close();
     });
  } catch (e) {
     if ( e.message === "DuplicatedId" ) {
        dialog.showMessageBoxSync(addAppWindow, {
          type: "info",
          title: "Model exists",
          message: "A model with the same name already exists. Please first delete this model before trying again."
        })
        return
     }
     dialog.showMessageBoxSync(addAppWindow, {
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

ipcMain.on('delete-app', (e, appId) => {
  const updatedApps = appsData.deleteApp(appId).apps
  settingsWindow.send('manage-apps-received', updatedApps)
  mainWindow.send('apps-received', updatedApps, appDataPath)
});

app.on('will-finish-launching', () => {
  app.on('open-file', (e, path) => {
    e.preventDefault();
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
