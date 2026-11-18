import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { leaderboardRouter } from "../backend/src/routes/leaderboard.js";
import { publishedResultsRouter } from "../backend/src/routes/publishedResults.js";
import { ExamResultPublication } from "../backend/src/models/ExamResultPublication.js";
import { User } from "../backend/src/models/User.js";
import { Exam } from "../backend/src/models/Exam.js";
import { ExamSession } from "../backend/src/models/ExamSession.js";
import { Submission } from "../backend/src/models/Submission.js";

process.env.JWT_SECRET = "publication-isolated-test-secret";
const examId = "65a000000000000000000001";
const teacherId = "65b000000000000000000001", aId = "65b000000000000000000002", bId = "65b000000000000000000003", otherTeacherId = "65b000000000000000000004";
const store = new Map();
let users, exam, submissions, writes, lastProjection;
const copy = value => value == null ? value : structuredClone(value);
function query(value) { return { select(projection) { lastProjection = projection; return this; }, sort() { return this; }, limit() { return this; }, lean: async () => copy(value), then: (yes, no) => Promise.resolve(copy(value)).then(yes, no) }; }
User.findById = id => query(users.find(user => user._id === String(id)) || null);
User.find = filter => query(users.filter(user => user.role === "STUDENT" && filter.identifier.$in.includes(user.identifier)));
Exam.findOne = filter => query(filter._id === examId && filter.createdBy === "teacher@test" ? exam : null);
ExamSession.find = () => query(["a@test", "b@test"].map(studentId => ({ studentId, status: "SUBMITTED", startedAt: 1 })));
Submission.find = () => query(submissions);
ExamResultPublication.findById = id => query(store.get(String(id)) || null);
ExamResultPublication.create = async value => {
  await Promise.resolve();
  if (store.has(String(value._id))) throw Object.assign(new Error("duplicate"), { code: 11000 });
  store.set(String(value._id), copy(value)); writes++; return copy(value);
};
ExamResultPublication.findOneAndUpdate = (filter, update) => {
  const current = store.get(String(filter._id));
  if (!current || current.revision !== filter.revision) return query(null);
  const value = { ...current, ...update.$set }; store.set(String(filter._id), copy(value)); writes++; return query(value);
};
ExamResultPublication.find = filter => {
  assert.equal(typeof filter["results.userId"], "string");
  return query([...store.values()].filter(item => item.results.some(row => row.userId === filter["results.userId"])));
};
beforeEach(() => {
  store.clear(); writes = 0; lastProjection = undefined;
  users = [
    { _id: teacherId, identifier: "teacher@test", role: "TEACHER", name: "Teacher" },
    { _id: aId, identifier: "a@test", role: "STUDENT", name: "Student A" },
    { _id: bId, identifier: "b@test", role: "STUDENT", name: "Student B" },
    { _id: otherTeacherId, identifier: "other@test", role: "TEACHER", name: "Other Teacher" },
  ].map(user => ({ ...user, status: "ACTIVE", tokenVersion: 0 }));
  exam = { _id: examId, title: "Publication exam", status: "ENDED", assignedStudents: ["a@test", "b@test"],
    questions: [{ type: "MCQ", text: "Question", options: ["A", "B"], correctAnswer: "0", marks: 2 }] };
  submissions = [{ studentId: "a@test", submittedAt: 2, answers: [{ questionIndex: 0, answerText: "A" }] },
    { studentId: "b@test", submittedAt: 2, answers: [{ questionIndex: 0, answerText: "B" }] }];
});
async function withServer(run) {
  const app = express(); app.use(express.json()); app.use("/teacher", leaderboardRouter); app.use("/students", publishedResultsRouter);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message, code: error.code }));
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, user = teacherId, body) => {
    const headers = { "Content-Type": "application/json" };
    if (user) headers.Authorization = `Bearer ${jwt.sign({ sub: user }, process.env.JWT_SECRET, { expiresIn: "1h" })}`;
    const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  const review = () => call(`/teacher/exams/${examId}/leaderboard`);
  const publish = expectedDigest => call(`/teacher/exams/${examId}/leaderboard/publish`, teacherId, { expectedDigest });
  try { await run({ call, review, publish }); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test("teacher sees sorted draft results; students see nothing until publication, then only their own score", async () => withServer(async ({ call, review, publish }) => {
  const draft = await review(); assert.equal(draft.status, 200); assert.equal(draft.body.students[0].studentId, "a@test");
  assert.equal(draft.body.publication.publishedAt, null); assert.equal(writes, 0);
  assert.deepEqual((await call("/students/me/results", aId)).body.results, []);
  assert.equal((await publish(draft.body.digest)).status, 200); assert.equal(writes, 1);
  const a = await call("/students/me/results?studentId=b@test", aId);
  assert.equal(a.status, 200); assert.equal(a.headers.get("cache-control"), "no-store");
  assert.equal(a.body.results.length, 1); assert.equal(a.body.results[0].marks, 2); assert.equal(a.body.results[0].correct, 1);
  assert.equal(a.body.results[0].rank, undefined); assert.equal(a.body.results[0].answers, undefined);
  assert.equal(JSON.stringify(a.body).includes("b@test"), false);
  assert.deepEqual(lastProjection.results, { $elemMatch: { userId: aId } });
  assert.equal((await call("/students/me/results", bId)).body.results[0].marks, 0);
}));
test("repeated and concurrent publish requests are idempotent", async () => withServer(async ({ review, publish }) => {
  const digest = (await review()).body.digest;
  const responses = await Promise.all([publish(digest), publish(digest)]);
  assert.ok(responses.every(response => response.status === 200)); assert.equal(writes, 1);
  assert.equal(responses[0].body.publication.revision, 1);
  assert.equal((await publish(digest)).body.publication.revision, 1); assert.equal(writes, 1);
}));
test("changed drafts require teacher review and do not change student snapshots until republished", async () => withServer(async ({ call, review, publish }) => {
  const first = (await review()).body; await publish(first.digest);
  submissions[1].answers[0].answerText = "A";
  const second = (await review()).body; assert.equal(second.publication.hasUnpublishedChanges, true);
  assert.equal((await call("/students/me/results", bId)).body.results[0].marks, 0);
  assert.equal((await publish(first.digest)).status, 409); assert.equal(writes, 1);
  assert.equal((await publish(second.digest)).body.publication.revision, 2);
  assert.equal((await call("/students/me/results", bId)).body.results[0].marks, 2);
}));
test("student identity changes cannot transfer an existing published result to another account", async () => withServer(async ({ call, review, publish }) => {
  await publish((await review()).body.digest);
  users.find(user => user._id === aId).identifier = "renamed@test";
  assert.equal((await call("/students/me/results", aId)).body.results[0].marks, 2);
  assert.equal((await call("/students/me/results", bId)).body.results[0].marks, 0);
}));
test("publishing rejects unfinished exams, invalid keys and unauthenticated or foreign users", async () => withServer(async ({ call, review, publish }) => {
  const path = `/teacher/exams/${examId}/leaderboard/publish`;
  assert.equal((await call(path, null, {})).status, 401);
  assert.equal((await call(path, aId, {})).status, 403);
  assert.equal((await call(path, otherTeacherId, {})).status, 404);
  assert.equal((await call("/students/me/results", teacherId)).status, 403);
  assert.equal((await call("/students/me/results", null)).status, 401);
  exam.status = "LIVE"; assert.equal((await publish("invalid")).status, 409);
  exam.status = "ENDED"; exam.questions[0].correctAnswer = "";
  assert.equal((await publish((await review()).body.digest)).body.code, "RESULTS_NOT_READY"); assert.equal(writes, 0);
}));
