import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
      set: (value) => {
        if (!value) return value;
        return value
          .split(" ")
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");
      },
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
      lowercase: true,
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      minlength: 5,
      lowercase: true,
      set: (v) => (v === "" ? undefined : v),
    },
    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      minlength: 10,
      set: (v) => (v === "" ? undefined : v),
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["ADMIN", "SUPER_ADMIN", "MANAGEMENT_STAFF"],
      default: "MANAGEMENT_STAFF",
    },
    allowedEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
    access: {
      type: [String],
      default: [],
    },
    maxCashTicketsAllowed: {
      type: Number,
      required: false,
      min: [0, "Max cash tickets allowed cannot be negative"],
    },
    status: {
      type: String,
      enum: ["ACTIVATED", "DEACTIVATED"],
      default: "ACTIVATED",
    },
    refreshToken: {
      type: String,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
adminSchema.index({ username: 1 });
adminSchema.index({ status: 1 });

export default mongoose.model("Admin", adminSchema);
