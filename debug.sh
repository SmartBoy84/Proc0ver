echo "Sun Jan 16 2022 21:34:00 GMT+0800 (Australian Western Standard Time)" > latest
rm -r debs
rm Packages*
rm latest
rm errors
if [[ $1 == 1 ]]; then
node change.js
fi
