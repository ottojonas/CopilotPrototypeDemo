import { config } from "./config";
import { processEmails } from "./emailService";

processEmails().catch(console.error);
