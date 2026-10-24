import jwt from "jsonwebtoken";
import { User } from "../models.js";
import { problem } from "../helpers.js";
export const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
});
export function authMiddleware(secret) {
  return async (req, res, next) => {
    try {
      const p = jwt.verify(req.cookies.reunite_session, secret, {
        issuer: "reunite",
        audience: "reunite-web",
        algorithms: ["HS256"],
      });
      req.user = await User.findById(p.sub);
      if (!req.user) throw new Error();
      next();
    } catch {
      next(problem(401, "Please sign in to continue."));
    }
  };
}
export function admin(req, res, next) {
  return req.user.role === "admin"
    ? next()
    : next(problem(403, "Administrator access is required."));
}
export function session(res, user, secret, options) {
  res.cookie(
    "reunite_session",
    jwt.sign({ sub: String(user._id) }, secret, {
      expiresIn: "8h",
      issuer: "reunite",
      audience: "reunite-web",
    }),
    { ...options, maxAge: 8 * 3600000 },
  );
}
