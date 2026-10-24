import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { authMiddleware } from "./middleware/auth.js";
import { authControllers } from "./controllers/auth.js";
import { itemRoutes } from "./routes/items.js";
import { problem } from "./helpers.js";
export function createApp(config = {}) {
  const app = express(),
    secret = config.jwtSecret || process.env.JWT_SECRET,
    production = process.env.NODE_ENV === "production";
  if (!secret || secret.length < 32)
    throw new Error("Set JWT_SECRET to at least 32 random characters.");
  const origins = (
    process.env.CLIENT_ORIGIN || "http://127.0.0.1:5175,http://localhost:5175"
  )
    .split(",")
    .map((v) => v.trim());
  if (production) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      !origins.includes(req.headers.origin)
    )
      return next(problem(403, "This origin is not allowed."));
    next();
  });
  if (config.rateLimit !== false) {
    app.use(
      "/api",
      rateLimit({
        windowMs: 900000,
        limit: 600,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { message: "Too many requests. Try again later." },
      }),
    );
    app.use(
      ["/api/auth/login", "/api/auth/register"],
      rateLimit({
        windowMs: 900000,
        limit: 20,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: {
          message: "Too many sign-in attempts. Try again in 15 minutes.",
        },
      }),
    );
  }
  const cookie = {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: "/api",
    },
    auth = authMiddleware(secret),
    a = authControllers(secret, cookie);
  app.get("/api/health", (req, res) =>
    res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
      status: mongoose.connection.readyState === 1 ? "ok" : "unavailable",
    }),
  );
  app.post("/api/auth/register", a.register);
  app.post("/api/auth/login", a.login);
  app.post("/api/auth/logout", a.logout);
  app.get("/api/auth/me", auth, a.me);
  app.use("/api", auth, itemRoutes());
  app.use("/api", (req, res, next) =>
    next(problem(404, "Endpoint not found.")),
  );
  const dist = fileURLToPath(new URL("../../client/dist/", import.meta.url));
  if (existsSync(path.join(dist, "index.html"))) {
    app.use(express.static(dist));
    app.get("/{*path}", (req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  app.use((err, req, res, next) => {
    if (err instanceof z.ZodError)
      return res
        .status(400)
        .json({ message: err.issues.map((i) => i.message).join(" ") });
    if (err.code === 11000)
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });
    if (err.name === "VersionError")
      return res
        .status(409)
        .json({ message: "The report changed. Refresh and try again." });
    const status = err.status || 500;
    if (status === 500) console.error("Request failed:", err.name);
    res.status(status).json({
      message:
        status === 500
          ? "Something went wrong. Please try again."
          : err.message,
    });
  });
  return app;
}
