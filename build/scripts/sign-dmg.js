require('dotenv').config();
const execa = require('execa');
const path = require('path');

exports.default = async function signing(context) {
  const { electronPlatformName, appOutDir } = context;  
  if ( electronPlatformName !== 'darwin' ) {
    return;
  }
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

  try{
    const signProc = execa(path.join('.', 'build', 'scripts', 'sign-dmg.sh'), 
      [`"${frameworksDir}"`, codesignIdentity, `"${entitlementsFile}"`], {shell: true});
    signProc.stderr.pipe(process.stderr);
    signProc.stdout.pipe(process.stderr);
    await signProc;
  } catch (e) {
      console.log(`Problems signing app. Error message: ${e.message}`);
      throw e;
  }

  return;
};
