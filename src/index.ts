import * as dotenv from "dotenv";
dotenv.config({ path: "env/.env.dev" });

import { processEmails } from "./emailService";

processEmails().catch(console.error);
