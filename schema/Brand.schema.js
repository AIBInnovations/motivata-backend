import mongoose from "mongoose";

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
      minlength: [2, "Brand name must be at least 2 characters"],
      maxlength: [100, "Brand name cannot exceed 100 characters"],
    },
    logoUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Brand description cannot exceed 1000 characters"],
      default: "",
    },
    category: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    instagram: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    otherLinks: {
      type: [
        {
          _id: false,
          label: { type: String, trim: true, maxlength: 60, required: true },
          url: { type: String, trim: true, maxlength: 500, required: true },
        },
      ],
      default: [],
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 200,
      default: "",
    },
    contactPhone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
    deletedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

brandSchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    partialFilterExpression: { isDeleted: false },
  }
);
brandSchema.index({ category: 1, city: 1, isActive: 1 });

brandSchema.pre(/^find/, function () {
  if (!Object.prototype.hasOwnProperty.call(this.getQuery(), "isDeleted")) {
    this.where({ isDeleted: false });
  }
});

brandSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.isActive = false;
  return this.save();
};

const Brand = mongoose.model("Brand", brandSchema);

export default Brand;
