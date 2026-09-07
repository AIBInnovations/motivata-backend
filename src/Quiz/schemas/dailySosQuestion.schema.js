import mongoose from "mongoose";

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

const dailySosQuestionSchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },

    questionText: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
      maxlength: [1000, "Question text cannot exceed 1000 characters"],
    },

    questionType: {
      type: String,
      required: [true, "Question type is required"],
      enum: {
        values: ["text", "single-choice", "multiple-choice", "scale", "boolean"],
        message: "{VALUE} is not a valid question type",
      },
      default: "text",
    },

    options: {
      type: [optionSchema],
      validate: {
        validator: function (v) {
          if (["single-choice", "multiple-choice", "scale"].includes(this.questionType)) {
            return v && v.length >= 2;
          }
          return true;
        },
        message: "Choice-based questions must have at least 2 options",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },

    deletedAt: {
      type: Date,
      select: false,
    },

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

dailySosQuestionSchema.index({ dateKey: 1 }, { unique: true });
dailySosQuestionSchema.index({ isActive: 1, isDeleted: 1 });

dailySosQuestionSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

dailySosQuestionSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

dailySosQuestionSchema.statics.findByDateKey = function (dateKey) {
  return this.findOne({ dateKey, isActive: true, isDeleted: false });
};

dailySosQuestionSchema.statics.findInRange = function (fromKey, toKey) {
  return this.find({ dateKey: { $gte: fromKey, $lte: toKey }, isDeleted: false }).sort({
    dateKey: 1,
  });
};

const DailySOSQuestion = mongoose.model("DailySOSQuestion", dailySosQuestionSchema);

export default DailySOSQuestion;
