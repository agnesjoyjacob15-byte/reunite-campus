import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models.js";
const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (
  !MONGODB_URI ||
  !ADMIN_EMAIL ||
  !ADMIN_PASSWORD ||
  ADMIN_PASSWORD.length < 12 ||
  Buffer.byteLength(ADMIN_PASSWORD, "utf8") > 72
) {
  throw new Error(
    "Set MONGODB_URI, ADMIN_EMAIL, and ADMIN_PASSWORD (12+ characters; at most 72 UTF-8 bytes) in the environment.",
  );
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL))
  throw new Error("ADMIN_EMAIL must be a valid email address.");
try {
  await mongoose.connect(MONGODB_URI);
  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (await User.exists({ email }))
    throw new Error("This email already exists. No account was changed.");
  await User.create({
    name: "Event Administrator",
    email,
    role: "admin",
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
  });
  console.log("Administrator account created. No credentials were printed.");
} finally {
  await mongoose.disconnect();
}
