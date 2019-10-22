# install required packages for MIRO

CRANMirror <- "https://cloud.r-project.org/"
RLibPath <- "./r/library"

packageVersionMap <- list(
    c('assertthat', '0.2.1'),
    c('crayon', '1.3.4'),
    c('cli', '1.1.0'),
    c('fansi', '0.4.0'),
    c('utf8', '1.1.4'),
    c('Rcpp', '1.0.2'),
    c('R6', '2.4.0'),
    c('BH', '1.69.0-1'),
    c('magrittr', '1.5'),
    c('httpuv', '1.5.1'),
    c('mime', '0.7'),
    c('jsonlite', '1.6'),
    c('digest', '0.6.20'),
    c('sourcetools', '0.1.7'),
    c('promises', '1.0.1'),
    c('rlang', '0.4.0'),
    c('xtable', '1.8-4'),
    c('fastmap', '1.0.0'),
    c('curl', '4.2'),
    c('V8', '2.3'),
    'htmltools',
    'shiny',
    c('colorspace', '1.4-1'),
    c('purrr', '0.3.2'),
    c('yaml', '2.2.0'),
    c('labeling', '0.3'),
    c('munsell', '0.5.0'),
    c('lazyeval', '0.2.2'),
    c('glue', '1.3.1'),
    c('pkgconfig', '2.0.2'),
    c('tidyselect', '0.2.5'),
    c('plogr', '0.2.0'),
    c('htmlwidgets', '1.3'),
    c('base64enc', '0.1-3'),
    c('png', '0.1-7'),
    c('RColorBrewer', '1.1-2'),
    c('sp', '1.3-1'),
    c('raster', '2.9-23'),
    c('scales', '1.0.0'),
    c('viridisLite', '0.3.0'),
    c('zeallot', '0.1.0'),
    c('ellipsis', '0.3.0'),
    'crosstalk',
    'DT',
    'gdxrrw',
    'leaflet',
    'vctrs',
    c('pillar', '1.4.2'),
    c('tibble', '2.1.3'),
    c('dplyr', '0.8.3'),
    c('sys', '3.2'),
    c('askpass', '1.1'),
    c('prettyunits', '1.0.2'),
    c('stringi', '1.4.3'),
    c('DBI', '1.0.0'),
    c('blob', '1.2.0'),
    c('hms', '0.5.0'),
    c('lifecycle', '0.1.0'),
    c('tidyr', '1.0.0'),
    c('data.table', '1.12.2'),
    c('memoise', '1.1.0'),
    'httr',
    'RSQLite',
    'plotly',
    'shinydashboard',
    'timevis',
    c('rematch', '1.0.1'),
    c('formatR', '1.7'),
    c('ps', '1.3.0'),
    c('clipr', '0.7.0'),
    c('cellranger', '1.1.0'),
    c('progress', '1.2.2'),
    c('lambda.r', '1.2.3'),
    c('futile.options', '1.0.1'),
    c('zoo', '1.8-6'),
    c('globals', '0.12.4'),
    c('listenv', '0.7.0'),
    c('processx', '3.4.1'),
    c('readr', '1.3.1'),
    c('readxl', '1.3.1'),
    c('writexl', '1.1'),
    c('jsonvalidate', '1.1.0'),
    c('rpivotTable', '0.3.0'),
    c('futile.logger', '1.4.3'),
    c('zip', '2.0.3'),
    c('tidyr', '1.0.0'),
    c('leaflet.minicharts', '0.5.4'),
    c('xts', '0.11-2'),
    c('dygraphs', '1.1.1.6'),
    c('future', '1.14.0'),
    'rhandsontable')

isLinux <- grepl("linux-gnu", R.version$os)

if(!'devtools' %in% installed.packages()[, "Package"]) {
    install.packages('devtools', repos = CRANMirror, 
        dependencies = c("Depends", "Imports", "LinkingTo"))
}
library('devtools')

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
                dependencies = FALSE, repos = CRANMirror))
        }
    }, error = function(e){
        print(conditionMessage(e))
        installPackage(package, attempt + 1)
     })
}
downloadPackage <- function(package) {
    packageFileNameTmp <- remote::download_version(package[1], package[2],
        repos = CRANMirror)
    packageFileName <- file.path('.', 'r', 'library_src', 
        paste0(package[1], '_', package[2], '.tar.gz'))
    if (!file.rename(packageFileNameTmp, packageFileName)) {
        stop(sprintf("Problems renaming package: '%s' from '%s' to '%s'.",
            package[1], packageFileNameTmp, packageFileName))
    }
}
for(package in packageVersionMap){
    if ( length(package) == 1L ) {
        packagePath <- build(file.path('.', 'r-src', package), path = file.path('.', 'r-src', 'build/'), 
            binary = FALSE, vignettes = FALSE, manual = FALSE, args = NULL, quiet = FALSE)
        install.packages(packagePath, lib = RLibPath, repos = NULL, 
                         type = "source", dependencies = FALSE)
    } else {
        installPackage(package)
    }
}
# clean up unncecessary files
unlink(file.path('.', 'r-src', 'build/'), recursive = TRUE, force = TRUE)
lapply(list.dirs(RLibPath, full.names = TRUE, recursive = FALSE), 
    function(x) {
        unlink(file.path(x, c("help", "doc", "tests", "html",
                              "include", "unitTests",
                              file.path("libs", "*dSYM"))), force=TRUE, recursive=TRUE)
})
# replace directories with periods in their names with symlinks 
# as directories with periods must be frameworks for codesign to not nag
if (Sys.info()['sysname'] == 'Darwin' || grepl("^darwin", R.version$os)) {
    dirsWithPeriod <- list.dirs(file.path('.', 'r'))
    dirsWithPeriod <- dirsWithPeriod[grepl('.*\\..*', basename(dirsWithPeriod), perl = TRUE)]
    dirsWithPeriod <- dirsWithPeriod[dirsWithPeriod != '.']
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

