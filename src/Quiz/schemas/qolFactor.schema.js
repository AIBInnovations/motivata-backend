import mongoose from "mongoose";

const qolFactorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Factor name is required"],
      trim: true,
      maxlength: [100, "Factor name cannot exceed 100 characters"],
    },

    order: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
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
  },
  {
    timestamps: true,
  }
);

qolFactorSchema.index({ order: 1 });
qolFactorSchema.index({ isActive: 1, isDeleted: 1 });

qolFactorSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

qolFactorSchema.methods.softDelete = function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.updatedBy = adminId;
  return this.save();
};

qolFactorSchema.statics.findActiveOrdered = function () {
  return this.find({ isActive: true, isDeleted: false }).sort({ order: 1, name: 1 });
};

const QoLFactor = mongoose.model("QoLFactor", qolFactorSchema);

export default QoLFactor;
