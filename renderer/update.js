'use strict'
const { remote, shell } = require('electron');
const https = require('https');
const $ = require('jquery');
const lang = remote.getGlobal('lang').update;
const installedVersion = remote.getGlobal('miroVersion').split('.');

$('#btClose').text(lang['btClose']);

$('#btClose').on('click', () => {
    remote.getCurrentWindow().close();
});

function updateStatus(status, text = true){
    $('#updateSpinner').hide();
    if ( text ) {
        $('#updateText').text(status);
    } else {
        $('#updateText').html(status);
    }
}

https.get('https://gams.com/miro/latest.ver', (res) => {
    if ( res.statusCode !== 200 ) {
        updateStatus(lang['error']);
        return;
    }
    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
           const currentVersion = rawData.trim().split(',');
           if ( !currentVersion || currentVersion.length !== 3 ) {
              updateStatus(lang['error']);
              return;
           }
           const newVersionText = `${lang['updateAvailable']}<br>${lang['downloadUpdate']} <a href="#" id="downloadMIRO">${lang['here']}</a>.`;
           const currentMajor = parseInt(currentVersion[0], 10);
           const installedMajor = parseInt(installedVersion[0], 10);
           if ( currentMajor > installedMajor ) {
             updateStatus(newVersionText, false);
             return;
           } else if ( currentMajor === installedMajor ) {
                const currentMinor = parseInt(currentVersion[1], 10);
                const installedMinor = parseInt(installedVersion[1], 10);
                if ( currentMinor > installedMinor ) {
                  updateStatus(newVersionText, false);
                  return;
                } else if ( currentMinor === installedMinor && 
                    parseInt(currentVersion[2], 10) > parseInt(installedVersion[2], 10)) {
                    updateStatus(newVersionText, false);
                    return;
                }
           }
           updateStatus(lang['upToDate']);
           return;
        } catch (e) {
           updateStatus(lang['error']);
           return;
        }
    });
}).on('error', (e) => {
    updateStatus(lang['error']);
});
$('.site-wrapper').on('click', '#downloadMIRO', () => {
    shell.openExternal('https://gams.com/miro');
});
