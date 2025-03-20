import { Item } from "./types";
import crypto from 'crypto'; 

export function base64URLEncode(str: Buffer): string {
    return str.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""); 
}

export function sha256(buffer: Buffer): Buffer {
    return crypto.createHash("sha256").update(buffer).digest();
}

export function extractDomain(email: string): string {
    return email.substring(email.lastIndexOf("@") + 1)
}

export function extractRequestedItems(
  emailBody: string,
  items: Item[]
): Item[] {
  const requestedItems: Item[] = [];
  items.forEach((item) => {
    const regex = new RegExp(
      `\\b${item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    if (regex.test(emailBody)) {
      console.log(`Matched items: ${item.name}`)
      requestedItems.push(item);
    } 
  });
  return requestedItems;
}

export function generateReplyEmail(requestedItems: Item[]): string {
  let reply =
    "Thanks for getting into contact with us!\n\nHere are the quotes for the requested items:\n\n";
  requestedItems.forEach((item) => {
    reply += `Item: ${item.name}, Price: £${item.price} (Approx)\n\n Kind Regards, \n\n Otto`;
  });
  return reply;
}
