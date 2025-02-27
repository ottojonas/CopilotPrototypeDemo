import { config } from "./config";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { ClientSecretCredential } from "@azure/identity";
import { readCSV } from "./csvService";
import {
ConfidentialClientApplication,
AuthorizationCodeRequest,
AuthorizationUrlRequest,
} from "@azure/msal-node";
import { extractRequestedItems, generateReplyEmail } from "./utils";
import crypto from "crypto";
import http from "http";
import url from "url";
import { Item } from "./types";

// Utility functions
function base64URLEncode(str: Buffer) {
  return str
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function sha256(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest();
}

// PKCE code generation
const codeVerifier = base64URLEncode(crypto.randomBytes(32));
const codeChallenge = base64URLEncode(sha256(Buffer.from(codeVerifier)));

// MSAL configuration and initialization
if (!config.clientId || !config.clientSecret) {
  throw new Error("Client ID and Client Secret must be defined in the config.");
}

const msalConfig = {
auth: {
    clientId: config.clientId as string,
    clientSecret: config.clientSecret as string,
    authority: `https://login.microsoftonline.com/${config.tenantId}`,
},
};

const pca = new ConfidentialClientApplication(msalConfig);

// Capture authorization code from redirect URI
async function captureAuthCodeFromRedirect(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const queryObject = url.parse(req.url as string, true).query;
      const authCode = queryObject.code as string;

      if (authCode) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Authorization code received. You can close this window.");
        server.close();
        resolve(authCode);
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Authorization code not found.");
        server.close();
        reject(new Error("Authorization code not found."));
      }
    });

    server.listen(4001, () => {
      console.log("Listening for authorization code on http://localhost:4001");
    });
  });
}

// Get access token using authorization code
async function getAccessToken(authCode: string): Promise<string> {
  const tokenRequest: AuthorizationCodeRequest = {
    code: authCode,
    scopes: ["Mail.Read", "Mail.Send"],
    redirectUri: config.redirectUri,
    codeVerifier: codeVerifier,
  };

  const response = await pca.acquireTokenByCode(tokenRequest);
  return response.accessToken;
}

// Get emails from Otto
async function getEmailsFromOtto(accessToken: string): Promise<any[]> {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
  const response = await client
    .api(`/users/${config.userId}/messages`)
    .filter("from/emailAddress/address eq 'otto@purelydynamics.co.uk'")
    .get();
  return response.value;
}

// Send reply email
async function sendReplyEmail(
  accessToken: string,
  email: any,
  replyBody: string
) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
  const reply = {
    message: {
      subject: `Re: ${email.subject}`,
      body: {
        contentType: "text",
        content: replyBody,
      },
      toRecipients: [
        {
          emailAddress: {
            address: email.from.emailAddress.address,
          },
        },
      ],
    },
    saveToSentItems: true,
  };
  await client.api(`/me/messages/${email.id}/reply`).post(reply);
}

// Test email connection
async function testEmailConnection() {
  try {
    const authCodeUrlParameters: AuthorizationUrlRequest = {
      scopes: ["Mail.Read", "Mail.Send"],
      redirectUri: config.redirectUri,
      codeChallenge: codeChallenge,
      codeChallengeMethod: "S256",
    };
    const authCodeUrl = await pca.getAuthCodeUrl(authCodeUrlParameters);
    console.log("Navigate to this URL to authenticate: ", authCodeUrl);

    // Automatically open the URL in the default browser
    const open = require("open");
    await open(authCodeUrl);

    // Capture the authorization code from the redirect URI
    const authCode = await captureAuthCodeFromRedirect();

    const accessToken = await getAccessToken(authCode);
    const emails = await getEmailsFromOtto(accessToken);
    console.log("Successfully fetched emails: ", emails);
  } catch (error) {
    console.error("Error fetching emails: ", error);
  }
}

// Prompt for authorization code (if needed)
async function promptForAuthCode(): Promise<string> {
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter the authorization code: ", (authCode: string) => {
      rl.close();
      resolve(authCode);
    });
  });
}

// Process emails
export async function processEmails() {
  const authCode = await promptForAuthCode();
  const accessToken = await getAccessToken(authCode);
  const items = await readCSV("demo_data/demodata.csv");
  const emails = await getEmailsFromOtto(accessToken);
  for (const email of emails) {
    const requestedItems = extractRequestedItems(email.body.content, items);
    const replyBody = generateReplyEmail(requestedItems);
    await sendReplyEmail(accessToken, email, replyBody);
  }
}

testEmailConnection();
