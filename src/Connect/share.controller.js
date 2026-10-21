import Post from "../../schema/Post.schema.js";
import Club from "../../schema/Club.schema.js";
import User from "../../schema/User.schema.js";
import Event from "../../schema/Event.schema.js";
import responseUtil from "../../utils/response.util.js";
import {
  buildPostShare,
  buildEventShare,
  buildClubShare,
  buildUserShare,
  buildGenericShare,
  isShareablePost,
  isGenericPost,
} from "../../utils/shareMeta.util.js";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const NOT_FOUND = "Not found";

const send = (res, payload) => {
  res.set("Cache-Control", "public, max-age=300");
  return responseUtil.success(res, "Share details fetched", payload);
};

const notFound = (res) => responseUtil.notFound(res, NOT_FOUND);

export const getPostShareMeta = async (req, res) => {
  try {
    const { id } = req.params;
    if (!OBJECT_ID.test(id)) return notFound(res);

    const post = await Post.findById(id).lean();
    if (!post) return notFound(res);

    if (post.authorType === "User") {
      const authorExists = await User.exists({ _id: post.author });
      if (!authorExists) return notFound(res);
    }

    const club = post.club ? await Club.findById(post.club).lean() : null;
    if (post.club && !club) return notFound(res);

    if (isShareablePost(post, club)) return send(res, buildPostShare(post));
    if (isGenericPost(post, club)) return send(res, buildGenericShare("post", post._id));
    return notFound(res);
  } catch (error) {
    console.error("[SHARE] Post share meta error:", error);
    return responseUtil.internalError(res, "Failed to fetch share details");
  }
};

export const getEventShareMeta = async (req, res) => {
  try {
    const raw = String(req.params.idOrSlug || "");
    const query = OBJECT_ID.test(raw)
      ? { _id: raw }
      : SLUG.test(raw.toLowerCase()) && raw.length <= 80
        ? { slug: raw.toLowerCase() }
        : null;
    if (!query) return notFound(res);

    const event = await Event.findOne({ ...query, isLive: true })
      .select("name description imageUrls thumbnail")
      .lean();
    if (!event) return notFound(res);

    return send(res, buildEventShare(event));
  } catch (error) {
    console.error("[SHARE] Event share meta error:", error);
    return responseUtil.internalError(res, "Failed to fetch share details");
  }
};

export const getClubShareMeta = async (req, res) => {
  try {
    const { id } = req.params;
    if (!OBJECT_ID.test(id)) return notFound(res);

    const club = await Club.findById(id).select("name description thumbnail").lean();
    if (!club) return notFound(res);

    return send(res, buildClubShare(club));
  } catch (error) {
    console.error("[SHARE] Club share meta error:", error);
    return responseUtil.internalError(res, "Failed to fetch share details");
  }
};

export const getUserShareMeta = async (req, res) => {
  try {
    const { id } = req.params;
    if (!OBJECT_ID.test(id)) return notFound(res);

    const user = await User.findById(id).select("name photoUrl privacySettings").lean();
    if (!user) return notFound(res);

    return send(res, buildUserShare(user));
  } catch (error) {
    console.error("[SHARE] User share meta error:", error);
    return responseUtil.internalError(res, "Failed to fetch share details");
  }
};
