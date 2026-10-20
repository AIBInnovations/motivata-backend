import Brand from "../../schema/Brand.schema.js";
import responseUtil from "../../utils/response.util.js";

const escapeRegex = (value) => String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exactCi = (value) => new RegExp(`^${escapeRegex(value)}$`, "i");

const paginationOf = (totalCount, page, limit) => {
  const totalPages = Math.ceil(totalCount / limit);
  return {
    currentPage: page,
    totalPages,
    totalCount,
    limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

const CLEARABLE_FIELDS = [
  "logoUrl",
  "description",
  "category",
  "city",
  "website",
  "instagram",
  "contactEmail",
  "contactPhone",
];

export const formatBrandForAdmin = (brand) => ({
  id: brand._id,
  name: brand.name,
  logoUrl: brand.logoUrl || null,
  description: brand.description || "",
  category: brand.category || "",
  city: brand.city || "",
  website: brand.website || "",
  instagram: brand.instagram || "",
  otherLinks: (brand.otherLinks || []).map((l) => ({ label: l.label, url: l.url })),
  contactEmail: brand.contactEmail || "",
  contactPhone: brand.contactPhone || "",
  isActive: brand.isActive !== false,
  createdBy: brand.createdBy || null,
  createdAt: brand.createdAt,
  updatedAt: brand.updatedAt,
});

export const formatBrandForUser = (brand) => {
  const { contactEmail, contactPhone, createdBy, isActive, ...publicFields } = formatBrandForAdmin(brand);
  return publicFields;
};

const buildFilter = ({ q, category, city, isActive }) => {
  const filter = { isDeleted: false };
  if (q) filter.name = new RegExp(escapeRegex(q), "i");
  if (category) filter.category = exactCi(category);
  if (city) filter.city = exactCi(city);
  if (isActive !== undefined) filter.isActive = isActive;
  return filter;
};

export const createBrand = async (req, res) => {
  try {
    const body = req.body;
    const data = { name: body.name, createdBy: req.user.id };
    CLEARABLE_FIELDS.forEach((key) => {
      if (body[key] !== undefined && body[key] !== null) data[key] = body[key];
    });
    if (Array.isArray(body.otherLinks)) data.otherLinks = body.otherLinks;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const duplicate = await Brand.exists({ name: exactCi(body.name), isDeleted: false });
    if (duplicate) {
      return responseUtil.conflict(res, "A brand with this name already exists");
    }

    const brand = await Brand.create(data);
    return responseUtil.created(res, "Brand created successfully", { brand: formatBrandForAdmin(brand) });
  } catch (error) {
    console.error("[BRAND] Create brand error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }
    if (error.code === 11000) {
      return responseUtil.conflict(res, "A brand with this name already exists");
    }
    return responseUtil.internalError(res, "Failed to create brand", error.message);
  }
};

export const listBrandsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const filter = buildFilter(req.query);
    const [brands, totalCount] = await Promise.all([
      Brand.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Brand.countDocuments(filter),
    ]);
    return responseUtil.success(res, "Brands fetched successfully", {
      brands: brands.map(formatBrandForAdmin),
      pagination: paginationOf(totalCount, Number(page), Number(limit)),
    });
  } catch (error) {
    console.error("[BRAND] List brands error:", error);
    return responseUtil.internalError(res, "Failed to fetch brands", error.message);
  }
};

export const getBrandAdmin = async (req, res) => {
  try {
    const brand = await Brand.findOne({ _id: req.params.brandId, isDeleted: false }).lean();
    if (!brand) {
      return responseUtil.notFound(res, "Brand not found");
    }
    return responseUtil.success(res, "Brand fetched successfully", { brand: formatBrandForAdmin(brand) });
  } catch (error) {
    console.error("[BRAND] Get brand error:", error);
    return responseUtil.internalError(res, "Failed to fetch brand", error.message);
  }
};

export const updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findOne({ _id: req.params.brandId, isDeleted: false });
    if (!brand) {
      return responseUtil.notFound(res, "Brand not found");
    }

    const body = req.body;

    if (body.name !== undefined && body.name.toLowerCase() !== brand.name.toLowerCase()) {
      const duplicate = await Brand.exists({
        name: exactCi(body.name),
        isDeleted: false,
        _id: { $ne: brand._id },
      });
      if (duplicate) {
        return responseUtil.conflict(res, "A brand with this name already exists");
      }
    }

    if (body.name !== undefined) brand.name = body.name;
    CLEARABLE_FIELDS.forEach((key) => {
      if (body[key] !== undefined) brand[key] = body[key] === null ? (key === "logoUrl" ? null : "") : body[key];
    });
    if (body.otherLinks !== undefined) brand.otherLinks = body.otherLinks || [];
    if (body.isActive !== undefined) brand.isActive = body.isActive;

    await brand.save();
    return responseUtil.success(res, "Brand updated successfully", { brand: formatBrandForAdmin(brand) });
  } catch (error) {
    console.error("[BRAND] Update brand error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }
    if (error.code === 11000) {
      return responseUtil.conflict(res, "A brand with this name already exists");
    }
    return responseUtil.internalError(res, "Failed to update brand", error.message);
  }
};

export const deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findOne({ _id: req.params.brandId, isDeleted: false });
    if (!brand) {
      return responseUtil.notFound(res, "Brand not found");
    }
    await brand.softDelete();
    return responseUtil.success(res, "Brand deleted successfully", { id: brand._id });
  } catch (error) {
    console.error("[BRAND] Delete brand error:", error);
    return responseUtil.internalError(res, "Failed to delete brand", error.message);
  }
};

export const listBrandsUser = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const filter = buildFilter({ ...req.query, isActive: true });
    const [brands, totalCount] = await Promise.all([
      Brand.find(filter)
        .sort({ name: 1 })
        .collation({ locale: "en", strength: 2 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Brand.countDocuments(filter),
    ]);
    return responseUtil.success(res, "Brands fetched successfully", {
      brands: brands.map(formatBrandForUser),
      pagination: paginationOf(totalCount, Number(page), Number(limit)),
    });
  } catch (error) {
    console.error("[BRAND] List brands (user) error:", error);
    return responseUtil.internalError(res, "Failed to fetch brands", error.message);
  }
};

export const listBrandCategoriesUser = async (req, res) => {
  try {
    const raw = await Brand.distinct("category", {
      isDeleted: false,
      isActive: true,
      category: { $nin: [null, ""] },
    });
    const seen = new Map();
    raw.forEach((value) => {
      const name = String(value || "").trim();
      if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    });
    const categories = [...seen.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    return responseUtil.success(res, "Brand categories fetched successfully", { categories });
  } catch (error) {
    console.error("[BRAND] List brand categories error:", error);
    return responseUtil.internalError(res, "Failed to fetch brand categories", error.message);
  }
};

export const getBrandUser = async (req, res) => {
  try {
    const brand = await Brand.findOne({
      _id: req.params.brandId,
      isDeleted: false,
      isActive: true,
    }).lean();
    if (!brand) {
      return responseUtil.notFound(res, "Brand not found");
    }
    return responseUtil.success(res, "Brand fetched successfully", { brand: formatBrandForUser(brand) });
  } catch (error) {
    console.error("[BRAND] Get brand (user) error:", error);
    return responseUtil.internalError(res, "Failed to fetch brand", error.message);
  }
};
