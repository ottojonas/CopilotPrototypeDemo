import dotenv from "dotenv";
dotenv.config({ path: "./env/.env.dev" });

export const config = {
  tenantId: process.env.TENANT_ID || "",
  clientId: process.env.CLIENT_ID || "",
  clientSecret: process.env.CLIENT_SECRET || "",
  redirectUri: "http://localhost:4001",
  userId: "otto@purelydynamics.co.uk",
};

if (!config.tenantId) {
  throw new Error("Missing tenantId environmental variable");
}

if (!config.clientId) {
  throw new Error("Missing clientId environmental variable");
}

if (!config.clientSecret) {
  throw new Error("Missing clientSecret environmental variable");
}
