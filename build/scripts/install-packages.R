# install required packages for MIRO
source('./r/scripts/globals.R')

if(!'devtools' %in% installed.packages(RlibPathDevel)[, "Package"]) {
    install.packages('devtools', repos = CRANMirrors[1], lib = RlibPathDevel,
        dependencies = c("Depends", "Imports", "LinkingTo"))
}
options(warn = 2)
.libPaths( c( .libPaths(), RlibPathDevel) )
library('devtools')

libPathSrc <- file.path('.', 'r', 'library_src')

if ( isLinux && !dir.exists(libPathSrc) && 
    !dir.create(libPathSrc, showWarnings = TRUE, recursive = TRUE)) {
    stop(sprintf('Could not create directory: %s', libPathSrc))
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
        } else {
            withr::with_libpaths(RLibPath, install_version(package[1], package[2], quick = TRUE, 
                local = TRUE, out = './dist/dump', 
                dependencies = FALSE, repos = CRANMirrors[attempt + 1]))
        }
    }, error = function(e){
        print(conditionMessage(e))
        installPackage(package, attempt + 1)
     })
}
downloadPackage <- function(package) {
    packageFileNameTmp <- remotes::download_version(package[1], package[2],
        repos = CRANMirrors[1])
    packageFileName <- file.path(libPathSrc, 
        paste0(package[1], '_', package[2], '.tar.gz'))
    if (!file.rename(packageFileNameTmp, packageFileName)) {
        stop(sprintf("Problems renaming package: '%s' from '%s' to '%s'.",
            package[1], packageFileNameTmp, packageFileName))
    }
}
# data.table needs some special attention on OSX due to lacking openmp support in clang
# see https://github.com/Rdatatable/data.table/wiki/Installation#openmp-enabled-compiler-for-mac
if ( !'data.table' %in% installedPackages){
    if ( isMac ) {
        makevarsPath <- '~/.R/Makevars'
        if ( file.exists(makevarsPath) ) {
            stop("Makevars already exist. Won't overwrite!")
        }
        if (!dir.exists(dirname(makevarsPath)) && 
            !dir.create(dirname(makevarsPath), showWarnings = TRUE, recursive = TRUE)){
            stop(sprintf('Could not create directory: %s', dirname(makevarsPath)))
        }
        writeLines(c('LLVM_LOC = /usr/local/opt/llvm', 
            'CC=$(LLVM_LOC)/bin/clang -fopenmp',
           'CXX=$(LLVM_LOC)/bin/clang++ -fopenmp', 
           '# -O3 should be faster than -O2 (default) level optimisation ..',
           'CFLAGS=-g -O3 -Wall -pedantic -std=gnu99 -mtune=native -pipe', 
           'CXXFLAGS=-g -O3 -Wall -pedantic -std=c++11 -mtune=native -pipe',
           'LDFLAGS=-L/usr/local/opt/gettext/lib -L$(LLVM_LOC)/lib -Wl,-rpath,$(LLVM_LOC)/lib',
            'CPPFLAGS=-I/usr/local/opt/gettext/include -I$(LLVM_LOC)/include -I/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include'), makevarsPath)
    }
    tryCatch({
        installPackage(c('data.table', '1.12.2'))
    }, error = function(e){
        stop(sprintf('Problems installing data.table: %s', conditionMessage(e)))
    }, finally = {
        if( isMac ){
            unlink(makevarsPath)
        }
    })    
}

for(package in packageVersionMap){
    if ( package[1] %in% installedPackages){
        print(sprintf("Skipping '%s' as it is already installed.", package[1]))
        next
    }
    if ( length(package) == 1L ) {
        packagePath <- build(file.path('.', 'r-src', package), path = file.path('.', 'r-src', 'build/'), 
            binary = FALSE, vignettes = FALSE, manual = FALSE, args = NULL, quiet = FALSE)
        if(isLinux){
            file.rename(packagePath, file.path(RLibPath, basename(packagePath)))
        }else{
            install.packages(packagePath, lib = RLibPath, repos = NULL, 
                         type = "source", dependencies = FALSE)
        }
    } else {
        installPackage(package)
    }
}
# clean up unncecessary files
unlink(file.path('.', 'r-src', 'build/'), recursive = TRUE, force = TRUE)
dontDisplayMe <- lapply(list.dirs(RLibPath, full.names = TRUE, recursive = FALSE), 
    function(x) {
        unlink(file.path(x, c("help", "doc", "tests", "html",
                              "include", "unitTests",
                              file.path("libs", "*dSYM"))), force=TRUE, recursive=TRUE)
})
# replace directories with periods in their names with symlinks 
# as directories with periods must be frameworks for codesign to not nag
if (isMac) {
    dirsWithPeriod <- list.dirs(file.path('.', 'r'))
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
}

