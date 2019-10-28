'use strict'

const { ipcRenderer, remote } = require('electron');
const path = require('path');
window.Bootstrap = require('bootstrap');
const $ = require('jquery');

const currentWindow = remote.getCurrentWindow();

const cbLaunchExternal = $('#launchExternal');
const inputLogLifetime = $('#logLifetime');

const newConfig = {};
let defaultValues;
let importantKeys;
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
    let logLifeVal = inputLogLifetime.val();
    if ( logLifeVal !== '' ) {
        logLifeVal = parseInt(logLifeVal, 10);
        if ( Number.isNaN(logLifeVal) ) {
            remote.dialog.showMessageBoxSync(currentWindow,
            {
                type: 'warning',
                title: 'Invalid log lifetime',
                message: 'The value you entered for the number of days log file should be stored is invalid! Please enter only whole numbers!'
            });
            return;
        }
    }
    newConfig.logLifeTime = logLifeVal;
    newConfig.launchExternal = cbLaunchExternal.is(":checked");
    ipcRenderer.send('save-path-config', newConfig, requireRestart); 
});

$('#btCancel').on('click', (e) => {
    currentWindow.close();
});

function updatePathConfig( pathSelectConfig, pathSelected ) {
    newConfig[pathSelectConfig.id] = pathSelected;
    $(`#btPathSelect_${pathSelectConfig.id}`)
       .siblings('label').text(pathSelected);

    if ( pathSelectConfig.requiresRestart === true) {
        requireRestart = true;
    }
}

function genPathSelectHandler( pathSelectConfig ) {
    return (event) => { 
        if ( importantKeys.find(el => el === pathSelectConfig.id ) ) {
            return;
        }
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
    console.log(elKey);
    newConfig[elKey] = '';
    if ( pathConfig.findIndex(el => el.id === elKey && el.restart === true ) === -1 ) {
        requireRestart = true;
    }
    const $this = $(this);
    $this.siblings('label').text(defaultValues[elKey]);
    $this.hide();
  });
});
$('.btn-reset-nonpath').click(function(e) {
    const elKey = this.dataset.key;
    newConfig[elKey] = '';
    if ( elKey === 'launchExternal' ) {
        cbLaunchExternal.prop('checked', defaultValues[elKey]);
    } else if ( elKey === 'logLifeTime' ) {
        inputLogLifetime.val(defaultValues[elKey]);
    }
    $(this).hide();
});

ipcRenderer.on('settings-loaded', (e, data, defaults) => {
    defaultValues = defaults;
    importantKeys = data.important;

    for (let [key, value] of Object.entries(data)) {
      if ( key === 'important' ) {
        continue
      }
      let newValue = value;
      let isImportant = false;
      if ( importantKeys.find(el => el === key) ) {
        isImportant = true;
      }
      if ( newValue == null || newValue === '' ) {
        newValue = defaultValues[key];
        if ( key === 'launchExternal' || key === 'logLifeTime' ) {
            $(`[data-key="${key}"]`).show();
        } else {
            $(`#btPathSelect_${key}`).siblings('.btn-reset').show();
        }
      } else {
        newConfig[key] = newValue;
      }
      if ( key === 'launchExternal' ) {
        cbLaunchExternal.prop('checked', newValue);
        if ( isImportant ) {
            cbLaunchExternal.attr('disabled', true);
        }
      } else if ( key === 'logLifeTime' ) {
        inputLogLifetime.val(newValue);
        if ( isImportant ) {
            inputLogLifetime.attr('disabled', true);
        }
      } else {
        const pathSelectEl = $(`#btPathSelect_${key}`);
        if ( isImportant ) {
            pathSelectEl.addClass('path-disabled');
        }
        pathSelectEl.siblings('label').text(newValue);
      }
    }
});

ipcRenderer.on('gamspath-validated', (e, path) => {
    gamspathValidating = false;
    updatePathConfig(pathConfig.filter(el => el.id === 'gamspath'), path);
});
