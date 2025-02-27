import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { ClientSecretCredential } from "@azure/identity";
import { readCSV } from "./csvService";
import { extractRequestedItems, generateReplyEmail } from "./utils";
import { Item } from "./types";

const tenantId = process.env.TENANT_ID;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

if (!tenantId) {
  throw new Error("Missing tenantId environmental variable");
}

if (!clientId) {
  throw new Error("Missing clientId environmental variable");
}

if (!clientSecret) {
  throw new Error("Missing clientSecret environemental variable");
}

const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ["Mail.Read", "Mail.Send"],
});

const client = Client.initWithMiddleware({ authProvider });

async function getEmailsFromOtto(): Promise<any[]> {
  const response = await client
    .api("/me/messages")
    .filter("from/emailAddress/address eq 'otto@purelydynamics.co.uk'")
    .get();
  return response.value;
}

async function sendReplyEmail(email: any, replyBody: string) {
  const reply = {
    message: {
      subject: `Re: ${email.subject}`,
      body: {
        contentType: "text",
        constent: replyBody,
      },
      toRecipients: [
        {
          emailAddress: {
            address: email.from.emailAddress.address,
          },
        },
      ],
    },
    savetoSentItems: true,
  };
  await client.api(`/me/messages/${email.id}/reply`).post(reply);
}

async function testEmailConnection() {
  try {
    const emails = await getEmailsFromOtto();
    console.log("Succssfully fetched emails: ", emails);
  } catch (error) {
    console.error("Error fetching emails: ", error);
  }
}

testEmailConnection();

export async function processEmails() {
  const items = await readCSV("demo_data/demodata.csv");
  const emails = await getEmailsFromOtto();
  for (const email of emails) {
    const requestedItems = extractRequestedItems(email.body.content, items);
    const replyBody = generateReplyEmail(requestedItems);
    await sendReplyEmail(email, replyBody);
  }
}
