/**
 * @fileoverview Quiz schema definition with questions, submissions, and soft delete functionality
 * @module schema/Quiz
 */

import mongoose from "mongoose";

/**
 * Question sub-schema for quiz questions
 * @typedef {Object} Question
 * @property {string} questionText - The question text
 * @property {string} questionType - Type of question (QNA, MCQ_SINGLE, MCQ_MULTIPLE)
 * @property {Array<Object>} options - Array of options for MCQ questions
 * @property {string} correctAnswer - Correct answer for QNA questions
 * @property {Array<number>} correctOptionIndices - Indices of correct options for MCQ
 * @property {number} points - Points awarded for correct answer
 * @property {boolean} isRequired - Whether the question is required
 * @property {number} order - Display order of the question
 */
const questionSchema = new mongoose.Schema(
  {
    /**
     * The question text
     */
    questionText: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
      maxlength: [1000, "Question text cannot exceed 1000 characters"],
    },

    /**
     * Type of question
     * QNA - Simple question and answer (text input)
     * MCQ_SINGLE - Multiple choice with single correct answer
     * MCQ_MULTIPLE - Multiple choice with multiple correct answers
     */
    questionType: {
      type: String,
      required: [true, "Question type is required"],
      enum: {
        values: ["QNA", "MCQ_SINGLE", "MCQ_MULTIPLE"],
        message: "{VALUE} is not a valid question type",
      },
    },

    /**
     * Options for MCQ questions
     */
    options: [
      {
        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: [500, "Option text cannot exceed 500 characters"],
        },
        isCorrect: {
          type: Boolean,
          default: false,
        },
      },
    ],

    /**
     * Correct answer for QNA questions (used for reference/auto-grading)
     */
    correctAnswer: {
      type: String,
      trim: true,
      maxlength: [2000, "Correct answer cannot exceed 2000 characters"],
    },

    /**
     * Points for this question
     */
    points: {
      type: Number,
      default: 1,
      min: [0, "Points cannot be negative"],
    },

    /**
     * Whether this question is required
     */
    isRequired: {
      type: Boolean,
      default: false,
    },

    /**
     * Display order of the question
     */
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

/**
 * Submission sub-schema for quiz submissions
 * @typedef {Object} Submission
 * @property {mongoose.Types.ObjectId} userId - Reference to the user who submitted
 * @property {Array<Object>} answers - Array of question answers
 * @property {number} score - Total score achieved
 * @property {number} totalPoints - Total possible points
 * @property {Date} submittedAt - Submission timestamp
 * @property {number} timeTaken - Time taken in seconds
 * @property {string} status - Submission status
 */
const submissionSchema = new mongoose.Schema(
  {
    /**
     * Reference to the user who submitted
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /**
     * Array of answers for each question
     */
    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        answer: {
          type: String,
          trim: true,
        },
        selectedOptions: [
          {
            type: Number,
          },
        ],
        isCorrect: {
          type: Boolean,
          default: null,
        },
        pointsAwarded: {
          type: Number,
          default: 0,
        },
        skipped: {
          type: Boolean,
          default: false,
        },
      },
    ],

    /**
     * Total score achieved
     */
    score: {
      type: Number,
      default: 0,
      min: [0, "Score cannot be negative"],
    },

    /**
     * Total possible points
     */
    totalPoints: {
      type: Number,
      default: 0,
    },

    /**
     * Submission timestamp
     */
    submittedAt: {
      type: Date,
      default: Date.now,
    },

    /**
     * Time taken to complete the quiz (in seconds)
     */
    timeTaken: {
      type: Number,
      min: [0, "Time taken cannot be negative"],
    },

    /**
     * Submission status
     */
    status: {
      type: String,
      enum: ["PENDING", "GRADED", "REVIEWED"],
      default: "PENDING",
    },
  },
  { _id: true }
);

/**
 * @typedef {Object} Quiz
 * @property {string} title - Quiz title
 * @property {string} [shortDescription] - Brief description of the quiz
 * @property {boolean} isPaid - Whether the quiz is paid or free
 * @property {number} price - Quiz price (if paid)
 * @property {number} [compareAtPrice] - Original price for comparison
 * @property {string} enrollmentType - Type of enrollment (REGISTERED, OPEN)
 * @property {Array<mongoose.Types.ObjectId>} enrollments - Users enrolled in the quiz
 * @property {Array<Question>} questions - Quiz questions
 * @property {Array<Submission>} submissions - User submissions
 * @property {boolean} isLive - Whether quiz is currently available
 * @property {Object} [liveData] - Live quiz configuration
 * @property {number} [timeLimit] - Time limit in minutes
 * @property {boolean} shuffleQuestions - Whether to shuffle questions
 * @property {boolean} showResults - Whether to show results after submission
 * @property {mongoose.Types.ObjectId} createdBy - Admin who created the quiz
 * @property {boolean} isDeleted - Soft delete flag
 */
const quizSchema = new mongoose.Schema(
  {
    /**
     * Quiz title
     */
    title: {
      type: String,
      required: [true, "Quiz title is required"],
      trim: true,
      maxlength: [200, "Quiz title cannot exceed 200 characters"],
    },

    /**
     * Brief description of the quiz
     */
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [500, "Short description cannot exceed 500 characters"],
    },

    /**
     * Whether the quiz is paid or free
     */
    isPaid: {
      type: Boolean,
      default: false,
    },

    /**
     * Quiz price (required if isPaid is true)
     */
    price: {
      type: Number,
      min: [0, "Price cannot be negative"],
      validate: {
        validator: function (value) {
          if (this.isPaid && (value == null || value <= 0)) {
            return false;
          }
          return true;
        },
        message: "Price is required and must be greater than 0 for paid quizzes",
      },
    },

    /**
     * Original price for comparison (for discounts)
     */
    compareAtPrice: {
      type: Number,
      min: [0, "Compare at price cannot be negative"],
      validate: {
        validator: function (value) {
          return !value || value >= this.price;
        },
        message: "Compare at price must be greater than or equal to current price",
      },
    },

    /**
     * Enrollment type
     * REGISTERED - Only enrolled users can take the quiz
     * OPEN - Anyone can take the quiz
     */
    enrollmentType: {
      type: String,
      required: [true, "Enrollment type is required"],
      enum: {
        values: ["REGISTERED", "OPEN"],
        message: "{VALUE} is not a valid enrollment type",
      },
      default: "OPEN",
    },

    /**
     * Users enrolled in the quiz
     */
    enrollments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    /**
     * Quiz questions
     */
    questions: [questionSchema],

    /**
     * User submissions
     */
    submissions: [submissionSchema],

    /**
     * Whether quiz is currently available
     */
    isLive: {
      type: Boolean,
      default: false,
    },

    /**
     * Live quiz configuration (for scheduled/live quizzes)
     */
    liveData: {
      startTime: {
        type: Date,
      },
      endTime: {
        type: Date,
      },
      isScheduled: {
        type: Boolean,
        default: false,
      },
    },

    /**
     * Time limit in minutes (null = no limit)
     */
    timeLimit: {
      type: Number,
      min: [1, "Time limit must be at least 1 minute"],
      max: [480, "Time limit cannot exceed 480 minutes (8 hours)"],
    },

    /**
     * Whether to shuffle questions for each user
     */
    shuffleQuestions: {
      type: Boolean,
      default: false,
    },

    /**
     * Whether to show results immediately after submission
     */
    showResults: {
      type: Boolean,
      default: true,
    },

    /**
     * Maximum number of attempts allowed (null = unlimited)
     */
    maxAttempts: {
      type: Number,
      min: [1, "Maximum attempts must be at least 1"],
    },

    /**
     * Thumbnail/cover image URL
     */
    imageUrl: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid image URL"],
    },

    /**
     * Created by (admin user)
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    /**
     * Last updated by (admin user)
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
      default: null,
      select: false,
    },

    /**
     * Who deleted the record
     */
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Virtual for total questions count
 */
quizSchema.virtual("questionCount").get(function () {
  return this.questions ? this.questions.length : 0;
});

/**
 * Virtual for total possible points
 */
quizSchema.virtual("totalPoints").get(function () {
  if (!this.questions) return 0;
  return this.questions.reduce((sum, q) => sum + (q.points || 0), 0);
});

/**
 * Virtual for enrollment count
 */
quizSchema.virtual("enrollmentCount").get(function () {
  return this.enrollments ? this.enrollments.length : 0;
});

/**
 * Virtual for submission count
 */
quizSchema.virtual("submissionCount").get(function () {
  return this.submissions ? this.submissions.length : 0;
});

/**
 * Virtual for discount percentage
 */
quizSchema.virtual("discountPercent").get(function () {
  if (!this.compareAtPrice || this.compareAtPrice <= this.price) return 0;
  return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
});

/**
 * Virtual for checking if quiz is currently active (within live time window)
 */
quizSchema.virtual("isCurrentlyActive").get(function () {
  if (!this.isLive) return false;
  if (!this.liveData || !this.liveData.isScheduled) return this.isLive;

  const now = new Date();
  const startTime = this.liveData.startTime;
  const endTime = this.liveData.endTime;

  if (startTime && now < startTime) return false;
  if (endTime && now > endTime) return false;

  return true;
});

/**
 * Index for improving query performance
 */
quizSchema.index({ isDeleted: 1, isLive: 1 });
quizSchema.index({ enrollmentType: 1, isDeleted: 1 });
quizSchema.index({ isPaid: 1, isDeleted: 1 });
quizSchema.index({ createdAt: -1 });
quizSchema.index({ "enrollments": 1 });
quizSchema.index({ "submissions.userId": 1 });

/**
 * Pre-query middleware to exclude soft deleted documents
 */
quizSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

/**
 * Pre-save middleware to validate quiz data
 */
quizSchema.pre("save", function (next) {
  // Validate MCQ questions have options
  if (this.questions) {
    for (const question of this.questions) {
      if (
        (question.questionType === "MCQ_SINGLE" || question.questionType === "MCQ_MULTIPLE") &&
        (!question.options || question.options.length < 2)
      ) {
        return next(new Error(`MCQ question "${question.questionText}" must have at least 2 options`));
      }

      // Validate MCQ_SINGLE has exactly one correct answer
      if (question.questionType === "MCQ_SINGLE" && question.options) {
        const correctCount = question.options.filter((opt) => opt.isCorrect).length;
        if (correctCount !== 1) {
          return next(
            new Error(`MCQ_SINGLE question "${question.questionText}" must have exactly 1 correct option`)
          );
        }
      }

      // Validate MCQ_MULTIPLE has at least one correct answer
      if (question.questionType === "MCQ_MULTIPLE" && question.options) {
        const correctCount = question.options.filter((opt) => opt.isCorrect).length;
        if (correctCount < 1) {
          return next(
            new Error(`MCQ_MULTIPLE question "${question.questionText}" must have at least 1 correct option`)
          );
        }
      }
    }
  }

  // Validate price for paid quizzes
  if (this.isPaid && (!this.price || this.price <= 0)) {
    return next(new Error("Paid quizzes must have a price greater than 0"));
  }

  // Set price to 0 for free quizzes
  if (!this.isPaid) {
    this.price = 0;
  }

  next();
});

/**
 * Static method to find deleted quizzes
 * @param {Object} filter - Query filter
 * @returns {Query} Mongoose query for deleted quizzes
 */
quizSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, isDeleted: true }).select("+isDeleted +deletedAt +deletedBy");
};

/**
 * Instance method for soft delete
 * @param {mongoose.Types.ObjectId} adminId - ID of admin performing deletion
 * @returns {Promise<Quiz>} Updated quiz document
 */
quizSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

/**
 * Instance method to restore soft deleted quiz
 * @returns {Promise<Quiz>} Restored quiz document
 */
quizSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

/**
 * Static method for permanent delete
 * @param {mongoose.Types.ObjectId} id - Quiz ID to delete
 * @returns {Promise<Quiz>} Deleted quiz document
 */
quizSchema.statics.permanentDelete = function (id) {
  return this.findByIdAndDelete(id);
};

/**
 * Instance method to enroll a user
 * @param {mongoose.Types.ObjectId} userId - ID of user to enroll
 * @returns {Promise<Quiz>} Updated quiz document
 */
quizSchema.methods.enrollUser = function (userId) {
  if (!this.enrollments.includes(userId)) {
    this.enrollments.push(userId);
  }
  return this.save();
};

/**
 * Instance method to check if user is enrolled
 * @param {mongoose.Types.ObjectId} userId - ID of user to check
 * @returns {boolean} Whether user is enrolled
 */
quizSchema.methods.isUserEnrolled = function (userId) {
  return this.enrollments.some((id) => id.toString() === userId.toString());
};

/**
 * Instance method to get user's submission count
 * @param {mongoose.Types.ObjectId} userId - ID of user
 * @returns {number} Number of submissions by user
 */
quizSchema.methods.getUserAttemptCount = function (userId) {
  return this.submissions.filter((sub) => sub.userId.toString() === userId.toString()).length;
};

/**
 * Instance method to check if user can attempt quiz
 * @param {mongoose.Types.ObjectId} userId - ID of user
 * @returns {boolean} Whether user can attempt the quiz
 */
quizSchema.methods.canUserAttempt = function (userId) {
  if (!this.maxAttempts) return true;
  return this.getUserAttemptCount(userId) < this.maxAttempts;
};

/**
 * Static method to get available quizzes
 * @param {Object} filter - Additional query filters
 * @returns {Query} Mongoose query for available quizzes
 */
quizSchema.statics.findAvailable = function (filter = {}) {
  return this.find({
    ...filter,
    isLive: true,
  });
};

const Quiz = mongoose.model("Quiz", quizSchema);

export default Quiz;
