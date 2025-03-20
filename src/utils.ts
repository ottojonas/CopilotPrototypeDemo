import { Item } from "./types";
import crypto from "crypto";
import Fuse from "fuse.js";

export function base64URLEncode(str: Buffer): string {
  return str
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function sha256(buffer: Buffer): Buffer {
  return crypto.createHash("sha256").update(buffer).digest();
}

export function extractDomain(email: string): string {
  return email.substring(email.lastIndexOf("@") + 1);
}

// ! Responds to all emails with all possible matches
// ! Should store possible matches and check for matches with csv then respond with matched items
export function extractRequestedItems(
  emailBody: string,
  items: Item[]
): Item[] {
  const fuse = new Fuse(items, { keys: ["name"], threshold: 0.3 });
  const words = emailBody.split(/\s+/);
  const requestedItems: Item[] = [];
  words.forEach((word) => {
    const matches = fuse.search(word);
    if (matches.length > 0) {
      const matchedItem = matches[0].item;
      if (!requestedItems.some((item) => item.name === matchedItem.name)) {
        console.log(`Matched items: ${matchedItem.name}`);
        requestedItems.push(matchedItem);
      }
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
