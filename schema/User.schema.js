import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
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
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 5,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 10,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    enrollments: [
      {
        event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
        certificate: [String],
      },
    ],
    refreshToken: {
      type: String,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Query middleware to exclude soft deleted documents by default
userSchema.pre(/^find/, function () {
  // Only apply filter if not explicitly looking for deleted docs
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: false });
  }
});

// Static method to get all soft deleted users
userSchema.statics.findDeleted = function () {
  return this.find({ isDeleted: true }).setOptions({ includeDeleted: true });
};

// Static method to permanently delete soft deleted user
userSchema.statics.permanentDelete = function (id) {
  return this.findOneAndDelete({
    _id: id,
    isDeleted: true,
  }).setOptions({ includeDeleted: true });
};

// Static method to restore soft deleted user
userSchema.statics.restore = function (id) {
  return this.findByIdAndUpdate(
    id,
    {
      isDeleted: false,
      deletedAt: null,
    },
    {
      new: true,
      includeDeleted: true,
    }
  ).setOptions({ includeDeleted: true });
};

// Instance method for soft delete
userSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ isDeleted: 1 });

export default mongoose.model("User", userSchema);
