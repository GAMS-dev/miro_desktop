const path  = require('path');
const fs    = require('fs-extra');
const execa = require('execa');

(async () => {
    try {
        let rPath = 'Rscript';
        if ( process.platform === 'win32' ) {
            rPath = path.join('.', 'r', 'bin', 'Rscript');
        }
        const subproc =  execa(rPath, [ 'run_tests.R' ],
            { env: { 'LIB_PATH': path.join('.', 'r', 'library')},
            cwd: path.join('..', 'miro')});
        subproc.stderr.pipe(process.stderr);
        subproc.stdout.pipe(process.stderr);
        await subproc;
    } catch (e) {
        console.log(`Problems running R tests. Error message: ${e.message}`);
        exit(1);
    }
})();
