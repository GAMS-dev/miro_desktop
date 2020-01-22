'use strict'
const { remote, shell } = require('electron');
const $ = require('jquery');
const lang = remote.getGlobal('lang').update;

$('#btClose').text(lang['btClose']);

$('#btClose').on('click', () => {
    remote.getCurrentWindow().close();
});

const miroRelease = remote.getGlobal('miroRelease');
const copyrightYear = miroRelease.substr(miroRelease.length - 4);

const aboutText = `<b>GAMS MIRO v.${remote.getGlobal('miroVersion')}</b><br/><br/>\
Release Date: ${miroRelease}<br/>\
Copyright (c) 2019 - ${copyrightYear} GAMS Software GmbH &lt;support@gams.com&gt;<br/>\
Copyright (c) 2019 - ${copyrightYear} GAMS Development Corp. &lt;support@gams.com&gt;<br/><br/>\
This program is free software: you can redistribute it and/or modify it under the terms of version 3 \
of the GNU General Public License as published by the Free Software Foundation.<br/><br/>\
This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; \
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. \
See the GNU General Public License for more details.<br/><br/>\
You should have received a copy of the GNU General Public License along with this program. \
If not, see <a href="#" id="linkGnuLicense">http://www.gnu.org/licenses/</a>. \
For more information about third-party software included in MIRO, see <a href="#" id="linkMiroLicense">here</a>`;

$('#aboutText').html(aboutText);

$('#aboutText').on('click', '#linkGnuLicense', () => {
  shell.openExternal('http://www.gnu.org/licenses/');
});
$('#aboutText').on('click', '#linkMiroLicense', () => {
  shell.openExternal('http://www.gams.com/miro/license.html');
});
