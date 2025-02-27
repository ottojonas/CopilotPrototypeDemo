"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEmails = processEmails;
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
const azureTokenCredentials_1 = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");
const identity_1 = require("@azure/identity");
const csvService_1 = require("./csvService");
const utils_1 = require("./utils");
const credential = new identity_1.InteractiveBrowserCredential({
  clientId: "21ec56a6-60a3-4f16-b9ca-c6f3ca0f713f",
  tenantId: "bea1b781-c641-4bde-a222-89760960615d",
});
const authProvider =
  new azureTokenCredentials_1.TokenCredentialAuthenticationProvider(
    credential,
    {
      scopes: ["Mail.Read", "Mail.Send"],
    }
  );
const client = microsoft_graph_client_1.Client.initWithMiddleware({
  authProvider,
});
function getEmailsFromOtto() {
  return __awaiter(this, void 0, void 0, function* () {
    const response = yield client
      .api("/me/messages")
      .filter("from/emailAddress/address eq 'otto@purelydynamics.co.uk'")
      .get();
    return response.value;
  });
}
function sendReplyEmail(email, replyBody) {
  return __awaiter(this, void 0, void 0, function* () {
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
    yield client.api(`/me/messages/${email.id}/reply`).post(reply);
  });
}
function processEmails() {
  return __awaiter(this, void 0, void 0, function* () {
    const items = yield (0, csvService_1.readCSV)("demo_data/demodata.csv");
    const emails = yield getEmailsFromOtto();
    for (const email of emails) {
      const requestedItems = (0, utils_1.extractRequestedItems)(
        email.body.content,
        items
      );
      const replyBody = (0, utils_1.generateReplyEmail)(requestedItems);
      yield sendReplyEmail(email, replyBody);
    }
  });
}
