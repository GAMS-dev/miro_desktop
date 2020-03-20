'use strict'

const { ipcRenderer, remote, shell } = require('electron');
const path = require('path');
window.Bootstrap = require('bootstrap');
const $ = require('jquery');

const currentWindow = remote.getCurrentWindow();

const cbLaunchExternal = $('#launchExternal');
const cbRemoteExecution = $('#remoteExecution');
const inputLogLifetime = $('#logLifeTime');
const inputLanguage    = $('#language');
const inputLogLevel    = $('#logLevel');
const saveButton       = $('#btSave');

const lang = remote.getGlobal('lang').settings;
['title', 'general-tab', 'paths-tab', 'launchBrowser', 'browserReset', 'generalLanguage', 'languageReset',
'generalRemoteExec', 'remoteExecReset', 'generalLogging', 'loggingReset', 'generalLoglife', 'loglifeReset', 
'pathMiroapp', 'pathMiroappSelect', 'resetPathMiroapp', 'pathGams', 'pathGamsSelect', 'pathGamsReset', 'pathLog',
'pathLogSelect', 'pathLogReset', 'pathR', 'pathRSelect', 'pathRReset', 'needHelp', 'btSave'].forEach(id => {
  const el = document.getElementById(id);
  if ( el ) {
    el.innerText = lang[id];
  }
});
document.getElementById('btCancel').value = lang['btCancel'];
['pathMiroappSelect', 'pathGamsSelect', 'pathLogSelect', 'pathRSelect'].forEach(id => {
  const el = document.getElementById(id);
  if ( el ) {
    $(el).addClass('browseLang').attr('content-after', lang['browseFiles']);
  }
});
$('#helpLink').on('click', () => {
    shell.openExternal('https://gams.com/miro/deployment.html#sbs-customize-app');
}); 
let oldConfig = {};
const newConfig = {};
let defaultValues;
let importantKeys;
let requireRestart = false;
let pathValidating = false;

const optionAliasMap = {
    language: {
        English: 'en',
        Deutsch: 'de',
        中文: 'cn'
    }
}

const pathConfig = [
    {
        id: 'configpath',
        title: lang['dialogConfigPathHdr'],
        message: lang['dialogConfigPathMsg'],
        buttonLabel: lang['dialogConfigPathBtn'],
        label: lang['dialogConfigPathLabel'],
        requiresRestart: true
    },
    {
        id: 'gamspath',
        title: lang['dialogGamsPathHdr'],
        message: lang['dialogGamsPathMsg'],
        label: lang['dialogGamsPathLabel'],
        buttonLabel: lang['dialogGamsPathBtn'],
    },
    {
        id: 'rpath',
        title: lang['dialogRPathHdr'],
        message: lang['dialogRPathMsg'],
        label: lang['dialogRPathLabel'],
        buttonLabel: lang['dialogRPathBtn']
    },
    {
        id: 'logpath',
        title: lang['dialogLogPathHdr'],
        message: lang['dialogLogPathMsg'],
        label: lang['dialogLogPathLabel'],
        buttonLabel: lang['dialogLogPathBtn']
    }
];

[inputLogLifetime, inputLanguage, inputLogLevel, cbLaunchExternal, cbRemoteExecution].forEach(el => {
    el.on('change', () => {
        saveButton.attr('disabled', false);
    });
});

saveButton.on('click', (e) => {
    if ( pathValidating === true ) {
        return;
    }
    let logLifeVal = inputLogLifetime.val();
    if ( logLifeVal !== '' ) {
        logLifeVal = parseInt(logLifeVal, 10);
        if ( Number.isNaN(logLifeVal) ) {
            remote.dialog.showMessageBoxSync(currentWindow,
            {
                type: 'warning',
                title: lang['dialogLogLifeErrHdr'],
                message: lang['dialogLogLifeErrMsg'],
                buttons: [ lang['dialogLogLifeErrBtn'] ]
            });
            return;
        }
    }
    newConfig.logLifeTime = logLifeVal;
    newConfig.launchExternal = cbLaunchExternal.is(':checked');
    newConfig.remoteExecution = cbRemoteExecution.is(':checked');

    newConfig.language    = optionAliasMap.language[inputLanguage.val()];
    let oldLanguage = defaultValues.language;
    if ( oldConfig.language ) {
        oldLanguage = oldConfig.language;
    }
    if ( oldLanguage !== newConfig.language ) {
        requireRestart = true;
    }
    newConfig.logLevel    = inputLogLevel.val();
    saveButton.attr('disabled', true);
    ipcRenderer.send('save-general-config', newConfig, requireRestart); 
});

$('#btCancel').on('click', (e) => {
    currentWindow.close();
});

function updatePathConfig( pathSelectConfig, pathSelected ) {
    saveButton.attr('disabled', false);
    newConfig[pathSelectConfig.id] = pathSelected;
    $(`#btPathSelect_${pathSelectConfig.id}`)
       .siblings('label').text(pathSelected);

    if ( pathSelectConfig.requiresRestart === true) {
        requireRestart = true;
    }
}

function genPathSelectHandler( pathSelectConfig ) {
    return (event) => { 
        if ( importantKeys && importantKeys.find(el => 
            el === pathSelectConfig.id ) ) {
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
            pathValidating = true;
            ipcRenderer.send('validate-gams', pathSelected[0]);
            return;
        } else if ( pathSelectConfig.id === 'rpath' ) {
            pathValidating = true;
            ipcRenderer.send('validate-r', pathSelected[0]);
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
    saveButton.attr('disabled', false);
    if ( pathConfig.find(el2 => el2.id === elKey && 
        el2.requiresRestart === true ) ) {
        requireRestart = true;
    }
    const $this = $(this);
    $this.siblings('label').text(defaultValues[elKey]);
    $this.hide();
  });
});
$('.btn-reset-nonpath').click(function(e) {
    saveButton.attr('disabled', false);
    const elKey = this.dataset.key;
    newConfig[elKey] = '';
    if ( elKey === 'launchExternal' ) {
        cbLaunchExternal.prop('checked', defaultValues[elKey]);
    } else if ( elKey === 'remoteExecution' ) {
        cbRemoteExecution.prop('checked', defaultValues[elKey]);
    } else if ( elKey === 'logLifeTime' ) {
        inputLogLifetime.val(defaultValues[elKey]);
    } else if ( elKey === 'language' ) {
        inputLanguage.val(Object.keys(optionAliasMap.language)
            .find(key => optionAliasMap.language[key] === defaultValues[elKey]));
    } else if ( elKey === 'logLevel' ) {
        inputLogLevel.val(defaultValues[elKey]);
    }
    $(this).hide();
});

ipcRenderer.on('settings-loaded', (e, data, defaults) => {
    oldConfig = data;
    saveButton.attr('disabled', true);
    defaultValues = defaults;
    if ( !data.important ) {
        importantKeys = [];
    } else if ( Array.isArray(data.important) ) {
        importantKeys = data.important;
    } else {
        importantKeys = [ data.important ];
    }
    requireRestart = false;
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
      } else {
        if ( !isImportant ) {
            if ( ['launchExternal', 'remoteExecution', 'logLifeTime', 
                  'language', 'logLevel'].find(el => el === key ) ) {
                if ( newValue !== defaultValues[key] ) {
                    $(`[data-key="${key}"]`).show();
                }
            } else {
                $(`#btPathSelect_${key}`).siblings('.btn-reset').show();
            }
        }
      }
      if ( key === 'launchExternal' ) {
        cbLaunchExternal.prop('checked', newValue);
        if ( isImportant ) {
            cbLaunchExternal.attr('disabled', true);
        }
      } else if ( key === 'remoteExecution' ) {
        cbRemoteExecution.prop('checked', newValue);
        if ( isImportant ) {
            cbRemoteExecution.attr('disabled', true);
        }
      } else if ( ['logLifeTime', 'logLevel', 'language' ].find(el => el === key) ) {
        $(`#${key}`).val(key === 'language'? Object.keys(optionAliasMap.language)
            .find(key => optionAliasMap.language[key] === newValue): newValue);
        if ( isImportant ) {
            $(`#${key}`).attr('disabled', true);
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
[ 'gamspath', 'rpath' ].forEach(el => {
    ipcRenderer.on(`${el}-validated`, (e, path) => {
        pathValidating = false;
        updatePathConfig(pathConfig.filter(el2 => el2.id === el)[0], path);
    });
});
