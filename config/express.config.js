/**
 * @fileoverview Express application configuration and middleware setup.
 * @module config/express
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// route imports
import adminRoutes from "../routes/admin.routes.js";
import appRoutes from "../routes/app.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {express.Application} */
const app = express();

// Set up EJS as view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

/**
 * CORS configuration options.
 * @type {cors.CorsOptions}
 * @property {Function} origin - Dynamic origin validation function
 * @property {boolean} credentials - Allow credentials in requests
 * @property {number} optionsSuccessStatus - Success status for preflight requests
 */
const corsOptions = {
  /**
   * Validates request origin against allowed origins.
   * @param {string|undefined} origin - The request origin
   * @param {Function} callback - Callback to accept/reject the origin
   */
  origin: (origin, callback) => {
    // In development, allow all origins
    if (process.env.NODE_ENV !== "production") {
      callback(null, true);
      return;
    }

    // In production, check against allowed origins from .env
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
      : [
          "https://mediumpurple-dotterel-484503.hostingersite.com",
          "https://mediumpurple-dotterel-484503.hostingersite.com/",
          "https://motivata.in",
          "https://motivata.in/",
          "https://lightslategrey-baboon-874891.hostingersite.com/",
          "https://lightslategrey-baboon-874891.hostingersite.com",
          "http://localhost:3000",
          "http://localhost:3000/",
          "http://localhost:5173",
          "http://localhost:5173/",
          "https://motivata.synquic.com/",
          "https://motivata.synquic.com",
        ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`[CORS] Blocked request from origin: ${origin}`);
      console.error(`[CORS] Allowed origins: ${allowedOrigins.join(", ")}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Request logging middleware
app.use((req, _res, next) => {
  console.log(
    `[REQ] ${new Date().toISOString()} | ${req.method} ${
      req.originalUrl
    } | Origin: ${req.headers.origin || "N/A"} | IP: ${
      req.ip || req.socket?.remoteAddress
    }`
  );
  next();
});

// Middleware
app.use(cors(corsOptions));

// Webhook endpoint needs raw body for signature verification
// Must come BEFORE express.json()
app.use("/api/web/razorpay/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// global routes
app.use("/api/web", adminRoutes); // only admin uses
app.use("/api/app", appRoutes); // non admin uses


// Basic route
app.get("/", (_req, res) => {
  res.json({ message: "Welcome to Motivata API" });
});

// Health check route
app.get("/health", (_req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Android App Links — Digital Asset Links verification file
// Required for deep links to open the Motivata app directly
app.get("/.well-known/assetlinks.json", (_req, res) => {
  res.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.synquic.motivata",
        sha256_cert_fingerprints: [
          "C2:C0:48:F4:2C:3E:E6:7F:EF:74:DC:26:25:C7:87:FF:F9:C7:51:9E:B7:B2:5E:F0:37:78:F5:0A:59:20:AC:56",
          "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C"
        ],
      },
    },
  ]);
});

// Deep link redirect — opens the app via motivata:// scheme, falls back to Play Store
// Uses /open/ prefix to avoid conflicts with the admin panel on the same domain
app.get("/open/events/:eventId", (req, res) => {
  const { eventId } = req.params;
  const deepLink = `motivata://event/${eventId}`;
  const playStoreLink = "https://play.google.com/store/apps/details?id=com.synquic.motivata";
  res.send(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Opening Motivata...</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>
  window.location.replace("${deepLink}");
  setTimeout(function(){ window.location.replace("${playStoreLink}"); }, 1500);
</script>
</head><body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding-top:80px">
<h2>Opening Motivata...</h2>
<p>If the app doesn't open, <a href="${playStoreLink}" style="color:#fedd44">get it on Google Play</a></p>
</body></html>`);
});

// Deep link redirect for posts
app.get("/open/post/:postId", (req, res) => {
  const { postId } = req.params;
  const deepLink = `motivata://post/${postId}`;
  const playStoreLink = "https://play.google.com/store/apps/details?id=com.synquic.motivata";
  res.send(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Opening Motivata...</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>
  window.location.replace("${deepLink}");
  setTimeout(function(){ window.location.replace("${playStoreLink}"); }, 1500);
</script>
</head><body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding-top:80px">
<h2>Opening Motivata...</h2>
<p>If the app doesn't open, <a href="${playStoreLink}" style="color:#fedd44">get it on Google Play</a></p>
</body></html>`);
});

// Deep link redirect for challenges — opens the Motivata app on the challenge detail,
// falls back to Play Store / App Store if the app is not installed.
// Mounted under /api/ because the reverse proxy at motivata.synquic.com only forwards
// /api/* to this Node backend; everything else goes to the admin panel.
const challengeDeepLinkHandler = (req, res) => {
  const { challengeId } = req.params;
  const playStoreLink = "https://play.google.com/store/apps/details?id=com.synquic.motivata";
  const appStoreLink = process.env.APP_STORE_URL || playStoreLink;
  // JSON-encoded so the value is safe to drop into inline JS regardless of contents.
  const safeChallengeId = JSON.stringify(String(challengeId));
  const safePlayStore = JSON.stringify(playStoreLink);
  const safeAppStore = JSON.stringify(appStoreLink);
  res.send(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Opening Motivata...</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>
(function () {
  var ua = navigator.userAgent || "";
  var isAndroid = /Android/i.test(ua);
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var challengeId = ${safeChallengeId};
  var playStore = ${safePlayStore};
  var appStore = ${safeAppStore};

  if (isAndroid) {
    // intent:// = Android's native way to open a specific app. If the Motivata
    // app is installed, it opens directly on the challenge screen. If not,
    // browser_fallback_url sends the user to the Play Store automatically —
    // no timeout race needed.
    var intentUrl =
      "intent://challenge/" + encodeURIComponent(challengeId) +
      "#Intent;scheme=motivata;package=com.synquic.motivata;" +
      "S.browser_fallback_url=" + encodeURIComponent(playStore) + ";end";
    window.location.replace(intentUrl);
    return;
  }

  if (isIOS) {
    // iOS doesn't support intent://. Try the custom scheme; if the app isn't
    // installed the page stays visible, so after 1.5s send them to the App Store.
    var clickedAt = Date.now();
    window.location.replace("motivata://challenge/" + encodeURIComponent(challengeId));
    setTimeout(function () {
      if (Date.now() - clickedAt < 2000) {
        window.location.replace(appStore);
      }
    }, 1500);
    return;
  }

  // Desktop / other: no app to open — send them to install it.
  window.location.replace(playStore);
})();
</script>
</head><body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding-top:80px">
<h2>Opening Motivata...</h2>
<p>If the app doesn't open, <a href="${playStoreLink}" style="color:#fedd44">get it on Google Play</a></p>
</body></html>`);
};
app.get("/api/open/challenge/:challengeId", challengeDeepLinkHandler);
app.get("/open/challenge/:challengeId", challengeDeepLinkHandler);

// 404 handler — catches requests to undefined routes
app.use((_req, res) => {
  res.status(404).json({
    status: 404,
    message: "Route not found",
    error: "The requested endpoint does not exist",
    data: null,
  });
});

// Global error handler — must have 4 params (err, req, res, next)
// Catches errors thrown by body-parser (malformed JSON), multer, and any unhandled next(err) calls
// Without this, Express sends HTML error pages which the mobile app cannot parse as JSON
app.use((err, _req, res, _next) => {
  console.error("[GLOBAL ERROR]", err.message);

  // Body-parser / JSON parse errors
  if (err.type === "entity.parse.failed" || err.status === 400) {
    return res.status(400).json({
      status: 400,
      message: "Invalid JSON in request body",
      error: err.message,
      data: null,
    });
  }

  // Multer file upload errors
  if (err.code && err.code.startsWith("LIMIT_")) {
    return res.status(400).json({
      status: 400,
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "File size too large. Maximum size is 50MB."
          : "File upload error",
      error: err.message,
      data: null,
    });
  }

  // Generic fallback
  return res.status(err.status || 500).json({
    status: err.status || 500,
    message: err.message || "Internal server error",
    error: err.message || "An unexpected error occurred",
    data: null,
  });
});

export default app;
