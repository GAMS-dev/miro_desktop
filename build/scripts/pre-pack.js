const path  = require('path');
const fs    = require('fs-extra');
const execa = require('execa');
const https = require('https');

let rExists = false;
if ( !fs.existsSync(path.join('.', 'r')) ) {
    fs.mkdirSync(path.join('.', 'r'));
} else {
    console.log('R already exists. Skipping installation.');
    rExists = true;
}
const tryInstallRPackages = async (attempt = 0) => {
    if ( attempt === 3 ) {
        process.exit(1);
    }
    try {
        let rPath = 'Rscript';
        if ( process.platform === 'win32' ) {
            rPath = path.join('.', 'r', 'bin', 'Rscript');
        }
        const subproc =  execa(rPath, [ path.join('.', 'build', 'scripts', 'install-packages.R') ],
            { env: { 'LIB_PATH': path.join('.', 'r', 'library')}});
        subproc.stderr.pipe(process.stderr);
        subproc.stdout.pipe(process.stderr);
        await subproc;
    } catch (e) {
        console.log(`Problems installing R packages. Error message: ${e.message}`);
        tryInstallRPackages(attempt + 1)
    }
}
(async () => {
    if ( process.platform === 'win32' && !rExists ) {

    } else {
        tryInstallRPackages()
    }
})();