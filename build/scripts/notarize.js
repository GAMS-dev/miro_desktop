require('dotenv').config();
const execa = require('execa');
const path = require('path');

exports.default = async function notarizing(context) {
  if ( process.platform !== 'darwin' || !process.env.CODESIGN_IDENTITY ) {
    return;
  }
  const appFile = `"${context.artifactPaths.filter(el => el.endsWith('.dmg'))[0]}"`;
  try{
    const notarizeProc = execa(path.join('.', 'build', 'scripts', 'notarize.sh'), 
      [appFile], {shell: true});
    notarizeProc.stderr.pipe(process.stderr);
    notarizeProc.stdout.pipe(process.stderr);
    await notarizeProc;
  } catch (e) {
      console.log(`Problems notarizing app. Error message: ${e.message}`);
      throw e;
  }
  return;
};
