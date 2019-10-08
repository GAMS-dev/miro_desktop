'use strict'

const { ipcRenderer } = require('electron')
const path = require('path');
window.Bootstrap = require('bootstrap');

ipcRenderer.on('apps-received', (e, apps, appDataPath) => {
  const appList = document.getElementById('appsWrapper');
  const noAppsNotice = document.getElementById('noAppsDiv');
  const appItems = apps.reduce((html, app) => {
    let logoPath = "../static/default_logo.png";
    console.log(appDataPath);
    if ( app.logoPath ) {
        logoPath = path.join(appDataPath, app.id, app.logoPath);
    }
    html += `<div class="app-box col-lg-4 col-6 miro-app-item" data-id="${app.id}" 
               data-usetmp="${app.useTmpDir}" data-mode="${app.modesAvailable[0]}" 
               data-apiver="${app.APIVersion}" data-mirover="${app.MIROVersion}">
                 <div>
                     <div style="height:200px;">
                         <p style="height:180px;display:block;\
margin:auto;background-image:url('${logoPath}');background-size:cover;" \
title="${app.title} logo">
                        </p>
                     </div>
                     <div>
                         <h3 class="title" style="text-align:left;margin-top:15pt;">${app.title}</h3>
                         <p class="intro" style="text-align:left;">${app.description}</p>
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
             </div>`
    return html
  }, '')
  if (appItems.length !== 0) {
        appList.innerHTML = appItems
        noAppsNotice.style.display = "none";
    } else {
        document.getElementById("loading-screen").style.display = "flex";
        setTimeout(() => { document.getElementById("loading-screen").style.display = "none"; }, 2900);
        appList.innerHTML = "";
       noAppsNotice.style.display = "block";
    }

  appList.querySelectorAll('.miro-app-item').forEach( (el) => {
    el.addEventListener('click', function(e) {
        console.log(this.dataset.id)
    })
  })
})
