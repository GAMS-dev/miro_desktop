'use strict'

const { ipcRenderer } = require('electron');
window.Bootstrap = require('bootstrap');
const fs = require("fs");

const btAddApp = document.getElementById('btAddApp');
const btReset  = document.getElementById('btReset');

let currentAppConf
const appFiles = document.getElementById("appFiles");
const appLogo = document.getElementById("appLogo");
const appNameField = document.getElementById('appName');
const appDescField = document.getElementById('appDesc');
const appDbPathButton = document.getElementById('appDbPath');
const appDbPathField = document.getElementById('appDbPathLabel');
const appNamePlaceholder = "Define the app title";
const appDescPlaceholder = "Short model description (optional)";
const appDbPathPlaceholder = "Custom database location (optional)";

function validateAppLogo(filePath){
    const filteredPath = filePath.filter( el => el
        .toLowerCase()
        .match(/\.(jpg|jpeg|png)$/) );
    if ( filteredPath.length === 0 ) {
      return ipcRenderer.send("show-error-msg", {id: 'add-app', options: {
            type: "info",
            title: "Invalid MIRO app logo",
            message: "The file you selected is not a valid MIRO logo. Only jpg/jpeg and png supported!"
        }});
        return
    } else if ( filteredPath.length > 1 ) {
      return ipcRenderer.send("show-error-msg", {id: 'add-app', options: {
            type: "info",
            title: "Invalid MIRO app logo",
            message: "Please drop only a single MIRO app logo!"
        }});
    }
    const logoSize = fs.statSync(filteredPath[0]).size / 1000000.0;
    if ( logoSize > 10 ) {
        return ipcRenderer.send("show-error-msg", {id: 'add-app', options: {
            type: "info",
            title: "Logo too large",
            message: "Logos must not be larger than 10MB!"
        }});
    }
    currentAppConf.logoPath = filteredPath[0];
    currentAppConf.logoNeedsMove = true;
    appLogo.style.backgroundImage = `url('${currentAppConf.logoPath}')`;
}

appNameField.addEventListener("focus", (e) => {
    if ( appNameField.textContent.trim() === appNamePlaceholder ) {
        appNameField.textContent = "";
    }
});
appNameField.addEventListener("focusout", (e) => {
    if ( appNameField.textContent.trim() === "" ) {
        appNameField.textContent = appNamePlaceholder;
    }
});
appDescField.addEventListener("focus", (e) => {
    if ( appDescField.textContent.trim() === appDescPlaceholder ) {
        appDescField.textContent = "";
    }
});
appDescField.addEventListener("focusout", (e) => {
    if ( appDescField.textContent.trim() === "" ) {
        appDescField.textContent = appDescPlaceholder;
    }
});
appDbPathButton.addEventListener("click", (e) => {
    ipcRenderer.send("browse-app", {id: "add-app", options: {
        title: "Select database path",
        message: "Please select a directory in which the database should be located.",
        buttonLabel: "Select",
        properties: [ "openDirectory", "createDirectory" ]
    }}, "dbpath-received");
});
ipcRenderer.on("dbpath-received", (e, filePath) => {
    if ( filePath ) {
        appDbPathField.textContent = filePath[0];
    }
});

btAddApp.addEventListener('click', (e) => {
    if ( !currentAppConf ) {
        return ipcRenderer.send("show-error-msg", {id: 'add-app', options: {
            type: "error",
            title: "Unexpected error",
            message: "No MIRO app configuration was found. If this problem persists, please contact GAMS!"
        }})
    }
    const titleTmp = appNameField.textContent.trim();
    if ( titleTmp === appNamePlaceholder || titleTmp.length < 1 ) {
        return ipcRenderer.send("show-error-msg", {id: 'add-app', options: {
            type: "info",
            title: "No title",
            message: "Please enter a title for your MIRO app!"
        }})
    }
    const appDbPathTmp = appDbPathField.textContent.trim();
    if ( appDbPathTmp !== "" && appDbPathTmp !== appDbPathPlaceholder ) {
        if ( fs.existsSync(appDbPathTmp) ) {
            currentAppConf.dbPath = appDbPathTmp;
        } else {
            return ipcRenderer.send("show-error-msg", {id: 'add-app', options: {
                type: "info",
                title: "Invalid database path",
                message: "The database path you selected does not exist."
            }})
        }
    }
    let descTmp  = appDescField.textContent.trim();
    if ( descTmp === appDescPlaceholder ) {
        descTmp = "";
    }
    currentAppConf.title       = titleTmp;
    currentAppConf.description = descTmp;
    ipcRenderer.send('add-app', currentAppConf);
});
btReset.addEventListener('click', (e) => {
    currentAppConf = null;
    appLogo.style.backgroundImage = "url('../static/default_logo.png')";
    btAddApp.disabled = true;
    appFiles.style.display = "block";
    appLogo.style.display = "none";
    appFiles.classList.remove("dragover");
    appNameField.textContent = appNamePlaceholder;
    appDescField.textContent = appDescPlaceholder;
    appDbPathField.textContent = appDbPathPlaceholder;
});
appFiles.addEventListener("click", (e) => {
    ipcRenderer.send("browse-app", {id: "add-app", options: {
        title: "Select MIRO app",
        message: "Please select the MIRO app you want to add",
        buttonLabel: "Add app",
        properties: [ "openFile" ],
        filters: [
            { name: 'MIRO apps', extensions: ['miroapp'] }
        ]
    }});
});
appFiles.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    appFiles.style.background = "#F90";
    appFiles.classList.remove("dragover");
    appFiles.textContent = "Drop your MIRO app here or click to browse.";
    const filePaths = [...e.dataTransfer.files].map(el => el.path)
    ipcRenderer.send("validate-app", filePaths);
});
appFiles.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      appFiles.classList.add("dragover");
});
appFiles.addEventListener('dragleave', function (e) {
      e.preventDefault();
      e.stopPropagation();
      appFiles.classList.remove("dragover");
});
appLogo.addEventListener("click", (e) => {
    ipcRenderer.send("browse-app", {id: "add-app", options: {
        title: "Select MIRO app logo",
        message: "Please select a logo for your MIRO app (jpg/jpeg/png supported)",
        buttonLabel: "Choose",
        properties: [ "openFile" ],
        filters: [
            { name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }
        ]
    }}, "logopath-received");
});
ipcRenderer.on("logopath-received", (e, filePath) => {
    validateAppLogo(filePath);
});
appLogo.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    appFiles.style.background = "#F90";
    appFiles.textContent = "Drop your MIRO app here or click to browse.";
    const filePath = [...e.dataTransfer.files].map(el => el.path);
    validateAppLogo(filePath);
});
appLogo.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      appFiles.classList.add("dragover");
});
appLogo.addEventListener('dragleave', function (e) {
      e.preventDefault();
      e.stopPropagation();
      appFiles.classList.remove("dragover");
});
ipcRenderer.on("validated-logo-received", (e, logoPath) => {
    if ( currentAppConf ) {
        appLogo.style.backgroundImage = `url('${logoPath}')`;
    }
});
ipcRenderer.on("app-validated", (e, appConf) => {
    currentAppConf = appConf;    
    btAddApp.disabled = false;
    if ( appConf.logoPathTmp ) {
        appLogo.style.backgroundImage = `url('${appConf.logoPathTmp}')`;
        delete currentAppConf.logoPathTmp;
    }
    if ( appNameField.textContent.trim() === appNamePlaceholder ) {
        appNameField.textContent = appConf.id;
    }
    appFiles.style.display = "none";
    appLogo.style.display = "block";
});
