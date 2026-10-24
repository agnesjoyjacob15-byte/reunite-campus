import dotenv from "dotenv";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { MongoBinary } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { seedDemo } from "./seed.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
dotenv.config({ path: path.join(root, "server/.env"), quiet: true });
const local = path.join(root, ".local-data");
await mkdir(local, { recursive: true });
let credentials;
try {
  credentials = JSON.parse(
    await readFile(path.join(local, "credentials.json"), "utf8"),
  );
} catch {
  credentials = {
    adminEmail: "admin@reunite.example",
    studentEmail: "student@reunite.example",
    password: randomBytes(18).toString("base64url"),
  };
}
credentials.jwtSecret ||= randomBytes(48).toString("hex");
await writeFile(
  path.join(local, "credentials.json"),
  JSON.stringify(credentials, null, 2),
);
process.env.JWT_SECRET ||= credentials.jwtSecret;
process.env.NODE_ENV = "development";
process.env.ADMIN_EMAIL ||= credentials.adminEmail;
process.env.ADMIN_PASSWORD ||= credentials.password;
process.env.DEMO_PASSWORD ||= credentials.password;
process.env.CLIENT_ORIGIN ||= "http://127.0.0.1:5175,http://localhost:5175";
let mongoProcess,
  mongoUri,
  server,
  stopping = false,
  mongoExited = false;

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect().catch(() => {});
  if (mongoProcess && !mongoExited) {
    const client = new mongoose.mongo.MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 1000,
      socketTimeoutMS: 2000,
    });
    try {
      await client.connect();
      await client.db("admin").command({ shutdown: 1 });
    } catch {
      /* MongoDB normally closes the socket while shutting down. */
    } finally {
      await client.close().catch(() => {});
    }
    if (!mongoExited) {
      await Promise.race([
        new Promise((resolve) => mongoProcess.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      if (!mongoExited) mongoProcess.kill();
    }
  }
  process.exit(code);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
process.on("message", (message) => {
  if (message === "shutdown") void stop();
});

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}
try {
  if (!process.env.MONGODB_URI) {
    const dbPath = path.join(local, "mongodb");
    await mkdir(dbPath, { recursive: true });
    const binary = await MongoBinary.getPath({
      version: "7.0.14",
      downloadDir: path.join(local, "mongodb-binaries"),
    });
    const port = await availablePort();
    mongoUri = "mongodb://127.0.0.1:" + port + "/reunite_demo";
    let spawnError;
    mongoProcess = spawn(
      binary,
      [
        "--dbpath",
        dbPath,
        "--port",
        String(port),
        "--bind_ip",
        "127.0.0.1",
        "--wiredTigerCacheSizeGB",
        "0.25",
        "--logpath",
        path.join(local, "mongodb.log"),
        "--logappend",
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    mongoProcess.once("error", (error) => {
      spawnError = error;
    });
    mongoProcess.once("exit", () => {
      mongoExited = true;
    });
    const client = new mongoose.mongo.MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 500,
    });
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (spawnError) throw spawnError;
      if (mongoExited)
        throw new Error(
          "Local MongoDB exited. Inspect .local-data/mongodb.log; another instance may hold its data folder.",
        );
      try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    await client.close();
    if (!ready)
      throw new Error(
        "Local MongoDB did not become ready. Inspect .local-data/mongodb.log.",
      );
    process.env.MONGODB_URI = mongoUri;
    console.log("Local MongoDB ready. Records persist in .local-data/mongodb.");
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  if (mongoProcess) await seedDemo();
  const app = createApp();
  await new Promise((resolve, reject) => {
    server = app.listen(Number(process.env.PORT || 5002), "127.0.0.1", resolve);
    server.once("error", reject);
  });
  console.log("API ready at http://127.0.0.1:" + (process.env.PORT || 5002));
  console.log(
    "Local demonstration account details: .local-data/credentials.json (never commit this file).",
  );
} catch (error) {
  console.error(error.message);
  await stop(1);
}
