import { ConfidentialClientApplication, AuthorizationCodeRequest, RefreshTokenRequest, AuthorizationUrlRequest } from "@azure/msal-node";
import { base64URLEncode, sha256 } from "./utils";
import * as fs from "fs";
import path from "path";
import http from "http";
import url from "url";
import crypto from 'crypto'

export class AuthService {
  private pca: ConfidentialClientApplication;
  private tokenCachePath: string;
  private codeVerifier: string;
  private codeChallenge: string;

  constructor(clientId: string, clientSecret: string, tenantId: string, private redirectUri: string) {
    this.pca = new ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
    });
    this.tokenCachePath = path.join(__dirname, "../env/tokenCache.json");
    this.codeVerifier = base64URLEncode(crypto.randomBytes(32));
    this.codeChallenge = base64URLEncode(sha256(Buffer.from(this.codeVerifier)));
  }

  async getValidAccessToken(): Promise<string> {
    let tokenResponse = this.loadToken();
    console.log("Checking for valid access token...") 
    if (tokenResponse && new Date(tokenResponse.expiresOn) > new Date()) {
        console.log("Valid access token found in cache")
      return tokenResponse.accessToken;
    }
    if (tokenResponse?.refreshToken) {
        console.log("Access token expired. \n Attempting to regenerate token...")
      return await this.refreshAccessToken(tokenResponse.refreshToken);
    }
    console.log("No valid token found.\n Prompt user for new token...")
    const authCode = await this.promptForAuthCode();
    return await this.getAccessToken(authCode);
  }

  private async getAccessToken(authCode: string): Promise<string> {
    const tokenRequest: AuthorizationCodeRequest = {
      code: authCode,
      scopes: ["Mail.Read", "Mail.Send", "Mail.ReadWrite"],
      redirectUri: this.redirectUri,
      codeVerifier: this.codeVerifier,
    };
    const response = await this.pca.acquireTokenByCode(tokenRequest);
    this.saveToken(response);
    return response.accessToken;
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const tokenRequest: RefreshTokenRequest = {
      refreshToken,
      scopes: ["Mail.Read", "Mail.Send", "Mail.ReadWrite"],
    };
    const response = await this.pca.acquireTokenByRefreshToken(tokenRequest);
    if (!response) {
      throw new Error("Failed to refresh access token: response is null or undefined")
    }
    this.saveToken(response);
    return response.accessToken;
  }

  private saveToken(tokenResponse: any) {
    fs.writeFileSync(this.tokenCachePath, JSON.stringify(tokenResponse));
  }

  private loadToken(): any {
    if (fs.existsSync(this.tokenCachePath)) {
      return JSON.parse(fs.readFileSync(this.tokenCachePath, "utf-8"));
    }
    return null;
  }

  private async promptForAuthCode(): Promise<string> {
    const authCodeUrlParameters: AuthorizationUrlRequest = {
      scopes: ["Mail.Read", "Mail.Send", "Mail.ReadWrite"],
      redirectUri: this.redirectUri,
      codeChallenge: this.codeChallenge,
      codeChallengeMethod: "S256",
      prompt: "consent",
    };
    const authCodeUrl = await this.pca.getAuthCodeUrl(authCodeUrlParameters);
    console.log("Navigate to this URL to authenticate:", authCodeUrl);

    const open = require("open");
    await open(authCodeUrl);

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const queryObject = url.parse(req.url as string, true).query;
        const authCode = queryObject.code as string;
        if (authCode) {
          res.end("Authorization code received. You can close this window.");
          server.close();
          resolve(authCode);
        } else {
          res.end("Authorization code not found.");
          server.close();
          reject(new Error("Authorization code not found."));
        }
      });
      server.listen(4001, () => console.log("Listening on http://localhost:4001"));
    });
  }
}
