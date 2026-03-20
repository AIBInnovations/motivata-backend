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
