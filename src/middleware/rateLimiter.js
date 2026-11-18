import Redis from "ioredis";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { logger } from "../services/logger.js";

const DEFAULT_LIMITS = {
  api: { windowMs: 60 * 1000, max: 120 },
  examEntry: { windowMs: 60 * 1000, max: 120 },
  anonymousApi: { windowMs: 60 * 1000, max: 1200 },
  apiIngress: { windowMs: 60 * 1000, max: 12000 },
  login: { windowMs: 15 * 60 * 1000, max: 8 },
  signup: { windowMs: 60 * 60 * 1000, max: 10 },
  passwordReset: { windowMs: 15 * 60 * 1000, max: 5 },
  accessCode: { windowMs: 10 * 60 * 1000, max: 20 },
  socketAuth: { windowMs: 5 * 60 * 1000, max: 30 },
  socketIngress: { windowMs: 5 * 60 * 1000, max: 6000 },
};

const redisUrl = config.redis.url;
let redisConnected = false;
let redis = null;

if (redisUrl) {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy: () => null,
  });

  redis.connect()
    .then(() => {
      redisConnected = true;
      logger.info("Rate limiter connected to Redis.");
    })
    .catch((err) => {
      redisConnected = false;
      logger.warn("Rate limiter Redis connection failed. Falling back to memory limiter.", {
        errorName: err.name,
        errorCode: err.code,
      });
    });

  redis.on("error", (err) => {
    if (redisConnected) {
      logger.error("Redis connection lost. Switching to memory limiter fallback.", {
        errorName: err.name,
        errorCode: err.code,
      });
      redisConnected = false;
    }
  });

  redis.on("ready", () => {
    if (!redisConnected) {
      logger.info("Redis server reconnected. Restoring Redis rate limiting.");
      redisConnected = true;
    }
  });
} else {
  logger.info("REDIS_URL is not configured. Rate limiter is using memory storage.");
}

const memoryHistory = new Map();

// A classroom shares an IP address. Signed account identities get independent
// budgets; the larger IP budget is only an aggregate abuse safeguard.
export async function rateLimiter(req, res, next) {
  try {
    const subject = authenticatedSubject(req);
    // Code lookup is also the Android waiting-screen refresh. Keep admission
    // available when unrelated background API traffic exhausts its own budget.
    const isExamEntry = subject && req.method === "GET" && /^\/exams\/access\/[^/]+\/?$/i.test(req.path || "");
    const group = subject ? (isExamEntry ? "api-exam-entry" : "api-account") : "api-anonymous";
    const key = subject ? hash(subject) : ipOnlyKey(req);
    const policy = subject ? (isExamEntry ? DEFAULT_LIMITS.examEntry : DEFAULT_LIMITS.api) : DEFAULT_LIMITS.anonymousApi;
    const result = await consumeRateLimit(`${group}:${key}`, policy);
    if (!result.allowed) return rejectRateLimit(res, result, group);
    const ingress = await consumeRateLimit(`api-ingress:${ipOnlyKey(req)}`, DEFAULT_LIMITS.apiIngress);
    if (!ingress.allowed) return rejectRateLimit(res, ingress, "api-ingress");
    next();
  } catch (error) { next(error); }
}
export const loginRateLimiter = createRateLimiter("login", DEFAULT_LIMITS.login, accountAwareKey);
export const signupRateLimiter = createRateLimiter("signup", DEFAULT_LIMITS.signup, accountAwareKey);
export const passwordResetRateLimiter = createRateLimiter("password-reset", DEFAULT_LIMITS.passwordReset, accountAwareKey);
export const accessCodeRateLimiter = createRateLimiter("access-code", DEFAULT_LIMITS.accessCode, accessCodeAwareKey);
// Snapshot traffic is budgeted separately from login and ordinary API traffic.
export const monitoringIngressLimiter = createRateLimiter("monitoring-ingress", { windowMs: 60_000, max: 12_000 });
export const monitoringUserLimiter = createRateLimiter("monitoring-user", { windowMs: 60_000, max: 120 }, (req) => monitoringUserKey(req.user));

function monitoringUserKey(user) {
  if (user?.role !== "STUDENT") throw Object.assign(new Error("Student authentication required."), { status: 403 });
  return createHash("sha256").update(String(user.sub || user.identifier)).digest("hex");
}

export async function consumeStudentMonitoringRateLimit(user) {
  return consumeRateLimit(`monitoring-user:${monitoringUserKey(user)}`, { windowMs: 60_000, max: 120 });
}

export function createRateLimiter(group, policy, keyBuilder = ipOnlyKey) {
  return async function groupedRateLimiter(req, res, next) {
    try {
      const key = `${group}:${keyBuilder(req)}`;
      const result = await consumeRateLimit(key, policy);
      if (!result.allowed) return rejectRateLimit(res, result, group);
      next();
    } catch (error) { next(error); }
  };
}

function rejectRateLimit(res, result, group) {
  res.setHeader("Retry-After", String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))));
  return res.status(429).json({
    code: "RATE_LIMITED", message: "Too many requests. Please try again later.",
    retryAfterMs: result.retryAfterMs, rateLimitGroup: group,
  });
}

export async function consumeSocketAuthRateLimit(ip = "unknown", token) {
  const subject = authenticatedSubject({ headers: { authorization: typeof token === "string" ? `Bearer ${token}` : "" } });
  const key = subject ? `socket-account:${hash(subject)}` : `socket-auth:${normalizeKeyPart(ip)}`;
  const account = await consumeRateLimit(key, DEFAULT_LIMITS.socketAuth);
  if (!account.allowed) return account;
  return consumeRateLimit(`socket-ingress:${normalizeKeyPart(ip)}`, DEFAULT_LIMITS.socketIngress);
}

export function clearRateLimiterStateForTests() {
  memoryHistory.clear();
}

async function consumeRateLimit(key, policy) {
  const now = Date.now();

  if (redisConnected) {
    try {
      const redisKey = `ratelimit:${key}`;
      const clearBefore = now - policy.windowMs;

      const multi = redis.multi();
      multi.zremrangebyscore(redisKey, 0, clearBefore);
      multi.zadd(redisKey, now, `${now}-${Math.random()}`);
      multi.zcard(redisKey);
      multi.pexpire(redisKey, policy.windowMs);

      const results = await multi.exec();
      const requestCount = results[2][1];
      if (requestCount > policy.max) {
        return { allowed: false, retryAfterMs: policy.windowMs };
      }
      return { allowed: true, retryAfterMs: 0 };
    } catch (err) {
      logger.error(`Redis rate limiting operation failed: ${err.message}. Invoking memory fallback.`);
    }
  }

  const timestamps = memoryHistory.get(key) || [];
  const validTimestamps = timestamps.filter((time) => now - time < policy.windowMs);
  if (validTimestamps.length >= policy.max) {
    const retryAfterMs = policy.windowMs - (now - validTimestamps[0]);
    memoryHistory.set(key, validTimestamps);
    return { allowed: false, retryAfterMs };
  }

  memoryHistory.set(key, [...validTimestamps, now]);
  return { allowed: true, retryAfterMs: 0 };
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  const longestWindowMs = Math.max(...Object.values(DEFAULT_LIMITS).map((policy) => policy.windowMs));
  for (const [key, timestamps] of memoryHistory.entries()) {
    const valid = timestamps.filter((time) => now - time < longestWindowMs);
    if (valid.length === 0) {
      memoryHistory.delete(key);
    } else {
      memoryHistory.set(key, valid);
    }
  }
}, 10 * 60 * 1000);
cleanupTimer.unref?.();

function accountAwareKey(req) {
  const identifier = normalizeIdentifier(req.body?.identifier || req.body?.email || req.params?.userId || "");
  // Keep login/reset limits bound to the target account, including managed
  // password resets performed by an administrator for different students.
  if (identifier) return `${ipOnlyKey(req)}:${identifier}`;
  const subject = authenticatedSubject(req);
  if (subject) return `account:${hash(subject)}`;
  // Firebase exchange has no identifier field. A credential fingerprint prevents
  // different students sharing the "no-account" bucket; it never authorizes them.
  if (!identifier && typeof req.body?.idToken === "string" && req.body.idToken.length <= 16384) {
    return `${ipOnlyKey(req)}:credential:${hash(req.body.idToken)}`;
  }
  return `${ipOnlyKey(req)}:${identifier || "no-account"}`;
}

function accessCodeAwareKey(req) {
  const subject = authenticatedSubject(req);
  if (!subject) throw Object.assign(new Error("Student authentication required."), { status: 401, code: "AUTH_INVALID" });
  // Count attempts across codes for one authenticated account. Rotating codes or
  // network addresses cannot evade the guessing limit or consume classmates' budgets.
  return `account:${hash(subject)}`;
}

export function sessionRateLimitKey(req) {
  const token = typeof req.body?.refreshToken === "string" ? req.body.refreshToken.slice(0, 128) : "";
  if (token) return `${ipOnlyKey(req)}:device:${hash(token)}`;
  const subject = authenticatedSubject(req);
  if (subject) return `account:${hash(subject)}`;
  return `${ipOnlyKey(req)}:device:${hash(token)}`;
}

const subjectCache = Symbol("verifiedRateLimitSubject");
function authenticatedSubject(req) {
  if (Object.prototype.hasOwnProperty.call(req, subjectCache)) return req[subjectCache];
  let subject = null;
  const authorization = req.headers?.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    try {
      const claims = jwt.verify(authorization.slice(7), config.jwt.secret());
      if (typeof claims.sub === "string" && claims.sub.length > 0 && claims.sub.length <= 256) subject = claims.sub;
    } catch { /* Invalid/expired credentials retain the anonymous budget; route auth still rejects them. */ }
  }
  req[subjectCache] = subject;
  return subject;
}

const hash = (value) => createHash("sha256").update(value).digest("hex");

function ipOnlyKey(req) {
  // Express resolves req.ip according to its explicitly configured trust proxy policy.
  return normalizeKeyPart(req.ip || req.socket?.remoteAddress || "unknown");
}

function normalizeIdentifier(value) {
  const text = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  return text ? normalizeKeyPart(text) : "";
}

function normalizeKeyPart(value) {
  return String(value || "unknown").trim().toLowerCase().replace(/[^a-z0-9_.:@-]/g, "_").slice(0, 160);
}
