const path  = require('path');
const fs    = require('fs-extra');
const execa = require('execa');
const rimraf = require('rimraf');
const http = require('http');

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
        try {
            console.log('Installing R...');
            const file = fs.createWriteStream(path.join('r', 'latest_r.exe'));
            const request = http.get('https://cloud.r-project.org/bin/windows/base/R-3.6.1-win.exe', function(response) {
                response.pipe(file);

                file.on('finish', function() {
                    file.close(async () => {
                        const subproc = execa('innoextract', ['-e', 'latest_r.exe'], 
                            {cwd: path.join('.', 'r')});
                        subproc.stderr.pipe(process.stderr);
                        subproc.stdout.pipe(process.stderr);
                        await subproc;
                        try {
                            await fs.move(path.join('.', 'r', 'app'), path.join('.', 'r'))
                            rimraf.sync(path.join('.', 'r', 'app'));
                            fs.unlinkSync(path.join('.', 'r', 'latest_r.exe'))
                        } catch (e) {
                            console.log(`Problems installing R. Error message: ${e.message}`);
                            rimraf.sync(path.join('.', 'r'));
                            process.exit(1);
                        }
                    });
                });
            }).on('error', function(e) {
                console.log(`Problems installing R. Error message: ${e.message}`);
                rimraf.sync(path.join('.', 'r'));
                process.exit(1);
            });
        } catch (e) {
            console.log(`Problems installing R. Error message: ${e.message}`);
            rimraf.sync(path.join('.', 'r'));
            process.exit(1);
        }
    } else {
        tryInstallRPackages()
    }
})();