'use strict'

const Store = require('electron-store')

const schema = {
  apps: {
     type: "array",
     items: {
        type: "object",
        properties: {
           id: {
            type: "string",
            minLength: 1
           },
           title: {
            type: "string",
            minLength: 1
          },
          description: {
            type: "string"
          },
          logoPath: {
            type: "string",
            minLength: 1
          },
          APIVersion: {
            type: "integer",
            minimum: 1
          },
          useTmpDir: {
            type: "boolean"
          },
          MIROVersion: {
            type: "string",
            pattern: "^[0-9]+\.[0-9]+\.[0-9]+$"
          },
          modesAvailable: {
            type: "array",
            uniqueItems: true,
            minItems: 1,
            items: {
              type: "string",
              enum: [
                "base",
                "hcube"
              ]
            }
          }
        },
        required: [ "id", "title", "modesAvailable", "useTmpDir" ]
      }
  }
};

class DataStore extends Store {
  constructor () {
    super({schema})
    this.apps = this.get('apps') || []
  }

  saveApps () {
    this.set('apps', this.apps)
    return this
  }

  getApps () {
    this.apps = this.get('apps') || []
    return this
  }

  addApp (app) {
    if ( this.apps.filter(t => t.id === app.id).length ) {
      throw new Error('DuplicatedId');
    }
    this.apps = [ ...this.apps, app ]

    return this.saveApps()
  }

  deleteApp (id) {
    this.apps = this.apps.filter(t => t.id !== id)
    return this.saveApps()
  }
}

module.exports = DataStore
