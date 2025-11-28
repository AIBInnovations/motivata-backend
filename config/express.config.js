import express from "express";
import cors from "cors";

// route imports
import adminRoutes from "../routes/admin.routes.js";
import appRoutes from "../routes/app.routes.js";

const app = express();

// CORS configuration
const corsOptions = {
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
          // "https://mediumpurple-dotterel-484503.hostingersite.com",
          // "https://mediumpurple-dotterel-484503.hostingersite.com/",
          "https://motivata.in",
          "https://motivata.in/",
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

export default app;
