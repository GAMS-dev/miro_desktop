'use strict'

const { app } = require('electron');
const Store = require('electron-store')
const fs = require('fs');
const path  = require('path');
const which = require('which');
const execa = require('execa');
const { tmpdir } = require('os');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);

const minGams = '29.0';
const minR = '3.6';
const gamsDirNameRegex = /^(GAMS)?(\d+\.\d+)$/;

const schema = {
  configpath: {
    type: 'string',
    minLength: 2
  },
  gamspath: {
    type: 'string',
    minLength: 2
  },
  rpath: {
   type: 'string',
   minLength: 2
  },
  logpath: {
    type: 'string',
    minLength: 2
  },
  launchExternal: {
    type: 'boolean',
    default: false
  }
};

class ConfigManager extends Store {
  constructor (appRootDir, miroWorkspaceDir) {
    let configPathTmp = miroWorkspaceDir;
    super({schema, 
      cwd: configPathTmp,
      name: 'paths', 
      encryptionKey: 'MIROobfuscatedPathsConfigFile'});
    try {
      configPathTmp = super.get('configpath', '');
    } catch (e) { }

    if ( configPathTmp ) {
      try {
        const superPathConfigData = new Store({schema, 
          cwd: configPathTmp,
          name: 'paths', 
          encryptionKey: 'MIROobfuscatedPathsConfigFile'});

        [ 'gamspath', 'rpath', 'logpath' ].forEach(el => {
          this[el] = superPathConfigData.get(el, '');
        });
        this.launchExternal = superPathConfigData.get('launchExternal', false);
      } catch (e) { }
    }

    this.appRootDir = appRootDir;
    this.configpath = configPathTmp;
    this.configpathDefault = miroWorkspaceDir;
    this.logpathDefault = path.join(miroWorkspaceDir, "logs");

    [ 'gamspath', 'rpath', 'logpath' ].forEach(el => {
      this[el] = super.get(el, this[el]);
    });
    if ( this.launchExternal === false ) {
      this.launchExternal = super.get('launchExternal', false);
    }   

    return this
  }

  set (data) {
    for (const [key, value] of Object.entries(data)) {
      this[key] = value;
      if ( value == null || value === '' ) {
        super.delete(key); 
      } else {
        super.set(key, value);
      }
    }
    return this
  }

  async get (key) {
    let valTmp;

    if ( key === 'configpath' ) {
      valTmp = this.configpath;
    } else if ( key === 'rpath' ) {
      valTmp = this.rpath;
    } else if ( key === 'gamspath' ) {
      valTmp = this.gamspath;
    } else if ( key === 'logpath' ) {
      valTmp = this.logpath;
    } else if ( key === 'launchExternal' ) {
      valTmp = this.launchExternal;
    }
    // if options is not set, fetch defaults
    if ( (valTmp == null || valTmp === '') ) {
      valTmp = await this.getDefault(key);
    }
    
    return valTmp;
  }

  async getDefault (key) {
    if ( key === 'rpath' ) {
      return await this.findR();
    } else if ( key === 'gamspath' ) {
      return await this.findGAMS();
    } else if ( key === 'logpath' ) {
      return this.logpathDefault;
    } else if ( key === 'configpath' ) {
      return this.configpathDefault;
    } else {
      return false;
    }
  }

  async getAll(defaults = false){
    const keys = Object.keys(schema);
    const valuePromises = keys.map((key) => {
      if( defaults ) {
        return this.getDefault(key);
      }
      return this.get(key);
    });
    let values;
    try {
      values = await Promise.all(valuePromises);
    } catch (e) {
      console.error(e);
      return {};
    }
    return Object.fromEntries(keys.map((_, i) => [keys[i], values[i]]))
  }

  getConfigPath () {
    if ( this.configpath ) {
      return this.configpath;
    }
    return this.configpathDefault;
  }

  getSync(key) {
    return super.get(key, '');
  }

  async findR() {
    if ( this.rpathDefault ) {
      return this.rpathDefault;
    }
    if ( process.platform === 'win32' ) {
      this.rpathDefault = path.join(this.appRootDir, 'r');
    } 
    try {
      if ( !this.rpathDefault || 
        !fs.existsSync(this.rpathDefault) ) {
        if ( process.platform === 'darwin' ) {
          const rPathRoot = path.join('/', 'Library', 'Frameworks',
               'R.framework', 'Versions')
          const rVersionsAvailable = fs.readdirSync(
            rPathRoot).filter(el => {
                try {
                  return this.vComp(el, minR);
                } catch (e) {
                  return false
                }            
          });
          if ( rVersionsAvailable ) {
            this.rpathDefault = path.join(rPathRoot, 
              rVersionsAvailable[0], 'Resources');
          }
        } else {
          let rpathTmp = await which('Rscript', {nothrow: true});
          console.log(rpathTmp);
          let { stdout } = await execa(rpathTmp, ['-e', 
            'print(R.home())\nprint(paste0(R.Version()$major, \
  ".", R.Version()$minor))']);
          stdout = stdout.split('\n');
          rpathTmp = stdout[0].match(/^\[1\] "([^"]*)"$/);
          const rVersion = stdout[1].match(/^\[1\] "([^"]*)"$/);
          if ( rpathTmp && rVersion &&
            this.vComp(rVersion[1], minR) ) {
            this.rpathDefault = rpathTmp[1];
          }
        }
      }
    } catch(e) { 
      console.log(e)
      this.rpathDefault = '';
    }
    console.log(this.rpathDefault)
    return this.rpathDefault;
  }

  async findGAMS() {
    if ( this.gamspathDefault ) {
      return this.gamspathDefault;
    }
    const vCompReducer = (acc, curr) => {
      if ( this.vComp(acc, curr) ) {
        return acc;
      }
      return curr;
    };

    if ( process.platform === 'darwin' ) {
      const latestGamsInstalled = fs.readdirSync('/Applications', 
        { withFileTypes: true })
        .filter(el => el.isDirectory())
        .map(el => el.name.slice(4))
        .filter(el => gamsDirNameRegex.test(el))
        .reduce(vCompReducer);

      if ( latestGamsInstalled && 
        this.vComp(latestGamsInstalled, minGams) ) {
        this.gamspathDefault = path.join('/Applications', 
          `GAMS${latestGamsInstalled}`,
          'GAMS Terminal.app', 'Contents', 'MacOS');
      } else if ( latestGamsInstalled ) {
        console.log(`Latest installed GAMS version found: \
${latestGamsInstalled}`);
      }
    } else {
      this.gamspathDefault = path.dirname(await which('gams', 
        {nothrow: true}));
    }
    return this.gamspathDefault;
  }

  getMinimumGAMSVersion() {
    return minGams;
  }

  async validateGAMS(gamsDir) {
    let contentGamsDir
    let gamsExecDir
    try {
      contentGamsDir = await readdir(gamsDir, { withFileTypes: true });
      contentGamsDir.map(el => el.name);
    } catch (e) {
      console.error(e);
      return false
    }
    if ( contentGamsDir.find(el => el.isFile() && 
      (el === 'gams' || el === 'gams.exe')) ) {
      if ( process.platform === 'win32' ) {
        gamsExecDir = path.join(gamsDir, 'gams.exe');
      } else {
        gamsExecDir = path.join(gamsDir, 'gams');
      }
    } else {
      // gams executable not in selected folder
      contentGamsDir = contentGamsDir
        .filter(el => el.isDirectory());
      const gamsDirName = contentGamsDir.find(el => {
            gamsDirNameRegex.test(el.name)
          });
      if ( gamsDirName ) {
        if ( process.platform === 'win32' ) {
          gamsExecDir = path.join(gamsDir, gamsDirName, 'sysdir');
        } else if ( process.platform === 'darwin' ) {
          gamsExecDir = path.join(gamsDir, gamsDirName, 'GAMS Terminal.app',
            'Contents', 'MacOS', 'gams');
        } else {
          return false;
        }
      } else if ( process.platform === 'win32' && 
        contentGamsDir.find(el => el.name === 'sysdir') ) {
        gamsExecDir = path.join(gamsDir, 'sysdir');
      } else if ( process.platform === 'darwin' && 
        contentGamsDir.find(el => el.name === 'GAMS Terminal.app') ) {
        gamsExecDir = path.join(gamsDir, 'GAMS Terminal.app',
            'Contents', 'MacOS', 'gams');
        console.log(gamsExecDir);
      } else {
        return false;
      }
    }

    try {
      let { stdout } = await execa(gamsExecDir, ['/??', 'lo=3', 
        `curdir=${tmpdir}`]);
      stdout = stdout.split('\n');
      if ( stdout.length < 2 ) {
        return false;
      }
      const selectedGamsVer = stdout[1]
        .match(/^GAMS Release: (\d+\.\d+\.\d+)/);
      if ( selectedGamsVer && 
        this.vComp(selectedGamsVer[1], minGams) ) {
        return true;
      } else {
        return false;
      }
    } catch(e) {
      console.error(e);
      return false;
    }
  }

  vComp(v1, v2) {
    const v1parts = v1.split('.');
    const v2parts = v2.split('.');
    const v1Major = parseInt(v1parts[0], 10);
    const v2Major = parseInt(v2parts[0], 10);
    const v1Minor = parseInt(v1parts[1], 10);
    const v2Minor = parseInt(v2parts[1], 10);
    if ( v1Major > v2Major || (v1Major === v2Major && 
      v1Minor >= v2Minor) ) {
      return true;
    } else {
      return false;
    }
  }
}
module.exports = ConfigManager;

