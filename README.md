# Proc0ver
A set of scripts to enable running packages hosted on the procursus repo to run on unc0ver based jailbreaks.

It does this by converting the deb compression from zst to bzip since the DPKG version that comes with unc0ver does not support the zst compression and attempting to upgrade it causes unc0ver to stall during the jailbreak process.

Steps:
*Donwload page listing all the packages in the procursus repo
*Scrape package links and date of last update
Filter packages which are already present on disk by comparing their update/upload date to the last update date stored on disk
Download the packages file from the server and read from disk
Compare the two packages file, filtering any discrepencies from the packages read fromm disk and updating descriptions and other information
For each new package, 
Download it to disk
Extract it, remove liblzma dependency and convert compression
Recompress it and store new file sizes, hashes and path
Add these details (or edit a preexisting entry) to the new packages file
Write packages file to disk and compress it
Write any errors to disk and update "lastupdated" file
Clean up
