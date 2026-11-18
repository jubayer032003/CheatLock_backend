import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { rankMcqSubmissions, scoreMcqSubmission, mcqQuestionSet } from "../backend/src/services/mcqScoring.js";
import { leaderboardRouter } from "../backend/src/routes/leaderboard.js";
import { User } from "../backend/src/models/User.js";
import { Exam } from "../backend/src/models/Exam.js";
import { ExamSession } from "../backend/src/models/ExamSession.js";
import { Submission } from "../backend/src/models/Submission.js";

process.env.JWT_SECRET = "leaderboard-isolated-test-secret";
const question = (extra = {}) => ({ type: "MCQ", text: "Capital?", options: ["Paris", "Rome"], correctAnswer: "0", marks: 2, ...extra });
const answer = (questionIndex, answerText, extra = {}) => ({ questionIndex, answerText, ...extra });
test("Android option text, legacy indexes and numeric option text are scored correctly", () => {
  assert.equal(scoreMcqSubmission([question()], [answer(0, "Paris")]).correct, 1);
  assert.equal(scoreMcqSubmission([question()], [answer(0, "0")]).correct, 1);
  const numeric = question({ options: ["1", "2"], correctAnswer: "1" });
  assert.equal(scoreMcqSubmission([numeric], [answer(0, "1")]).incorrect, 1);
  assert.equal(scoreMcqSubmission([numeric], [answer(0, "2")]).correct, 1);
  assert.equal(scoreMcqSubmission([question({ correctAnswer: "Rome" })], [answer(0, "Rome")]).marks, 2);
});
test("weighted scoring applies negatives only to incorrect MCQs and keeps written grading separate", () => {
  const questions = [question({ marks: 3 }), question({ text: "Second", negativeMarking: 0.5 }), question({ text: "Third" }), { type: "CQ", text: "Explain", marks: 10 }];
  const score = scoreMcqSubmission(questions, [answer(0, "Paris"), answer(1, "Rome", { isCorrect: true }), answer(3, "anything")]);
  assert.deepEqual(score, { correct: 1, incorrect: 1, unanswered: 1, marks: 2.5, maxMarks: 7, percentage: 35.7143 });
  const negative = scoreMcqSubmission([question({ negativeMarking: 1 })], [answer(0, "Rome")]);
  assert.equal(negative.marks, -1);
});
test("missing, invalid or ambiguous keys are excluded instead of penalizing students", () => {
  const definition = mcqQuestionSet([question({ correctAnswer: "" }), question({ correctAnswer: "99" }), question({ options: ["same", "same"] }), question()]);
  assert.deepEqual(definition.missingKeyQuestions, [1, 2, 3]);
  assert.equal(definition.maxMarks, 2); assert.equal(definition.scorable.length, 1);
});
test("question indexes preserve shuffled answers and ambiguous legacy prompts do not guess", () => {
  const questions = [question(), question({ text: "Second", correctAnswer: "1" })];
  assert.equal(scoreMcqSubmission(questions, [answer(1, "Rome"), answer(0, "Paris")]).correct, 2);
  assert.equal(scoreMcqSubmission(questions, [{ questionText: "Second", answerText: "Rome" }]).correct, 1);
  assert.equal(scoreMcqSubmission([question(), question()], [{ questionText: "Capital?", answerText: "Paris" }]).unanswered, 2);
  assert.equal(scoreMcqSubmission([question()], [answer(0, "Paris"), answer(0, "Rome")]).unanswered, 1);
});
test("ranking uses finalized current submissions only, deduplicates latest records and shares ranks", () => {
  const exam = { questions: [question()], assignedStudents: ["a", "b", "c", "d", "e"] };
  const sessions = ["a", "b", "c", "d", "e"].map(studentId => ({ studentId, status: studentId === "d" ? "IN_PROGRESS" : "SUBMITTED", startedAt: 100 }));
  const record = (studentId, value, submittedAt = 200) => ({ studentId, submittedAt, answers: [answer(0, value)], grade: 100 });
  const result = rankMcqSubmissions(exam, [record("a", "Rome", 150), record("a", "Paris"), record("b", "Paris"), record("c", "Rome"), record("d", "Paris"), record("e", "Paris", 50)], sessions, new Map([["a", "Student A"]]));
  assert.deepEqual(result.students.map(row => [row.studentId, row.rank, row.marks]), [["a", 1, 2], ["b", 1, 2], ["c", 3, 0]]);
  assert.equal(result.students[0].studentName, "Student A");
  assert.equal(result.summary.notSubmitted, 2); assert.equal(result.summary.submitted, 3);
  assert.equal(result.students[2].marks, 0, "manual grade must not override auto-scored MCQ marks");
});
test("exams without valid MCQ keys do not invent a rank or percentage", () => {
  const result = rankMcqSubmissions({ questions: [question({ correctAnswer: "" })] }, [{ studentId: "a", submittedAt: 2, answers: [] }], [{ studentId: "a", status: "SUBMITTED" }]);
  assert.equal(result.students[0].rank, null); assert.equal(result.students[0].percentage, null);
});

const examId = "65a000000000000000000001", teacherId = "65b000000000000000000001";
const query = value => ({ select() { return this; }, lean: async () => value, then: (yes, no) => Promise.resolve(value).then(yes, no) });
let exam, queries;
User.findById = id => query(id === teacherId ? { _id: teacherId, identifier: "teacher@test", role: "TEACHER", status: "ACTIVE", tokenVersion: 0 }
  : { _id: id, identifier: "student@test", role: "STUDENT", status: "ACTIVE", tokenVersion: 0 });
Exam.findOne = filter => { queries.push(filter); return query(filter.createdBy === "teacher@test" && filter._id === examId ? exam : null); };
ExamSession.find = filter => { assert.equal(String(filter.examId), examId); return query([{ studentId: "student@test", status: "SUBMITTED", startedAt: 1 }]); };
Submission.find = filter => { assert.deepEqual(filter, { examId }); return query([{ studentId: "student@test", submittedAt: 2, answers: [answer(0, "Paris")] }]); };
User.find = () => query([{ identifier: "student@test", name: "Student Test" }]);
beforeEach(() => { queries = []; exam = { _id: examId, title: "Finished exam", status: "ENDED", questions: [question()], assignedStudents: ["student@test"] }; });
async function withServer(run) {
  const app = express(); app.use("/teacher", leaderboardRouter);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message, code: error.code }));
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  const token = (sub = teacherId) => jwt.sign({ sub }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const get = (id = examId, bearer = token()) => fetch(`http://127.0.0.1:${server.address().port}/teacher/exams/${id}/leaderboard`, { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
  try { await run(get, token); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test("leaderboard HTTP endpoint enforces authentication, teacher ownership and completed status", async () => withServer(async (get, token) => {
  assert.equal((await get(examId, "")).status, 401);
  assert.equal((await get(examId, token("65b000000000000000000002"))).status, 403);
  assert.equal((await get("bad-id")).status, 400);
  assert.equal((await get("65a000000000000000000002")).status, 404);
  exam.status = "LIVE"; assert.equal((await get()).status, 409);
  exam.status = "ENDED";
  const response = await get(); assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json(); assert.equal(body.students[0].correct, 1); assert.equal(body.students[0].marks, 2);
  assert.equal(body.students[0].studentName, "Student Test"); assert.equal(body.exam.questions, undefined);
  assert.ok(queries.every(filter => filter.createdBy === "teacher@test"));
  exam.status = "ARCHIVED"; assert.equal((await get()).status, 200);
}));
test("scheduled end time makes completed exam rankings available without a manual end click", async () => withServer(async get => {
  exam.status = "SCHEDULED"; exam.scheduledEndAt = new Date(Date.now() - 1000);
  assert.equal((await get()).status, 200);
}));
