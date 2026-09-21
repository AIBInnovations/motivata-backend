import mongoose from "mongoose";

const occupationCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100, unique: true },
    subCategories: {
      type: [{ type: String, trim: true, maxlength: 100 }],
      default: [],
    },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

occupationCategorySchema.index({ order: 1, name: 1 });

const OccupationCategory = mongoose.model("OccupationCategory", occupationCategorySchema);
export default OccupationCategory;
