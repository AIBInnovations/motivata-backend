/**
 * @fileoverview Rate limiters.
 *
 * The website has no login — visitors just browse and submit forms — so none of
 * these endpoints can be put behind auth. Rate limiting is the only lever we
 * have, and it must never get in a real person's way. Every limit below is set
 * far above what a human does and far below what a script does.
 *
 * Two things make these safe on shared IPs (office wifi, mobile carrier NAT,
 * where many real users look like one IP):
 *   - the auth limiters only count FAILED attempts, so a legitimate login never
 *     consumes budget;
 *   - the form limits are per hour, not per minute.
 *
 * Requires `app.set("trust proxy", 1)` — behind the reverse proxy every request
 * otherwise carries the proxy's IP, which would put the whole internet in one
 * bucket and lock everyone out at once.
 *
 * @module middleware/rateLimit
 */

import rateLimit from "express-rate-limit";
import responseUtil from "../utils/response.util.js";

/**
 * Shared 429 response. Matches the { status, message, error, data } envelope the
 * clients already parse, so a rate-limited call surfaces as a normal API error
 * instead of an unparseable body.
 */
const tooManyRequests = (message) => (req, res) => {
  console.warn(`[RATE-LIMIT] ${req.method} ${req.originalUrl} from ${req.ip}`);
  return responseUtil.custom(res, 429, message, null, "Rate limit exceeded");
};

const baseOptions = {
  standardHeaders: "draft-7", // RateLimit-* response headers
  legacyHeaders: false,
};

/**
 * Login. Counts only failures, so an admin who logs in normally is never
 * limited no matter how many colleagues share the office IP.
 * 10 failed attempts / 15 min kills password guessing while leaving room for
 * someone who genuinely mistypes.
 */
export const loginLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: tooManyRequests(
    "Too many failed login attempts. Please try again in 15 minutes."
  ),
});

/**
 * Public form submissions — membership, Doer, Motivata Blend, Round Table,
 * feature requests. A real person submits once, maybe twice if they made a
 * typo. 20/hour is unreachable by hand and useless to a spammer.
 */
export const publicFormLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  handler: tooManyRequests(
    "Too many submissions from this network. Please try again later."
  ),
});

/**
 * Coupon and voucher checks. These are the enumeration targets — a script can
 * otherwise walk the whole coupon space. A real user tries a handful of codes.
 */
export const codeCheckLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  limit: 40,
  handler: tooManyRequests(
    "Too many code checks. Please try again later."
  ),
});

/**
 * Everything else. Deliberately loose: this is a flood guard, not a usage
 * policy. Browsing a page fires a handful of calls, so 600 per 15 minutes is
 * unreachable for a person — even a whole office behind one IP — but stops a
 * machine hammering the API.
 *
 * Razorpay's webhook is skipped: it is a server-to-server callback that retries,
 * and dropping one means a paid customer silently never gets their membership.
 */
export const generalLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 600,
  skip: (req) => req.originalUrl.startsWith("/api/web/razorpay/webhook"),
  handler: tooManyRequests(
    "Too many requests. Please slow down and try again shortly."
  ),
});

export default {
  loginLimiter,
  publicFormLimiter,
  codeCheckLimiter,
  generalLimiter,
};
