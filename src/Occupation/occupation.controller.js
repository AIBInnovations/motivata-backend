import OccupationCategory from "../../schema/OccupationCategory.schema.js";
import responseUtil from "../../utils/response.util.js";

export const DEFAULT_OCCUPATION_CATEGORIES = [
  {
    name: "Working",
    subCategories: [
      "Software / IT", "Design", "Marketing", "Sales", "Finance / Accounts", "HR", "Operations",
      "Healthcare", "Education / Teaching", "Law", "Media & Content", "Engineering", "Government", "Other",
    ],
  },
  { name: "Homemaker", subCategories: ["Homemaker"] },
  { name: "Student", subCategories: ["School", "Undergraduate", "Postgraduate", "PhD / Research", "Other"] },
  { name: "Business", subCategories: ["Founder / Entrepreneur", "Family Business", "Startup", "Retail / Shop", "Other"] },
  {
    name: "Freelancer",
    subCategories: ["Designer", "Developer", "Writer", "Photographer / Videographer", "Consultant", "Coach / Trainer", "Creator", "Other"],
  },
];

const cleanSubCategories = (list) =>
  [...new Set((Array.isArray(list) ? list : []).map((s) => String(s || "").trim()).filter(Boolean))].slice(0, 100);

const ensureDefaults = async () => {
  const count = await OccupationCategory.estimatedDocumentCount();
  if (count > 0) return;
  await OccupationCategory.insertMany(
    DEFAULT_OCCUPATION_CATEGORIES.map((c, i) => ({ ...c, order: i })),
    { ordered: false }
  ).catch((err) => {
    if (err.code !== 11000) throw err;
  });
};

const format = (c) => ({
  id: c._id,
  name: c.name,
  subCategories: c.subCategories || [],
  order: c.order || 0,
  isActive: c.isActive !== false,
});

export const listOccupationCategories = async (req, res) => {
  try {
    await ensureDefaults();
    const includeInactive = req.user?.userType === "admin" && req.query.all === "true";
    const categories = await OccupationCategory.find(includeInactive ? {} : { isActive: true })
      .sort({ order: 1, name: 1 })
      .lean();
    return responseUtil.success(res, "Occupation categories fetched", { categories: categories.map(format) });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch occupations", error.message);
  }
};

export const createOccupationCategory = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return responseUtil.badRequest(res, "Category name is required");
    if (name.length > 100) return responseUtil.badRequest(res, "Name cannot exceed 100 characters");
    const last = await OccupationCategory.findOne().sort({ order: -1 }).select("order").lean();
    const category = await OccupationCategory.create({
      name,
      subCategories: cleanSubCategories(req.body?.subCategories),
      order: (last?.order ?? -1) + 1,
    });
    return responseUtil.created(res, "Category created", { category: format(category) });
  } catch (error) {
    if (error.code === 11000) return responseUtil.conflict(res, "A category with this name already exists");
    return responseUtil.internalError(res, "Failed to create category", error.message);
  }
};

export const updateOccupationCategory = async (req, res) => {
  try {
    const category = await OccupationCategory.findById(req.params.id);
    if (!category) return responseUtil.notFound(res, "Category not found");
    const { name, subCategories, isActive, order } = req.body || {};
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return responseUtil.badRequest(res, "Category name is required");
      category.name = trimmed;
    }
    if (subCategories !== undefined) category.subCategories = cleanSubCategories(subCategories);
    if (typeof isActive === "boolean") category.isActive = isActive;
    if (Number.isFinite(Number(order)) && order !== undefined) category.order = Number(order);
    await category.save();
    return responseUtil.success(res, "Category updated", { category: format(category) });
  } catch (error) {
    if (error.code === 11000) return responseUtil.conflict(res, "A category with this name already exists");
    if (error.name === "CastError") return responseUtil.badRequest(res, "Invalid category ID");
    return responseUtil.internalError(res, "Failed to update category", error.message);
  }
};

export const deleteOccupationCategory = async (req, res) => {
  try {
    const category = await OccupationCategory.findByIdAndDelete(req.params.id);
    if (!category) return responseUtil.notFound(res, "Category not found");
    return responseUtil.success(res, "Category deleted");
  } catch (error) {
    if (error.name === "CastError") return responseUtil.badRequest(res, "Invalid category ID");
    return responseUtil.internalError(res, "Failed to delete category", error.message);
  }
};

export default {
  listOccupationCategories,
  createOccupationCategory,
  updateOccupationCategory,
  deleteOccupationCategory,
};
