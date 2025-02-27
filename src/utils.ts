import { Item } from "./types";

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
      requestedItems.push(item);
    }
  });
  return requestedItems;
}

export function generateReplyEmail(requestedItems: Item[]): string {
  let reply =
    "Thanks for getting into contact with us!\n\nHere are the quotes for the requested items:\n\n";
  requestedItems.forEach((item) => {
    reply += `Item: ${item.name}, Price: £${item.price} (Approx)\n`;
  });
  return reply;
}
