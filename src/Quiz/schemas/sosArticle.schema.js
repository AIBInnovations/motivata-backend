import mongoose from "mongoose";

const sosArticleSchema = new mongoose.Schema(
  {
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SOSProgram",
      required: [true, "Program ID is required"],
    },

    dayNumber: {
      type: Number,
      required: [true, "Day number is required"],
      min: [1, "Day number must be at least 1"],
    },

    title: {
      type: String,
      required: [true, "Article title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    body: {
      type: String,
      required: [true, "Article body is required"],
      maxlength: [20000, "Article body cannot exceed 20000 characters"],
    },

    audioUrl: {
      type: String,
      trim: true,
      default: null,
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

sosArticleSchema.index({ programId: 1, dayNumber: 1 }, { unique: true });
sosArticleSchema.index({ programId: 1, isDeleted: 1 });
sosArticleSchema.index({ isActive: 1, isDeleted: 1 });

sosArticleSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

sosArticleSchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("dayNumber") || this.isModified("programId")) {
    const SOSProgram = mongoose.model("SOSProgram");
    const program = await SOSProgram.findById(this.programId);

    if (!program) {
      return next(new Error("Program not found"));
    }

    if (this.dayNumber > program.durationDays) {
      return next(
        new Error(
          `Day number (${this.dayNumber}) cannot exceed program duration (${program.durationDays} days)`
        )
      );
    }
  }
  next();
});

sosArticleSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  return this.save();
};

sosArticleSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

sosArticleSchema.statics.findByProgram = function (programId) {
  return this.find({ programId, isDeleted: false, isActive: true }).sort({ dayNumber: 1 });
};

sosArticleSchema.statics.findByDay = function (programId, dayNumber) {
  return this.findOne({ programId, dayNumber, isDeleted: false, isActive: true });
};

const SOSArticle = mongoose.model("SOSArticle", sosArticleSchema);

export default SOSArticle;
