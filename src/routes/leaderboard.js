import express from "express";
import mongoose from "mongoose";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Exam } from "../models/Exam.js";
import { ExamSession } from "../models/ExamSession.js";
import { Submission } from "../models/Submission.js";
import { User } from "../models/User.js";
import { getEffectiveExamStatus } from "./exams.js";
import { rankMcqSubmissions } from "../services/mcqScoring.js";

export const leaderboardRouter = express.Router();
leaderboardRouter.get("/exams/:examId/leaderboard", requireAuth, requireRole("TEACHER"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.examId)) throw Object.assign(new Error("Invalid exam ID."), { status: 400 });
    const exam = await Exam.findOne({ _id: req.params.examId, createdBy: req.user.identifier }).lean();
    if (!exam) throw Object.assign(new Error("Exam not found or not owned by this teacher."), { status: 404 });
    const status = getEffectiveExamStatus(exam);
    if (!["ENDED", "ARCHIVED"].includes(status)) throw Object.assign(new Error("The leaderboard is available after this exam ends."), { status: 409, code: "EXAM_NOT_FINISHED" });
    const [sessions, submissions] = await Promise.all([
      ExamSession.find({ examId: exam._id }).select("studentId studentName status startedAt submittedAt").lean(),
      Submission.find({ examId: exam._id }).select("studentId answers submittedAt").lean(),
    ]);
    const identifiers = [...new Set(sessions.map(session => session.studentId))];
    const users = identifiers.length ? await User.find({ identifier: { $in: identifiers }, role: "STUDENT" }).select("identifier name").lean() : [];
    const result = rankMcqSubmissions(exam, submissions, sessions, new Map(users.map(user => [user.identifier, user.name])));
    res.set("Cache-Control", "no-store").json({ exam: { id: String(exam._id), title: exam.title, status, accessCode: exam.accessCode },
      generatedAt: new Date().toISOString(), ...result });
  } catch (error) { next(error); }
});
