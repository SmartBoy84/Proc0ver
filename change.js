const spawn = require("child_process").spawn
const execute = require("util").promisify(require("child_process").exec)

const Fs = require("fs").promises
const Path = require("path")

const Axios = require("axios")

let resolve = (a) => `.${a ? "/" + a : ""}`

Fs.mkdir(Path.resolve(resolve("debs")), { recursive: true })
let updateRepo = async () => {

    try {
        let latest = await Fs.readFile(resolve("latest"))
            .then(d => new Date(d))
            .catch(e => {
                if (e.code == "ENOENT") {
                    console.log("Latest date not found, setting to null")
                    return null // Null ensures that it will be older than any date on the page
                }
                else { throw e }
            })
        console.log(`Up and running, boss!\nPrevious update at ===> ${latest == null ? "Never" : latest.toISOString().replace(/T/, ' ').replace(/\..+/, '').replace(/:\d\d$/, "")}\n`)

        let base = "https://repo.quiprr.dev/procursus/pool/main/iphoneos-arm64/1700" //"https://apt.procurs.us/pool/main/iphoneos-arm64/1700"

        let debs = await Axios(base).then(a => a.data).then(data =>

            data = data.split("\n")
                .filter(a => /^\s*<a/.test(a) && /href="(.+\.deb)"/.test(a)) // Get anchor elements
                .map(a => [
                    decodeURIComponent(a.match(/href="(.+\.deb)"/)[1]), // Get the file name and decode any URI escape chars (for prettifying purposes)
                    new Date(a.match(/>\s*(\w+-\w+-\w+\s\w+:\w+)/)[1]) // Get the date
                ])
                .sort((a, b) => b[1] - a[1]) // Sort by date (descending)
                .filter(a => a[1] > latest) // Remove all preexisting/unchanged tweaks
        )

        if (debs.length > 0) {
            console.log(`${debs.length} new/updated files found, starting conversion...`)

            let errors = {}
            let hashes = {}

            for (let i = 0; i < debs.length; i++) {

                let fileName = debs[i][0]

                console.log(`\n\n\nDownloading ${fileName} [${i}/${debs.length}] ${errors.length > 0 ? `[${Object.keys(errors).length}]` : ""}\n`)

                await new Promise((res, rej) =>
                    spawn("wget", [
                        `${base}/${fileName}`,
                        "-U", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36",
                        "-w", "5",
                        "--random-wait",
                        "-q", "--show-progress",
                        "-O", `${resolve("debs")}/${fileName}`
                    ],
                        { stdio: "inherit" })
                        .on('exit', (code) => code == '0' ? res() : rej())
                )
                    .then(async () => {
                        const { stdout, stderr } = await execute(`sh change.sh ${resolve("debs")}/${fileName}`)
                        console.log(stdout.trim())

                        if (stderr) { throw stderr }
                    })
                    .then(async () => {
                        console.log("Getting deb hashes... ")

                        let dir = `${resolve("debs")}/${fileName}`
                        let size = (await Fs.stat(dir)).size

                        let getHash = async (type) => {
                            let { stdout, stderr } = await execute(`${type} ${dir}`)
                            stdout = stdout.trim().split(/\s+/)

                            if (stdout.length == 2 && stdout[1] == dir) {
                                process.stdout.write(`${type} || `)
                                return stdout[0]
                            }
                            else { throw ("Failed to get hash", stderr) }
                        }

                        hashes[fileName] = {
                            dir,
                            size,

                            "md5": await getHash("md5sum"),
                            "sha1": await getHash("sha1sum"),
                            "sha256": await getHash("sha256sum"),
                        }
                    })
                    .catch(e => {
                        console.log(e, `Failed to download ${fileName}`)
                        errors[fileName] = e
                        debs.splice(i, 1)
                    })

                /* if (i > 0 && i % 75 == 0) {
                    console.log("Phew, taking a quick break now - gimme 10")
                    await new Promise(res => setTimeout(() => res(), 60000))
                }*/
            }

            if (debs.length > 0) {
                await Fs.writeFile(resolve("latest"), debs[0][1].toString(), { flag: "w" }) // Write latest update date to file

                console.log("\n\n\n*Generating Packages file")

                let processPak = (a) =>
                    a.split(/\n(?=Package:)/)
                        .reduce((a, c) => {
                            let name = /(?<=Filename:.*)(?!.*\/).*\.deb(?=\n)/.exec(c)
                            return name == null ? a : { ...a, [name[0]]: c }
                        }, {})

                let serverPackages = await Axios.get("https://repo.quiprr.dev/procursus/dists/iphoneos-arm64/1800/main/binary-iphoneos-arm/Packages")
                    .then(a => processPak(a.data))

                let diskPackages = await Fs.readFile(resolve("Packages"))
                    .then(d => processPak(d))
                    .then(d => Object.keys(d).reduce((a, c) => (Object.keys(serverPackages).includes(c) ? { ...a, [c]: serverPackages[c] } : a))) // Remove any redundancies and update description and other tings
                    .catch(e => { if (e.code == "ENOENT") { return {} } else { throw e } })

                Object.keys(hashes).forEach(a => {
                    let details = hashes[a]

                    let content = Object.keys(diskPackages).includes(a) ? diskPackages[a] : serverPackages[a]

                    diskPackages[a] = content
                        .replace(/(?<=filename:\s).*(?=\n)/i, `debs/${a}`)

                        .replace(/(?<=md5sum:\s).*(?=\n)/i, details["md5"])
                        .replace(/(?<=sha1:\s).*(?=\n)/i, details["sha1"])
                        .replace(/(?<=sha256:\s).*(?=\n)/i, details["sha256"])

                        .replace(/(?<=size:\s).*(?=\n)/i, details["size"])

                        .replace(/sha512:.*\n/i, "")
                })

                await Fs.writeFile(resolve("Packages"), Object.values(diskPackages).join("\n"), { flag: "w" })

                console.log("*Compressing Packages file")
                await execute(`xz -kz Packages`).then(a => { if (a.stderr) { throw stderr } })


                console.log("\n*Removing redundant debs")
                await Fs.readdir(resolve("debs"))
                    .then(a => a.forEach(async b => {
                        if (!Object.keys(serverPackages).includes(b)) {
                            console.log("Exterrrminate!!", b)
                            await Fs.unlink(resolve(`debs/${b}`))
                                .catch(e => { throw e })
                        }
                    }))

            }
            else { console.log("What the hell, everything failed?") }

            if (Object.keys(errors).length > 0) {
                await Fs.writeFile(resolve("errors"), `${"\n".repeat(5)}${JSON.stringify(errors)}`, { flag: "a" }) // Write errors to file
            }
        }
        else { console.log("Nothing to do!") }

    } catch (error) { console.log(error) }

}
updateRepo()
