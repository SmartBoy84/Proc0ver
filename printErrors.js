const Fs = require("fs/promises")

let process = async () => {
    let errors = await JSON.parse(await Fs.readFile("/var/www/gabba.ga/repo/apt"+"/errors"))
    console.log(errors)
}

process()