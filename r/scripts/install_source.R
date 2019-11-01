scriptPath = Sys.getenv('SCRIPTS_PATH')

source(file.path(scriptPath, 'globals.R'))
options(warn = 2)

if(R.version[["major"]] < 3 || 
   R.version[["major"]] == 3 && gsub("\\..$", "", 
                                     R.version[["minor"]]) < 6){
  stop("The R version you are using is not supported. At least version 3.6 is required to run GAMS MIRO.", call. = FALSE)
}

for(package in packageVersionMap){
    if ( package[1] %in% installedPackages){
        print(sprintf("Skipping '%s' as it is already installed.", package[1]))
        next
    }
    install.packages(file.path(scriptPath, '..', 'library_src'), 
      paste0(package[1], '_', package[2], '.tar.gz')), 
      lib = RLibPath, repos = NULL, 
      type = "source", dependencies = FALSE)
}
# clean up unncecessary files
unlink(file.path(RLibPath, 'INSTALLING'), force = TRUE, recursive = FALSE)
dontDisplayMe <- lapply(list.dirs(RLibPath, full.names = TRUE, recursive = FALSE), 
    function(x) {
        unlink(file.path(x, c("help", "doc", "tests", "html",
                              "include", "unitTests",
                              file.path("libs", "*dSYM"))), force=TRUE, recursive=TRUE)
})