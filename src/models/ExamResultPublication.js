import mongoose from "mongoose";

const resultSchema = new mongoose.Schema({
  userId: { type: String, default: "" }, studentId: { type: String, required: true },
  marks: Number, maxMarks: Number, percentage: { type: Number, default: null },
  correct: Number, incorrect: Number, unanswered: Number, submittedAt: Number,
}, { _id: false });
const schema = new mongoose.Schema({
  // Exam ID is the document ID: MongoDB's built-in unique _id index makes the
  // whole publication atomic, including concurrent first-publish requests.
  _id: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
  teacherId: { type: String, required: true }, title: { type: String, required: true },
  publishedAt: { type: Date, required: true }, revision: { type: Number, required: true },
  digest: { type: String, required: true }, results: { type: [resultSchema], default: [] },
}, { timestamps: true });
schema.index({ "results.userId": 1, publishedAt: -1 });
export const ExamResultPublication = mongoose.model("ExamResultPublication", schema);
