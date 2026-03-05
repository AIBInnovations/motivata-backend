/**
 * @fileoverview Cleanup script for permanently deleting soft-deleted users
 * after the 30-day grace period has expired.
 *
 * Runs on server startup and removes users (and their related data)
 * who were soft-deleted more than 30 days ago.
 */

import User from '../schema/User.schema.js';
import Connect from '../schema/Connect.schema.js';
import Like from '../schema/Like.schema.js';
import Post from '../schema/Post.schema.js';
import ClubMember from '../schema/ClubMember.schema.js';

const GRACE_PERIOD_DAYS = 30;

export const cleanupDeletedUsers = async () => {
  const thirtyDaysAgo = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  console.log('[CLEANUP] Starting cleanup of expired soft-deleted users', {
    cutoffDate: thirtyDaysAgo.toISOString(),
    timestamp: new Date().toISOString()
  });

  const expiredUsers = await User.find({
    isDeleted: true,
    deletedAt: { $lt: thirtyDaysAgo }
  }).setOptions({ includeDeleted: true });

  console.log(`[CLEANUP] Found ${expiredUsers.length} expired soft-deleted users to permanently delete`);

  let successCount = 0;
  let failCount = 0;

  for (const user of expiredUsers) {
    try {
      // Hard-delete related data
      const [connectResult, likeResult, postResult, clubMemberResult] = await Promise.all([
        Connect.deleteMany({ $or: [{ follower: user._id }, { following: user._id }] }),
        Like.deleteMany({ user: user._id }),
        Post.deleteMany({ author: user._id }),
        ClubMember.deleteMany({ user: user._id }),
      ]);

      // Hard-delete the user
      await User.findByIdAndDelete(user._id).setOptions({ includeDeleted: true });

      console.log(`[CLEANUP] Permanently deleted user: ${user._id} (${user.email || user.phone})`, {
        connects: connectResult.deletedCount,
        likes: likeResult.deletedCount,
        posts: postResult.deletedCount,
        clubMembers: clubMemberResult.deletedCount
      });
      successCount++;
    } catch (error) {
      console.error(`[CLEANUP] Failed to delete user ${user._id}:`, error.message);
      failCount++;
    }
  }

  console.log(`[CLEANUP] Cleanup completed`, {
    total: expiredUsers.length,
    success: successCount,
    failed: failCount,
    timestamp: new Date().toISOString()
  });
};
