import { config } from "./config";
import { Client } from "@microsoft/microsoft-graph-client";
import { readCustomerData, readItemData } from "./csvService";
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

  const customers = await readCustomerData("demo_data/democustomerdata.csv");
  const allowedDomains = customers.map((customer) =>
    extractDomain(customer.email)
  );

  const items = await readItemData("demo_data/demoitemdata.csv");
  const itemNames = items.map((item) => item.name);
  const response = await client
    .api(`/users/${config.userId}/mailFolders/inbox/messages`)
    .get();

  const filteredEmails = response.value.filter((email: any) => {
    const senderDomain = extractDomain(email.from.emailAddress.address);
    const requestedItems = extractRequestedItems(email.bodyPreview, items);
    const requestedItemNames = requestedItems.map((item) => item.name);
    const isAllowedDomain = allowedDomains.includes(senderDomain);
    const hasRequestedItems = requestedItemNames.some((name) =>
      itemNames.includes(name)
    );
    // if (hasRequestedItems) {
    //   console.log(
    //     `email from: ${
    //       email.from.emailAddress.address
    //     }, matched items: ${requestedItemNames.join(", ")}`
    //   );
    // }
    return isAllowedDomain || hasRequestedItems;
  });
  const storedEmails = filteredEmails;
  return storedEmails;
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

// function to check email connection
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

    // Read customer data and extract allowed domains
    const customers = await readCustomerData("demo_data/democustomerdata.csv");
    const allowedDomains = customers.map((customer) =>
      extractDomain(customer.email)
    );

    //console.log("Allowed domains: ", allowedDomains);

    // Check if sender's domain matches any allowed domain
    //emails.forEach((email) => {
    // const senderDomain = extractDomain(email.from.emailAddress.address);
    // const isAllowedDomain = allowedDomains.includes(senderDomain);
    // console.log(
    //  `Email from: ${email.from.emailAddress.address}, Domain: ${senderDomain}, Allowed: ${isAllowedDomain}`
    //);
    //});

    // console.log("Successfully fetched emails: ", emails);
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

function extractDomain(email: string): string {
  return email.substring(email.lastIndexOf("@") + 1);
}

// Process emails
export async function processEmails() {
  const authCode = await promptForAuthCode();
  const accessToken = await getAccessToken(authCode);
  const items = await readItemData("demo_data/demoitemdata.csv");
  const customers = await readCustomerData("demo_data/democustomerdata.csv");

  const customerDomains = customers.map((customer) =>
    extractDomain(customer.email)
  );

  const emails = await getEmailsFromOtto(accessToken);
  for (const email of emails) {
    const requestedItems = extractRequestedItems(email.bodyPreview, items);
    const replyBody = generateReplyEmail(requestedItems);
    await sendReplyEmail(accessToken, email, replyBody);
  }
}

testEmailConnection();
