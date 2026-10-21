import Admin from "../schema/Admin.schema.js";
import responseUtil from "../utils/response.util.js";
import { verifyAccessToken } from "../utils/jwt.util.js";

export const isPageAllowed = (role, allowedPages, pageKey) => {
  if (role === "SUPER_ADMIN") return true;
  if (!Array.isArray(allowedPages) || allowedPages.length === 0) return true;
  return allowedPages.includes(pageKey);
};

export const isAnyPageAllowed = (role, allowedPages, pageKeys) =>
  [].concat(pageKeys).some((key) => isPageAllowed(role, allowedPages, key));

export const requirePage = (pageKey) => async (req, res, next) => {
  try {
    if (!req.user) {
      return responseUtil.unauthorized(res, "User not authenticated");
    }

    if (req.user.userType !== "admin") {
      return responseUtil.forbidden(res, "Admin access required");
    }

    if (req.user.role === "SUPER_ADMIN") {
      return next();
    }

    const admin = await Admin.findById(req.user.id).select("role allowedPages").lean();
    if (!admin) {
      return responseUtil.unauthorized(res, "Admin account not found");
    }

    if (isAnyPageAllowed(admin.role, admin.allowedPages, pageKey)) {
      return next();
    }

    return responseUtil.forbidden(
      res,
      "You do not have access to this section. Ask a Super Admin to enable it for your account."
    );
  } catch (error) {
    console.error("Page access check error:", error);
    return responseUtil.internalError(res, "Authorization failed", error.message);
  }
};

export const requirePageForAdminToken = (pageKeysOrResolver) => (req, res, next) => {
  if (req.user?.userType !== "admin") return next();
  const keys =
    typeof pageKeysOrResolver === "function" ? pageKeysOrResolver(req) : pageKeysOrResolver;
  return requirePage(keys)(req, res, next);
};

export const shouldEnforcePage =(method, readsOpen) =>
  !(readsOpen && (method === "GET" || method === "HEAD" || method === "OPTIONS"));

export const guardAdminPage = (pageKey, { readsOpen = false } = {}) => {
  const enforce = requirePage(pageKey);
  return (req, res, next) => {
    if (!shouldEnforcePage(req.method, readsOpen)) return next();

    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) return next();

    const decoded = verifyAccessToken(header.substring(7));
    if (!decoded || decoded.userType !== "admin") return next();

    return enforce({ user: decoded }, res, next);
  };
};

export default { requirePage, isPageAllowed, isAnyPageAllowed, guardAdminPage, requirePageForAdminToken };
