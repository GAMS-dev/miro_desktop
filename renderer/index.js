'use strict'

const { ipcRenderer } = require('electron')
const path = require('path');
window.Bootstrap = require('bootstrap');
const $ = require('jquery');

const btRemoveConfirm = document.getElementById("btRemoveModel");
const appsWrapper = $("#appsWrapper");
const btEdit = document.getElementById("btEdit");
const addAppWrapperHTML = `<div id="addAppBox" class="add-app-box">
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
const appFilesPlaceholder = "Drop your MIRO app here or click to browse.";
const appNamePlaceholder = "Define the app title";
const appDescPlaceholder = "Short model description (optional)";
const appDbPathPlaceholder = "Custom database location (optional)";
const appLogoPlaceholder = "Different app logo? Drop your MIRO app logo here or click to browse.";
  
let appData
let dataPath
let newAppConfig

let dragAddAppCounter = 0;
let isInEditMode = false;
  
const $overlay = $("#overlayScreen");
const $body = $("body");

function toggleEditMode(){
  if ( isInEditMode ) {
    exitOverlayMode();
    btEdit.textContent = "Edit";
    $(".delete-app-button").hide();
    $("#addAppWrapper").fadeOut(200);
    $('.edit-bt-group').hide();
    $('.db-path-field').hide();
    isInEditMode = false;
  } else {
    btEdit.textContent = "Done";
    newAppConfig  = null;
    $(".delete-app-button").show();
    $("#addAppWrapper").fadeIn(200);
    isInEditMode = true;
  }
}
function exitOverlayMode(){
  if ( $('#expandedAddAppWrapper').is(':visible') ) {
    $("#addAppWrapper").html(addAppWrapperHTML);
  }
  if ( $overlay.is(":visible") ) {
    $('.app-logo').empty().removeClass('drag-drop-area');
    $('.app-item-title').removeClass('editable').attr('contenteditable', false);
    $('.app-item-desc').removeClass('editable').attr('contenteditable', false);
    $('.db-path-field').slideUp(200);
    $('.edit-bt-group').slideUp(200);
    $overlay.hide();
    $overlay.data('current').css('z-index', 1);
  }
}
function expandAddAppForm(){
  if ( $("#expandedAddAppWrapper").is(":visible") ) {
    return
  }
  if ( !isInEditMode ) {
    toggleEditMode();
  }
  const addAppWrapper = $("#addAppWrapper");
  addAppWrapper.css( 'z-index', 11 );
  $overlay.data('current', addAppWrapper).fadeIn(300);
  addAppWrapper.html(`<div class="app-box" id="expandedAddAppWrapper">
                        <div style="height:200px;">
                           <div class="drag-drop-area app-window" id="newAppFiles">
                              <div class="drag-drop-area-text">
                                 ${appFilesPlaceholder}
                              </div>
                           </div>
                            <div class="drag-drop-area add-app-logo app-logo" id="newAppLogo" style="display:none">
                              <div class="drag-drop-area-text">
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
    if ( !isInEditMode || $overlay.is(":visible") || 
      $target.hasClass("cancel-btn") || 
      $target.hasClass('delete-app-button') || 
      $target.parents('.delete-app-button').length ) {
      return
    }
    const $this = $(this);
    const appID = this.dataset.id;
    if ( appID ) {
      newAppConfig = appData.find(app => app.id === appID);
      if ( !newAppConfig ) {
        ipcRenderer.send("show-error-msg", {
            type: "error",
            title: "Unexpected error",
            message: "No MIRO app configuration was found. If this problem persists, please contact GAMS!"
        });
        return;
      }
      $(`#appLogo_${appID}`).html(`<div class="drag-drop-area-text">${appLogoPlaceholder}</div>`).addClass('drag-drop-area');
      $(`#appTitle_${appID}`).addClass('editable').attr('contenteditable', true);
      const appDescField = $(`#appDesc_${appID}`);
      appDescField.addClass('editable').attr('contenteditable', true);
      if ( !appDescField.text().trim() ) {
        appDescField.text(appDescPlaceholder);
      }
    }
    $('.db-path-field').slideDown(200);
    $('.edit-bt-group').slideDown(200);
    $this.css( 'z-index', 11 );
    $overlay.data('current', $this).fadeIn(300);
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
  const appID = $(this).data('id');
  if ( !appID ) {
    return;
  }
  if ( !newAppConfig ) {
    ipcRenderer.send("show-error-msg", {
        type: "error",
        title: "Unexpected error",
        message: "No MIRO app configuration was found. If this problem persists, please contact GAMS!"
    });
    return
  }
  const appTitle = $(`#appTitle_${appID}`).text().trim();
  if ( !appTitle || appTitle === appNamePlaceholder ) {
    ipcRenderer.send("show-error-msg", {
        type: "info",
        title: "No title",
        message: "Please enter a title for your MIRO app!"
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
appsWrapper.on('click', '.delete-app-button', function(){
  ipcRenderer.send("delete-app", $(this).data('id'));
});
appsWrapper.on('click', '#btAddApp', () => {
    if ( !newAppConfig ) {
        return ipcRenderer.send("show-error-msg", {
            type: "error",
            title: "Unexpected error",
            message: "No MIRO app configuration was found. If this problem persists, please contact GAMS!"
        });
    }
    const titleTmp = $('#newAppName').text().trim();
    if ( titleTmp === appNamePlaceholder || titleTmp.length < 1 ) {
        return ipcRenderer.send("show-error-msg", {
            type: "info",
            title: "No title",
            message: "Please enter a title for your MIRO app!"
        });
    }
    const appDbPathTmp = $('#newAppDbPathLabel').text().trim();
    if ( appDbPathTmp !== "" && appDbPathTmp !== appDbPathPlaceholder ) {
        if ( fs.existsSync(appDbPathTmp) ) {
            newAppConfig.dbPath = appDbPathTmp;
        } else {
            return ipcRenderer.send("show-error-msg", {
                type: "info",
                title: "Invalid database path",
                message: "The database path you selected does not exist."
            });
        }
    }
    let descTmp  = $('#newAppDesc').text().trim();
    if ( descTmp === appDescPlaceholder ) {
        descTmp = "";
    }
    newAppConfig.title       = titleTmp;
    newAppConfig.description = descTmp;
    ipcRenderer.send('add-app', newAppConfig);
});
appsWrapper.on('click', '.cancel-btn', function(){
  const appID = $(this).data('id');
  if ( appID ) {
    const oldAppData = appData.find(app => app.id === appID);
    let logoPath = "../static/default_logo.png";
    if ( oldAppData.logoPath ) {
        logoPath = path.join(dataPath, appID, oldAppData.logoPath);
    }
    $(`#appLogo_${appID}`).css('background-image', `url('${logoPath}')`);
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
    ipcRenderer.send("validate-logo", filePath, $this.data('id'));
});
appsWrapper.on('click', '.app-logo', function(){
  if ( !isInEditMode || !$overlay.is(":visible") ) {
    return
  }
  ipcRenderer.send("browse-app", {
      title: "Select MIRO app logo",
      message: "Please select a logo for your MIRO app (jpg/jpeg/png supported)",
      buttonLabel: "Choose",
      properties: [ "openFile" ],
      filters: [
          { name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }
      ]
  }, "validateLogo", $(this).data('id'));
});
appsWrapper.on('dragenter', '#addAppBox', function(e){
  e.preventDefault();
  e.stopPropagation();
  if ( !isInEditMode ) {
    return
  }
  dragAddAppCounter++;
  $("#addAppBox").addClass("index-dragover");
  $("#addApp").addClass("btn-add-app-dragover");
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
    $("#addAppBox").removeClass("index-dragover");
    $("#addApp").removeClass("btn-add-app-dragover");
  }
});
appsWrapper.on('drop', '#addAppBox', function(e){
  e.preventDefault();
  e.stopPropagation();
  if ( !isInEditMode ) {
    return
  }
  dragAddAppCounter = 0;
  $("#addAppBox").removeClass("index-dragover");
  $("#addApp").removeClass("btn-add-app-dragover");
  const filePaths = [...e.originalEvent.dataTransfer.files].map(el => el.path);
  ipcRenderer.send("validate-app", filePaths);
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
  $(this).addClass("index-dragover");
});
appsWrapper.on('dragleave', '.drag-drop-area', function(e){
  e.preventDefault();
  e.stopPropagation();
  if ( !isInEditMode ) {
    return
  }
  dragAddAppCounter--;
  if ( dragAddAppCounter === 0 ) {
    $(this).removeClass("index-dragover");
  }
});
appsWrapper.on('drop', '#newAppFiles', function(e){
  e.preventDefault();
  e.stopPropagation();
  dragAddAppCounter = 0;
  $("#newAppFiles").removeClass("index-dragover").text(appFilesPlaceholder);
  const filePaths = [...e.originalEvent.dataTransfer.files].map(el => el.path);
  ipcRenderer.send("validate-app", filePaths);
});
appsWrapper.on('click', '#newAppFiles', () => {
  ipcRenderer.send("browse-app", {
      title: "Select MIRO app",
      message: "Please select the MIRO app you want to add",
      buttonLabel: "Add app",
      properties: [ "openFile" ],
      filters: [
          { name: 'MIRO apps', extensions: ['miroapp'] }
      ]
  }, "validateApp");
});
btEdit.addEventListener('click', (e) => {
  toggleEditMode();
});
appsWrapper.on('click', '.app-db-path', function(){
  ipcRenderer.send("browse-app", {
      title: "Select database path",
      message: "Please select a directory in which the database should be located.",
      buttonLabel: "Select",
      properties: [ "openDirectory", "createDirectory" ]
  }, "dbpath-received", $(this).data('id'));
});
ipcRenderer.on('apps-received', (e, apps, appDataPath) => {
  if ( isInEditMode ) {
    toggleEditMode();
  }
  const noAppsNotice = document.getElementById('noAppsDiv');
  appData = apps;
  dataPath = appDataPath;
  const appItems = apps.reduce((html, app) => {
    let logoPath = "../static/default_logo.png";
    if ( app.logoPath ) {
        logoPath = path.join(appDataPath, app.id, `${app.logoPath}?v=${new Date().getTime()}`);
    }
    html += `<div class="col-lg-4 col-6 miro-app-item" data-id="${app.id}" 
               data-usetmp="${app.useTmpDir}" data-mode="${app.modesAvailable[0]}" 
               data-apiver="${app.APIVersion}" data-mirover="${app.MIROVersion}">
                 <div class="app-box" data-id="${app.id}">
                   <div>
                     <div style="height:200px;">
                         <div id="appLogo_${app.id}" style="height:180px;display:block;\
margin:auto;background-image:url('${logoPath}');background-size:cover;" \
title="${app.title} logo" data-id="${app.id}" class="app-logo">
                        </div>
                     </div>
                     <div>
                         <h3 id="appTitle_${app.id}" class="app-title app-item-title" style="text-align:left;margin-top:15pt;">${app.title}</h3>
                         <p id="appDesc_${app.id}" class="app-desc app-item-desc" style="text-align:left;">${app.description}</p>
                         <div class="custom-file db-path-field" style="display:none;">
                           <div id="appDbPath_${app.id}" class="custom-file-input browseFiles app-db-path" data-id="${app.id}"></div>
                           <label id="appDbPathLabel_${app.id}" class="custom-file-label dbpath" for="appDbPath_${app.id}">${app.dbPath? app.dbPath: appDbPathPlaceholder}</label>
                         </div>
                     </div>
                     <div class="input-group mb-3"${app.modesAvailable.length <= 1 ? ' style="visibility:hidden;"' : ''}>
                         <div class="input-group-prepend">
                           <button class="btn btn-outline-secondary dropdown-toggle btn-launch" 
                             type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Launch</button>
                           <div class="dropdown-menu">
                               <a class="dropdown-item" href="#">Base mode</a>
                               <a class="dropdown-item" href="#">Hypercube mode</a>
                           </div>
                        </div>
                    </div>
                 </div>
                 <div style="text-align:right;display:none;" class="edit-bt-group">
                     <input data-id="${app.id}" class="btn btn-secondary cancel-btn" id="btCancelChanges" value="Cancel" type="reset">
                     <button class="btn btn-secondary confirm-btn btn-save-changes" data-id="${app.id}" type="button">Save</button>
                 </div>
                 <a class="delete-app-button" data-id="${app.id}" style="display:none;"><i class="fas fa-times"></i></a>
               </div>
             </div>`
    return html
  }, '');
  const addAppWrapperHTMLFull = `<div id="addAppWrapper" class="col-lg-4 col-6" style="display:none;">
                                  ${addAppWrapperHTML}
                                </div>`;
  if (appItems.length !== 0) {
        appsWrapper.html(appItems + addAppWrapperHTMLFull);
        noAppsNotice.style.display = "none";
    } else {
        document.getElementById("loading-screen").style.display = "flex";
        setTimeout(() => { document.getElementById("loading-screen").style.display = "none"; }, 2900);
        appsWrapper.html(addAppWrapperHTMLFull);
       noAppsNotice.style.display = "block";
    }
});

ipcRenderer.on("dbpath-received", (e, dbpathData) => {
  if ( !dbpathData.path ) {
    return;
  }
  const appID = dbpathData.id;
  let dpPathField;
  if ( appID == null ) {
    dpPathField = $("#newAppDbPathLabel");
  } else {
    dpPathField = $(`#appDbPathLabel_${appID}`);
  }
  dpPathField.text(dbpathData.path[0]);
});
ipcRenderer.on("validated-logopath-received", (e, logoData) => {
  if ( !newAppConfig ) {
    return
  }
  const appID = logoData.id;
  let logoEl;
  if ( appID == null ) {
    logoEl = $("#newAppLogo");
  } else {
    logoEl = $(`#appLogo_${appID}`);
  }
  newAppConfig.logoPath = logoData.path;
  newAppConfig.logoNeedsMove = true;
  logoEl.css('background-image', `url('${newAppConfig.logoPath}')`);
});
ipcRenderer.on("validated-logo-received", (e, logoData) => {
  if ( !newAppConfig ) {
    return
  }
  const appID = logoData.id;
  let logoEl;
  if ( appID == null ) {
    logoEl = $("#newAppLogo");
  } else {
    logoEl = $(`appLogo_${appID}`);
  }
  logoEl.css('background-image', `url('${logoData.path}')`);
});
ipcRenderer.on("app-validated", (e, appConf) => {
    expandAddAppForm();
    newAppConfig = appConf;
    const appNameField = $('#newAppName');
    $("#btAddApp").disabled = false;
    if ( appConf.logoPathTmp ) {
        $("#newAppLogo").css('background-image', `url('${appConf.logoPathTmp}')`);
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
