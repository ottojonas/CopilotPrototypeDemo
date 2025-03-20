import { config } from "./config";
import { AuthService } from "./authService"
import { EmailService } from "./emailService"

async function main() {
    console.log("Starting the application...")
    const authService = new AuthService(config.clientId, config.clientSecret, config.tenantId, config.redirectUri)
    console.log("Authentication service initialised") 
    const emailService = new EmailService(authService) 
    console.log("Email services initialised")
    await emailService.processEmails(); 
}

main().catch(console.error) 
