'use strict'

const { remote, ipcRenderer, shell } = require('electron')
const path = require('path');
const { pathToFileURL } = require('url');
window.Bootstrap = require('bootstrap');
const $ = require('jquery');

const btRemoveConfirm = document.getElementById('btRemoveModel');
const appsWrapper = $('#appsWrapper');
const noAppsNotice = $('#noAppsDiv');
const btEditWrapper = $('#btEditWrapper');
const btEdit = document.getElementById('btEdit');
const btEditIcon = document.getElementById('editIcon');
const loadingScreen = $('#loadingScreen');
const animationScreen = $('#animationScreen');
const addAppWrapperHTML = `<div id="addAppBox" class="add-app-box app-box-fixed-height">
                             <div style="height:200px;">
                                 <p class="add-app-box-logo">
                                </p>
                             </div>
                             <div>
                               <div class="add-app-box-title"></div>
                               <div class="add-app-box-desc"></div>
                             </div>
                            <a class="btn-add-app" id="addApp"><i class="fas fa-plus-circle"></i></a>
                          </div>`;
const appFilesPlaceholder = 'Drop your MIRO app here or click to browse.';
const appNamePlaceholder = 'Define the app title';
const appDescPlaceholder = 'Short model description (optional)';
const appDbPathPlaceholder = path.join('~', '.miro');
const appDbPathReset = 'Reset to default';
const appLogoPlaceholder = 'Different app logo? Drop your MIRO app logo here or click to browse.';
const editHelper = `<div class="edit-info" style="display:none;">
                        <p class="edit-info-text"><img class="edit-info-img img-fluid" \ 
                        src="${pathToFileURL(path.join(remote.app.getAppPath(),
                        'static', 'arrow.png'))}" width="45px" align="middle" alt="arrow">Click on app to edit</p>
                    </div>`;  
let appData
let dataPath
let newAppConfig

let dragAddAppCounter = 0;
let isInEditMode = false;
let runningProcesses = [];
  
const $overlay = $('#overlayScreen');
const $body = $('body');

function toggleEditMode(){
  if ( isInEditMode ) {
    exitOverlayMode();
    if ( !appData.length ) {
      noAppsNotice.fadeIn(200);
    }
    btEdit.textContent = 'Edit';
    $('.edit-info').fadeOut(200);
    $('.delete-app-button').fadeOut(200);
    $('#addAppWrapper').fadeOut(200);
    $('.edit-bt-group').hide();
    $('.db-path-field').hide();
    $('.btn-launch').fadeIn(200);
    $('.launch-app-box').removeClass('app-box-hover');
    isInEditMode = false;
  } else {
    if ( !appData.length ) {
      noAppsNotice.hide();
    }
    btEdit.textContent = 'Done';
    newAppConfig  = null;
    $('.edit-info').fadeIn(200);
    $('.delete-app-button').fadeIn(200);
    $('#addAppWrapper').fadeIn(200);
    $('.btn-launch').fadeOut(200);
    $('.launch-app-box').addClass('app-box-hover');
    isInEditMode = true;
  }
  $('#editIcon').toggleClass('fa-lock fa-lock-open');
}
function exitOverlayMode(){
  if ( $('#expandedAddAppWrapper').is(':visible') ) {
    $('#addAppWrapper').html(addAppWrapperHTML);
  }
  if ( $overlay.is(':visible') ) {
    $('.app-logo').empty().removeClass('drag-drop-area');
    $('.app-item-title').removeClass('editable').attr('contenteditable', false);
    $('.app-item-desc').removeClass('editable').addClass('app-desc-fixed').attr('contenteditable', false);
    $('.db-path-field').slideUp(200);
    $('.edit-bt-group').slideUp(200);
    $('.launch-app-box').addClass('app-box-fixed-height');
    $overlay.hide();
    $overlay.data('current').css('z-index', 1);
    $('.launch-app-box').addClass('app-box-hover');
  }
}
function expandAddAppForm(){
  if ( $('#expandedAddAppWrapper').is(':visible') ) {
    return
  }
  if ( !isInEditMode ) {
    toggleEditMode();
  }
  const addAppWrapper = $('#addAppWrapper');
  addAppWrapper.css( 'z-index', 11 );
  $overlay.data('current', addAppWrapper).fadeIn(300);
  addAppWrapper.html(`<div class="app-box" id="expandedAddAppWrapper">
                        <div style="height:200px;">
                           <div class="drag-drop-area app-window" id="newAppFiles">
                              <div class="drag-drop-area-text empty">
                                <div><i class="fas fa-plus-circle drag-drop-area-icon"></i></div>
                                 ${appFilesPlaceholder}
                              </div>
                           </div>
                            <div class="drag-drop-area add-app-logo app-logo" id="newAppLogo" style="display:none">
                              <div class="drag-drop-area-text not-empty">
                               ${appLogoPlaceholder}
                              </div>
                           </div>
                        </div>
                        <div>
                        <h3 id="newAppName" class="app-title editable" style="margin-top:15pt;" contenteditable="true">
                           ${appNamePlaceholder}
                        </h3>
                        <p id="newAppDesc" class="app-desc editable" contenteditable="true">
                           ${appDescPlaceholder}
                        </p>
                        <div class="custom-file db-path-field">
                          <div id="newAppDbPath" class="custom-file-input browseFiles app-db-path"></div>
                          <label id="newAppDbPathLabel" class="custom-file-label dbpath" for="newAppDbPath">
                            ${appDbPathPlaceholder}</label>
                            <small class="form-text reset-db-path" style="display:none">${appDbPathReset}</small>
                        </div>
                        </div>
                        <div class="input-group mb-3" style="visibility:hidden;">
                          <div class="input-group-prepend">
                            <button class="btn btn-outline-secondary dropdown-toggle btn-launch" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Launch</button>
                            <div class="dropdown-menu">
                              <a class="dropdown-item" href="#">Base mode</a>
                              <a class="dropdown-item" href="#">Hypercube mode</a>
                            </div>
                          </div>
                        </div>
                        <div style = "text-align:right;">
                            <input class="btn btn-secondary cancel-btn" id="btAddAppReset" value="Cancel" type="reset">
                            <button class="btn btn-secondary confirm-btn" id="btAddApp" type="button">Add app</button>
                        </div>`);
}

$body.on('click', '.app-box', function(e) {
  const $target = $(e.target);
    if ( !isInEditMode || $overlay.is(':visible') || 
      $target.hasClass('cancel-btn') || 
      $target.hasClass('delete-app-button') || 
      $target.parents('.delete-app-button').length ) {
      return
    }
    const $this = $(this);
    const appID = this.dataset.id;
    if ( appID ) {
      newAppConfig = appData.find(app => app.id === appID);
      if ( !newAppConfig ) {
        ipcRenderer.send('show-error-msg', {
            type: 'error',
            title: 'Unexpected error',
            message: 'No MIRO app configuration was found. If this problem persists, please contact GAMS!'
        });
        return;
      }
      $(`#appBox_${appID}`).removeClass('app-box-fixed-height');
      $(`#appLogo_${appID}`).html(`<div class='drag-drop-area-text'>${appLogoPlaceholder}</div>`).addClass('drag-drop-area');
      $(`#appTitle_${appID}`).addClass('editable').attr('contenteditable', true);
      const appDescField = $(`#appDesc_${appID}`);
      appDescField.addClass('editable').removeClass('app-desc-fixed').attr('contenteditable', true);
      if ( !appDescField.text().trim() ) {
        appDescField.text(appDescPlaceholder);
      }
    }
    $('.db-path-field').slideDown(200);
    $('.edit-bt-group').slideDown(200);
    $this.css( 'z-index', 11 );
    $overlay.data('current', $this).fadeIn(300);
    $('.launch-app-box').removeClass('app-box-hover');
});
appsWrapper.on('focus', '.app-title', (e) => {
  const $target = $(e.target);
  if ( $target.text().trim() === appNamePlaceholder ) {
    $target.text('');
  }
});
appsWrapper.on('focusout', '.app-title', (e) => {
  const $target = $(e.target);
  if ( $target.text().trim() === '' ) {
    $target.text(appNamePlaceholder);
  }
});
appsWrapper.on('focus', '.app-desc', (e) => {
  const $target = $(e.target);
  if ( $target.text().trim() === appDescPlaceholder ) {
    $target.text('');
  }
});
appsWrapper.on('focusout', '.app-desc', (e) => {
  const $target = $(e.target);
  if ( $target.text().trim() === '' ) {
    $target.text(appDescPlaceholder);
  }
});
appsWrapper.on('click', '.btn-save-changes', function(){
  const appID = this.dataset.id;
  if ( !appID ) {
    return;
  }
  if ( !newAppConfig ) {
    ipcRenderer.send('show-error-msg', {
        type: 'error',
        title: 'Unexpected error',
        message: 'No MIRO app configuration was found. If this problem persists, please contact GAMS!'
    });
    return
  }
  const appTitle = $(`#appTitle_${appID}`).text().trim();
  if ( !appTitle || appTitle === appNamePlaceholder ) {
    ipcRenderer.send('show-error-msg', {
        type: 'info',
        title: 'No title',
        message: 'Please enter a title for your MIRO app!'
    });
    return
  }
  newAppConfig.title = appTitle;
  const appDescription = $(`#appDesc_${appID}`).text().trim();
  if ( appDescription && appDescription !== appDescPlaceholder ) {
    newAppConfig.description = appDescription
  }
  ipcRenderer.send('update-app', newAppConfig);
});
appsWrapper.on('click', '.reset-db-path', function(){
  const appID = this.dataset.id;
  if ( appID ) {
    $(`#appDbPathLabel_${app.id}`).text(appDbPathPlaceholder);
  } else {
    $('#newAppDbPathLabel').text(appDbPathPlaceholder);
  }
  if ( newAppConfig ) {
    delete newAppConfig.dbPath;
  }
});
appsWrapper.on('click', '.delete-app-button', function(){
  ipcRenderer.send('delete-app', this.dataset.id);
});
appsWrapper.on('click', '#btAddApp', () => {
    if ( !newAppConfig ) {
        return ipcRenderer.send('show-error-msg', {
            type: 'error',
            title: 'Unexpected error',
            message: 'No MIRO app configuration was found. If this problem persists, please contact GAMS!'
        });
    }
    const titleTmp = $('#newAppName').text().trim();
    if ( titleTmp === appNamePlaceholder || titleTmp.length < 1 ) {
        return ipcRenderer.send('show-error-msg', {
            type: 'info',
            title: 'No title',
            message: 'Please enter a title for your MIRO app!'
        });
    }
    const appDbPathTmp = $('#newAppDbPathLabel').text().trim();
    if ( appDbPathTmp !== '' && appDbPathTmp !== appDbPathPlaceholder ) {
        if ( fs.existsSync(appDbPathTmp) ) {
            newAppConfig.dbPath = appDbPathTmp;
        } else {
            return ipcRenderer.send('show-error-msg', {
                type: 'info',
                title: 'Invalid database path',
                message: 'The database path you selected does not exist.'
            });
        }
    }
    let descTmp  = $('#newAppDesc').text().trim();
    if ( descTmp === appDescPlaceholder ) {
        descTmp = '';
    }
    newAppConfig.title       = titleTmp;
    newAppConfig.description = descTmp;
    ipcRenderer.send('add-app', newAppConfig);
});
appsWrapper.on('click', '.cancel-btn', function(){
  const appID = this.dataset.id;
  if ( appID ) {
    const oldAppData = appData.find(app => app.id === appID);
    let logoPath = path.join(remote.app.getAppPath(), 'static', 'default_logo.png');
    if ( oldAppData.logoPath ) {
        logoPath = path.join(dataPath, appID, oldAppData.logoPath);
    }
    $(`#appLogo_${appID}`).css('background-image', `url('${pathToFileURL(logoPath)}')`);
    $(`#appTitle_${appID}`).text(oldAppData.title);
    $(`#appDesc_${appID}`).text(oldAppData.description);
    $(`#appDbPathLabel_${appID}`).text(oldAppData.dbPath? oldAppData.dbPath: appDbPathPlaceholder);
  }
  exitOverlayMode();
});
appsWrapper.on('click', '#addAppBox', function(){
  expandAddAppForm();
});
appsWrapper.on('drop', '.app-logo', function(e){
    e.preventDefault();
    e.stopPropagation();
    if ( !isInEditMode ) {
      return
    }
    dragAddAppCounter = 0;

    const $this = $(this);
    $this.removeClass('index-dragover').text(appLogoPlaceholder);
    const filePath = [...e.originalEvent.dataTransfer.files].map(el => el.path);
    ipcRenderer.send('validate-logo', filePath, this.dataset.id);
});
appsWrapper.on('click', '.app-logo', function(){
  if ( !isInEditMode || !$overlay.is(':visible') ) {
    return
  }
  ipcRenderer.send('browse-app', {
      title: 'Select MIRO app logo',
      message: 'Please select a logo for your MIRO app (jpg/jpeg/png supported)',
      buttonLabel: 'Choose',
      properties: [ 'openFile' ],
      filters: [
          { name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }
      ]
  }, 'validateLogo', this.dataset.id);
});
appsWrapper.on('dragenter', '#addAppBox', function(e){
  e.preventDefault();
  e.stopPropagation();
  if ( !isInEditMode ) {
    return
  }
  dragAddAppCounter++;
  $('#addAppBox').addClass('index-dragover');
  $('#addApp').addClass('btn-add-app-dragover');
});
appsWrapper.on('dragover', '#addAppBox', function(e){
  e.preventDefault();
  e.stopPropagation();
});
appsWrapper.on('dragleave', '#addAppBox', function(e){
  e.preventDefault();
  e.stopPropagation();
  if ( !isInEditMode ) {
    return
  }
  dragAddAppCounter--;
  if ( dragAddAppCounter === 0 ) {
    $('#addAppBox').removeClass('index-dragover');
    $('#addApp').removeClass('btn-add-app-dragover');
  }
});
appsWrapper.on('drop', '#addAppBox', function(e){
  e.preventDefault();
  e.stopPropagation();
  if ( !isInEditMode ) {
    return
  }
  dragAddAppCounter = 0;
  $('#addAppBox').removeClass('index-dragover');
  $('#addApp').removeClass('btn-add-app-dragover');
  const filePaths = [...e.originalEvent.dataTransfer.files].map(el => el.path);
  ipcRenderer.send('validate-app', filePaths);
});
appsWrapper.on('dragover', '.drag-drop-area', function(e){
  e.preventDefault();
  e.stopPropagation();
});
appsWrapper.on('dragenter', '.drag-drop-area', function(e){
  e.preventDefault();
  e.stopPropagation();
  if ( !isInEditMode ) {
    return
  }
  dragAddAppCounter++;
  $(this).addClass('drag-drop-area-dragover');
});
appsWrapper.on('dragleave', '.drag-drop-area', function(e){
  e.preventDefault();
  e.stopPropagation();
  if ( !isInEditMode ) {
    return
  }
  dragAddAppCounter--;
  if ( dragAddAppCounter === 0 ) {
    $(this).removeClass('drag-drop-area-dragover');
  }
});
appsWrapper.on('drop', '#newAppFiles', function(e){
  e.preventDefault();
  e.stopPropagation();
  dragAddAppCounter = 0;
  $('#newAppFiles').removeClass('index-dragover').text(appFilesPlaceholder);
  const filePaths = [...e.originalEvent.dataTransfer.files].map(el => el.path);
  ipcRenderer.send('validate-app', filePaths);
});
appsWrapper.on('click', '#newAppFiles', () => {
  ipcRenderer.send('browse-app', {
      title: 'Select MIRO app',
      message: 'Please select the MIRO app you want to add',
      buttonLabel: 'Add app',
      properties: [ 'openFile' ],
      filters: [
          { name: 'MIRO apps', extensions: ['miroapp'] }
      ]
  }, 'validateApp');
});
btEditWrapper.on('click', function(e){
  if ( $(this).hasClass('bt-disabled') ) {
    return;
  }
  toggleEditMode();
});
appsWrapper.on('click', '.app-db-path', function(){
  ipcRenderer.send('browse-app', {
      title: 'Select database path',
      message: 'Please select a directory in which the database should be located.',
      buttonLabel: 'Select',
      properties: [ 'openDirectory', 'createDirectory' ]
  }, 'dbpath-received', this.dataset.id);
});
appsWrapper.on('click', '.launch-app', function(){
  const appID = this.dataset.id;
  if ( isInEditMode || $(`#appLoadingScreen_${appID}`).is(':visible') ) {
    return;
  }
  if ( !appID ) {
    ipcRenderer.send('show-error-msg', {
        type: 'error',
        title: 'Unexpected error',
        message: 'No MIRO app configuration was found. If this problem persists, please contact GAMS!'
    });
    return;
  }
  $(`#appLoadingScreen_${appID}`).show();
  runningProcesses.push(appID);
  btEditWrapper.addClass('bt-disabled');
  ipcRenderer.send('launch-app', this.dataset);
});
ipcRenderer.on('apps-received', (e, apps, appDataPath, startup = false) => {
  if ( isInEditMode ) {
    toggleEditMode();
  }
  appData = apps;
  dataPath = appDataPath;
  const appItems = apps.reduce((html, app) => {
    let logoPath = path.join(remote.app.getAppPath(), 'static', 'default_logo.png');
    if ( app.logoPath ) {
        logoPath = path.join(appDataPath, app.id, app.logoPath);
    }
    html += `<div class="col-lg-4 col-6 miro-app-item" data-id="${app.id}" 
               data-usetmp="${app.useTmpDir}" data-mode="${app.modesAvailable[0]}" 
               data-apiver="${app.APIVersion}" data-mirover="${app.MIROVersion}">
                 <div id="appBox_${app.id}" class="app-box launch-app-box app-box-fixed-height" data-id="${app.id}">
                   <div id="appLoadingScreen_${app.id}" class="app-loading-screen" style="display:none">
                    <div class="lds-ellipsis">
                      <div>
                      </div>
                      <div>
                      </div>
                      <div>
                      </div>
                      <div>
                      </div>
                    </div>
                  </div>
                   <div>
                     <div style="height:200px;">
                         <div id="appLogo_${app.id}" style="background-image:url('${pathToFileURL(logoPath)}?v=${new Date().getTime()}');" \
title="${app.title} logo" data-id="${app.id}" class="app-logo">
                        </div>
                     </div>
                     <div style="height:125px;">
                         <h3 id="appTitle_${app.id}" class="app-title app-item-title" style="margin-top:15pt;">${app.title}</h3>
                         <p id="appDesc_${app.id}" class="app-desc app-desc-fixed app-item-desc">${app.description}</p>
                         <div class="custom-file db-path-field" style="display:none;">
                           <div id="appDbPath_${app.id}" class="custom-file-input browseFiles app-db-path" data-id="${app.id}" aria-describedby="resetDbPath"></div>
                           <label id="appDbPathLabel_${app.id}" class="custom-file-label dbpath" for="appDbPath_${app.id}">${app.dbPath? app.dbPath: appDbPathPlaceholder}</label>
                           <small data-id="${app.id}" class="form-text reset-db-path" style="${app.dbPath? '': 'display:none'}">${appDbPathReset}</small>
                         </div>
                     </div>
                     <div class="dropdown mb-3 btn-launch-wrapper">
                           ${app.modesAvailable.length <= 1 ? 
                            `<button class="btn btn-outline-secondary btn-launch launch-app" 
                               type="button" data-id="${app.id}" 
                               data-usetmp="${app.useTmpDir}" data-mode="${app.modesAvailable[0]}" 
                               data-apiver="${app.APIVersion}" data-mirover="${app.MIROVersion}">Launch</button>` : 
                            `<button class="btn btn-outline-secondary dropdown-toggle btn-launch" 
                               type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Launch</button>
                             <div class="dropdown-menu">
                                 <a class="dropdown-item launch-app" href="#" data-id="${app.id}" 
                                   data-usetmp="${app.useTmpDir}" data-mode="base" 
                                   data-apiver="${app.APIVersion}" data-mirover="${app.MIROVersion}">Base mode</a>
                                 <a class="dropdown-item launch-app" href="#" data-id="${app.id}" 
                                   data-usetmp="${app.useTmpDir}" data-mode="hcube" 
                                   data-apiver="${app.APIVersion}" data-mirover="${app.MIROVersion}">Hypercube mode</a>
                             </div>`}
                           
                    </div>
                 </div>
                 <div style="text-align:right;display:none;" class="edit-bt-group">
                     <input data-id="${app.id}" class="btn btn-secondary cancel-btn" id="btCancelChanges" value="Cancel" type="reset">
                     <button class="btn btn-secondary confirm-btn btn-save-changes" data-id="${app.id}" type="button">Save</button>
                 </div>
                 <div id="iconActive_${app.id}" class="running-app-icon app-corner-button" style="display:none;"><i class="fas fa-cog fa-spin"></i></div>
                 <a class="delete-app-button app-corner-button" data-id="${app.id}" style="display:none;"><i class="fas fa-times"></i></a>
               </div>
             </div>`
    return html
  }, '');
  const addAppWrapperHTMLFull = `<div id="addAppWrapper" class="col-lg-4 col-6" style="display:none;">
                                  ${addAppWrapperHTML}
                                </div>`;
  loadingScreen.hide();
  if (appItems.length !== 0) {
        appsWrapper.html(appItems + addAppWrapperHTMLFull + editHelper);
        noAppsNotice.hide();
    } else {
        if ( startup ) {
          animationScreen.css('display', 'flex');
          setTimeout(() => { animationScreen.hide(); }, 2900);
        }
        appsWrapper.html(addAppWrapperHTMLFull);
       noAppsNotice.show();
    }
});
$('#downloadR').click((e) => {
   shell.openExternal('https://gams.com/miro/installation.html');
});

ipcRenderer.on('dbpath-received', (e, dbpathData) => {
  if ( !dbpathData.path ) {
    return;
  }
  if ( !newAppConfig ) {
    ipcRenderer.send('show-error-msg', {
        type: 'error',
        title: 'Unexpected error',
        message: 'No MIRO app configuration was found. If this problem persists, please contact GAMS!'
    });
    return;
  }
  const appID = dbpathData.id;
  let dpPathFieldID;
  if ( appID == null ) {
    dpPathFieldID = '#newAppDbPathLabel';
  } else {
    dpPathFieldID = `#appDbPathLabel_${appID}`;
  }
  newAppConfig.dbPath = dbpathData.path[0];
  $(`${dpPathFieldID} + .reset-db-path`).show();
  $(dpPathFieldID).text(dbpathData.path[0]);
});
ipcRenderer.on('validated-logopath-received', (e, logoData) => {
  if ( !newAppConfig ) {
    return
  }
  const appID = logoData.id;
  let logoEl;
  if ( appID == null ) {
    logoEl = $('#newAppLogo');
  } else {
    logoEl = $(`#appLogo_${appID}`);
  }
  newAppConfig.logoPath = logoData.path;
  newAppConfig.logoNeedsMove = true;
  logoEl.css('background-image', `url('${pathToFileURL(newAppConfig.logoPath)}')`);
});
ipcRenderer.on('validated-logo-received', (e, logoData) => {
  if ( !newAppConfig ) {
    return
  }
  const appID = logoData.id;
  let logoEl;
  if ( appID == null ) {
    logoEl = $('#newAppLogo');
  } else {
    logoEl = $(`appLogo_${appID}`);
  }
  logoEl.css('background-image', `url('${pathToFileURL(logoData.path)}')`);
});
ipcRenderer.on('app-validated', (e, appConf) => {
    expandAddAppForm();
    newAppConfig = appConf;
    const appNameField = $('#newAppName');
    $('#btAddApp').disabled = false;
    if ( appConf.logoPathTmp ) {
        $('#newAppLogo').css('background-image', `url('${pathToFileURL(appConf.logoPathTmp)}')`);
        delete newAppConfig.logoPathTmp;
    }
    if ( appNameField.text().trim() === appNamePlaceholder ) {
        appNameField.text(appConf.id);
    }
    $('#newAppFiles').css('display', 'none');
    $('#newAppLogo').css('display', 'block');
});
ipcRenderer.on('activate-edit-mode', (e, openNewAppForm) => {
  if ( openNewAppForm ) {
    expandAddAppForm();
  }else if ( !isInEditMode ) {
    toggleEditMode();
  }
});
ipcRenderer.on('app-closed', (e, appID) => {
  $(`#iconActive_${appID}`).fadeOut(200);
  runningProcesses.pop(appID);
  if ( !runningProcesses.length ) {
    btEditWrapper.removeClass('bt-disabled');
  }
});
ipcRenderer.on('hide-loading-screen', (e, appID, success = false) => {
  $(`#appLoadingScreen_${appID}`).hide();
  if ( success ) {
    $(`#iconActive_${appID}`).show();
  } else {
    runningProcesses.pop(appID);
    if ( !runningProcesses.length ) {
      btEditWrapper.removeClass('bt-disabled');
    }
  }
});
ipcRenderer.on('invalid-r', (e) => {
  $('#rNotFoundModal').modal('show');
});
ipcRenderer.on('install-r-packages', (e) => {
  $('#installRPkgModal').modal({
      backdrop: 'static',
      keyboard: false
  });
  $('#installRPkgModal').modal('show');
});
ipcRenderer.on('install-r-packages-stdout', 
  (e, data) => {
  $('#updateRPkgStatusLog').append(
    document.createTextNode(data));
});
