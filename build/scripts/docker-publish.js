const path  = require('path');
const execa = require('execa');
const fs = require('fs');


(async () => {
    if ( process.platform != 'linux' ) {
        console.error('Please publish images on Linux!');
        process.exit(1);
    }
    const miroVersion = fs.readFileSync('version', 'utf8').trim();
    try {
        const subproc =  execa('docker', [ 'tag', 'gamsmiro-ui', 'hub.gams.com/gamsmiro-ui' ]);
        subproc.stderr.pipe(process.stderr);
        subproc.stdout.pipe(process.stderr);
        await subproc;
    } catch (e) {
        console.log(`Problems tagging docker image. Error message: ${e.message}`);
        process.exit(1);
    }
    try {
        const subproc =  execa('docker', [ 'tag', 'gamsmiro-ui', `hub.gams.com/gamsmiro-ui:${miroVersion}` ]);
        subproc.stderr.pipe(process.stderr);
        subproc.stdout.pipe(process.stderr);
        await subproc;
    } catch (e) {
        console.log(`Problems tagging docker image. Error message: ${e.message}`);
        process.exit(1);
    }
    try {
        const subproc =  execa('docker', [ 'push', 'hub.gams.com/gamsmiro-ui' ]);
        subproc.stderr.pipe(process.stderr);
        subproc.stdout.pipe(process.stderr);
        await subproc;
    } catch (e) {
        console.log(`Problems pushing docker image. Error message: ${e.message}`);
        process.exit(1);
    }
    try {
        const subproc =  execa('docker', [ 'push', `hub.gams.com/gamsmiro-ui:${miroVersion}` ]);
        subproc.stderr.pipe(process.stderr);
        subproc.stdout.pipe(process.stderr);
        await subproc;
    } catch (e) {
        console.log(`Problems pushing docker image. Error message: ${e.message}`);
        process.exit(1);
    }
})();