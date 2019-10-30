'use strict'
const { dialog } = require('electron');
const execa = require('execa');



async function installRPackages(rpath, libpath, mainWindow){
  if ( !rpath ) {
    mainWindow.send('invalid-r');
    return;
  }
  const selection = dialog.showMessageBoxSync({
    type: 'question',
    title: 'Install R packages',
    message: 'Would you like to install the required R packages now? Note that before doing so, you have to install the system libraries V8 and libcurl. On Debian / Ubuntu you need libcurl4-gnutls-dev and either libv8-dev or libnode-dev, on Fedora use libcurl-devel and v8-devel.',
    buttons: ['No', 'Yes']
  });
  if ( selection !== 1 ) {
    return false;
  }
  const rproc = execa(path.join(rpath, 'bin', 'Rscript'), 
    path.join(libpath, 'scripts', 'install_source.R'));
  mainWindow.send('install-r-packages');

  for await (const data of child.stdout) {
    mainWindow.send('install-r-packages-stdout', data);
  };
  return true;    
}

module.exports = installRPackages
