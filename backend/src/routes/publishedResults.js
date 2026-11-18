import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ExamResultPublication } from "../models/ExamResultPublication.js";
import { ownPublishedResult } from "../services/resultsPublication.js";

export const publishedResultsRouter = express.Router();
publishedResultsRouter.get("/me/results", requireAuth, requireRole("STUDENT"), async (req, res, next) => {
  try {
    const userId = String(req.user.sub);
    const publications = await ExamResultPublication.find({ "results.userId": userId })
      .select({ title: 1, publishedAt: 1, revision: 1, results: { $elemMatch: { userId } } })
      .sort({ publishedAt: -1 }).limit(100).lean();
    res.set("Cache-Control", "no-store").json({ results: publications.map(item => ownPublishedResult(item, userId)).filter(Boolean) });
  } catch (error) { next(error); }
});
