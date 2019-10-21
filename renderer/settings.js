'use strict'

const { ipcRenderer, remote } = require('electron');
const path = require('path');
window.Bootstrap = require('bootstrap');
const $ = require('jquery');

const currentWindow = remote.getCurrentWindow();

const cbLaunchExternal = $('#launchExternal');

const newConfig = {};
let pathDefaults;
let requireRestart = false;
let gamspathValidating = false;
const pathConfig = [
    {
        id: 'configpath',
        title: 'Select MIRO app path',
        message: 'Please select your MIRO app directory.',
        buttonLabel: 'Select',
        label: 'Select MIRO app path',
        requiresRestart: true
    },
    {
        id: 'gamspath',
        title: 'Please select the path where you installed GAMS.',
        message: 'Please select the path where you installed GAMS.',
        label: 'Select GAMS path',
        buttonLabel: 'Select',
    },
    {
        id: 'rpath',
        title: 'Select R path',
        message: 'Please select the path where you installed R.',
        label: 'Select R path',
        buttonLabel: 'Select'
    },
    {
        id: 'logpath',
        title: 'Select log path',
        message: 'Please select the path where logs shall be stored.',
        label: 'Select log file path',
        buttonLabel: 'Select'
    }
];


$('#btSave').on('click', (e) => {
    if ( gamspathValidating === true ) {
        return;
    }
    newConfig.launchExternal = cbLaunchExternal.is(":checked");
    ipcRenderer.send('save-path-config', newConfig, requireRestart); 
});

$('#btCancel').on('click', (e) => {
    currentWindow.close();
});

function updatePathConfig( pathSelectConfig, pathSelected ) {
    newConfig[pathSelectConfig.id] = pathSelected;
    $(`#btPathSelect_${pathSelectConfig.id}`).siblings('label').text(pathSelected);

    if ( pathSelectConfig.requiresRestart === true) {
        requireRestart = true;
    }
}

function genPathSelectHandler( pathSelectConfig ) {
    return (event) => { 
        const pathSelected = remote.dialog.showOpenDialogSync(currentWindow, {
             title: pathSelectConfig.title,
             message: pathSelectConfig.message,
             buttonLabel: pathSelectConfig.buttonLabel,
             properties: [ 'openDirectory', 'createDirectory' ]
        });
        if ( !pathSelected ) {
            return;
        }
        if ( pathSelectConfig.id === 'gamspath' ) {
            gamspathValidating = true;
            ipcRenderer.send('validate-gams', pathSelected[0]);
            return;
        }
        updatePathConfig(pathSelectConfig, pathSelected[0]);
    };
}

pathConfig.forEach((el) => {
  $(`#btPathSelect_${el.id}`).click(genPathSelectHandler(el));
});
pathConfig.forEach((el) => {
  $(`#btPathSelect_${el.id}`).siblings('.btn-reset').click(function() {
    const elKey = this.dataset.key;
    newConfig[elKey] = '';
    console.log(pathConfig.findIndex(el => el.id === elKey && el.restart === true ));
    if ( pathConfig.findIndex(el => el.id === elKey && el.restart === true ) === -1 ) {
        requireRestart = true;
    }
    const $this = $(this);
    $this.siblings('label').text(pathDefaults[elKey]);
    $this.hide();
  });
});

ipcRenderer.on('settings-loaded', (e, data, defaults) => {
    pathDefaults = defaults;
    for (let [key, value] of Object.entries(data)) {
      if ( value == null || value === '' ) {
        continue
      }
      if ( key === 'launchExternal' ) {
        newConfig.launchExternal = data.launchExternal;
        cbLaunchExternal.prop('checked', value);
      } else {
        newConfig[key] = value;
        $(`#btPathSelect_${key}`).siblings('label').text(value);
        if ( value !== pathDefaults[key] ) {
           $(`#btPathSelect_${key}`).siblings('.btn-reset').show();
        }
      }
    }
});

ipcRenderer.on('gamspath-validated', (e, path) => {
    gamspathValidating = false;
    updatePathConfig(pathConfig.filter(el => el.id === 'gamspath'), path);
});
