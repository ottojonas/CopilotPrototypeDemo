"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRequestedItems = extractRequestedItems;
exports.generateReplyEmail = generateReplyEmail;
function extractRequestedItems(emailBody, items) {
    const requestedItems = [];
    items.forEach((item) => {
        if (emailBody.includes(item.name)) {
            requestedItems.push(item);
        }
    });
    return requestedItems;
}
function generateReplyEmail(requestedItems) {
    let reply = "Thanks for using Teams Toolkit to create your declarative agent!\n\nHere are the quotes for the requested items:\n\n";
    requestedItems.forEach((item) => {
        reply += `Item: ${item.name}, Price: ${item.price}\n`;
    });
    return reply;
}
