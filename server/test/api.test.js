import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { User, Item } from "../src/models.js";

let mongo, app, users, passwordHash;
const secret = "test-only-reunite-signing-key-not-for-production",
  password = "Reunite-test-password-2026";
before(async () => {
  process.env.NODE_ENV = "test";
  mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
  await mongoose.connect(mongo.getUri("reunite_test"));
  await Promise.all([User.init(), Item.init()]);
  passwordHash = await bcrypt.hash(password, 12);
  app = createApp({ jwtSecret: secret, rateLimit: false });
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await Promise.all([Item.deleteMany({}), User.deleteMany({})]);
  const rows = await User.create(
    ["admin", "finder", "alice", "bob"].map((name) => ({
      name,
      email: name + "@reunite-test.example",
      passwordHash,
      role: name === "admin" ? "admin" : "student",
    })),
  );
  users = Object.fromEntries(rows.map((u) => [u.name, u]));
});
function c(user, method, path, body) {
  const r = request(app)[method]("/api" + path);
  if (user)
    r.set(
      "Cookie",
      "reunite_session=" +
        jwt.sign({ sub: String(user._id) }, secret, {
          issuer: "reunite",
          audience: "reunite-web",
          algorithm: "HS256",
          expiresIn: "1h",
        }),
    );
  return body === undefined ? r : r.send(body);
}
const input = (overrides = {}) => ({
  kind: "Found",
  title: "Wireless headphones",
  description:
    "A fictional pair of headphones was found at the campus library.",
  category: "Electronics",
  location: "Library",
  happenedAt: new Date(Date.now() - 3600000).toISOString(),
  ...overrides,
});
async function item(overrides = {}, creator = users.finder) {
  return Item.create({ ...input(overrides), createdBy: creator._id });
}
const evidence = (name) =>
  "PRIVATE CLUE " +
  name +
  ": a blue star is stitched inside the left carrying sleeve.";
async function claim(i, user) {
  const r = await c(user, "post", "/items/" + i.id + "/claims", {
    evidence: evidence(user.name),
  }).expect(201);
  return r.body.item.myClaim;
}
const review = (i, claimId) =>
  "/items/" + i.id + "/claims/" + claimId + "/review";

test("1. anonymous requests cannot read reports, claims or statistics", async () => {
  for (const path of ["/items", "/claims", "/stats"])
    await c(null, "get", path).expect(401);
});
test("2. registration normalizes email, hashes passwords and returns a safe student profile", async () => {
  const r = await c(null, "post", "/auth/register", {
    name: "New Student",
    email: "  NEW@REUNITE-TEST.EXAMPLE  ",
    password,
  }).expect(201);
  assert.equal(r.body.user.role, "student");
  assert.equal(r.body.user.email, "new@reunite-test.example");
  assert.ok(!JSON.stringify(r.body).includes("passwordHash"));
  const u = await User.findById(r.body.user.id).select("+passwordHash");
  assert.ok(await bcrypt.compare(password, u.passwordHash));
  assert.notEqual(u.passwordHash, password);
});
test("3. forged roles, duplicate emails and excessive password bytes are rejected", async () => {
  await c(null, "post", "/auth/register", {
    name: "Forged",
    email: "fake@example.com",
    password,
    role: "admin",
  }).expect(400);
  await c(null, "post", "/auth/register", {
    name: "Duplicate",
    email: users.alice.email,
    password,
  }).expect(409);
  await c(null, "post", "/auth/register", {
    name: "Long bytes",
    email: "bytes@example.com",
    password: "é".repeat(40),
  }).expect(400);
  await c(null, "post", "/auth/login", {
    email: users.alice.email,
    password: "é".repeat(40),
  }).expect(400);
});
test("4. login rejects wrong passwords and production cookies require HTTPS", async () => {
  await c(null, "post", "/auth/login", {
    email: users.alice.email,
    password: "wrong",
  }).expect(401);
  process.env.NODE_ENV = "production";
  const production = createApp({ jwtSecret: secret, rateLimit: false });
  process.env.NODE_ENV = "test";
  const r = await request(production)
    .post("/api/auth/login")
    .send({ email: users.alice.email, password })
    .expect(200);
  const cookie = r.headers["set-cookie"][0];
  for (const part of ["Secure", "HttpOnly", "SameSite=Lax", "Path=/api"])
    assert.ok(cookie.includes(part));
});
test("5. authorization reads the current database role rather than a forged cookie role", async () => {
  const token = jwt.sign({ sub: users.alice.id, role: "admin" }, secret, {
    issuer: "reunite",
    audience: "reunite-web",
  });
  await request(app)
    .get("/api/reports.csv")
    .set("Cookie", "reunite_session=" + token)
    .expect(403);
  await User.updateOne({ _id: users.alice._id }, { $set: { role: "admin" } });
  await request(app)
    .get("/api/reports.csv")
    .set("Cookie", "reunite_session=" + token)
    .expect(200);
});
test("6. report validation enforces kind, category, lengths, safe fields and dates", async () => {
  for (const override of [
    { title: "x" },
    { category: "Unknown" },
    { happenedAt: "2020-99-99" },
    { happenedAt: new Date(Date.now() + 86400000).toISOString() },
    { happenedAt: "1999-01-01T00:00:00.000Z" },
    { status: "Returned" },
    { createdBy: users.admin.id },
  ])
    await c(users.alice, "post", "/items", input(override)).expect(400);
  const r = await c(users.alice, "post", "/items", input()).expect(201);
  assert.equal(r.body.item.status, "Open");
  assert.equal(r.body.item.isOwner, true);
});
test("7. only the reporter or administrator can edit or delete an eligible report", async () => {
  const i = await item();
  await c(
    users.alice,
    "patch",
    "/items/" + i.id,
    input({ title: "Changed title" }),
  ).expect(403);
  await c(
    users.finder,
    "patch",
    "/items/" + i.id,
    input({ title: "Owner update" }),
  ).expect(200);
  await c(users.alice, "delete", "/items/" + i.id).expect(403);
  await c(
    users.admin,
    "patch",
    "/items/" + i.id,
    input({ title: "Staff update" }),
  ).expect(200);
  await c(users.finder, "delete", "/items/" + i.id).expect(204);
  assert.equal(await Item.findById(i._id), null);
});
test("8. filters and pagination work and regex syntax is treated as literal text", async () => {
  await item(
    { title: "Lost [special] notebook", kind: "Lost", category: "Books" },
    users.alice,
  );
  await item();
  let r = await c(users.bob, "get", "/items?search=%5Bspecial%5D").expect(200);
  assert.equal(r.body.total, 1);
  r = await c(
    users.alice,
    "get",
    "/items?scope=mine&kind=Lost&category=Books&limit=1",
  ).expect(200);
  assert.equal(r.body.total, 1);
  r = await c(users.bob, "get", "/items?search=.*").expect(200);
  assert.equal(r.body.total, 0);
  for (const q of ["limit=31", "page=0", "unknown=1"])
    await c(users.alice, "get", "/items?" + q).expect(400);
});
test("9. claims require a found item, a different reporter and a student role", async () => {
  const lost = await item({ kind: "Lost" }),
    found = await item();
  await c(users.alice, "post", "/items/" + lost.id + "/claims", {
    evidence: evidence("alice"),
  }).expect(409);
  await c(users.finder, "post", "/items/" + found.id + "/claims", {
    evidence: evidence("finder"),
  }).expect(403);
  await c(users.admin, "post", "/items/" + found.id + "/claims", {
    evidence: evidence("admin"),
  }).expect(403);
  await c(users.alice, "post", "/items/" + found.id + "/claims", {
    evidence: "short",
  }).expect(400);
});
test("10. private evidence never leaks to other students or the item reporter", async () => {
  const i = await item();
  await claim(i, users.alice);
  for (const u of [users.bob, users.finder]) {
    const r = await c(u, "get", "/items/" + i.id).expect(200);
    assert.equal(r.body.item.myClaim, null);
    assert.ok(!JSON.stringify(r.body).includes(evidence("alice")));
    const list = await c(u, "get", "/claims?itemId=" + i.id).expect(200);
    assert.equal(list.body.total, 0);
  }
  const own = await c(users.alice, "get", "/claims").expect(200);
  assert.equal(own.body.items[0].claim.evidence, evidence("alice"));
  assert.equal(own.body.items[0].claim.student, undefined);
  const staff = await c(users.admin, "get", "/claims").expect(200);
  assert.equal(staff.body.items[0].claim.student.email, users.alice.email);
  assert.equal(staff.body.items[0].claim.evidence, evidence("alice"));
});
test("11. simultaneous duplicate claims produce one stored claim", async () => {
  const i = await item();
  const rows = await Promise.all([
    c(users.alice, "post", "/items/" + i.id + "/claims", {
      evidence: evidence("alice"),
    }),
    c(users.alice, "post", "/items/" + i.id + "/claims", {
      evidence: evidence("alice"),
    }),
  ]);
  assert.deepEqual(rows.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await Item.findById(i._id)).claims.length, 1);
});
test("12. the bounded embedded claim list rejects the next claim at capacity", async () => {
  const i = await item();
  await Item.updateOne(
    { _id: i._id },
    {
      $set: {
        claims: Array.from({ length: 100 }, () => ({
          student: new mongoose.Types.ObjectId(),
          evidence: evidence("capacity"),
          status: "Pending",
        })),
      },
    },
  );
  await c(users.alice, "post", "/items/" + i.id + "/claims", {
    evidence: evidence("alice"),
  }).expect(409);
  assert.equal((await Item.findById(i._id)).claims.length, 100);
});
test("13. students cannot approve or reject ownership claims", async () => {
  const i = await item(),
    a = await claim(i, users.alice);
  for (const u of [users.alice, users.finder])
    await c(u, "patch", review(i, a.id), {
      decision: "Approved",
      note: "Evidence was checked.",
    }).expect(403);
});
test("14. rejection requires a note and persists the reviewer and decision", async () => {
  const i = await item(),
    a = await claim(i, users.alice);
  await c(users.admin, "patch", review(i, a.id), {
    decision: "Rejected",
    note: "tiny",
  }).expect(400);
  await c(users.admin, "patch", review(i, a.id), {
    decision: "Rejected",
    note: "The provided details did not match.",
  }).expect(200);
  const saved = await Item.findById(i._id);
  assert.equal(saved.status, "Open");
  assert.equal(saved.claims[0].status, "Rejected");
  assert.equal(String(saved.claims[0].reviewedBy), users.admin.id);
  assert.ok(saved.claims[0].reviewedAt instanceof Date);
  await c(users.admin, "patch", review(i, a.id), {
    decision: "Approved",
    note: "Trying again is not permitted.",
  }).expect(409);
  await c(users.alice, "post", "/items/" + i.id + "/claims", {
    evidence: evidence("second"),
  }).expect(409);
});
test("15. approval atomically selects one owner and rejects competing pending claims", async () => {
  const i = await item(),
    a = await claim(i, users.alice);
  await claim(i, users.bob);
  const note = "$literal evidence matched the hidden mark.";
  await c(users.admin, "patch", review(i, a.id), {
    decision: "Approved",
    note,
  }).expect(200);
  const saved = await Item.findById(i._id);
  assert.equal(saved.status, "Claimed");
  assert.equal(String(saved.approvedClaim), a.id);
  assert.equal(saved.claims.find((x) => x.id === a.id).reviewNote, note);
  assert.equal(saved.claims.filter((x) => x.status === "Approved").length, 1);
  assert.equal(saved.claims.filter((x) => x.status === "Rejected").length, 1);
});
test("16. competing administrator approvals cannot approve two owners", async () => {
  const i = await item(),
    a = await claim(i, users.alice),
    b = await claim(i, users.bob);
  const rows = await Promise.all([
    c(users.admin, "patch", review(i, a.id), {
      decision: "Approved",
      note: "Alice evidence was checked.",
    }),
    c(users.admin, "patch", review(i, b.id), {
      decision: "Approved",
      note: "Bob evidence was checked.",
    }),
  ]);
  assert.deepEqual(rows.map((r) => r.status).sort(), [200, 409]);
  const saved = await Item.findById(i._id);
  assert.equal(saved.claims.filter((c) => c.status === "Approved").length, 1);
  assert.equal(saved.claims.filter((c) => c.status === "Rejected").length, 1);
});
test("17. found-item return requires an approved claim and an administrator", async () => {
  const i = await item();
  await c(users.admin, "patch", "/items/" + i.id + "/status", {
    status: "Returned",
  }).expect(409);
  const a = await claim(i, users.alice);
  await c(users.admin, "patch", review(i, a.id), {
    decision: "Approved",
    note: "Ownership details matched.",
  }).expect(200);
  await c(users.bob, "post", "/items/" + i.id + "/claims", {
    evidence: evidence("bob"),
  }).expect(409);
  for (const u of [users.finder, users.alice])
    await c(u, "patch", "/items/" + i.id + "/status", {
      status: "Returned",
    }).expect(403);
  await c(users.admin, "patch", "/items/" + i.id + "/status", {
    status: "Returned",
  }).expect(200);
});
test("18. returned reports preserve history and cannot be reopened, edited or deleted", async () => {
  const i = await item({ kind: "Lost", status: "Returned" }, users.alice);
  await c(users.alice, "patch", "/items/" + i.id, input()).expect(409);
  await c(users.admin, "delete", "/items/" + i.id).expect(409);
  await c(users.admin, "patch", "/items/" + i.id + "/status", {
    status: "Closed",
  }).expect(409);
  await c(users.admin, "patch", "/items/" + i.id + "/status", {
    status: "Open",
  }).expect(400);
  assert.ok(await Item.findById(i._id));
});
test("19. only the owner can withdraw a pending claim and withdrawal is final", async () => {
  const i = await item(),
    a = await claim(i, users.alice);
  await c(users.bob, "delete", "/items/" + i.id + "/claims/me").expect(409);
  assert.equal((await Item.findById(i._id)).claims[0].status, "Pending");
  await c(users.alice, "delete", "/items/" + i.id + "/claims/me").expect(200);
  assert.equal((await Item.findById(i._id)).claims[0].status, "Withdrawn");
  await c(users.admin, "patch", review(i, a.id), {
    decision: "Approved",
    note: "Cannot approve a withdrawn claim.",
  }).expect(409);
  await c(users.alice, "post", "/items/" + i.id + "/claims", {
    evidence: evidence("second"),
  }).expect(409);
});
test("20. claim history locks edits and staff closure rejects pending claims", async () => {
  const i = await item();
  await claim(i, users.alice);
  await c(users.finder, "patch", "/items/" + i.id, input()).expect(409);
  await c(users.admin, "delete", "/items/" + i.id).expect(409);
  await c(users.finder, "patch", "/items/" + i.id + "/status", {
    status: "Closed",
  }).expect(409);
  await c(users.admin, "patch", "/items/" + i.id + "/status", {
    status: "Closed",
  }).expect(200);
  const saved = await Item.findById(i._id);
  assert.equal(saved.status, "Closed");
  assert.equal(saved.claims[0].status, "Rejected");
  assert.equal(String(saved.claims[0].reviewedBy), users.admin.id);
});
test("21. a lost-item reporter can record recovery but a stranger cannot", async () => {
  const i = await item({ kind: "Lost" }, users.alice);
  await c(users.bob, "patch", "/items/" + i.id + "/status", {
    status: "Returned",
  }).expect(403);
  await c(users.alice, "patch", "/items/" + i.id + "/status", {
    status: "Returned",
  }).expect(200);
  assert.equal((await Item.findById(i._id)).status, "Returned");
});
test("22. claim list pagination, item filters and status filters remain private", async () => {
  const a = await item(),
    b = await item({ title: "Another found item" });
  await claim(a, users.alice);
  await claim(b, users.bob);
  const r = await c(
    users.admin,
    "get",
    "/claims?limit=1&page=2&status=Pending",
  ).expect(200);
  assert.equal(r.body.total, 2);
  assert.equal(r.body.items.length, 1);
  const own = await c(users.alice, "get", "/claims?itemId=" + b.id).expect(200);
  assert.equal(own.body.total, 0);
  for (const q of ["limit=31", "page=0", "itemId=bad"])
    await c(users.alice, "get", "/claims?" + q).expect(400);
});
test("23. summary CSV is admin-only, formula-safe and excludes ownership evidence", async () => {
  const i = await item({ title: '=HYPERLINK("bad")' });
  await claim(i, users.alice);
  await c(users.alice, "get", "/reports.csv").expect(403);
  const r = await c(users.admin, "get", "/reports.csv").expect(200);
  assert.match(r.headers["content-type"], /text\/csv/);
  assert.ok(r.text.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(!r.text.includes(evidence("alice")));
  assert.ok(!r.text.includes(users.alice.email));
});
test("24. browser-origin checks reject writes and authentication rate limits apply", async () => {
  await request(app)
    .post("/api/auth/login")
    .set("Origin", "https://untrusted.example")
    .send({ email: users.alice.email, password })
    .expect(403);
  const limited = createApp({ jwtSecret: secret });
  for (let n = 0; n < 20; n++)
    await request(limited).post("/api/auth/login").send({}).expect(400);
  await request(limited).post("/api/auth/login").send({}).expect(429);
});
test("25. invalid IDs and unknown endpoints fail safely; health reports Mongo readiness", async () => {
  await c(users.alice, "get", "/items/not-an-id").expect(404);
  await c(users.alice, "get", "/items/" + new mongoose.Types.ObjectId()).expect(
    404,
  );
  const i = await item();
  await c(users.admin, "patch", review(i, "bad"), {
    decision: "Approved",
    note: "Safe invalid identifier.",
  }).expect(404);
  await c(users.alice, "get", "/missing").expect(404);
  const health = await request(app).get("/api/health").expect(200);
  assert.equal(health.body.status, "ok");
});
test("26. role-scoped statistics, logout and refreshed SPA navigation work", async () => {
  const i = await item();
  await claim(i, users.alice);
  await item({ kind: "Lost", status: "Returned" }, users.alice);
  const own = await c(users.alice, "get", "/stats").expect(200),
    other = await c(users.bob, "get", "/stats").expect(200),
    staff = await c(users.admin, "get", "/stats").expect(200);
  assert.equal(own.body.pendingClaims, 1);
  assert.equal(other.body.pendingClaims, 0);
  assert.equal(staff.body.pendingClaims, 1);
  assert.equal(own.body.myReports, 1);
  assert.equal(own.body.reunited, 1);
  const r = await c(users.alice, "post", "/auth/logout").expect(204);
  assert.ok(r.headers["set-cookie"][0].includes("reunite_session=;"));
  const spa = await request(app).get("/claims/history").expect(200);
  assert.ok(spa.text.includes('id="root"'));
});
