import { Router } from "express";
import { admin } from "../middleware/auth.js";
import * as c from "../controllers/items.js";
export function itemRoutes() {
  const r = Router();
  r.get("/meta", c.metadata);
  r.get("/stats", c.stats);
  r.get("/claims", c.claims);
  r.get("/reports.csv", admin, c.exportSummary);
  r.route("/items").get(c.list).post(c.create);
  r.use("/items/:id", c.byId);
  r.route("/items/:id").get(c.detail).patch(c.edit).delete(c.remove);
  r.patch("/items/:id/status", c.changeStatus);
  r.post("/items/:id/claims", c.submitClaim);
  r.delete("/items/:id/claims/me", c.withdraw);
  r.patch("/items/:id/claims/:claimId/review", admin, c.review);
  return r;
}
