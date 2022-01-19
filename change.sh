COMP=gzip
mkdir "$1.extract"
dpkg-deb -R "$1" "$1.extract"
rm "$1"

cat "$1.extract/DEBIAN/control" | perl -pe 's/\s?liblzma5(.*?)\s?,\s?/ /'>tmpcontrol
cat tmpcontrol > "$1.extract/DEBIAN/control"

dpkg-deb -b "-Z$COMP" "$1.extract" "$1"
rm -rf "$1.extract"
rm tmpcontrol
