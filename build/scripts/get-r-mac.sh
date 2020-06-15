#!/bin/bash
set -e

# Download and extract R.framework
# Requires xar and cpio
rm -rf r
mkdir -p r
curl -o r/r.pkg https://cloud.r-project.org/bin/macosx/R-4.0.1.pkg

pushd r > /dev/null
    xar -xf r.pkg
    rm -r R-app.pkg Resources tcltk.pkg texinfo.pkg Distribution r.pkg
    cat R-fw.pkg/Payload | gunzip -dc | cpio -i
    rm -r R-fw.pkg

    pushd R.framework/Versions/Current/Resources/ > /dev/null
        # clean up directory a little
        rm -rf bin/R.bak SVN-REVISION doc tests lib/*.dSYM
    popd > /dev/null

    # somehow signtool does not like these symlinks to be in the
    # top level of a framework..
    rm -f R.framework/PrivateHeaders R.framework/Header R.framework/PrivateHeaders R.framework/Libraries

    # make symlink to libraries folder for development
    ln -s R.framework/Resources/libraries libraries

popd > /dev/null
