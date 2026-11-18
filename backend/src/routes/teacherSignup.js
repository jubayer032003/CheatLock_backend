import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { signupRateLimiter } from "../middleware/rateLimiter.js";
import { User } from "../models/User.js";

export const teacherSignupRouter = express.Router();

teacherSignupRouter.post("/teacher-signup", signupRateLimiter, async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const invalid = (message, code = "INVALID_SIGNUP") => Object.assign(new Error(message), { status: 400, code });
    if (name.length < 2 || name.length > 100) throw invalid("Enter a name between 2 and 100 characters.");
    if (identifier.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) throw invalid("Enter a valid email address.");
    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      throw invalid("Use at least 8 characters and no more than 72 UTF-8 bytes for your password.", "WEAK_PASSWORD");
    }
    // Public registration can create only an independent teacher account.
    // Existing administrator provisioning controls institution membership.
    if ((body.role && body.role !== "TEACHER") || body.tenantId || body.status || body.permissions) {
      throw Object.assign(new Error("Teacher signup cannot assign administrator access or institution membership."),
        { status: 403, code: "INVALID_SIGNUP_ROLE" });
    }
    if (await User.findOne({ identifier, role: "TEACHER" })) {
      throw Object.assign(new Error("A teacher account with this email already exists. Sign in instead."),
        { status: 409, code: "ACCOUNT_EXISTS" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, identifier, passwordHash, role: "TEACHER", status: "ACTIVE", tokenVersion: 0 });
    const token = jwt.sign({ sub: user._id.toString(), identifier: user.identifier, role: "TEACHER", tokenVersion: 0 },
      config.jwt.secret(), { expiresIn: config.jwt.expiresIn });
    res.set("Cache-Control", "no-store").status(201).json({ token, user: {
      id: user._id.toString(), name: user.name, identifier: user.identifier, role: "TEACHER", mustChangePassword: false,
    } });
  } catch (error) {
    if (error.code === 11000) {
      return next(Object.assign(new Error("A teacher account with this email already exists. Sign in instead."),
        { status: 409, code: "ACCOUNT_EXISTS" }));
    }
    next(error);
  }
});
