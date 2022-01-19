const axios = require("axios")
const Fs = require("fs/promises")
const { stderr } = require("process")

const execute = require("util").promisify(require("child_process").exec)

let updatePackages = async () => {
    try {
        console.log("updating...")

        let debs = await Fs.readdir("./debs")

        let rawPackages = await axios.get("https://repo.quiprr.dev/procursus/dists/iphoneos-arm64/1800/main/binary-iphoneos-arm/Packages")
            .then(a => a.data)
            .then(a => a.split(/\n(?=Package:)/))
            .then(a => a.filter(b => {
                let name = /(?<=Filename:.*)(?!.*\/).*\.deb(?=\n)/.exec(b)
                return name != null && debs.includes(name[0])
            }))

        let packages = []
        for (let i = 0; i <= rawPackages.length; i++) {

            process.stdout.cursorTo(0)
            process.stdout.clearLine()
            process.stdout.write(`${i}/${rawPackages.length}`)

            let deb = rawPackages[i]
            let name = /(?<=Filename:.*)(?!.*\/).*\.deb(?=\n)/.exec(deb)

            if (name == null) {
                console.log(deb, "Whaaa?")
                continue
            }
            else { name = name[0] }

            if (name == null || !debs.includes(name)) {
            }
            else {
                let dir = `./debs/${name}`
                let size = (await Fs.stat(dir)).size

                let getHash = async (type) => {

                    let { stdout, stderr } = await execute(`${type} ${dir}`)
                    stdout = stdout.trim().split(/\s+/)

                    if (stdout.length == 2 && stdout[1] == dir) { return stdout[0] }
                    else { console.log("Failed to get hash", stderr) }
                }

                packages.push(
                    deb
                        .replace(/(?<=filename:\s).*(?=\n)/i, `debs/${name}`)

                        .replace(/(?<=md5sum:\s).*(?=\n)/i, await getHash("md5sum"))
                        .replace(/(?<=sha1:\s).*(?=\n)/i, await getHash("sha1sum"))
                        .replace(/(?<=sha256:\s).*(?=\n)/i, await getHash("sha256sum"))

                        .replace(/(?<=size:\s).*(?=\n)/i, size)

                        .replace(/sha512:.*\n/i, "")
                        .replace(/,?\s*?liblzma(.*?)\s*?(?=\n|,)\s*?/g, "")

                )
            }
        }

        await Fs.writeFile("Packages", packages.join("\n"), { flag: "w" })
        await execute(`xz -kz Packages`).then(a => { if (a.stderr) { throw stderr } })
    }
    catch (e) { console.log(e) }
}
updatePackages()