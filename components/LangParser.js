'use strict'

const Ajv = require('ajv');
const ajv = new Ajv();
const schema = {  
   "$schema":"http://json-schema.org/draft-07/schema#",
   "title":"GAMS MIRO Launcher language file schema",
   "type":"object",
   "additionalProperties":false,
   "properties":{
     "main":{
       "type":"object",
       "additionalProperties":false,
       "properties":{
           "title": {
               "type":"string",
               "minLength":1
           },
           "noApps": {
               "type":"string",
               "minLength":1
           },
           "btEdit": {
               "type":"string",
               "minLength":1
           },
           "btEditDone": {
               "type":"string",
               "minLength":1
           },
           "btAddExamples": {
               "type":"string",
               "minLength":1
           },
           "appFilesPlaceholder": {
               "type":"string",
               "minLength":1
           },
           "appNamePlaceholder": {
               "type":"string",
               "minLength":1
           },
           "appDescPlaceholder": {
               "type":"string",
               "minLength":1
           },
           "appLogoPlaceholder": {
               "type":"string",
               "minLength":1
           },
           "appDbPathReset": {
               "type":"string",
               "minLength":1
           },
           "editAppInfoText": {
               "type":"string",
               "minLength":1
           },
           "btLaunch": {
               "type":"string",
               "minLength":1
           },
           "btLaunchBase": {
               "type":"string",
               "minLength":1
           },
           "btLaunchHcube": {
               "type":"string",
               "minLength":1
           },
           "btCancel": {
               "type":"string",
               "minLength":1
           },
           "btSave": {
               "type":"string",
               "minLength":1
           },
           "btAddApp": {
               "type":"string",
               "minLength":1
           },
           "errNoAppTitleHdr": {
               "type":"string",
               "minLength":1
           },
           "errNoAppTitleMsg": {
               "type":"string",
               "minLength":1
           },
           "errInvalidDbPathHdr": {
               "type":"string",
               "minLength":1
           },
           "errInvalidDbPathMsg": {
               "type":"string",
               "minLength":1
           },
           "dialogSelectAppLogoHdr": {
               "type":"string",
               "minLength":1
           },
           "dialogSelectAppLogoMsg": {
               "type":"string",
               "minLength":1
           },
           "dialogSelectAppLogoBtn": {
               "type":"string",
               "minLength":1
           },
           "dialogSelectAppLogoFilter": {
               "type":"string",
               "minLength":1
           },
           "dialogSelectDbPathHdr": {
               "type":"string",
               "minLength":1
           },
           "dialogSelectDbPathMsg": {
               "type":"string",
               "minLength":1
           },
           "dialogSelectDbPathBtn": {
               "type":"string",
               "minLength":1
           },
           "dialogErrHdr": {
               "type":"string",
               "minLength":1
           },
           "dialogErrMsg": {
               "type":"string",
               "minLength":1
           },
           "dialogNewAppFilesHdr": {
               "type":"string",
               "minLength":1
           },
           "dialogNewAppFilesMsg": {
               "type":"string",
               "minLength":1
           },
           "dialogNewAppFilesBtn": {
               "type":"string",
               "minLength":1
           },
           "dialogNewAppFilesFilter": {
               "type":"string",
               "minLength":1
           },
       },
       "required": ["title", "noApps", "btEdit", "btEditDone", "btAddExamples", "appFilesPlaceholder", "appNamePlaceholder", 
       "appDescPlaceholder", "appLogoPlaceholder", "appDbPathReset", "editAppInfoText", "btLaunch", "btLaunchBase", "btLaunchHcube",
       "btCancel", "btSave", "btAddApp", "errNoAppTitleHdr", "errNoAppTitleMsg" ,"errInvalidDbPathHdr",
       "errInvalidDbPathMsg", "dialogSelectAppLogoHdr", "dialogSelectAppLogoMsg", "dialogSelectAppLogoBtn",
       "dialogSelectAppLogoFilter", "dialogSelectDbPathHdr", "dialogSelectDbPathMsg", "dialogSelectDbPathBtn",
       "dialogErrHdr", "dialogErrMsg", "dialogNewAppFilesHdr", "dialogNewAppFilesMsg", "dialogNewAppFilesBtn",
       "dialogNewAppFilesFilter"]
     },
     "menu":{
       "type":"object",
       "additionalProperties":false,
       "properties":{
           "pref": {
               "type":"string",
               "minLength":1
           },
           "about": {
               "type":"string",
               "minLength":1
           },
           "services": {
               "type":"string",
               "minLength":1
           },
           "hide": {
               "type":"string",
               "minLength":1
           },
           "unhide": {
               "type":"string",
               "minLength":1
           },
           "hideothers": {
               "type":"string",
               "minLength":1
           },
           "file": {
               "type":"string",
               "minLength":1
           },
           "edit": {
               "type":"string",
               "minLength":1
           },
           "addApp": {
               "type":"string",
               "minLength":1
           },
           "editApp": {
               "type":"string",
               "minLength":1
           },
           "addExampleApps": {
               "type":"string",
               "minLength":1
           },
           "undo": {
               "type":"string",
               "minLength":1
           },
           "redo": {
               "type":"string",
               "minLength":1
           },
           "cut": {
               "type":"string",
               "minLength":1
           },
           "copy": {
               "type":"string",
               "minLength":1
           },
           "paste": {
               "type":"string",
               "minLength":1
           },
           "selectAll": {
               "type":"string",
               "minLength":1
           },
           "view": {
               "type":"string",
               "minLength":1
           },
           "window": {
               "type":"string",
               "minLength":1
           },
           "minimize": {
               "type":"string",
               "minLength":1
           },
           "zoom": {
               "type":"string",
               "minLength":1
           },
           "front": {
               "type":"string",
               "minLength":1
           },
           "close": {
               "type":"string",
               "minLength":1
           },
           "quit": {
               "type":"string",
               "minLength":1
           },
           "fullscreen": {
               "type":"string",
               "minLength":1
           },
           "help": {
               "type":"string",
               "minLength":1
           },
           "doc": {
               "type":"string",
               "minLength":1
           }
         },
         "required": ["pref", "file", "edit", "addApp", "editApp", "addExampleApps", "undo",
         "redo", "cut", "copy", "paste", "selectAll", "view", "window", "minimize", "zoom", "front", "close", 
         "quit", "fullscreen", "help", "doc"]
      }
   },
   "required": ["main", "menu"]
}

const en = {
    "main": {
        "title": "MIRO Library",
        "noApps": "No apps",
        "btEdit": "Edit", 
        "btEditDone": "Done",
        "btAddExamples": "Add example apps",
        "appFilesPlaceholder": "Drop your MIRO app here or click to browse.",
        "appNamePlaceholder": "Define the app title",
        "appDescPlaceholder": "Short model description (optional)",
        "appLogoPlaceholder": "Different app logo? Drop your MIRO app logo here or click to browse.",
        "appDbPathReset": "Reset to default",
        "editAppInfoText": "Click on app to edit",
        "btLaunch": "Launch",
        "btLaunchBase": "Base mode",
        "btLaunchHcube": "Hypercube mode",
        "btCancel": "Cancel",
        "btSave": "Save",
        "btAddApp": "Add app",
        "errNoAppTitleHdr": "No title",
        "errNoAppTitleMsg": "Please enter a title for your MIRO app!",
        "errInvalidDbPathHdr": "Invalid database path",
        "errInvalidDbPathMsg": "The database path you selected does not exist.",
        "dialogSelectAppLogoHdr": "Select MIRO app logo",
        "dialogSelectAppLogoMsg": "Please select a logo for your MIRO app (jpg/jpeg/png supported)",
        "dialogSelectAppLogoBtn": "Choose",
        "dialogSelectAppLogoFilter": "Images",
        "dialogSelectDbPathHdr": "Select database path",
        "dialogSelectDbPathMsg": "Please select a directory in which the database should be located.",
        "dialogSelectDbPathBtn": "Select",
        "dialogErrHdr": "Unexpected error",
        "dialogErrMsg": "No MIRO app configuration was found. If this problem persists, please contact GAMS!",
        "dialogNewAppFilesHdr": "Select MIRO app",
        "dialogNewAppFilesMsg": "Please select the MIRO app you want to add.",
        "dialogNewAppFilesBtn": "Add app",
        "dialogNewAppFilesFilter": "MIRO apps"
   },
   "menu": {
        "pref": "Preferences",
        "about": "About GAMS MIRO",
        "services": "Services",
        "hide": "Hide GAMS MIRO",
        "unhide": "Show All",
        "hideothers": "Hide Others",
        "file": "File",
        "edit": "Edit",
        "addApp": "➕ Add MIRO app",
        "editApp": "⚙️ Edit apps",
        "addExampleApps": "Add example apps",
        "undo": "Undo",
        "redo": "Redo",
        "cut": "Cut",
        "copy": "Copy",
        "paste": "Paste",
        "selectAll": "Select all",
        "view": "View",
        "window": "Window",
        "minimize": "Minimize",
        "zoom": "Zoom",
        "front": "Bring all to front",
        "close": "Close Window",
        "quit": "Quit",
        "fullscreen": "Toggle Full Screen",
        "help": "Help",
        "doc": "Documentation"
   }
}
const de = {
    "main": {
        "title": "MIRO Bibliothek",
        "noApps": "Keine Apps",
        "btEdit": "Bearbeiten", 
        "btEditDone": "Fertig",
        "btAddExamples": "Beispiel-Apps hinzufügen",
        "appFilesPlaceholder": "Legen Sie Ihre MIRO-App hier ab oder klicken Sie zum Durchsuchen.",
        "appNamePlaceholder": "Definieren Sie den App-Titel",
        "appDescPlaceholder": "Kurze Modellbeschreibung (optional)",
        "appLogoPlaceholder": "Anderes App-Logo? Legen Sie Ihr MIRO App-Logo hier ab oder klicken Sie zum Durchsuchen.",
        "appDbPathReset": "Zurücksetzen",
        "editAppInfoText": "Zum Bearbeiten auf App klicken",
        "btLaunch": "Starten",
        "btLaunchBase": "Basismodus",
        "btLaunchHcube": "Hypercube-Modus",
        "btCancel": "Abbrechen",
        "btSave": "Speichern",
        "btAddApp": "App hinzufügen",
        "errNoAppTitleHdr": "Kein Titel",
        "errNoAppTitleMsg": "Bitte geben Sie einen Titel für Ihre MIRO-App ein!",
        "errInvalidDbPathHdr": "Ungültiger Datenbankpfad",
        "errInvalidDbPathMsg": "Der von Ihnen gewählte Datenbankpfad existiert nicht.",
        "dialogSelectAppLogoHdr": "MIRO-App-Logo auswählen",
        "dialogSelectAppLogoMsg": "Bitte wählen Sie ein Logo für Ihre MIRO-App (jpg/jpeg/png unterstützt)",
        "dialogSelectAppLogoBtn": "Auswählen",
        "dialogSelectAppLogoFilter": "Bilder",
        "dialogSelectDbPathHdr": "Datenbankpfad auswählen",
        "dialogSelectDbPathMsg": "Bitte wählen Sie ein Verzeichnis aus, in dem sich die Datenbank befinden soll.",
        "dialogSelectDbPathBtn": "Auswählen",
        "dialogErrHdr": "Unerwarteter Fehler",
        "dialogErrMsg": "Es wurde keine MIRO-App-Konfiguration gefunden. Sollte dieses Problem weiterhin bestehen, kontaktieren Sie bitte die GAMS!",
        "dialogNewAppFilesHdr": "MIRO-App auswählen",
        "dialogNewAppFilesMsg": "Bitte wählen Sie die MIRO-App, die Sie hinzufügen möchten.",
        "dialogNewAppFilesBtn": "App hinzufügen",
        "dialogNewAppFilesFilter": "MIRO-Apps"
   },
   "menu": {
        "about": "Über GAMS MIRO",
        "services": "Dienste",
        "hide": "GAMS MIRO ausblenden",
        "unhide": "Alle anzeigen",
        "hideothers": "Andere ausblenden",
        "pref": "Einstellungen",
        "file": "Datei",
        "edit": "Bearbeiten",
        "addApp": "➕ MIRO-App hinzufügen",
        "editApp": "⚙️ Apps bearbeiten",
        "addExampleApps": "Beispiel-Apps hinzufügen",
        "undo": "Rückgängig",
        "redo": "Wiederholen",
        "cut": "Ausschneiden",
        "copy": "Kopieren",
        "paste": "Einfügen",
        "selectAll": "Alles auswählen",
        "view": "Ansicht",
        "window": "Fenster",
        "minimize": "Minimieren",
        "zoom": "Maximieren",
        "front": "Alle nach vorne bringen",
        "fullscreen": "Vollbild umschalten",
        "close": "Fenster schließen",
        "quit": "Beenden",
        "help": "Hilfe",
        "doc": "Dokumentation"
   }
}


class LangParser {
    constructor (lang) {
        if ( lang === 'de' ) {
            this.lang = de;
        } else {
            this.lang = en;
        }
        if ( !ajv.validate(schema, this.lang) ) {
            console.log(ajv.errors)
            throw new Error(ajv.errors);
        }
      
  }
  get (subkey){
     if ( subkey ) {
        return this.lang[subkey];
     }
     return this.lang;
  } 
}
module.exports = LangParser;

