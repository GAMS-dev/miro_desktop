#!/bin/bash
LICENSE_FILE=LICENSE_Launcher.txt
npm-license-crawler --exclude dist --exclude miro --exclude r-src --production --csv licenses.csv
cat >$LICENSE_FILE <<EOL
GAMS MIRO Launcher as a whole is distributed under GPL-3 (GNU GENERAL PUBLIC LICENSE version 3). A copy of this license is included below.

The entire source code is available at: https://github.com/GAMS-dev/miro_desktop

GAMS MIRO Launcher includes other open source software components. The following
is a list of these components:


EOL
cat licenses.csv>>$LICENSE_FILE
cat >$LICENSE_FILE <<EOL


EOL
cat GPL-3.txt>>$LICENSE_FILE
\rm -f licenses.csv

