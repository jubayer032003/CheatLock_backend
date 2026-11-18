import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { rateLimiter, accessCodeRateLimiter, loginRateLimiter, passwordResetRateLimiter, createRateLimiter,
  sessionRateLimitKey, consumeSocketAuthRateLimit, clearRateLimiterStateForTests } from "../backend/src/middleware/rateLimiter.js";
import { resolveTrustProxy } from "../backend/src/services/httpProxy.js";
import { examsRouter } from "../backend/src/routes/exams.js";
import { requireAuth } from "../backend/src/middleware/auth.js";
import { User } from "../backend/src/models/User.js";
import { Exam } from "../backend/src/models/Exam.js";

process.env.JWT_SECRET = "classroom-rate-limit-isolated-test-secret";
const tokens = new Map();
const userId = index => (index + 1).toString(16).padStart(24, "0");
const tokenFor = index => {
  if (!tokens.has(index)) tokens.set(index, jwt.sign({ sub: userId(index), role: "STUDENT" }, process.env.JWT_SECRET, { expiresIn: "1h" }));
  return tokens.get(index);
};
const request = (index, extra = {}) => ({ ip: "192.0.2.10", headers: { authorization: `Bearer ${tokenFor(index)}` },
  params: { code: "CLASS50" }, body: {}, ...extra });
async function invoke(limiter, req) {
  const result = { status: 200, headers: {} };
  await limiter(req, { setHeader: (key, value) => result.headers[key] = value,
    status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; } },
  error => { if (error) { result.status = error.status || 500; result.error = error; } });
  return result;
}
beforeEach(() => clearRateLimiterStateForTests());

test("200 students sharing one IP each get an independent ordinary API allowance", async () => {
  for (let i = 0; i < 200; i++) for (let call = 0; call < 8; call++) {
    assert.equal((await invoke(rateLimiter, request(i))).status, 200);
  }
});
test("one student's excessive API requests cannot consume a classmate's account budget", async () => {
  for (let i = 0; i < 120; i++) assert.equal((await invoke(rateLimiter, request(0))).status, 200);
  const blocked = await invoke(rateLimiter, request(0));
  assert.equal(blocked.status, 429); assert.equal(blocked.body.rateLimitGroup, "api-account");
  assert.ok(Number(blocked.headers["Retry-After"]) > 0);
  assert.equal((await invoke(rateLimiter, request(1))).status, 200);
});
test("forged bearer subjects do not create independent authenticated budgets", async () => {
  for (let i = 0; i < 1200; i++) {
    const forged = jwt.sign({ sub: userId(i) }, "different-untrusted-test-secret");
    assert.equal((await invoke(rateLimiter, request(i, { headers: { authorization: `Bearer ${forged}` } }))).status, 200);
  }
  const blocked = await invoke(rateLimiter, request(1201, { headers: { authorization: "Bearer invalid" } }));
  assert.equal(blocked.status, 429); assert.equal(blocked.body.rateLimitGroup, "api-anonymous");
  assert.equal((await invoke(rateLimiter, request(0))).status, 200);
});

test("exam re-entry has a separate per-account allowance from background API requests", async () => {
  for (let i = 0; i < 120; i++) assert.equal((await invoke(rateLimiter, request(0))).status, 200);
  assert.equal((await invoke(rateLimiter, request(0))).status, 429);
  const entry = () => request(0, { method: "GET", path: "/exams/access/CLASS50" });
  for (let i = 0; i < 120; i++) assert.equal((await invoke(rateLimiter, entry())).status, 200);
  const flood = await invoke(rateLimiter, entry());
  assert.equal(flood.status, 429);
  assert.equal(flood.body.rateLimitGroup, "api-exam-entry");
  assert.equal((await invoke(rateLimiter, request(1, { method: "GET", path: "/exams/access/CLASS50" }))).status, 200);
});
test("200 authenticated students can use the same code and shared IP", async () => {
  for (let i = 0; i < 200; i++) assert.equal((await invoke(accessCodeRateLimiter, request(i))).status, 200);
});
test("one student cannot evade code-guessing protection by rotating codes or IPs", async () => {
  for (let i = 0; i < 20; i++) assert.equal((await invoke(accessCodeRateLimiter,
    request(0, { ip: `192.0.2.${i+1}`, params: { code: `GUESS${i}` } }))).status, 200);
  assert.equal((await invoke(accessCodeRateLimiter, request(0))).status, 429);
  assert.equal((await invoke(accessCodeRateLimiter, request(1))).status, 200);
});
test("unauthenticated code requests cannot use a client-supplied student ID as identity", async () => {
  const value = await invoke(accessCodeRateLimiter, request(0, { headers: {}, body: { studentId: userId(0) } }));
  assert.equal(value.status, 401);
});
test("Firebase exchanges from different students do not share a no-account login bucket", async () => {
  for (let i = 0; i < 200; i++) assert.equal((await invoke(loginRateLimiter,
    request(i, { headers: {}, body: { idToken: `synthetic-firebase-credential-${i}` } }))).status, 200);
  for (let i = 0; i < 7; i++) assert.equal((await invoke(loginRateLimiter,
    request(0, { headers: {}, body: { idToken: "synthetic-firebase-credential-0" } }))).status, 200);
  assert.equal((await invoke(loginRateLimiter,
    request(0, { headers: {}, body: { idToken: "synthetic-firebase-credential-0" } }))).status, 429);
});
test("password brute-force limits remain account-specific and separate from exam entry", async () => {
  for (let i = 0; i < 8; i++) assert.equal((await invoke(loginRateLimiter,
    request(0, { headers: {}, body: { identifier: "student@example.test" } }))).status, 200);
  assert.equal((await invoke(loginRateLimiter,
    request(0, { headers: {}, body: { identifier: "student@example.test" } }))).status, 429);
  assert.equal((await invoke(accessCodeRateLimiter, request(0))).status, 200);
});
test("remembered-session enrollment gives each authenticated student its own budget", async () => {
  const limiter = createRateLimiter("session-classroom-test", { windowMs: 60000, max: 30 }, sessionRateLimitKey);
  for (let i = 0; i < 200; i++) assert.equal((await invoke(limiter, request(i))).status, 200);
});
test("an administrator can reset different students without sharing the five-attempt target budget", async () => {
  for (let i = 0; i < 50; i++) assert.equal((await invoke(passwordResetRateLimiter,
    request(999, { params: { userId: userId(i) } }))).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await invoke(passwordResetRateLimiter,
    request(999, { params: { userId: userId(0) } }))).status, 200);
  assert.equal((await invoke(passwordResetRateLimiter, request(999, { params: { userId: userId(0) } }))).status, 429);
  assert.equal((await invoke(passwordResetRateLimiter, request(999, { params: { userId: userId(99) } }))).status, 200);
});
test("socket authentication admits a class behind one address while bounding reconnect abuse", async () => {
  for (let i = 0; i < 200; i++) assert.equal((await consumeSocketAuthRateLimit("192.0.2.10", tokenFor(i))).allowed, true);
  for (let i = 0; i < 29; i++) assert.equal((await consumeSocketAuthRateLimit("192.0.2.10", tokenFor(0))).allowed, true);
  assert.equal((await consumeSocketAuthRateLimit("192.0.2.10", tokenFor(0))).allowed, false);
  assert.equal((await consumeSocketAuthRateLimit("192.0.2.10", tokenFor(1))).allowed, true);
});
test("proxy trust requires explicit verified hops or networks", () => {
  assert.equal(resolveTrustProxy(""), false);
  assert.equal(resolveTrustProxy("false"), false);
  assert.equal(resolveTrustProxy("1"), 1);
  assert.deepEqual(resolveTrustProxy("loopback,10.0.0.0/8"), ["loopback", "10.0.0.0/8"]);
  for (const value of ["true", "999", "0.0.0.0/0", "::/0", "untrusted-host", "10.0.0.0/99"]) {
    assert.throws(() => resolveTrustProxy(value));
  }
});

test("real HTTP exam-code entry admits 200 assigned students concurrently behind one IP", async (t) => {
  const users = Array.from({ length: 201 }, (_, i) => ({ _id: userId(i), identifier: `student-${i}`, role: "STUDENT", status: "ACTIVE", tokenVersion: 0 }));
  users.push({ _id: userId(999), identifier: "teacher", role: "TEACHER", status: "ACTIVE" });
  const exam = { _id: "65a000000000000000000001", title: "Isolated class test", accessCode: "CLASS50",
    createdBy: "teacher", status: "LIVE", assignedStudents: users.slice(0, 200).map(user => user.identifier),
    communityStudents: [], questions: [{ text: "Question", type: "MCQ", options: ["A", "B"], correctAnswer: "A" }] };
  const originalUser = User.findById, originalExam = Exam.findOne;
  const query = value => ({ select() { return this; }, lean: async () => value, then: (yes, no) => Promise.resolve(value).then(yes, no) });
  User.findById = id => query(users.find(user => user._id === String(id)) || null);
  Exam.findOne = filter => query(filter.accessCode === "CLASS50" ? exam : null);
  t.after(() => { User.findById = originalUser; Exam.findOne = originalExam; });
  const app = express();
  app.use(rateLimiter); app.use(express.json()); app.use("/exams", examsRouter);
  app.get("/protected", requireAuth, (_req, res) => res.json({ ok: true }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const url = `http://127.0.0.1:${server.address().port}/exams/access/CLASS50`;
  const responses = await Promise.all(Array.from({ length: 200 }, (_, i) => fetch(url,
    { headers: { Authorization: `Bearer ${tokenFor(i)}` } })));
  assert.deepEqual([...new Set(responses.map(response => response.status))], [200]);
  for (let i = 0; i < responses.length; i++) {
    const body = await responses[i].json();
    assert.deepEqual(body.exam.assignedStudents, [`student-${i}`]);
    assert.equal(body.exam.questions[0].correctAnswer, undefined);
  }
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${tokenFor(200)}` } })).status, 403);
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${tokenFor(999)}` } })).status, 403);
  assert.equal((await fetch(url)).status, 401);

  // The Android waiting screen polls this endpoint every five seconds. Leaving
  // and re-entering must still work after more than 20 successful status checks.
  for (let i = 0; i < 40; i++) {
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${tokenFor(0)}` } })).status, 200,
      `successful waiting-screen refresh/re-entry ${i + 1}`);
  }
  // Bad guesses retain their own limit, without locking out a valid exam code.
  const badUrl = url.replace("CLASS50", "INVALID");
  for (let i = 0; i < 20; i++) {
    assert.equal((await fetch(badUrl, { headers: { Authorization: `Bearer ${tokenFor(0)}` } })).status, 404);
  }
  assert.equal((await fetch(badUrl, { headers: { Authorization: `Bearer ${tokenFor(0)}` } })).status, 429);
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${tokenFor(0)}` } })).status, 200);
});
