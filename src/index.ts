import { config } from "./config";
import { AuthService } from "./authService"
import { EmailService } from "./emailService"

async function main() {
    const authService = new AuthService(config.clientId, config.clientSecret, config.tenantId, config.redirectUri)
    const emailService = new EmailService(authService) 
    await emailService.processEmails(); 
}

main().catch(console.error) 
