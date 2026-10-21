import { BRAND_AUTHOR_NAME } from "../Connect/content.constants.js";

const CREATOR_FIELDS = ["createdBy", "updatedBy"];

export const isAdminViewer = (reqUser) => reqUser?.userType === "admin";

const isPopulatedRef = (ref) =>
  ref !== null &&
  typeof ref === "object" &&
  (ref.name !== undefined || ref.email !== undefined);

export const maskCreators = (obj, reqUser) => {
  if (!obj || isAdminViewer(reqUser)) return obj;
  CREATOR_FIELDS.forEach((field) => {
    const ref = obj[field];
    if (isPopulatedRef(ref)) {
      obj[field] = { _id: ref._id, name: BRAND_AUTHOR_NAME };
    }
  });
  return obj;
};
