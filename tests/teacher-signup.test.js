import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { authRouter } from "../backend/src/routes/auth.js";
import { User } from "../backend/src/models/User.js";
import { requireAuth, requireRole } from "../backend/src/middleware/auth.js";
import { clearRateLimiterStateForTests } from "../backend/src/middleware/rateLimiter.js";

process.env.JWT_SECRET = "teacher-signup-isolated-test-secret";
const users = [];
let race = false;
const query = value => ({ select() { return this; }, lean: async () => value, then: (yes, no) => Promise.resolve(value).then(yes, no) });
User.findOne = criteria => query(users.find(user => user.identifier === criteria.identifier &&
  (typeof criteria.role === "string" ? user.role === criteria.role : criteria.role?.$in.includes(user.role))) || null);
User.findById = id => query(users.find(user => String(user._id) === String(id)) || null);
User.create = async payload => {
  if (race) throw Object.assign(new Error("Duplicate key"), { code: 11000 });
  const user = { _id: String(users.length + 1).padStart(24, "0"), ...payload };
  users.push(user); return user;
};
beforeEach(() => { users.length = 0; race = false; clearRateLimiterStateForTests(); });
const signup = { name: " Teacher One ", identifier: "Teacher@Example.test", password: "isolated-test-password" };
async function withApp(action) {
  const app = express(); app.use(express.json()); app.use("/auth", authRouter);
  app.get("/teacher", requireAuth, requireRole("TEACHER"), (req, res) => res.json({ role: req.user.role }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ code: error.code, message: error.message }));
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body) => { const response = await fetch(url + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, headers: response.headers, body: await response.json() }; };
  try { await action(post, url); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test("teacher signup creates a hashed ACTIVE account, signs in immediately and permits later login", async () => withApp(async (post, url) => {
  const created = await post("/auth/teacher-signup", signup);
  assert.equal(created.status, 201); assert.equal(created.headers.get("cache-control"), "no-store");
  assert.equal(created.body.user.role, "TEACHER"); assert.equal(created.body.user.identifier, "teacher@example.test");
  assert.equal(created.body.user.name, "Teacher One"); assert.equal(created.body.user.passwordHash, undefined);
  assert.equal(users[0].status, "ACTIVE"); assert.equal(users[0].tenantId, undefined);
  assert.notEqual(users[0].passwordHash, signup.password); assert.equal(await bcrypt.compare(signup.password, users[0].passwordHash), true);
  const claims = jwt.verify(created.body.token, process.env.JWT_SECRET); assert.equal(claims.role, "TEACHER");
  assert.equal((await fetch(url + "/teacher", { headers: { Authorization: `Bearer ${created.body.token}` } })).status, 200);
  const loggedIn = await post("/auth/login", { identifier: "teacher@example.test", password: signup.password, role: "TEACHER" });
  assert.equal(loggedIn.status, 200); assert.equal(loggedIn.body.user.role, "TEACHER");
}));
test("teacher signup rejects malformed input and privileged fields without creating users", async () => withApp(async post => {
  for (const extra of [{ name: " " }, { identifier: "invalid" }, { password: "short" }, { password: "🔐".repeat(19) }]) {
    assert.equal((await post("/auth/teacher-signup", { ...signup, ...extra })).status, 400);
  }
  for (const extra of [{ role: "SUPER_ADMIN" }, { role: "STUDENT" }, { tenantId: "institution" }, { status: "ACTIVE" }, { permissions: ["manage_users"] }]) {
    assert.equal((await post("/auth/teacher-signup", { ...signup, ...extra })).status, 403);
  }
  assert.equal(users.length, 0);
}));
test("duplicates and concurrent unique-index conflicts return a useful conflict", async () => withApp(async post => {
  assert.equal((await post("/auth/teacher-signup", signup)).status, 201);
  assert.equal((await post("/auth/teacher-signup", { ...signup, identifier: " teacher@example.test " })).status, 409);
  race = true;
  assert.equal((await post("/auth/teacher-signup", { ...signup, identifier: "other@example.test" })).status, 409);
  assert.equal(users.length, 1);
}));
test("legacy student signup cannot request staff privileges", async () => withApp(async post => {
  assert.equal((await post("/auth/signup", { ...signup, role: "TEACHER" })).status, 403);
  assert.equal(users.length, 0);
}));
