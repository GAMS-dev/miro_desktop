'use strict'
const {app, Menu, shell } = require('electron');
const isMac = process.platform === 'darwin';

module.exports = function(activateEditCallback, 
  showSettingsCallback){
  return Menu.buildFromTemplate([
    // { role: 'appMenu' }
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { 
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: async () => {
            await showSettingsCallback();
          }
        },
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
        isMac ? { role: 'close' } : { role: 'quit' },
        ...(isMac ? [] : [{ 
          label: 'Preferences',
          accelerator: 'F7',
          click: async () => {
            await showSettingsCallback();
          }
        }])
      ]
    },
    {
      label: 'Edit',
      submenu: [
      {
        label: '➕ Add MIRO app',
        accelerator: 'CmdOrCtrl+O',
        click: async () => {
            await activateEditCallback(true);
          }
      },
      {
        label: '⚙️ Edit apps',
        accelerator: 'CmdOrCtrl+E',
        click: async () => {
            await activateEditCallback();
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
            await shell.openExternal('https://gams.com/miro')
          }
        }
      ]
    }
  ])
}

