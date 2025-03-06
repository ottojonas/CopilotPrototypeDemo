import { config } from "./config";
import { readCustomerData, readItemData } from "./csvService";
import { extractRequestedItems, generateReplyEmail } from "./utils";
import {
  ConfidentialClientApplication,
  AuthorizationCodeRequest,
  AuthorizationUrlRequest,
  RefreshTokenRequest,
} from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import crypto from "crypto";
import http from "http";
import url from "url";
import fs from "fs";
import path from "path";

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

const tokenCachePath = path.join(__dirname, "../env/tokenCache.json");

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
    scopes: ["Mail.Read", "Mail.Send", "Mail.ReadWrite"],
    redirectUri: config.redirectUri,
    codeVerifier: codeVerifier,
  };

  const response = await pca.acquireTokenByCode(tokenRequest);
  saveToken(response);
  if (response) {
    return response.accessToken;
  } else {
    throw new Error("Failed to acquire token.");
  }
}

// Save token to file
function saveToken(tokenResponse: any) {
  fs.writeFileSync(tokenCachePath, JSON.stringify(tokenResponse));
}

// Load token from file
function loadToken(): any {
  if (fs.existsSync(tokenCachePath)) {
    const tokenData = fs.readFileSync(tokenCachePath, "utf-8");
    return JSON.parse(tokenData);
  }
  return null;
}

// Refresh access token
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const tokenRequest: RefreshTokenRequest = {
    refreshToken: refreshToken,
    scopes: ["Mail.Read", "Mail.Send"],
  };

  const response = await pca.acquireTokenByRefreshToken(tokenRequest);
  saveToken(response);
  if (response) {
    return response.accessToken;
  } else {
    throw new Error("Failed to fetch token ");
  }
}

// Get emails from Otto
async function getEmailsFromOtto(accessToken: string): Promise<any[]> {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  console.log(`Fetching emails from user: ${config.userId}`);
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
    return isAllowedDomain || hasRequestedItems;
  });
  filteredEmails.forEach((email: any) => {
    const senderAddress = email.from.emailAddress.address;
    const senderDomain = extractDomain(senderAddress);
    const subject = email.subject;
    const requestedItems = extractRequestedItems(email.bodyPreview, items);
    const requestedItemNames = requestedItems.map((item) => item.name);
    const requestedItemPrices = requestedItems.map((item) => item.price);
    const isAllowedDomain = allowedDomains.includes(senderDomain);
    console.log(`Stored Email:
      From: ${senderAddress}
      Subject: ${subject}
      Matched Items: ${requestedItemNames.join(", ")}
      Approx Price of Item: ${requestedItemPrices}
      Is Allowed Domain: ${isAllowedDomain}
    `);
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
  try {
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
    console.log(`Sending reply to: ${email.from.emailAddress.address}`);
    await client.api(`/me/messages/${email.id}/reply`).post(reply);
    console.log(`Reply sent to: ${email.from.emailAddress.address}`);
  } catch (error) {
    console.error("Error sending reply email: ", error);
  }
}

// function to check email connection
async function testEmailConnection() {
  try {
    const authCodeUrlParameters: AuthorizationUrlRequest = {
      scopes: ["Mail.Read", "Mail.Send"],
      redirectUri: config.redirectUri,
      codeChallenge: codeChallenge,
      codeChallengeMethod: "S256",
      prompt: "consent",
    };
    const authCodeUrl = await pca.getAuthCodeUrl(authCodeUrlParameters);
    console.log("Navigate to this URL to authenticate: ", authCodeUrl);

    // Automatically open the URL in the default browser
    const open = require("open");
    await open(authCodeUrl);

    // Capture the authorization code from the redirect URI
    const authCode = await captureAuthCodeFromRedirect();

    console.log(`Using account: ${config.userId}`);
    const accessToken = await getAccessToken(authCode);
    const emails = await getEmailsFromOtto(accessToken);

    // Read customer data and extract allowed domains
    const customers = await readCustomerData("demo_data/democustomerdata.csv");
    const allowedDomains = customers.map((customer) =>
      extractDomain(customer.email)
    );
  } catch (error) {
    console.error(
      `Error fetching emails from account: ${config.userId}: `,
      error
    );
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
  try {
    let tokenResponse = loadToken();
    let accessToken: string;

    if (tokenResponse) {
      console.log("Token loaded from cache.");
      if (
        tokenResponse.expiresOn &&
        new Date(tokenResponse.expiresOn) > new Date()
      ) {
        accessToken = tokenResponse.accessToken;
      } else {
        console.log("Token expired, refreshing...");
        accessToken = await refreshAccessToken(tokenResponse.refreshToken);
      }
    } else {
      const authCode = await promptForAuthCode();
      accessToken = await getAccessToken(authCode);
    }

    const items = await readItemData("demo_data/demoitemdata.csv");
    const customers = await readCustomerData("demo_data/democustomerdata.csv");

    const customerDomains = customers.map((customer) =>
      extractDomain(customer.email)
    );

    console.log("Fetching emails...");
    const emails = await getEmailsFromOtto(accessToken);
    console.log(`Fetched ${emails.length} emails.`);

    for (const email of emails) {
      console.log(`Processing email from: ${email.from.emailAddress.address}`);
      const requestedItems = extractRequestedItems(email.bodyPreview, items);
      console.log(
        `Requested items: ${requestedItems.map((item) => item.name).join(", ")}`
      );

      if (requestedItems.length > 0) {
        const replyBody = generateReplyEmail(requestedItems);
        console.log(`Generated reply: ${replyBody}`);

        await sendReplyEmail(accessToken, email, replyBody);
        console.log(`Sent reply to: ${email.from.emailAddress.address}`);
      } else {
        console.log(
          `No requested items found in email from: ${email.from.emailAddress.address}`
        );
      }
    }
  } catch (error) {
    console.error("Error processing emails: ", error);
  }
}

async function markEmailAsReplied(accessToken: string, email: any) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
  await client.api(`/me/messages/${email.id}/move`).post({
    destinationId: `/users/${config.userId}/mailFolders/sent`,
  });
}

testEmailConnection();
