/**
 * @fileoverview Cash Partner schema definition
 * @module schema/CashPartner
 */

import mongoose from "mongoose";

const cashPartnerSchema = new mongoose.Schema(
  {
    /**
     * Partner name
     */
    name: {
      type: String,
      required: [true, "Partner name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    /**
     * Partner phone number
     */
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      minlength: [10, "Phone number must be at least 10 digits"],
      maxlength: [15, "Phone number cannot exceed 15 digits"],
    },

    /**
     * Unique 6-digit numeric code for partner identification
     */
    partnerCode: {
      type: String,
      required: [true, "Partner code is required"],
      unique: true,
      trim: true,
      match: [/^\d{6}$/, "Partner code must be exactly 6 digits"],
    },

    /**
     * Array of event enrollments associated with this partner
     */
    eventEnrollments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "EventEnrollment",
      },
    ],
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for improving query performance
 */
cashPartnerSchema.index({ phone: 1 });
cashPartnerSchema.index({ partnerCode: 1 });

const CashPartner = mongoose.model("CashPartner", cashPartnerSchema);

export default CashPartner;
