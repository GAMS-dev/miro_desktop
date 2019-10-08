'use strict'

const { ipcRenderer } = require('electron');
window.Bootstrap = require('bootstrap');

let activeAppId

const removeModelModal = document.getElementById("remove-model");

const spanRemove = document.getElementsByClassName("close-modal")[0];
spanRemove.addEventListener('click', (e) => {
  removeModelModal.style.display = "none";
})
window.addEventListener('click', (e) => {
  if (event.target == removeModelModal) {
    removeModelModal.style.display = "none";
  }
})

document.getElementById("btRemoveModel").addEventListener('click', (e) => {
  removeModelModal.style.display = "none";
  ipcRenderer.send('delete-app', activeAppId);
})

ipcRenderer.on('manage-apps-received', (e, apps) => {
  const appList = document.getElementById('manageApps')
  const appItems = apps.reduce((html, app) => {
    html += `<tr class="modify-app-list-item">
               <td>${app.title}</td>
               <td>${app.description}</td>

               <td>
                   <a class="aButton" href="./modify.html">Modify</a>
                   <a class="aButton" id="shortcut-btn">Create shortcut</a>
                   <a class="aButton delete-app-button" data-id="${app.id}">Remove</a>
               </td>
            </tr>`
    return html
  }, '')
  if (appItems.length !== 0) {
        appList.innerHTML = `<table><tr>
                               <th class="column1">Title</th>
                               <th class="column2">Description</th>
                               <th class="column3">Action</th>
                             </tr>` + appItems + '</table>'
    } else {
       appList.innerHTML = '<div>No apps</div>'
    }

  appList.querySelectorAll('.delete-app-button').forEach(item => {
    item.addEventListener('click', function(e) {
      activeAppId = this.dataset.id;
      removeModelModal.style.display = "block";
    })
  })   
})
