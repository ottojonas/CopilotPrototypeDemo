import { config } from "dotenv";
config();

import { processEmails } from "./emailService";

processEmails().catch(console.error);
