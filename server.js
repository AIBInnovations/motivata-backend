import dotenv from "dotenv";

dotenv.config();

// app imports
import app from "./config/express.config.js";
import connectDB from "./config/database.config.js";
import { runCashTicketAudit } from "./scripts/cashTicketAudit.js";

const PORT = process.env.PORT || 3000;

// Environment validation
const validateEnvironment = () => {
  const requiredEnvVars = [
    'MONGODB_URL',
    'JWT_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.error('> Missing required environment variables:');
    missing.forEach(varName => console.error(`  - ${varName}`));
    throw new Error('Missing required environment variables');
  }

  console.log('> Environment variables validated');
};

// Connect to database and start server
const startServer = async () => {
  try {
    // Validate environment before starting
    validateEnvironment();

    await connectDB();

    // Run cash ticket audit on startup (non-blocking)
    runCashTicketAudit().catch((err) => {
      console.error("> Cash ticket audit failed:", err.message);
    });

    app.listen(PORT, () => {
      console.log(`> Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("> Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
