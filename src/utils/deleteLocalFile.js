const fs = require("fs")
const path = require("path")

const deleteLocalFile = (filePath) => {
    if(!filePath) return

    //! handle array input
    if(Array.isArray(filePath)){
        for(const p of filePath){
            deleteLocalFile(p)
        }
        return
    }

    if(typeof filePath != "string") return

    const absolute = path.join(process.cwd(), "public", filePath.replace(/^\/+/, ""))

    if(fs.existsSync(absolute)){
        fs.unlinkSync(absolute)
    }
}

module.exports = deleteLocalFile