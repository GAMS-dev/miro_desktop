# install required packages for MIRO
local({
    packageVersionMapTmp <- read.csv('./miro/miro-pkg-lock.csv', header = FALSE, stringsAsFactors = FALSE)
    packageVersionMapTmp <- deparse(lapply(seq_len(nrow(packageVersionMapTmp)), function(pkgIdx){
        pkgInfo <- packageVersionMapTmp[pkgIdx, ]
        pkgInfo <- trimws(c(pkgInfo[[1]], pkgInfo[[2]]))
        if(identical(pkgInfo[2], "")){
          return(pkgInfo[1])
        }
        return(pkgInfo)
    }))
    packageVersionMapTmp[1] <- paste0("packageVersionMap <- ", packageVersionMapTmp[1])
    globalsSrc = readLines('./scripts/globals.R', warn = FALSE)
    linesToReplaceLo <- grep("packageVersionMap", globalsSrc)[1] - 1
    linesToReplaceUp <- which("" == trimws(globalsSrc))
    linesToReplaceUp <- linesToReplaceUp[linesToReplaceUp > linesToReplaceLo][1]
    globalsSrc <- c(globalsSrc[seq_len(linesToReplaceLo)],
        packageVersionMapTmp,
        globalsSrc[seq(linesToReplaceUp, length(globalsSrc))])
    writeLines(globalsSrc, './scripts/globals.R')
})

source('./scripts/globals.R')
if(CIBuild){
    installedPackages <- installedPackagesTmp
    customPackages <- packageVersionMap[vapply(packageVersionMap, function(package){
        return(length(package) == 1L)
        }, logical(1), USE.NAMES = FALSE)]
}
for ( libPath in c(RLibPath, RlibPathDevel, RlibPathTmp) ) {
    if (!dir.exists(libPath) && 
        !dir.create(libPath, showWarnings = TRUE, recursive = TRUE)){
        stop(sprintf('Could not create directory: %s', libPath))
    }
}
if ( isLinux ) {
    # workaround since electron builder does 
    # not include empty directories in app image
    writeLines('', file.path(RLibPath, 'EMPTY'))
} else if ( isWindows ) {
    # make sure Rtools compilers are used on Windows
    RtoolsHome <- "C:/rtools40"
    Sys.setenv(PATH = paste(paste0(RtoolsHome, "/usr/bin/"), Sys.getenv("PATH"), sep=";"))
    Sys.setenv(BINPREF = paste0(RtoolsHome, "/mingw$(WIN)/bin/"))
}
requiredPackages <- c('devtools', 'remotes', 'jsonlite', 'V8', 
    'zip', 'tibble', 'readr', 'R6', 'processx', 
    'testthat', 'shinytest', 'Rcpp')
if ( identical(Sys.getenv('BUILD_DOCKER'), 'true') ) {
    requiredPackages <- c(requiredPackages, 'DBI', 'blob')
}
installedPackagesDevel <- installed.packages(RlibPathDevel)
newPackages <- requiredPackages[!requiredPackages %in% 
  installedPackagesDevel[, "Package"]]

# make sure correct version of packages is installed
devPkgVersionMap <- list(list('shinytest', c(1,4)), list('zip', c(2,1)))
for(devPkgToInstall in devPkgVersionMap){
    if(!devPkgToInstall[[1]] %in% newPackages){
        pkgId <- match(devPkgToInstall[[1]], installedPackagesDevel[, "Package"])
        if(!is.na(pkgId)){
            versionInstalled <- as.integer(strsplit(installedPackagesDevel[pkgId, "Version"], ".", fixed = TRUE)[[1]][c(1,2)])
            if(versionInstalled[1] == devPkgToInstall[[2]][1] && versionInstalled[2] < devPkgToInstall[[2]][2]){
                newPackages <- c(newPackages, devPkgToInstall[[1]])
            }
        }
    }
}

for ( newPackage in newPackages ) {
    install.packages(newPackage, repos = CRANMirrors[1], lib = RlibPathDevel,
        dependencies = c("Depends", "Imports", "LinkingTo"),
        INSTALL_opts = "--no-multiarch")
}

options(warn = 2)
.libPaths( c( RlibPathDevel, .libPaths()) )

listOfLibs <- character(0L)
if ( isLinux ) {
    listOfLibs <- list.files(file.path('r', 'library_src'))
}

packageIsInstalled <- function(package) {
    if ( isLinux ) {
        if ( length(package) == 2L ) {
          return(paste0(package[1], '_', package[2], '.tar.gz') %in% listOfLibs)
        }
        return(sum(grepl(paste0(package[1], '_'),
                         listOfLibs, fixed = TRUE)) > 0L)
    }
    return(package[1] %in% installedPackages)
}

dontDisplayMe <- lapply(c('devtools', 'remotes'), library, character.only = TRUE)

if ( isLinux && !dir.exists(RlibPathSrc) && 
    !dir.create(RlibPathSrc, showWarnings = TRUE, recursive = TRUE)) {
    stop(sprintf('Could not create directory: %s', RlibPathSrc))
}

if (!dir.exists('./dist/dump') && 
    !dir.create('./dist/dump', showWarnings = TRUE, recursive = TRUE)){
    stop('Could not create output directory: ./dist/dump')
}
if (dir.exists(file.path('.', 'r-src', 'build')) &&
    unlink(file.path('.', 'r-src', 'build'), recursive = TRUE, force = TRUE) != 0L){
    stop("Could not remove old contents of '.', 'r-src', 'build'")
}
if (!dir.create(file.path('.', 'r-src', 'build'))){
    stop('Could not create build directory: ./r-src/build')
}

installPackage <- function(package, attempt = 0) {
    if ( attempt == 3L ) {
        stop(sprintf('Problems installing package: %s', package[0]))
    }
    tryCatch({
        if ( isLinux ) {
            downloadPackage(package)
        } else if ( isMac && identical(package[1], "V8") ) {
            # use binary from CRAN to avoid having absolute path to v8 dylib compiled into binary
            install.packages(package[1], if(CIBuild) RlibPathTmp else RLibPath, repos = CRANMirrors[attempt + 1],
                dependencies = FALSE, INSTALL_opts = '--no-multiarch')
        } else {
            #if ( isMac && identical(package[1], 'data.table') ) {
            #    makevarsPath <- '~/.R/Makevars'
            #    if ( file.exists(makevarsPath) ) {
            #        stop("Makevars already exist. Won't overwrite!")
            #    }
            #    on.exit(unlink(makevarsPath))
            #    if (!dir.exists(dirname(makevarsPath)) && 
            #        !dir.create(dirname(makevarsPath), showWarnings = TRUE, recursive = TRUE)){
            #        stop(sprintf('Could not create directory: %s', dirname(makevarsPath)))
            #    }
            #    writeLines(c('LLVM_LOC = /usr/local/opt/llvm', 
            #        'CC=$(LLVM_LOC)/bin/clang -fopenmp',
            #       'CXX=$(LLVM_LOC)/bin/clang++ -fopenmp', 
            #       '# -O3 should be faster than -O2 (default) level optimisation ..',
            #       'CFLAGS=-g -O3 -Wall -pedantic -std=gnu99 -mtune=native -pipe', 
            #       'CXXFLAGS=-g -O3 -Wall -pedantic -std=c++11 -mtune=native -pipe',
            #       'LDFLAGS=-L/usr/local/opt/gettext/lib -L$(LLVM_LOC)/lib -Wl,-rpath,$(LLVM_LOC)/lib',
            #        'CPPFLAGS=-I/usr/local/opt/gettext/include -I$(LLVM_LOC)/include -I/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include'), 
            #    makevarsPath)
            #}
            withr::with_libpaths(if(CIBuild) RlibPathTmp else RLibPath, install_version(package[1], package[2], out = './dist/dump',
                dependencies = FALSE, repos = CRANMirrors[attempt + 1],
                INSTALL_opts = '--no-multiarch'))
        }
    }, error = function(e){
        print(conditionMessage(e))
        installPackage(package, attempt + 1)
     })
}
downloadPackage <- function(package) {
    packageFileNameTmp <- remotes::download_version(package[1], package[2],
        repos = CRANMirrors[1])
    packageFileName <- file.path(RlibPathSrc, 
        paste0(package[1], '_', package[2], '.tar.gz'))
    if (!file.rename(packageFileNameTmp, packageFileName)) {
        stop(sprintf("Problems renaming package: '%s' from '%s' to '%s'.",
            package[1], packageFileNameTmp, packageFileName))
    }
}

if(CIBuild){
    dirsInLibPath <- dir(RlibPathTmp)
    lockedLibs <- startsWith(dirsInLibPath, "00LOCK-")
    if(any(lockedLibs)){
        print(paste0("Locked libraries found. Will remove locks for these libraries: ",
            paste(dirsInLibPath[lockedLibs], collapse = ", ")))
        unlink(file.path(RlibPathTmp, dirsInLibPath[lockedLibs]),
            force = TRUE, recursive = TRUE)
    }
}

for(package in packageVersionMap){
    if ( packageIsInstalled(package) ) {
        print(sprintf("Skipping '%s' as it is already installed.", package[1]))
        next
    }
    if ( length(package) == 1L ) {
        packagePath <- build(file.path('.', 'r-src', package), 
            path = file.path('.', 'r-src', 'build/'), 
            binary = FALSE, vignettes = FALSE, manual = FALSE, 
            args = NULL, quiet = FALSE)
        if(isLinux){
            file.rename(packagePath, 
                file.path(RlibPathSrc, basename(packagePath)))
        }else{
            install.packages(packagePath, lib = if(CIBuild) RlibPathTmp else RLibPath, repos = NULL, 
                         type = "source", dependencies = FALSE, INSTALL_opts = "--no-multiarch")
        }
    } else {
        installPackage(package)
        if(CIBuild){
            installedPackagesTmp <- c(installedPackagesTmp, package[1])
        }
    }
}
if(CIBuild && !isLinux){
    # install packages to lib path devel and copy over
    for(installedPackageTmp in c(installedPackagesTmp, customPackages)){
        if(any(!file.copy(file.path(RlibPathTmp, installedPackageTmp),
            RLibPath, overwrite = TRUE, recursive = TRUE))){
            stop(sprintf("Failed to copy: %s to: %s",
                file.path(RlibPathTmp, installedPackageTmp),
                RLibPath), call. = FALSE)
        }
    }
}
# clean up unncecessary files
unlink(file.path('.', 'r-src', 'build/'), recursive = TRUE, force = TRUE)
dontDisplayMe <- lapply(list.dirs(RLibPath, full.names = TRUE, recursive = FALSE), 
    function(x) {
        unlink(file.path(x, c("help", "doc", "tests", "html",
                              "include", "unitTests", file.path("inst", "examples"),
                              file.path("libs", "*dSYM"))), force=TRUE, recursive=TRUE)
})
if ( isWindows ) {
    unlink(file.path('r', c('doc', 'tests', file.path('bin', 'i386'))), force = TRUE, recursive = TRUE)
}
# replace directories with periods in their names with symlinks 
# as directories with periods must be frameworks for codesign to not nag
if (isMac) {
    currWd <- getwd()
    setwd(file.path('.', 'r'))
    dirsWithPeriod <- list.dirs(file.path('.'))
    dirsWithPeriod <- dirsWithPeriod[grepl('.*\\..*', basename(dirsWithPeriod), perl = TRUE)]
    dirsWithPeriod <- dirsWithPeriod[dirsWithPeriod != '.']
    dirsWithPeriod <- dirsWithPeriod[vapply(Sys.readlink(dirsWithPeriod), identical, logical(1L), USE.NAMES = FALSE, '')]
    dirsWithoutPeriod <- gsub(".", "", dirsWithPeriod, fixed = TRUE)
    if ( length(dirsWithoutPeriod) ) {
        dirsWithoutPeriod <- paste0('.', dirsWithoutPeriod)
    }

    if(!all(file.rename(file.path(dirname(dirsWithoutPeriod), 
                                  basename(dirsWithPeriod)), 
        dirsWithoutPeriod))){
        stop('Some directories could not be renamed!')
    }
    currWorkDir <- getwd()
    dirsWithoutPeriod <- file.path(currWorkDir, dirsWithoutPeriod)
    dirsWithoutPeriodBase <- basename(dirsWithoutPeriod)
    dirsWithPeriod <- basename(dirsWithPeriod)
    tryCatch({
        for ( i in seq_along(dirsWithPeriod) ) {
            setwd(dirname(dirsWithoutPeriod[i]))
            file.symlink(dirsWithoutPeriodBase[i], 
                dirsWithPeriod[i])
        }
    }, error = function(e){
        stop(sprintf('Problems creating symlinks!! Error message: %s', 
            conditionMessage(e)))
    }, finally = {
        setwd(currWorkDir)
    })
    setwd(file.path('.', 'fontconfig', 'fonts', 'confd'))
    # fix some symlinks that are hardlinked to /Library/Frameworks/R.frameworks
    filesWithBadLink <- list.files('.')
    filesWithBadLink <- filesWithBadLink[filesWithBadLink != "README"]
    for ( fileWithBadLink in filesWithBadLink ) {
        unlink(fileWithBadLink, force = TRUE)
        file.symlink(file.path('..', '..', 'fontconfig', 
            'conf.avail', fileWithBadLink),
            fileWithBadLink)
    }
    setwd(currWd)
}
# replace MIRO API version, MIRO version and MIRO release date in main.js and package.json with the one set in miro/app.R
local({
    eval(parse(text = readLines('./miro/app.R',
     n = 5L, warn = FALSE)))
    writeLines(MIROVersion, './version')
    mainJS = readLines('./main.js', warn = FALSE)
    mainJS = gsub('const requiredAPIVersion = \\d+;', 
        paste0('const requiredAPIVersion = ', APIVersion, ';'), mainJS)
    mainJS = gsub("const miroVersion = '[^']+';",
        paste0("const miroVersion = '", MIROVersion, "';"), mainJS)
    mainJS = gsub("const miroRelease = '[^']+';",
        paste0("const miroRelease = '", MIRORDate, "';"), mainJS)
    writeLines(mainJS, './main.js')
    packageJSON = readLines('./package.json', warn = FALSE)
    packageJSON = gsub('"version": "[^"]+",',
        paste0('"version": "', MIROVersion, '",'), packageJSON)
    writeLines(packageJSON, './package.json')
    adminConfig = readLines('./admin/global.R', warn = FALSE)
    adminConfig = gsub('MIRO_VERSION[[:space:]]*<-[[:space:]]*"[^"]+"',
        paste0('MIRO_VERSION      <- "', MIROVersion, '"'), adminConfig)
    adminConfig = gsub("REQUIRED_API_VERSION[[:space:]]*<-.*",
        paste0("REQUIRED_API_VERSION <- ", APIVersion), adminConfig)
    writeLines(adminConfig, './admin/global.R')
    dockerImageMiro = readLines('./Dockerfile', warn = FALSE)
    dockerImageMiro = gsub('com\\.gamsmiro\\.version="[^"]+"',
        paste0('com.gamsmiro.version="', MIROVersion, '"'), dockerImageMiro)
    writeLines(dockerImageMiro, './Dockerfile')
    dockerImageAdmin = readLines('./Dockerfile-admin', warn = FALSE)
    dockerImageAdmin = gsub('com\\.gamsmiroadmin\\.version="[^"]+"',
        paste0('com.gamsmiroadmin.version="', MIROVersion, '"'), dockerImageAdmin)
    writeLines(dockerImageAdmin, './Dockerfile-admin')
    aboutDialog = readLines('./renderer/about.js', warn = FALSE)
    aboutDialog = gsub('__HASH__',
        substr(Sys.getenv('GIT_COMMIT', '__HASH__'), 1, 8), aboutDialog, fixed = TRUE)
    writeLines(aboutDialog, './renderer/about.js')
})
# build MIRO example apps
examplesPath = file.path(getwd(), 'miro', 'examples')
if (dir.exists(examplesPath)){
    unlink(examplesPath, force = TRUE, recursive = TRUE)
}
if(length(RlibPathDevel)){
    Sys.setenv(R_LIBS=file.path(getwd(), RlibPathDevel))
}
Sys.setenv(MIRO_BUILD='true')
for ( modelName in c( 'pickstock', 'transport', 'sudoku', 'tsp', 'farming', 'inscribedsquare', 'cpack' ) ) {
    if(modelName %in% c('inscribedsquare', 'cpack', 'tsp')){
        Sys.setenv(MIRO_MODE='base')
    }else{
        Sys.setenv(MIRO_MODE='full')
    }
    if(!dir.exists(file.path(examplesPath, modelName)) &&
        !dir.create(file.path(examplesPath, modelName), recursive = TRUE)){
        stop(sprintf("Could not create path: %s", examplesPath))
    }
    modelPath = file.path(getwd(), 'miro', 'model', 
                   modelName)
    miroAppPath = file.path(modelPath, paste0(modelName, '.miroapp'))

    Sys.setenv(MIRO_MODEL_PATH=file.path(modelPath, paste0(modelName, '.gms')))

    buildProc = processx::run(file.path(R.home(), 'bin', 'Rscript'), 
        c('--vanilla', './app.R'), error_on_status = FALSE,
        wd = file.path(getwd(), 'miro'))
    if(buildProc$status != 0L) {
        stop(sprintf("Something went wrong while creating MIRO app for model: %s.\n\nStdout: %s\n\nStderr: %s", 
            modelName, buildProc$stdout, buildProc$stderr))
    }
    zip::unzip(miroAppPath, exdir = file.path(examplesPath, modelName))
}
