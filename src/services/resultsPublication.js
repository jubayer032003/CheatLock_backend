import { createHash } from "node:crypto";
import { ExamResultPublication } from "../models/ExamResultPublication.js";

export function leaderboardDigest(report, userIds) {
  return createHash("sha256").update(JSON.stringify({ exam: report.exam, summary: report.summary,
    students: report.students.map(row => ({ ...row, userId: userIds.get(row.studentId) || "" })) })).digest("hex");
}
export function publicationStatus(publication, digest) {
  return { publishedAt: publication?.publishedAt || null, revision: publication?.revision || 0,
    hasUnpublishedChanges: Boolean(publication && publication.digest !== digest) };
}
const changed = () => Object.assign(new Error("Results changed. Refresh the leaderboard and review it before publishing."),
  { status: 409, code: "LEADERBOARD_CHANGED" });
export async function publishLeaderboard(report, userIds, current, teacherId) {
  if (current?.digest === report.digest) return publicationStatus(current, report.digest);
  const snapshot = { teacherId, title: report.exam.title, publishedAt: new Date(), revision: (current?.revision || 0) + 1,
    digest: report.digest, results: report.students.map(row => ({
      userId: userIds.get(row.studentId) || "", studentId: row.studentId, marks: row.marks, maxMarks: row.maxMarks,
      percentage: row.percentage, correct: row.correct, incorrect: row.incorrect, unanswered: row.unanswered, submittedAt: row.submittedAt,
    })) };
  let saved;
  if (current) {
    saved = await ExamResultPublication.findOneAndUpdate({ _id: report.exam.id, revision: current.revision }, { $set: snapshot }, { new: true }).lean();
  } else {
    try { saved = await ExamResultPublication.create({ _id: report.exam.id, ...snapshot }); }
    catch (error) { if (error.code !== 11000) throw error; }
  }
  if (!saved) {
    saved = await ExamResultPublication.findById(report.exam.id).lean();
    if (!saved || saved.digest !== report.digest) throw changed();
  }
  return publicationStatus(saved, report.digest);
}

export function ownPublishedResult(publication, userId) {
  const row = publication.results?.find(result => result.userId === String(userId));
  if (!row) return null;
  // Never serialize the publication document or classmates' results.
  return { examId: String(publication._id), examTitle: publication.title, publishedAt: publication.publishedAt,
    revision: publication.revision, studentId: row.studentId, marks: row.marks, maxMarks: row.maxMarks,
    percentage: row.percentage, correct: row.correct, incorrect: row.incorrect, unanswered: row.unanswered,
    submittedAt: row.submittedAt };
}
