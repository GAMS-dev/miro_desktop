CRANMirrors <- c('https://cloud.r-project.org/',
    'https://ftp.fau.de/cran/',
    'https://stat.ethz.ch/CRAN/')

RLibPath <- Sys.getenv('LIB_PATH')
packageVersionMap <- list(
    c('backports', '1.1.7'))
dataTableVersionMap <- c('data.table', '1.12.2')

isMac <- Sys.info()['sysname'] == 'Darwin' || grepl("^darwin", R.version$os)
isWindows <- .Platform$OS.type == 'windows'
isLinux <- grepl("linux-gnu", R.version$os)

if ( identical(Sys.getenv('BUILD_DOCKER'), 'true') ) {
    if ( identical(RLibPath, "") ) {
        RLibPath <- NULL
    }
    isMac     <- FALSE
    isWindows <- FALSE
    isLinux   <- TRUE
    packageVersionMap <- c(packageVersionMap, list("RPostgres"))
} else {
    if ( identical(RLibPath, '') ) {
        stop("Library path not specified. Use environment variable LIB_PATH to specify where libraries should be installed.", 
            call. = FALSE)
    }
}

# on Jenkins use default library
RlibPathDevel <- NULL
if(identical(Sys.getenv("BUILD_NUMBER"), "")){
    RlibPathDevel <-  './build/lib_devel'
} else if(isWindows) {
    # on Windows, we use the R version we ship, so we need to set library path explicitly, or
    # it will install development libraries inside ./r/library
    RlibPathDevel <- paste0('~/R/win-library/', R.version[['major']], ".",
        strsplit(R.version[['minor']], '.', fixed = TRUE)[[1]][1])
}
RlibPathSrc <- file.path('.', 'r', 'library_src')

installedPackages <- installed.packages(RLibPath)[, "Package"]
