const path  = require('path');
const fs    = require('fs');
const execa = require('execa');
var rimraf = require("rimraf");

let rExists = false;
if ( !fs.existsSync('./r') ) {
    fs.mkdirSync('./r');
} else {
    rExists = true;
}
const tryInstallRPackages = async (attempt = 0) => {
    if ( attempt === 3 ) {
        process.exit(1);
    }
    try {
        let rPath = 'Rscript';
        if ( process.platform === 'win32' ) {
            rPath = './r/bin/Rscript';
        }
        const subproc =  execa(rPath, [ './build/scripts/install-packages.R' ],
            { env: { 'LIB_PATH': './r/library'}});
        subproc.stderr.pipe(process.stderr);
        subproc.stdout.pipe(process.stderr);
        await subproc;
    } catch (e) {
        console.log(`Problems installing R packages. Error message: ${e.message}`);
        tryInstallRPackages(attempt + 1)
    }
}
(async () => {
    if ( !rExists ) {
        try {
            if ( process.platform === 'win32' ) {
                const subproc = execa('./get-r-win.sh', {shell: true});
                subproc.stderr.pipe(process.stderr);
                subproc.stdout.pipe(process.stderr);
                await subproc;
            }
        } catch (e) {
            console.log(`Problems installing R. Error message: ${e.message}`);
            rimraf.sync('./r');
            process.exit(1);
        }
    }
    tryInstallRPackages()
})();