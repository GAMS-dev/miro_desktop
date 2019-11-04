'use strict'

const Store = require('electron-store')

const schema = {
  apps: {
     type: 'array',
     items: {
        type: 'object',
        properties: {
           id: {
            type: 'string',
            minLength: 1
           },
           title: {
            type: 'string',
            minLength: 1
          },
          description: {
            type: 'string'
          },
          logoPath: {
            type: 'string',
            minLength: 1
          },
          dbPath: {
            type: 'string',
            minLength: 1
          },
          apiversion: {
            type: 'integer',
            minimum: 1
          },
          usetmpdir: {
            type: 'boolean'
          },
          miroversion: {
            type: 'string',
            pattern: '^[0-9]+\.[0-9]+\.[0-9]+$'
          },
          modesAvailable: {
            type: 'array',
            uniqueItems: true,
            minItems: 1,
            items: {
              type: 'string',
              enum: [
                'base',
                'hcube'
              ]
            }
          }
        },
        required: [ 'id', 'title', 'modesAvailable', 'usetmpdir' ]
      }
  }
};

class AppDataStore extends Store {
  constructor (configPath) {
    super({schema, cwd: configPath, 
      encryptionKey: 'MIROobfuscatedConfigFile'})
    this.apps = this.get('apps') || []
    console.log(this.apps)
  }

  saveApps () {
    this.set('apps', this.apps)
    return this
  }

  updateApp (app) {
    this.apps = [ ...this.apps.filter(t => t.id !== app.id), app ];
    return this.saveApps()
  }

  getApps () {
    this.apps = this.get('apps') || []
    return this
  }

  isUniqueId (id) {
    if ( this.apps.filter(t => t.id === id).length ) {
      return false;
    }
    return true;
  }

  addApp (app) {
    if ( !this.isUniqueId(app.id) ) {
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

module.exports = AppDataStore
