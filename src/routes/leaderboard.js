import express from "express";
import mongoose from "mongoose";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Exam } from "../models/Exam.js";
import { ExamSession } from "../models/ExamSession.js";
import { Submission } from "../models/Submission.js";
import { User } from "../models/User.js";
import { getEffectiveExamStatus } from "./exams.js";
import { rankMcqSubmissions } from "../services/mcqScoring.js";
import { ExamResultPublication } from "../models/ExamResultPublication.js";
import { leaderboardDigest, publicationStatus, publishLeaderboard } from "../services/resultsPublication.js";

export const leaderboardRouter = express.Router();
async function loadLeaderboard(req) {
    if (!mongoose.isValidObjectId(req.params.examId)) throw Object.assign(new Error("Invalid exam ID."), { status: 400 });
    const exam = await Exam.findOne({ _id: req.params.examId, createdBy: req.user.identifier }).lean();
    if (!exam) throw Object.assign(new Error("Exam not found or not owned by this teacher."), { status: 404 });
    const status = getEffectiveExamStatus(exam);
    if (!["ENDED", "ARCHIVED"].includes(status)) throw Object.assign(new Error("The leaderboard is available after this exam ends."), { status: 409, code: "EXAM_NOT_FINISHED" });
    const [sessions, submissions] = await Promise.all([
      ExamSession.find({ examId: exam._id }).select("studentId studentName status startedAt submittedAt").lean(),
      Submission.find({ examId: exam._id }).select("studentId answers submittedAt").lean(),
    ]);
    const identifiers = [...new Set(sessions.map(session => String(session.studentId || "").trim().toLowerCase()).filter(Boolean))];
    const users = identifiers.length ? await User.find({ identifier: { $in: identifiers }, role: "STUDENT" }).select("_id identifier name").lean() : [];
    const result = rankMcqSubmissions(exam, submissions, sessions, new Map(users.map(user => [user.identifier, user.name])));
    const report = { exam: { id: String(exam._id), title: exam.title, status, accessCode: exam.accessCode },
      generatedAt: new Date().toISOString(), ...result };
    const userIds = new Map(users.map(user => [user.identifier, String(user._id || "")]));
    report.digest = leaderboardDigest(report, userIds);
    const current = await ExamResultPublication.findById(exam._id).lean();
    report.publication = { ...publicationStatus(current, report.digest), unlinkedStudents: result.students.filter(row => !userIds.get(row.studentId)).length };
    return { report, userIds, current };
}

leaderboardRouter.get("/exams/:examId/leaderboard", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try { res.set("Cache-Control", "no-store").json((await loadLeaderboard(req)).report); }
  catch (error) { next(error); }
});

leaderboardRouter.post("/exams/:examId/leaderboard/publish", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    const { report, userIds, current } = await loadLeaderboard(req);
    if (typeof req.body?.expectedDigest !== "string" || req.body.expectedDigest !== report.digest) {
      throw Object.assign(new Error("Results changed. Refresh and review the leaderboard before publishing."), { status: 409, code: "LEADERBOARD_CHANGED" });
    }
    if (!report.students.length || !report.summary.scoredQuestions || report.summary.maxMarks <= 0 || report.summary.missingKeyQuestions.length) {
      throw Object.assign(new Error("Publishing requires submitted students and valid MCQ answer keys with marks."), { status: 409, code: "RESULTS_NOT_READY" });
    }
    if (report.publication.unlinkedStudents) throw Object.assign(new Error("Some submissions are not linked to a current student account. Resolve them before publishing."), { status: 409, code: "UNLINKED_STUDENT_RESULTS" });
    const publication = await publishLeaderboard(report, userIds, current, req.user.identifier);
    res.set("Cache-Control", "no-store").json({ publication: { ...publication, unlinkedStudents: 0 } });
  } catch (error) { next(error); }
});
