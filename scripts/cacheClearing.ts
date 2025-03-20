import * as fs from 'fs';
import path from 'path'; 

const tokenCachePath = path.join(__dirname, "../env/tokenCache.json")

if (fs.existsSync(tokenCachePath)) {
    fs.unlinkSync(tokenCachePath)
    console.log("Token cached cleared")
} else {
    console.log("No token cache found") 
}

