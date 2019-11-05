'use strict'
const { dialog, ipcMain } = require('electron');
const execa = require('execa');
const path = require('path');
const fs = require('fs');



async function installRPackages(rpath, apppath, libpath, mainWindow){
  if ( !rpath ) {
    dialog.showMessageBoxSync(mainWindow, {type: 'error',
        title: 'R not found',
        message: 'No R installation was found on your machine. Please install R or specify path manually in settings.'})
    return;
  }
  const selection = dialog.showMessageBoxSync(mainWindow, {
    type: 'question',
    title: 'Install R packages',
    message: 'Would you like to install the required R packages now?\n\nNote that before doing so, you have to install the system libraries V8 and libcurl.\nOn Debian / Ubuntu you need libcurl4-gnutls-dev and either libv8-dev or libnode-dev, on Fedora use libcurl-devel and v8-devel.',
    buttons: ['No', 'Yes']
  });
  if ( selection !== 1 ) {
    return false;
  }
  const scriptsPath = path.join(apppath, 'scripts');
  const rproc = execa(path.join(rpath, 'bin', 'Rscript'), 
    [path.join(scriptsPath, 'install_source.R')],
    { env: {'LIB_PATH': libpath,
            'SCRIPTS_PATH': scriptsPath},
      all: true});
  mainWindow.send('install-r-packages');

  ipcMain.on('kill-r-pkg-install', (e) => {
    try {
      rproc.kill();
    } catch (e) { }
  });

  for await (const data of rproc.all) {
    mainWindow.send('install-r-packages-stdout', data);
  };
  try {
    await rproc;
    mainWindow.send('install-r-packages-installed');
  } catch (e) { }  
  return true;
}

module.exports = installRPackages
