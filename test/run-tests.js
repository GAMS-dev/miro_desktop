const path  = require('path');
const fs    = require('fs-extra');
const execa = require('execa');

let gamsSysDir = '';

if (typeof process.argv[2] === 'string' && process.argv[2].startsWith('gams_sys_dir')) {
    const gamsSysDirMatch = process.argv[2].match(/^gams_sys_dir="?([^"]+)"?$/);
    if (gamsSysDirMatch) {
        gamsSysDir = gamsSysDirMatch[1];
    }
}

(async () => {
    try {
        const subproc = execa('mv', ['-f', 'library', 'r/library'], {shell: true});
        subproc.stderr.pipe(process.stderr);
        subproc.stdout.pipe(process.stderr);
        await subproc;
    } catch (e) {
        console.log(`Problems replacing R library directory. Error message: ${e.message}`);
    }
    try {
        let rPath = 'Rscript';
        if ( process.platform === 'win32' ) {
            rPath = path.join(__dirname, '..', 'r', 'bin', 'Rscript');
        }
        const subproc =  execa(rPath, [ path.join(__dirname, '..', 'miro', 'run_tests.R') ],
            { env: { 'LIB_PATH': path.join(__dirname, '..', 'r', 'library'), 'GAMS_SYS_DIR': gamsSysDir},
            cwd: path.join(__dirname, '..', 'miro')});
        subproc.stderr.pipe(process.stderr);
        subproc.stdout.pipe(process.stderr);
        await subproc;
    } catch (e) {
        console.log(`Problems running R tests. Error message: ${e.message}`);
    }
})();
