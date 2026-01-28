const os = require("os")

let catchedIp = null

const baseUrl = (req) => {
    const protocol = req.protocol

    let host = req.get("host")

    //! if running locally replace localhost if ip
    if(host.includes("localhost") || host.startsWith("127.0.0.1")){

        //! generate ip
        if(!catchedIp){
            const nets = os.networkInterfaces()
            let ip = "localhost"

            for(const name in nets){
                for(const net of nets[name]){
                    if(net.family == "IPv4" && !net.internal){
                        ip = net.address
                        break
                    }
                }
            }
            catchedIp = ip
        }
        const port = process.env.PORT || 3000
        return `${protocol}://${catchedIp}:${port}`
    }
    return `${protocol}://${host}`
}

module.exports = baseUrl