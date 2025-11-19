import dotenv from "dotenv";
dotenv.config();

import { v2 as cloudinary } from "cloudinary";

// Environment variables
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Validate required environment variables
const validateConfig = () => {
  const missingVars = [];

  if (!CLOUDINARY_CLOUD_NAME) missingVars.push("CLOUDINARY_CLOUD_NAME");
  if (!CLOUDINARY_API_KEY) missingVars.push("CLOUDINARY_API_KEY");
  if (!CLOUDINARY_API_SECRET) missingVars.push("CLOUDINARY_API_SECRET");

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Cloudinary environment variables: ${missingVars.join(
        ", "
      )}`
    );
  }
};

try {
  // Validate configuration
  validateConfig();

  // Configure Cloudinary
  cloudinary.config({
    secure: true,
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  console.log("> Cloudinary configured successfully");
  console.log(`> Cloud Name: ${CLOUDINARY_CLOUD_NAME}`);
} catch (error) {
  console.error("> Cloudinary configuration failed:", error.message);
  console.warn("> Server will continue but Cloudinary features will not work");
}

// Export cloudinary for use in other modules
export default cloudinary;
