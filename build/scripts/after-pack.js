require('dotenv').config();
const execa = require('execa');
const path = require('path');


exports.default = async function(context) {
     if ( process.platform === 'darwin' ) {
        const appName = context.packager.appInfo.productFilename;

        const codesignIdentity = process.env.CODESIGN_IDENTITY;

        if ( !codesignIdentity ) {
            console.log('Skipping codesign as CODESIGN_IDENTITY was not specified!');
            return;
        }
        
        const entitlementsFile = path.join(context.packager.info['_buildResourcesDir'], 
            'entitlements.mac.plist');
        const appFile = path.join(context.appOutDir, `${appName}.app`);
        const frameworksDir = path.join(appFile, 'Contents', 'Frameworks');

        const objectsToSign = [
        {
            file: path.join(frameworksDir, 'Electron Framework.framework', 'Versions', 'A', 'Libraries', 'libEGL.dylib'),
            flags: []
        },
        {
            file: path.join(frameworksDir, 'Electron Framework.framework', 'Versions', 'A', 'Libraries', 'libffmpeg.dylib'),
            flags: []
        },
        {
            file: path.join(frameworksDir, 'Electron Framework.framework', 'Versions', 'A', 'Libraries', 'libGLESv2.dylib'),
            flags: []
        },
        {
            file: path.join(frameworksDir, 'Electron Framework.framework', 'Versions', 'A', 'Libraries', 'libswiftshader_libEGL.dylib'),
            flags: []
        },
        {
            file: path.join(frameworksDir, 'Electron Framework.framework', 'Versions', 'A', 'Libraries', 'libswiftshader_libGLESv2.dylib'),
            flags: []
        },
        {
            file: path.join(frameworksDir, 'Electron Framework.framework', 'Versions', 'A', 'Resources', 'crashpad_handler'),
            flags: ['--options', 'runtime', '--entitlements', entitlementsFile]
        },
        {
            file: path.join(frameworksDir, 'Squirrel.framework', 'Versions', 'A', 'Resources', 'ShipIt'),
            flags: ['--options', 'runtime', '--entitlements', entitlementsFile]
        },
        {
            file: appFile,
            flags: ['--options', 'runtime', '--entitlements', entitlementsFile, '--deep']
        }];

        for ( const objectToSign of objectsToSign ) {
            const signProc = execa('codesign', ['--sign', codesignIdentity, '--force', 
               '--timestamp'].concat(objectToSign.flags, objectToSign.file));
            signProc.stderr.pipe(process.stderr);
            signProc.stdout.pipe(process.stderr);
            await signProc;
        }        
     }
}