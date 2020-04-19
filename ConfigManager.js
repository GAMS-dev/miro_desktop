'use strict'

const { app } = require('electron');
const Store = require('electron-store')
const fs = require('fs');
const path  = require('path');
const which = require('which');
const execa = require('execa');
const { tmpdir } = require('os');

const minGams = '30.2';
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
    type: 'boolean'
  },
  remoteExecution: {
    type: 'boolean'
  },
  logLifeTime: {
    type: 'integer',
    minimum: -1
  },
  language: {
    type: 'string',
    enum: ['en', 'de', 'cn']
  },
  logLevel: {
    type: 'string',
    enum: ['TRACE', 'DEBUG', 'INFO', 
    'WARN', 'ERROR', 'FATAL']
  },
  important: {
    type: 'array',
    items:{
      type: 'string',
      enum: [
        'gamspath',
        'rpath',
        'logpath',
        'launchExternal',
        'remoteExecution',
        'logLifeTime',
        'language',
        'logLevel'
     ]
    }
  }
};

class ConfigManager extends Store {
  constructor (appRootDir, miroWorkspaceDir) {
    let configPathTmp = miroWorkspaceDir;
    super({schema, 
      cwd: configPathTmp,
      name: 'settings', 
      encryptionKey: 'MIROobfuscatedConfigFile'});
    try {
      configPathTmp = super.get('configpath', '');
    } catch (e) { }
    this.important = [];
    if ( configPathTmp ) {
      try {
        const superPathConfigData = new Store({schema, 
          cwd: configPathTmp,
          name: 'settings'});
        [ 'gamspath', 'rpath', 'logpath', 'launchExternal', 'remoteExecution',
         'logLifeTime', 'language', 'logLevel' ].forEach(el => {
          this[el] = superPathConfigData.get(el, '');
        });
        this.important = superPathConfigData.get(
          'important', []);
      } catch (e) { }
    }

    this.appRootDir = appRootDir;
    this.configpath = configPathTmp;
    this.configpathDefault = miroWorkspaceDir;
    this.logpathDefault = path.join(miroWorkspaceDir, "logs");

    [ 'gamspath', 'rpath', 'logpath', 'launchExternal', 'remoteExecution',
     'logLifeTime', 'language', 'logLevel' ].forEach(el => {
      if ( this.important.find(iel => iel === el) ) {
        return;
      }
      this[el] = super.get(el, this[el] == null? '' : this[el]);
    });
    return this
  }

  set (data) {
    for (const [key, value] of Object.entries(data)) {
      if ( !this.important.find(el => el === value) ) {
        this[key] = value;
      }
      if ( value == null || value === '' ||
       (key === 'launchExternal' && value === false) ||
       (key === 'remoteExecution' && value === false) ||
       (key === 'logLifeTime' && value === -1) ||
       (key === 'language' && value === 'en') ||
       (key === 'logLevel' && value === 'TRACE') ) {
        this[key] = '';
        super.delete(key); 
      } else {
        super.set(key, value);
      }
    }
    return this
  }

  async get (key, fallback = true) {
    let valTmp;

    valTmp = this[key];

    if ( [ 'gamspath', 'rpath' ].find(el => el === key) ) {
      if ( valTmp && !fs.existsSync(valTmp) ) {
        this[key] = valTmp = '';
      }
    }

    if ( fallback ) {
      // if options is not set, fetch defaults
      if ( (valTmp == null || valTmp === '') ) {
        valTmp = await this.getDefault(key);
      }
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
    } else if ( key === 'logLifeTime' ) {
      return -1;
    } else if ( key === 'language' ) {
      return 'en';
    } else if ( key === 'logLevel' ) {
      return 'TRACE';
    } else if ( key === 'launchExternal' ) {
      return false;
    } else if ( key === 'remoteExecution' ) {
      return false;
    }
  }

  async getAll(defaults = false){
    const keys = Object.keys(schema);
    const valuePromises = keys.map((key) => {
      if( defaults ) {
        return this.getDefault(key);
      }
      return this.get(key, '');
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

  async removeOldLogs(){
    if ( this.logLifeTime == null || 
      this.logLifeTime === '' ||
      this.logLifeTime < 0 ) {
      return true;
    }
    const now = new Date().getTime();   
    try {
      const logPath = await this.get('logpath');
      const logFiles = await fs.promises.readdir(logPath);
      if ( !logFiles ) {
        return true;
      }
      logFiles.forEach(async (logFile) => {
        if ( logFile === 'launcher.log' ) {
          return;
        }
        try{
          const fp = path.join(logPath, logFile);
          const { mtime } = await fs.promises.stat(fp);
          if ( (now - mtime.getTime()) / 
            (1000 * 3600 * 24) > this.logLifeTime ) {
            fs.promises.unlink(fp);
          } 
        } catch(e) {
          return;
        }
      });
    } catch (e) {
      console.error(e);
      return false;
    }
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
               'R.framework', 'Versions');
          const rVersionsAvailable = fs.readdirSync(
            rPathRoot).filter(el => {
                try {
                  return this.vComp(el, minR, compR = true);
                } catch (e) {
                  return false
                }            
          });
          if ( rVersionsAvailable.length ) {
            this.rpathDefault = path.join(rPathRoot, 
              rVersionsAvailable[0], 'Resources');
          }
        } else {
          let rpathTmp = await which('Rscript', {nothrow: true});
          rpathTmp = await this.validateR(rpathTmp);
          if ( rpathTmp !== false ) {
            this.rpathDefault = rpathTmp;
          }
        }
      }
    } catch(e) { 
      console.log(e)
      this.rpathDefault = '';
    }
    return this.rpathDefault;
  }

  async validateR(rpath) {
    if ( !rpath ) {
      return false;
    }
    let rpathTmp = rpath;

    if ( !path.basename(rpathTmp).toLowerCase().startsWith('rscript') ) {
      if ( !fs.lstatSync(rpathTmp).isDirectory() ) {
        return false;
      }
      // Directory was selected, so scan it
      let contentRDir;
      try {
        contentRDir = await fs.promises.readdir(rpathTmp, 
          { withFileTypes: true });
      } catch (e) {
        console.error(e);
        return false;
      }
      if ( contentRDir.find(el => el.name === 'bin') ) {
        if ( process.platform === 'win32' ) {
          rpathTmp = path.join(rpathTmp, 'bin', 'x64');
        } else {
          rpathTmp = path.join(rpathTmp, 'bin');
        }
      } else if ( contentRDir.find(el => el.name === 'Resources') ) {
        rpathTmp = path.join(rpathTmp, 'Resources', 'bin');
      } else if ( !contentRDir.find(el => el.isFile() && 
           (el.name === 'Rscript' || el.name === 'Rscript.exe')) ) {
        return false;
      }
      if ( process.platform === 'win32' ) {
        rpathTmp = path.join(rpathTmp, 'Rscript.exe');
      } else {
        rpathTmp = path.join(rpathTmp, 'Rscript');
      }
      if (!fs.existsSync(rpathTmp)) {
        return false;
      }
    }
    let { stdout } = await execa(rpathTmp, ['-e', 
      'print(R.home())\nprint(paste0(R.Version()$major, \
".", R.Version()$minor))']);
    if ( ! stdout ) {
      return false;
    }
    stdout = stdout.split('\n');
    if(stdout.length < 2){
      return false;
    }
    const rOutRegex = /^\[1\] "([^"]*)"/;
    const rpathIdx = stdout.findIndex(line => rOutRegex.test(line));
    if ( rpathIdx === -1 ) {
      return false;
    }
    rpathTmp = stdout[rpathIdx].match(rOutRegex);
    const rVersion = stdout[rpathIdx + 1].match(/^\[1\] "([^"]*)"$/);
    if ( rpathTmp && rVersion &&
      this.vComp(rVersion[1], minR, compR = true) ) {
      return rpathTmp[1];
    }
    return false;
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
      let latestGamsInstalled = fs.readdirSync('/Applications', 
        { withFileTypes: true })
        .filter(el => el.isDirectory() && gamsDirNameRegex.test(el.name));
      if ( latestGamsInstalled ) {
        latestGamsInstalled = latestGamsInstalled
        .map(el => el.name.slice(4))
        .reduce(vCompReducer);
      }

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
      try {
        this.gamspathDefault = path.dirname(await which('gams',
          {nothrow: true}));
      } catch ( e ) { }
    }

    if ( !this.gamspathDefault  && process.platform === 'win32' ) {
      let latestGamsInstalled = fs.readdirSync('C:\\GAMS\\win64', 
            { withFileTypes: true })
            .filter(el => el.isDirectory() && gamsDirNameRegex.test(el.name))
            .map(el => el.name);
      if ( latestGamsInstalled ) {
        latestGamsInstalled = latestGamsInstalled
        .reduce(vCompReducer);
      }

      if ( latestGamsInstalled && 
        this.vComp(latestGamsInstalled, minGams) ) {
        this.gamspathDefault = path.join('C:\\GAMS\\win64', 
          latestGamsInstalled);
      } else if ( latestGamsInstalled ) {
        console.log(`Latest installed GAMS version found: \
  ${latestGamsInstalled}`);
      }
    }
    
    return this.gamspathDefault;
  }

  getMinimumVersion(type) {
    if ( type.toLowerCase() === 'gams' ) {
      return minGams;
    }
    return minR;
  }

  async validateGAMS(gamsDir) {
    let contentGamsDir
    let gamsExecDir
    try {
      contentGamsDir = await fs.promises.readdir(gamsDir, 
        { withFileTypes: true });
    } catch (e) {
      console.error(e);
      return false
    }
    if ( contentGamsDir.find(el => el.isFile() && 
      (el.name === 'gams' || el.name === 'gams.exe')) ) {
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
          gamsExecDir = path.join(gamsDir, gamsDirName, 'sysdir', 'gams.exe');
        } else if ( process.platform === 'darwin' ) {
          gamsExecDir = path.join(gamsDir, gamsDirName, 'GAMS Terminal.app',
            'Contents', 'MacOS', 'gams');
        } else {
          return false;
        }
      } else if ( process.platform === 'win32' && 
        contentGamsDir.find(el => el.name === 'sysdir') ) {
        gamsExecDir = path.join(gamsDir, 'sysdir', 'gams.exe');
      } else if ( process.platform === 'darwin' && 
        contentGamsDir.find(el => el.name === 'GAMS Terminal.app') ) {
        gamsExecDir = path.join(gamsDir, 'GAMS Terminal.app',
            'Contents', 'MacOS', 'gams');
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
        return path.dirname(gamsExecDir);
      } else {
        return false;
      }
    } catch(e) {
      console.error(e);
      return false;
    }
  }

  async validate(id, pathToValidate){
    if ( id === 'gams' ) {
      return await this.validateGAMS(pathToValidate);
    }
    return await this.validateR(pathToValidate);
  }

  vComp(v1, v2, compR = false) {
    if ( compR && process.platform === 'darwin' ) {
      // since packages need to be recompiled on R 4.0, r 3.6 is the only supported version on Mac
      return v1 === v2;
    }
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

