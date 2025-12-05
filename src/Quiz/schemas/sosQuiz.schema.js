/**
 * @fileoverview SOS Quiz schema for daily quizzes within SOS programs
 * @module schemas/SOSQuiz
 */

import mongoose from "mongoose";

/**
 * Question option sub-schema
 */
const optionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "Option text is required"],
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Option value is required"],
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

/**
 * Question sub-schema
 */
const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: [true, "Question text is required"],
      maxlength: [1000, "Question text cannot exceed 1000 characters"],
    },
    questionType: {
      type: String,
      required: [true, "Question type is required"],
      enum: {
        values: ["text", "single-choice", "multiple-choice", "scale", "boolean"],
        message:
          "{VALUE} is not a valid question type. Use text, single-choice, multiple-choice, scale, or boolean",
      },
    },
    options: {
      type: [optionSchema],
      validate: {
        validator: function (v) {
          // Options required for choice-based and scale questions
          if (["single-choice", "multiple-choice", "scale"].includes(this.questionType)) {
            return v && v.length >= 2;
          }
          return true;
        },
        message: "Choice-based and scale questions must have at least 2 options",
      },
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    points: {
      type: Number,
      default: 0,
      min: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { _id: true }
);

/**
 * SOS Quiz schema
 */
const sosQuizSchema = new mongoose.Schema(
  {
    /**
     * Reference to the SOS program
     */
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SOSProgram",
      required: [true, "Program ID is required"],
    },

    /**
     * Day number within the program (1 to durationDays)
     */
    dayNumber: {
      type: Number,
      required: [true, "Day number is required"],
      min: [1, "Day number must be at least 1"],
    },

    /**
     * Quiz title
     */
    title: {
      type: String,
      required: [true, "Quiz title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    /**
     * Quiz description
     */
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    /**
     * Quiz questions
     */
    questions: {
      type: [questionSchema],
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "Quiz must have at least one question",
      },
    },

    /**
     * Whether the quiz is active
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    /**
     * Display order (for multiple quizzes on same day)
     */
    order: {
      type: Number,
      default: 0,
    },

    /**
     * Created by (admin)
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    /**
     * Last updated by (admin)
     */
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    /**
     * Soft delete flag
     */
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },

    /**
     * Deletion timestamp
     */
    deletedAt: {
      type: Date,
      select: false,
    },

    /**
     * Who deleted the record
     */
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for query performance
 * Compound unique index on programId + dayNumber ensures one quiz per day per program
 */
sosQuizSchema.index({ programId: 1, dayNumber: 1 }, { unique: true });
sosQuizSchema.index({ programId: 1, isDeleted: 1 });
sosQuizSchema.index({ isActive: 1, isDeleted: 1 });

/**
 * Virtual for total points
 */
sosQuizSchema.virtual("totalPoints").get(function () {
  if (!this.questions) return 0;
  return this.questions.reduce((sum, q) => sum + (q.points || 0), 0);
});

/**
 * Virtual for question count
 */
sosQuizSchema.virtual("questionCount").get(function () {
  return this.questions ? this.questions.length : 0;
});

/**
 * Pre-query middleware to exclude soft deleted documents
 */
sosQuizSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Pre-save validation to check dayNumber against program duration
 */
sosQuizSchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("dayNumber")) {
    const SOSProgram = mongoose.model("SOSProgram");
    const program = await SOSProgram.findById(this.programId);

    if (!program) {
      return next(new Error("Program not found"));
    }

    if (this.dayNumber > program.durationDays) {
      return next(
        new Error(`Day number (${this.dayNumber}) cannot exceed program duration (${program.durationDays} days)`)
      );
    }
  }
  next();
});

/**
 * Instance method for soft delete
 * @param {ObjectId} adminId - ID of admin performing deletion
 * @returns {Promise<SOSQuiz>} Updated document
 */
sosQuizSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

/**
 * Instance method to restore soft deleted quiz
 * @returns {Promise<SOSQuiz>} Restored document
 */
sosQuizSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

/**
 * Static method to find quizzes by program
 * @param {ObjectId} programId - Program ID
 * @returns {Query} Mongoose query
 */
sosQuizSchema.statics.findByProgram = function (programId) {
  return this.find({ programId, isDeleted: false, isActive: true }).sort({ dayNumber: 1 });
};

/**
 * Static method to find quiz for specific day
 * @param {ObjectId} programId - Program ID
 * @param {number} dayNumber - Day number
 * @returns {Query} Mongoose query
 */
sosQuizSchema.statics.findByDay = function (programId, dayNumber) {
  return this.findOne({ programId, dayNumber, isDeleted: false, isActive: true });
};

const SOSQuiz = mongoose.model("SOSQuiz", sosQuizSchema);

export default SOSQuiz;
