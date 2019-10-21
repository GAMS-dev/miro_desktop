const path  = require('path');
const fs    = require('fs');
const execa = require('execa');
var rimraf = require("rimraf");

if ( fs.existsSync('./r') ) {
    process.exit(0);
} else {
    fs.mkdirSync('./r');
}
(async () => {
    try {
        if ( process.platform === 'win32' ) {
            const subproc = execa('./get-r-win.sh', {shell: true});
            subproc.stderr.pipe(process.stderr);
            subproc.stdout.pipe(process.stderr);
            await subproc;
        } else if ( process.platform === 'darwin' ) {
            const subproc =  execa('./get-r-mac.sh', {shell: '/bin/bash'});
            subproc.stderr.pipe(process.stderr);
            subproc.stdout.pipe(process.stderr);
            await subproc;
        }
    } catch (e) {
        console.log(`Problems installing R. Error message: ${e.message}`);
        rimraf.sync('./r');
        process.exit(1);
    }
    try {
        const subproc =  execa('Rscript', [ './build/scripts/install-packages.R' ]);
        subproc.stderr.pipe(process.stderr);
        subproc.stdout.pipe(process.stderr);
        await subproc;
    } catch (e) {
        console.log(`Problems installing R packages. Error message: ${e.message}`);
        //rimraf.sync('./r');
        process.exit(1);
    }
})();