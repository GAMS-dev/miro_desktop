const path  = require('path');
const fs    = require('fs-extra');
const execa = require('execa');

(async () => {
    try {
        let rPath = 'Rscript';
        if ( process.platform === 'win32' ) {
            rPath = path.join('.', 'r', 'bin', 'Rscript');
        }
        console.error(__dirname)
        const subproc =  execa(rPath, [ path.join(__dirname, '..', 'miro', 'run_tests.R') ],
            { env: { 'LIB_PATH': path.join(__dirname, '..', 'r', 'library')},
            cwd: path.join(__dirname, '..', 'miro')});
        subproc.stderr.pipe(process.stderr);
        subproc.stdout.pipe(process.stderr);
        await subproc;
    } catch (e) {
        console.log(`Problems running R tests. Error message: ${e.message}`);
    }
})();
