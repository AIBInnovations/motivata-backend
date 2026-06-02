/**
 * @fileoverview Post controller for Connect social feed feature
 * @module controllers/post
 */

import Post from "../../schema/Post.schema.js";
import Like from "../../schema/Like.schema.js";
import Connect from "../../schema/Connect.schema.js";
import User from "../../schema/User.schema.js";
import Admin from "../../schema/Admin.schema.js";
import Club from "../../schema/Club.schema.js";
import ClubMember from "../../schema/ClubMember.schema.js";
import PostComment from "../../schema/PostComment.schema.js";
import PostCommentLike from "../../schema/PostCommentLike.schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Helper: Map post document to response format
 * @param {Object} post - Post document
 * @param {Object} options - Options
 * @param {string} options.currentUserId - Current user ID
 * @param {Set} options.likedPostIds - Set of liked post IDs
 * @param {Set} options.followingSet - Set of user IDs the current user is following
 * @returns {Object} Formatted post object
 */
const formatPostResponse = (post, { currentUserId = null, likedPostIds = new Set(), followingSet = new Set() } = {}) => {
  const authorId = post.author._id.toString();
  const isOwnPost = currentUserId ? authorId === currentUserId : false;

  return {
    id: post._id,
    title: post.title || "",
    content: post.content || "",
    caption: post.caption,
    mediaType: post.mediaType,
    mediaUrls: post.mediaUrls,
    mediaThumbnail: post.mediaThumbnail,
    likeCount: post.likeCount,
    shareCount: post.shareCount,
    commentCount: post.commentCount || 0,
    author: {
      id: post.author._id,
      name: post.author.name,
      isFollowing: currentUserId && !isOwnPost ? followingSet.has(authorId) : false,
    },
    club: post.club ? {
      id: post.club._id,
      name: post.club.name,
      thumbnail: post.club.thumbnail,
    } : null,
    isLiked: currentUserId ? likedPostIds.has(post._id.toString()) : false,
    isOwnPost,
    createdAt: post.createdAt,
  };
};

/**
 * Create a new post
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const createPost = async (req, res) => {
  try {
    const { caption, mediaType, mediaUrls, mediaThumbnail, clubId } = req.body;
    const authorId = req.user.id;

    // Validate: media is required
    if (!mediaUrls || !Array.isArray(mediaUrls) || mediaUrls.length === 0) {
      return responseUtil.badRequest(res, "At least one media URL is required");
    }

    // Validate: mediaType is required
    if (!mediaType || !["IMAGE", "VIDEO"].includes(mediaType)) {
      return responseUtil.badRequest(res, "Media type must be IMAGE or VIDEO");
    }

    // Validate: VIDEO must have exactly 1 URL
    if (mediaType === "VIDEO" && mediaUrls.length !== 1) {
      return responseUtil.badRequest(res, "Video posts must have exactly one video URL");
    }

    // Validate: IMAGE can have 1-10 URLs
    if (mediaType === "IMAGE" && mediaUrls.length > 10) {
      return responseUtil.badRequest(res, "Image posts cannot have more than 10 images");
    }

    // Validate club if clubId is provided
    if (clubId) {
      const club = await Club.findById(clubId);
      if (!club) {
        return responseUtil.notFound(res, "Club not found");
      }

      // Check posting permissions based on club settings
      // Support both old single permission (postPermission) and new array (postPermissions)
      let permissions = club.postPermissions || (club.postPermission ? [club.postPermission === 'ADMIN_ONLY' ? 'ADMIN' : club.postPermission] : ['MEMBERS']);
      const isAdmin = req.user.userType === 'admin';

      // If ANYONE is in permissions, no checks needed
      if (permissions.includes('ANYONE')) {
        // Anyone can post, no restrictions
      } else {
        // Check if user meets any of the permission requirements
        let hasPermission = false;

        // Check if admin and ADMIN permission exists
        if (isAdmin && permissions.includes('ADMIN')) {
          hasPermission = true;
        }

        // Check if member and MEMBERS permission exists
        if (!hasPermission && permissions.includes('MEMBERS')) {
          const isMember = await ClubMember.isMember(authorId, clubId);
          if (isMember) {
            hasPermission = true;
          }
        }

        // If no permission granted, return error
        if (!hasPermission) {
          const allowedRoles = permissions.join(' or ');
          return responseUtil.forbidden(
            res,
            `Only ${allowedRoles.toLowerCase()} can post in this club`
          );
        }
      }
    }

    const isAdmin = req.user.userType === 'admin';
    const postData = {
      authorType: isAdmin ? 'Admin' : 'User',
      author: authorId,
      caption: caption?.trim() || "",
      mediaType,
      mediaUrls,
      mediaThumbnail: mediaThumbnail || null,
      club: clubId || null,
      // General (non-club) posts are public and surface on the Explore feed.
      // Club posts stay scoped to their club.
      isExplorePost: !clubId,
    };

    const post = new Post(postData);
    await post.save();

    // Update user's or admin's post count (only update User postCount, admins don't have this field)
    if (!isAdmin) {
      await User.findByIdAndUpdate(authorId, { $inc: { postCount: 1 } });
    }

    // If post belongs to a club, increment club's post count
    if (clubId) {
      await Club.findByIdAndUpdate(clubId, { $inc: { postCount: 1 } });
    }

    // Populate author and club info for response
    // For User: select name, email
    // For Admin: select name, email (both have these fields)
    await post.populate([
      { path: "author", select: "name email" },
      { path: "club", select: "name thumbnail" },
    ]);

    return responseUtil.created(res, "Post created successfully", {
      post: formatPostResponse(post, { currentUserId: authorId, likedPostIds: new Set() }),
    });
  } catch (error) {
    console.error("[POST] Create post error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(res, "Failed to create post", error.message);
  }
};

/**
 * Get feed (posts from followed users + own posts)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getFeed = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const currentUserId = req.user.id;
    const skip = (page - 1) * limit;

    // Get list of users the current user follows
    const following = await Connect.find({ follower: currentUserId }).select("following");
    const followingIds = following.map((f) => f.following);
    const followingSet = new Set(followingIds.map((id) => id.toString()));

    // Include own posts in the feed
    const authorIds = [currentUserId, ...followingIds];

    // Build query: posts from followed users + own posts, excluding deleted and club posts
    const query = {
      author: { $in: authorIds },
      club: null  // Exclude club posts from main feed
    };

    const [posts, totalCount] = await Promise.all([
      Post.find(query)
        .populate({
          path: "author",
          select: "name email isDeleted",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Post.countDocuments(query),
    ]);

    // Filter out posts with deleted authors (only Users have isDeleted field)
    const validPosts = posts.filter((post) => {
      if (!post.author) return false;
      // If author has isDeleted field (User), check if not deleted
      if ('isDeleted' in post.author) {
        return !post.author.isDeleted;
      }
      // If no isDeleted field (Admin), include the post
      return true;
    });

    // Get like status for all posts
    const postIds = validPosts.map((p) => p._id);
    const likedPostIds = await Like.hasLikedPosts(currentUserId, postIds);

    const postsWithStatus = validPosts.map((post) =>
      formatPostResponse(post, { currentUserId, likedPostIds, followingSet })
    );

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Feed fetched successfully", {
      posts: postsWithStatus,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[POST] Get feed error:", error);
    return responseUtil.internalError(res, "Failed to fetch feed", error.message);
  }
};

/**
 * Get explore feed (all posts, sorted by latest)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getExploreFeed = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const currentUserId = req.user?.id;
    const skip = (page - 1) * limit;

    // Build query: only admin-published explore posts
    const query = { isExplorePost: true };

    const [posts, totalCount] = await Promise.all([
      Post.find(query)
        .populate({
          path: "author",
          select: "name email isDeleted",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Post.countDocuments(query),
    ]);

    // Filter out posts with deleted authors (only Users have isDeleted field)
    const validPosts = posts.filter((post) => {
      if (!post.author) return false;
      // If author has isDeleted field (User), check if not deleted
      if ('isDeleted' in post.author) {
        return !post.author.isDeleted;
      }
      // If no isDeleted field (Admin), include the post
      return true;
    });

    // Get like status and following status for all posts if user is logged in
    let likedPostIds = new Set();
    let followingSet = new Set();
    if (currentUserId) {
      const postIds = validPosts.map((p) => p._id);
      const [likedPosts, followingList] = await Promise.all([
        Like.hasLikedPosts(currentUserId, postIds),
        Connect.find({ follower: currentUserId }).select("following"),
      ]);
      likedPostIds = likedPosts;
      followingSet = new Set(followingList.map((f) => f.following.toString()));
    }

    const postsWithStatus = validPosts.map((post) =>
      formatPostResponse(post, { currentUserId, likedPostIds, followingSet })
    );

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Explore feed fetched successfully", {
      posts: postsWithStatus,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[POST] Get explore feed error:", error);
    return responseUtil.internalError(res, "Failed to fetch explore feed", error.message);
  }
};

/**
 * Get current user's own posts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getMyPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const currentUserId = req.user.id;
    const skip = (page - 1) * limit;

    const query = { author: currentUserId };

    const [posts, totalCount] = await Promise.all([
      Post.find(query)
        .populate("author", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Post.countDocuments(query),
    ]);

    // Get like status for all posts (followingSet not needed - all posts are own)
    const postIds = posts.map((p) => p._id);
    const likedPostIds = await Like.hasLikedPosts(currentUserId, postIds);

    const postsWithStatus = posts.map((post) =>
      formatPostResponse(post, { currentUserId, likedPostIds, followingSet: new Set() })
    );

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Your posts fetched successfully", {
      posts: postsWithStatus,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[POST] Get my posts error:", error);
    return responseUtil.internalError(res, "Failed to fetch your posts", error.message);
  }
};

/**
 * Get posts by a specific user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const currentUserId = req.user?.id;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return responseUtil.notFound(res, "User not found");
    }

    const query = { author: userId };

    const [posts, totalCount] = await Promise.all([
      Post.find(query)
        .populate("author", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Post.countDocuments(query),
    ]);

    // Get like status and following status if user is logged in
    let likedPostIds = new Set();
    let followingSet = new Set();
    if (currentUserId) {
      const postIds = posts.map((p) => p._id);
      // Since all posts are by the same author, we just need to check if following that user
      const [likedPosts, isFollowingAuthor] = await Promise.all([
        Like.hasLikedPosts(currentUserId, postIds),
        currentUserId !== userId ? Connect.isFollowing(currentUserId, userId) : false,
      ]);
      likedPostIds = likedPosts;
      if (isFollowingAuthor) {
        followingSet.add(userId);
      }
    }

    const postsWithStatus = posts.map((post) =>
      formatPostResponse(post, { currentUserId, likedPostIds, followingSet })
    );

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "User posts fetched successfully", {
      posts: postsWithStatus,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[POST] Get user posts error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid user ID");
    }

    return responseUtil.internalError(res, "Failed to fetch user posts", error.message);
  }
};

/**
 * Get single post by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.user?.id;

    const post = await Post.findById(postId).populate({
      path: "author",
      select: "name email isDeleted",
    });

    if (!post) {
      return responseUtil.notFound(res, "Post not found");
    }

    // Check if author is deleted
    if (!post.author || post.author.isDeleted) {
      return responseUtil.notFound(res, "Post not found");
    }

    // Check like status and following status
    let likedPostIds = new Set();
    let followingSet = new Set();
    if (currentUserId) {
      const authorId = post.author._id.toString();
      const [isLiked, isFollowingAuthor] = await Promise.all([
        Like.hasLiked(currentUserId, postId),
        currentUserId !== authorId ? Connect.isFollowing(currentUserId, authorId) : false,
      ]);
      if (isLiked) likedPostIds.add(post._id.toString());
      if (isFollowingAuthor) followingSet.add(authorId);
    }

    return responseUtil.success(res, "Post fetched successfully", {
      post: formatPostResponse(post, { currentUserId, likedPostIds, followingSet }),
    });
  } catch (error) {
    console.error("[POST] Get post by ID error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid post ID");
    }

    return responseUtil.internalError(res, "Failed to fetch post", error.message);
  }
};

/**
 * Delete own post
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.user.id;

    const post = await Post.findById(postId);

    if (!post) {
      return responseUtil.notFound(res, "Post not found");
    }

    // Check ownership
    if (post.author.toString() !== currentUserId) {
      return responseUtil.forbidden(res, "You can only delete your own posts");
    }

    // Soft delete the post
    await post.softDelete();

    // Soft delete all likes for this post
    await Like.softDeleteByPost(postId);

    // Decrement user's post count (ensure it doesn't go below 0)
    await User.findByIdAndUpdate(currentUserId, [
      { $set: { postCount: { $max: [0, { $subtract: ["$postCount", 1] }] } } },
    ]);

    // If post belongs to a club, decrement club's post count
    if (post.club) {
      await Club.findByIdAndUpdate(post.club, [
        { $set: { postCount: { $max: [0, { $subtract: ["$postCount", 1] }] } } },
      ]);
    }

    return responseUtil.success(res, "Post deleted successfully");
  } catch (error) {
    console.error("[POST] Delete post error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid post ID");
    }

    return responseUtil.internalError(res, "Failed to delete post", error.message);
  }
};

/**
 * Like a post
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const post = await Post.findById(postId).populate("author", "isDeleted");

    if (!post) {
      return responseUtil.notFound(res, "Post not found");
    }

    // Check if author is deleted
    if (post.author.isDeleted) {
      return responseUtil.notFound(res, "Post not found");
    }

    // Check if already liked
    const existingLike = await Like.findOne({ user: userId, post: postId });

    if (existingLike) {
      return responseUtil.conflict(res, "You have already liked this post");
    }

    // Create like
    const like = new Like({
      user: userId,
      post: postId,
    });

    await like.save();

    // Increment like count on post
    await post.incrementLikeCount();

    return responseUtil.created(res, "Post liked successfully", {
      likeCount: post.likeCount,
    });
  } catch (error) {
    console.error("[POST] Like post error:", error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, "You have already liked this post");
    }

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid post ID");
    }

    return responseUtil.internalError(res, "Failed to like post", error.message);
  }
};

/**
 * Unlike a post
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const unlikePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const post = await Post.findById(postId);

    if (!post) {
      return responseUtil.notFound(res, "Post not found");
    }

    // Find and delete the like
    const like = await Like.findOneAndDelete({ user: userId, post: postId });

    if (!like) {
      return responseUtil.notFound(res, "You have not liked this post");
    }

    // Decrement like count on post
    await post.decrementLikeCount();

    return responseUtil.success(res, "Post unliked successfully", {
      likeCount: post.likeCount,
    });
  } catch (error) {
    console.error("[POST] Unlike post error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid post ID");
    }

    return responseUtil.internalError(res, "Failed to unlike post", error.message);
  }
};

/**
 * Increment share count for a post
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const sharePost = async (req, res) => {
  try {
    const { postId } = req.params;

    // Check if post exists
    const post = await Post.findById(postId).populate("author", "isDeleted");

    if (!post) {
      return responseUtil.notFound(res, "Post not found");
    }

    // Check if author is deleted
    if (post.author.isDeleted) {
      return responseUtil.notFound(res, "Post not found");
    }

    // Increment share count
    await post.incrementShareCount();

    return responseUtil.success(res, "Share count updated", {
      shareCount: post.shareCount,
      deepLink: `motivata://post/${postId}`,
    });
  } catch (error) {
    console.error("[POST] Share post error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid post ID");
    }

    return responseUtil.internalError(res, "Failed to update share count", error.message);
  }
};

/**
 * Get users who liked a post
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getPostLikers = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user?.id;
    const skip = (page - 1) * limit;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return responseUtil.notFound(res, "Post not found");
    }

    const [likes, totalCount] = await Promise.all([
      Like.find({ post: postId })
        .populate({
          path: "user",
          select: "name email followerCount followingCount postCount",
          match: { isDeleted: false },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Like.countDocuments({ post: postId }),
    ]);

    // Filter out null users (deleted users) and add isFollowing status
    let followingSet = new Set();
    if (currentUserId) {
      const currentUserFollowing = await Connect.find({
        follower: currentUserId,
      }).select("following");
      followingSet = new Set(currentUserFollowing.map((c) => c.following.toString()));
    }

    const likers = likes
      .filter((l) => l.user !== null)
      .map((l) => ({
        id: l.user._id,
        name: l.user.name,
        email: l.user.email,
        followerCount: l.user.followerCount || 0,
        followingCount: l.user.followingCount || 0,
        postCount: l.user.postCount || 0,
        isFollowing: currentUserId ? followingSet.has(l.user._id.toString()) : false,
        likedAt: l.createdAt,
      }));

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Post likers fetched successfully", {
      likers,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        limit: Number(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[POST] Get post likers error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid post ID");
    }

    return responseUtil.internalError(res, "Failed to fetch post likers", error.message);
  }
};

/**
 * Redirect to post deep link (for shared links)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const openPostDeepLink = async (req, res) => {
  try {
    const { postId } = req.params;

    // Check if post exists and is not deleted
    const post = await Post.findById(postId).populate("author", "isDeleted");

    if (!post || (post.author && post.author.isDeleted)) {
      // Redirect to app home if post not found
      return res.redirect("motivata://");
    }

    // Redirect to the post deep link
    return res.redirect(`motivata://post/${postId}`);
  } catch (error) {
    console.error("[POST] Open deep link error:", error);
    // Redirect to app home on error
    return res.redirect("motivata://");
  }
};

/**
 * Resolve the comment author's display name based on their account type.
 */
const resolveCommentAuthorName = async (reqUser) => {
  if (reqUser.userType === "admin") {
    const admin = await Admin.findById(reqUser.id).select("name").lean();
    return admin?.name || "Admin";
  }
  const user = await User.findById(reqUser.id).select("name").lean();
  return user?.name || "User";
};

/**
 * Get all comments for a post (newest first). Public (optional auth).
 * @route GET /api/app/connect/posts/:postId/comments
 */
export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;

    const exists = await Post.exists({ _id: postId });
    if (!exists) {
      return responseUtil.notFound(res, "Post not found");
    }

    const comments = await PostComment.find({ post: postId })
      .sort({ createdAt: -1 })
      .populate({ path: "author", select: "name" })
      .lean();

    const currentUserId = req.user?.id || null;

    // Which of these comments has the viewer liked?
    let likedSet = new Set();
    if (currentUserId && comments.length > 0) {
      const likes = await PostCommentLike.find({
        user: currentUserId,
        comment: { $in: comments.map((c) => c._id) },
      })
        .select("comment")
        .lean();
      likedSet = new Set(likes.map((l) => l.comment.toString()));
    }

    const formatted = comments.map((c) => ({
      _id: c._id,
      post: c.post,
      authorType: c.authorType,
      author: c.author?._id || c.author,
      authorName: c.author?.name || c.authorName || "User",
      text: c.text,
      likeCount: c.likeCount || 0,
      isLiked: likedSet.has(c._id.toString()),
      isOwnComment: currentUserId
        ? (c.author?._id || c.author)?.toString() === currentUserId
        : false,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return responseUtil.success(res, "Comments fetched successfully", {
      comments: formatted,
      totalCount: formatted.length,
    });
  } catch (error) {
    console.error("[POST] Get comments error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid post ID");
    }
    return responseUtil.internalError(res, "Failed to fetch comments", error.message);
  }
};

/**
 * Create a comment on a post. Any authenticated user may comment.
 * @route POST /api/app/connect/posts/:postId/comments
 */
export const createPostComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return responseUtil.badRequest(res, "Comment text is required");
    }

    const post = await Post.findById(postId);
    if (!post) {
      return responseUtil.notFound(res, "Post not found");
    }

    const authorType = req.user.userType === "admin" ? "Admin" : "User";
    const authorName = await resolveCommentAuthorName(req.user);

    const comment = await PostComment.create({
      post: postId,
      authorType,
      author: req.user.id,
      authorName,
      text: text.trim(),
    });

    await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

    return responseUtil.created(res, "Comment posted successfully", {
      comment: {
        _id: comment._id,
        post: postId,
        authorType,
        author: req.user.id,
        authorName,
        text: comment.text,
        isOwnComment: true,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      },
    });
  } catch (error) {
    console.error("[POST] Create comment error:", error);
    if (error.name === "ValidationError") {
      return responseUtil.badRequest(res, error.message);
    }
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid post ID");
    }
    return responseUtil.internalError(res, "Failed to post comment", error.message);
  }
};

/**
 * Delete a comment. Allowed for the comment author or any admin.
 * @route DELETE /api/app/connect/posts/:postId/comments/:commentId
 */
export const deletePostComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const comment = await PostComment.findById(commentId);

    if (!comment || comment.post.toString() !== postId) {
      return responseUtil.notFound(res, "Comment not found");
    }

    const isAdmin = req.user.userType === "admin";
    const isAuthor = comment.author.toString() === req.user.id;

    if (!isAdmin && !isAuthor) {
      return responseUtil.forbidden(res, "You can only delete your own comments");
    }

    await comment.softDelete();
    await Post.findByIdAndUpdate(postId, {
      $inc: { commentCount: -1 },
    });
    // Guard against a negative count.
    await Post.updateOne(
      { _id: postId, commentCount: { $lt: 0 } },
      { $set: { commentCount: 0 } }
    );

    return responseUtil.success(res, "Comment deleted successfully");
  } catch (error) {
    console.error("[POST] Delete comment error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid ID");
    }
    return responseUtil.internalError(res, "Failed to delete comment", error.message);
  }
};

/**
 * Like a post comment (any authenticated user). Idempotent.
 * @route POST /api/app/connect/posts/:postId/comments/:commentId/like
 */
export const likePostComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await PostComment.findById(commentId);
    if (!comment) {
      return responseUtil.notFound(res, "Comment not found");
    }

    try {
      await PostCommentLike.create({ comment: commentId, user: req.user.id });
      comment.likeCount = (comment.likeCount || 0) + 1;
      await comment.save();
    } catch (err) {
      // Duplicate like — already liked; ignore.
      if (err.code !== 11000) throw err;
    }

    return responseUtil.success(res, "Comment liked", {
      likeCount: comment.likeCount,
      isLiked: true,
    });
  } catch (error) {
    console.error("[POST] Like comment error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid comment ID");
    }
    return responseUtil.internalError(res, "Failed to like comment", error.message);
  }
};

/**
 * Unlike a post comment. Idempotent.
 * @route DELETE /api/app/connect/posts/:postId/comments/:commentId/like
 */
export const unlikePostComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await PostComment.findById(commentId);
    if (!comment) {
      return responseUtil.notFound(res, "Comment not found");
    }

    const removed = await PostCommentLike.findOneAndDelete({
      comment: commentId,
      user: req.user.id,
    });
    if (removed) {
      comment.likeCount = Math.max(0, (comment.likeCount || 0) - 1);
      await comment.save();
    }

    return responseUtil.success(res, "Comment unliked", {
      likeCount: comment.likeCount,
      isLiked: false,
    });
  } catch (error) {
    console.error("[POST] Unlike comment error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid comment ID");
    }
    return responseUtil.internalError(res, "Failed to unlike comment", error.message);
  }
};

export default {
  createPost,
  getFeed,
  getExploreFeed,
  getMyPosts,
  getUserPosts,
  getPostById,
  deletePost,
  likePost,
  unlikePost,
  sharePost,
  getPostLikers,
  openPostDeepLink,
  getPostComments,
  createPostComment,
  deletePostComment,
  likePostComment,
  unlikePostComment,
};
