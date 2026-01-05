/**
 * @fileoverview Calendly configuration schema for storing Personal Access Token and event types
 * @module schema/CalendlyConfig
 */

import mongoose from "mongoose";

/**
 * @typedef {Object} CalendlyConfig
 * @property {boolean} isConnected - Whether Calendly is connected
 * @property {string} accessToken - Encrypted Personal Access Token
 * @property {string} calendlyUserId - Calendly user ID from API
 * @property {string} calendlyOrganizationUri - Organization URI
 * @property {mongoose.Types.ObjectId} connectedBy - Admin who connected
 * @property {Date} connectedAt - Connection timestamp
 * @property {Date} lastSyncedAt - Last event types sync
 * @property {Array} eventTypes - Available event types
 * @property {Object} settings - Configuration settings
 * @property {Date} lastValidatedAt - Last successful API call
 */
const calendlyConfigSchema = new mongoose.Schema(
  {
    /**
     * Connection mode: 'pat' (Personal Access Token) or 'public' (Public URLs only)
     */
    connectionMode: {
      type: String,
      enum: ["pat", "public"],
      default: "public",
    },

    /**
     * Whether Calendly is connected (PAT validated or public URLs configured)
     */
    isConnected: {
      type: Boolean,
      default: false,
    },

    /**
     * Personal Access Token (encrypted) - Required only for 'pat' mode
     */
    accessToken: {
      type: String,
      required: false,
      select: false, // Never expose in queries
    },

    /**
     * Calendly username for public URLs (e.g., "johndoe" from calendly.com/johndoe)
     */
    calendlyUsername: {
      type: String,
      trim: true,
      lowercase: true,
    },

    /**
     * Calendly user ID from /users/me API
     */
    calendlyUserId: {
      type: String,
      trim: true,
    },

    /**
     * Calendly organization URI
     */
    calendlyOrganizationUri: {
      type: String,
      trim: true,
    },

    /**
     * Admin who connected the account
     */
    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    /**
     * When the connection was established
     */
    connectedAt: {
      type: Date,
    },

    /**
     * Last time event types were synced from Calendly
     */
    lastSyncedAt: {
      type: Date,
    },

    /**
     * Available event types from Calendly
     */
    eventTypes: [
      {
        uri: {
          type: String,
          required: true,
          trim: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
        slug: {
          type: String,
          trim: true,
        },
        active: {
          type: Boolean,
          default: true,
        },
        duration: {
          type: Number, // in minutes
        },
        schedulingUrl: {
          type: String,
          trim: true,
        },
      },
    ],

    /**
     * Configuration settings
     */
    settings: {
      defaultEventTypeUri: {
        type: String,
        trim: true,
      },
    },

    /**
     * Last successful API validation
     */
    lastValidatedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Ensure only one config document exists (singleton pattern)
 */
calendlyConfigSchema.index({ _id: 1 }, { unique: true });

/**
 * Static method to get the singleton config
 * @returns {Promise<CalendlyConfig|null>} Config document
 */
calendlyConfigSchema.statics.getSingleton = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({
      isConnected: false,
    });
  }
  return config;
};

/**
 * Static method to get config with token (decrypted separately)
 * @returns {Promise<CalendlyConfig|null>} Config with token field
 */
calendlyConfigSchema.statics.getSingletonWithToken = async function () {
  let config = await this.findOne().select("+accessToken");
  if (!config) {
    config = await this.create({
      isConnected: false,
    });
  }
  return config;
};

const CalendlyConfig = mongoose.model("CalendlyConfig", calendlyConfigSchema);

export default CalendlyConfig;
