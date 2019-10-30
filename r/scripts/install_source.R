source('./r/scripts/globals.R')

for(package in packageVersionMap){
    if ( package[1] %in% installedPackages){
        print(sprintf("Skipping '%s' as it is already installed.", package[1]))
        next
    }
    install.packages(paste0(package[1], '_', package[2], '.tar.gz'), lib = RLibPath, repos = NULL, 
                     type = "source", dependencies = FALSE)
}
# clean up unncecessary files
unlink(file.path(RLibPath, '*.tar.gz'), force = TRUE, recursive=FALSE)
dontDisplayMe <- lapply(list.dirs(RLibPath, full.names = TRUE, recursive = FALSE), 
    function(x) {
        unlink(file.path(x, c("help", "doc", "tests", "html",
                              "include", "unitTests",
                              file.path("libs", "*dSYM"))), force=TRUE, recursive=TRUE)
})