# Download and extract the Windows binary install
# Requires innoextract installed in the Dockerfile
mkdir r
wget https://cloud.r-project.org/bin/windows/base/R-3.6.1-win.exe \
  --output-document r/latest_r.exe
cd r
innoextract -e latest_r.exe
mv app/* ../r
rm -r app latest_r.exe
