CRANMirrors <- c('http://cran.us.r-project.org',
    'https://cran.cnr.berkeley.edu/',
    'https://stat.ethz.ch/CRAN/')

RLibPath <- Sys.getenv('LIB_PATH')

if ( identical(RLibPath, '') ) {
    stop("Library path not specified. Use environment variable LIB_PATH to specify where libraries should be installed.", 
        call. = FALSE)
}

isMac <- Sys.info()['sysname'] == 'Darwin' || grepl("^darwin", R.version$os)
isWindows <- .Platform$OS.type == 'windows'
isLinux <- grepl("linux-gnu", R.version$os)

RlibPathDevel <- if(isWindows || identical(Sys.getenv("BUILD_NUMBER"), "")) './build/lib_devel'
RlibPathSrc <- file.path('.', 'r', 'library_src')

packageVersionMap <- list(
    c('backports', '1.1.5'))
dataTableVersionMap <- c('data.table', '1.12.2')
installedPackages <- installed.packages(RLibPath)[, "Package"]
