import mongoose from "mongoose";

const scoreSchema = new mongoose.Schema(
  {
    factorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QoLFactor",
      required: true,
    },
    factorName: {
      type: String,
      required: true,
      trim: true,
    },
    current: {
      type: Number,
      required: [true, "Current score is required"],
      min: [1, "Score must be between 1 and 10"],
      max: [10, "Score must be between 1 and 10"],
    },
    required: {
      type: Number,
      required: [true, "Required score is required"],
      min: [1, "Score must be between 1 and 10"],
      max: [10, "Score must be between 1 and 10"],
    },
    difference: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const qolEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    dateKey: {
      type: String,
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },

    scores: {
      type: [scoreSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one factor must be rated",
      },
    },

    mostDegrading: {
      factorName: { type: String },
      difference: { type: Number },
      tiedWith: { type: [String], default: [] },
    },

    mostSorted: {
      factorName: { type: String },
      difference: { type: Number },
      tiedWith: { type: [String], default: [] },
    },
  },
  {
    timestamps: true,
  }
);

qolEntrySchema.index({ userId: 1, dateKey: 1 }, { unique: true });
qolEntrySchema.index({ userId: 1, createdAt: -1 });

qolEntrySchema.statics.findLatestForUser = function (userId) {
  return this.findOne({ userId }).sort({ dateKey: -1 });
};

const QoLEntry = mongoose.model("QoLEntry", qolEntrySchema);

export default QoLEntry;
