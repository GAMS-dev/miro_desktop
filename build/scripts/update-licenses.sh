#!/bin/bash

LICENSE_FILE=LICENSE_Launcher.txt
npm list -g npm-license-crawler > /dev/null || {
    npm install -g npm-license-crawler
}
DIST_DIR_EXCL=""
if [ -d "dist" ]; then
    DIST_DIR_EXCL="--exclude dist "
fi
npm-license-crawler ${DIST_DIR_EXCL}--exclude build --exclude r --exclude miro --exclude admin --exclude r-src --dependencies --production --csv licenses.csv > /dev/null
cat >$LICENSE_FILE <<EOL
GAMS MIRO Launcher as a whole is distributed under GPL-3 (GNU GENERAL PUBLIC LICENSE version 3). A copy of this license is included below.

The entire source code is available at: https://github.com/GAMS-dev/miro_desktop

GAMS MIRO Launcher includes other open source software components. The following
is a list of these components:


EOL
cat licenses.csv>>$LICENSE_FILE
cat >>$LICENSE_FILE <<EOL


EOL
cat GPL-3.txt>>$LICENSE_FILE

cat >allowed-licenses <<EOL
(BSD-2-Clause OR MIT OR Apache-2.0)
(CC-BY-4.0 AND OFL-1.1 AND MIT)
(MIT OR CC0-1.0)
(MIT OR WTFPL)
Apache-2.0
BSD-2-Clause
BSD-3-Clause
CC-BY-3.0
CC0-1.0
GPL-3.0-only
ISC
MIT
WTFPL
WTFPL OR ISC
EOL

awk -F "\"*,\"*" '{print $2}' licenses.csv | tail -n +2 | sort |uniq | while read x; do grep "$x" allowed-licenses || { >&2 echo "$x";exit 1; }; done > /dev/null || {
    \rm -f licenses.csv allowed-licenses
    exit 1
}
\rm -f licenses.csv allowed-licenses
exit 0
