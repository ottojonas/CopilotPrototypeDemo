import { config } from "./config";
import { readCustomerData, readItemData } from "./csvService";
import { extractRequestedItems, generateReplyEmail, extractDomain } from "./utils";
import { AuthService } from "./authService";
import { Client } from "@microsoft/microsoft-graph-client";
import { createObjectCsvWriter } from "csv-writer";
import * as fs from "fs";
import path from "path";

export class EmailService {
  private client!: Client;
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  async initializeClient(): Promise<void> {
    const accessToken = await this.authService.getValidAccessToken();
    this.client = Client.init({
      authProvider: (done) => done(null, accessToken),
    });
  }

  async fetchEmails(): Promise<any[]> {
    console.log(`Fetching emails from user: ${config.userId}`);
    let allEmails: any[] = [];
    let response = await this.client
      .api(`/users/${config.userId}/mailFolders/inbox/messages`)
      .top(100)
      .get();

    while (response.value && response.value.length > 0) {
      allEmails = allEmails.concat(response.value);
      if (response["@odata.nextLink"]) {
        response = await this.client.api(response["@odata.nextLink"]).get();
      } else {
        break;
      }
    }
    return allEmails;
  }

  async filterEmails(emails: any[]): Promise<any[]> {
    const customers = await readCustomerData("demo_data/democustomerdata.csv");
    const allowedDomains = customers.map((customer) => extractDomain(customer.email));
    const items = await readItemData("demo_data/demoitemdata.csv");
    const itemNames = items.map((item) => item.name);

    return emails.filter((email: any) => {
      const senderDomain = extractDomain(email.from.emailAddress.address);
      const requestedItems = extractRequestedItems(email.body.content, items);
      const requestedItemNames = requestedItems.map((item) => item.name);
      const isAllowedDomain = allowedDomains.includes(senderDomain);
      const hasRequestedItems = requestedItemNames.some((name) => itemNames.includes(name));
      return isAllowedDomain || hasRequestedItems;
    });
  }

  async saveEmailsToCsv(emails: any[], items: any[]): Promise<void> {
    const customers = await readCustomerData("demo_data/democustomerdata.csv");
    const allowedDomains = customers.map((customer) => extractDomain(customer.email)); // Define allowedDomains here
    const itemNames = items.map((item) => item.name);
  
  const records = emails.map((email: any) => {
      const senderAddress = email.from.emailAddress.address;
      const senderDomain = extractDomain(senderAddress);
      const requestedItems = extractRequestedItems(email.body.content, items);
      const requestedItemNames = requestedItems.map((item) => item.name);
      const requestedItemPrices = requestedItems.map((item) => item.price);
      const isAllowedDomain = allowedDomains.includes(senderDomain);
      const hasRequestedItems = requestedItemNames.some((name) => itemNames.includes(name));
  
      return {
        from: senderAddress,
        subject: email.subject,
        content: email.body.content,
        requestedItems: requestedItemNames.join(", ") || "FALSE",
        requestedItemPrices: requestedItemPrices.join(", ") || "FALSE",
        isAllowedDomain: isAllowedDomain.toString(),
        hasRequestedItems: hasRequestedItems.toString(),
        labels: hasRequestedItems ? "items" : "noItems",
        quoteRequested: hasRequestedItems ? "YES" : "NO",
      };
    });
  
    const csvFilePath = path.join(__dirname, "../demo_data/emails.csv");
    const csvWriter = createObjectCsvWriter({
      path: csvFilePath,
      header: [
        { id: "from", title: "From" },
        { id: "subject", title: "Subject" },
        { id: "content", title: "Content" },
        { id: "requestedItems", title: "Requested Items" },
        { id: "requestedItemPrices", title: "Requested Item Prices" },
        { id: "isAllowedDomain", title: "Is Allowed Domain" },
        { id: "hasRequestedItems", title: "Has Requested Items" },
        { id: "labels", title: "Labels" },
        { id: "quoteRequested", title: "Quote Requested" },
      ],
    });
  
    await csvWriter.writeRecords(records);
    console.log(`Emails have been written to: ${csvFilePath}`);
  }

  async getOrCreateFolder(folderName: string): Promise<string> {
      try {
          const response = await this.client.api(`/me/mailFolders`).filter(`displayName eq '${folderName}'`).get(); 
          if (response.value && response.value.length > 0) {
              return response.value[0].id; 
          }
          const newFolder = await this.client.api(`/me/maliFolders`).post({
              displayName: folderName, 
          })
          return newFolder.id 
      } catch (error) {
          console.error(`Error getting or creating folder ${folderName}: ${error}`)
          throw error 
      }
  }

  async sendReply(email: any, replyBody: string): Promise<void> {
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
    await this.client.api(`/me/messages/${email.id}/reply`).post(reply);
    console.log(`Reply sent to: ${email.from.emailAddress.address}`);

    const folderId = await this.getOrCreateFolder("QuotesReplied")
    await this.client.api(`/me/messages/${email.id}/move`).post({
        destinationId: folderId, 
    })
    console.log(`Email moved to folder: ${folderId}`)
  }

  async processEmails(): Promise<void> {
    try {
      await this.initializeClient();
      const emails = await this.fetchEmails();
      const filteredEmails = await this.filterEmails(emails);

      console.log(`Fetched ${filteredEmails.length} relevant emails.`);
      const items = await readItemData("demo_data/demoitemdata.csv");

      for (const email of filteredEmails) {
        console.log(`Processing email from: ${email.from.emailAddress.address}`);
        const requestedItems = extractRequestedItems(email.body.content, items);

        if (requestedItems.length > 0) {
          const replyBody = generateReplyEmail(requestedItems);
          console.log(`Generated reply: ${replyBody}`);
          await this.sendReply(email, replyBody);
        } else {
          console.log(`No requested items found in email from: ${email.from.emailAddress.address}`);
        }
      }

      await this.saveEmailsToCsv(filteredEmails, items);
    } catch (error) {
      console.error("Error processing emails: ", error);
    }
  }
}
