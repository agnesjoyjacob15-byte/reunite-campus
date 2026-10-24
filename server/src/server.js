import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";

if (!process.env.MONGODB_URI)
  throw new Error(
    "Set MONGODB_URI in your environment. For local development, use npm run dev.",
  );
await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
});
const server = createApp().listen(
  Number(process.env.PORT || 5002),
  "0.0.0.0",
  () =>
    console.log(`Reunite API listening on port ${process.env.PORT || 5002}`),
);
async function shutdown() {
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
