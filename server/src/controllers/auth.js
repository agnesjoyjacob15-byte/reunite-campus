import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models.js";
import { text, email, password, problem } from "../helpers.js";
import { session, publicUser } from "../middleware/auth.js";
export function authControllers(secret, cookie) {
  return {
    register: async (req, res) => {
      const v = z
        .object({ name: text(2, 80), email, password })
        .strict()
        .parse(req.body);
      const u = await User.create({
        name: v.name,
        email: v.email,
        passwordHash: await bcrypt.hash(v.password, 12),
        role: "student",
      });
      session(res, u, secret, cookie);
      res.status(201).json({ user: publicUser(u) });
    },
    login: async (req, res) => {
      const v = z
        .object({
          email,
          password: z
            .string()
            .min(1)
            .max(72)
            .refine(
              (v) => Buffer.byteLength(v, "utf8") <= 72,
              "Use no more than 72 UTF-8 bytes.",
            ),
        })
        .strict()
        .parse(req.body);
      const u = await User.findOne({ email: v.email }).select("+passwordHash");
      const valid = await bcrypt.compare(
        v.password,
        u?.passwordHash ||
          "$2b$12$4rM7fsQY7q8XHW5a3R3jzeTYPK1pVhZHAQK.EhRZVvNP7oIIf4A0K",
      );
      if (!u || !valid) throw problem(401, "Email or password is incorrect.");
      session(res, u, secret, cookie);
      res.json({ user: publicUser(u) });
    },
    logout: (req, res) => {
      res.clearCookie("reunite_session", cookie);
      res.status(204).end();
    },
    me: (req, res) => res.json({ user: publicUser(req.user) }),
  };
}
