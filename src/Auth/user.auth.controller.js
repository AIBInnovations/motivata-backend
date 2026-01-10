/**
 * @fileoverview User authentication controller
 * @module controllers/user-auth
 */

import bcrypt from 'bcryptjs';
import User from '../../schema/User.schema.js';
import EventEnrollment from '../../schema/EventEnrollment.schema.js';
import Connect from '../../schema/Connect.schema.js';
import Like from '../../schema/Like.schema.js';
import Post from '../../schema/Post.schema.js';
import UserMembership from '../../schema/UserMembership.schema.js';
import UserServiceSubscription from '../../schema/UserServiceSubscription.schema.js';
import responseUtil from '../../utils/response.util.js';
import { generateTokens, refreshAccessToken } from '../../utils/jwt.util.js';

/**
 * Register a new user
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - User name
 * @param {string} req.body.email - User email
 * @param {string} req.body.phone - User phone
 * @param {string} req.body.password - User password
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with user data and tokens
 */
export const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return responseUtil.conflict(res, 'Email already registered');
      }
      return responseUtil.conflict(res, 'Phone number already registered');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword
    });

    await user.save();

    // Generate tokens
    const tokens = generateTokens({
      id: user._id.toString(),
      email: user.email,
      phone: user.phone,
      userType: 'user'
    });

    // Save refresh token to database
    user.refreshToken = tokens.refreshToken;
    user.lastLogin = new Date();
    await user.save();

    // Remove sensitive data
    const userData = user.toObject();
    delete userData.password;
    delete userData.refreshToken;
    delete userData.isDeleted;
    delete userData.deletedAt;

    return responseUtil.created(res, 'User registered successfully', {
      user: userData,
      tokens
    });
  } catch (error) {
    console.error('User registration error:', error);
    return responseUtil.internalError(res, 'Registration failed', error.message);
  }
};

/**
 * User login with email
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User email
 * @param {string} req.body.password - User password
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with user data and tokens
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user (excluding soft deleted)
    const user = await User.findOne({ email, isDeleted: false });

    if (!user) {
      return responseUtil.unauthorized(res, 'Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return responseUtil.unauthorized(res, 'Invalid email or password');
    }

    // Generate tokens
    const tokens = generateTokens({
      id: user._id.toString(),
      email: user.email,
      phone: user.phone,
      userType: 'user'
    });

    // Update refresh token and last login
    user.refreshToken = tokens.refreshToken;
    user.lastLogin = new Date();
    await user.save();

    // Remove sensitive data
    const userData = user.toObject();
    delete userData.password;
    delete userData.refreshToken;
    delete userData.isDeleted;
    delete userData.deletedAt;

    return responseUtil.success(res, 'Login successful', {
      user: userData,
      tokens
    });
  } catch (error) {
    console.error('User login error:', error);
    return responseUtil.internalError(res, 'Login failed', error.message);
  }
};

/**
 * User login with phone
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.phone - User phone number
 * @param {string} req.body.password - User password
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with user data and tokens
 */
export const loginWithPhone = async (req, res) => {
  const startTime = Date.now();
  try {
    const { phone, password } = req.body;
    console.log('[LOGIN-PHONE] Login attempt initiated', {
      phone,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Find user (excluding soft deleted)
    console.log('[LOGIN-PHONE] Querying database for user with phone:', phone);
    const user = await User.findOne({ phone, isDeleted: false });

    if (!user) {
      console.log('[LOGIN-PHONE] User not found', {
        phone,
        reason: 'No matching user or user is soft deleted',
        duration: `${Date.now() - startTime}ms`
      });
      return responseUtil.unauthorized(res, 'Invalid phone number or password');
    }

    console.log('[LOGIN-PHONE] User found successfully', {
      userId: user._id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      isDeleted: user.isDeleted,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    });

    // Verify password
    console.log('[LOGIN-PHONE] Starting password verification for user:', user._id);
    const passwordStartTime = Date.now();
    const isPasswordValid = await bcrypt.compare(password, user.password);
    const passwordDuration = Date.now() - passwordStartTime;

    console.log('[LOGIN-PHONE] Password verification completed', {
      userId: user._id,
      isValid: isPasswordValid,
      duration: `${passwordDuration}ms`
    });

    if (!isPasswordValid) {
      console.log('[LOGIN-PHONE] Authentication failed - Invalid password', {
        userId: user._id,
        phone,
        totalDuration: `${Date.now() - startTime}ms`
      });
      return responseUtil.unauthorized(res, 'Invalid phone number or password');
    }

    // Generate tokens
    console.log('[LOGIN-PHONE] Generating authentication tokens for user:', user._id);
    const tokens = generateTokens({
      id: user._id.toString(),
      email: user.email,
      phone: user.phone,
      userType: 'user'
    });
    console.log('[LOGIN-PHONE] Tokens generated successfully', {
      userId: user._id,
      tokenTypes: Object.keys(tokens)
    });

    // Update refresh token and last login
    console.log('[LOGIN-PHONE] Updating user refresh token and last login timestamp', {
      userId: user._id
    });
    user.refreshToken = tokens.refreshToken;
    user.lastLogin = new Date();
    await user.save();
    console.log('[LOGIN-PHONE] User document updated successfully', {
      userId: user._id,
      lastLogin: user.lastLogin
    });

    // Remove sensitive data
    const userData = user.toObject();
    delete userData.password;
    delete userData.refreshToken;
    delete userData.isDeleted;
    delete userData.deletedAt;

    const totalDuration = Date.now() - startTime;
    console.log('[LOGIN-PHONE] Login successful', {
      userId: user._id,
      phone,
      email: user.email,
      totalDuration: `${totalDuration}ms`,
      timestamp: new Date().toISOString()
    });

    return responseUtil.success(res, 'Login successful', {
      user: userData,
      tokens
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('[LOGIN-PHONE] Login failed with error', {
      error: error.message,
      stack: error.stack,
      phone: req.body?.phone,
      duration: `${totalDuration}ms`,
      timestamp: new Date().toISOString()
    });
    return responseUtil.internalError(res, 'Login failed', error.message);
  }
};

/**
 * Check if phone number exists
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.phone - User phone number
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response indicating if phone exists
 */
export const checkPhoneExists = async (req, res) => {
  const startTime = Date.now();
  try {
    const { phone } = req.body;
    console.log('[CHECK-PHONE] Phone existence check initiated', {
      phone,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Check if phone exists (excluding soft deleted users)
    console.log('[CHECK-PHONE] Querying database for phone:', phone);
    const queryStartTime = Date.now();
    const user = await User.findOne({ phone, isDeleted: false });
    const queryDuration = Date.now() - queryStartTime;

    const exists = !!user;

    if (user) {
      console.log('[CHECK-PHONE] Phone number found in database', {
        phone,
        userId: user._id,
        email: user.email,
        name: user.name,
        registeredAt: user.createdAt,
        queryDuration: `${queryDuration}ms`
      });
    } else {
      console.log('[CHECK-PHONE] Phone number not found in database', {
        phone,
        queryDuration: `${queryDuration}ms`
      });
    }

    const totalDuration = Date.now() - startTime;
    console.log('[CHECK-PHONE] Phone check completed', {
      phone,
      exists,
      totalDuration: `${totalDuration}ms`,
      timestamp: new Date().toISOString()
    });

    return responseUtil.success(res, 'Phone check completed', {
      exists,
      phone
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('[CHECK-PHONE] Phone check failed with error', {
      error: error.message,
      stack: error.stack,
      phone: req.body?.phone,
      duration: `${totalDuration}ms`,
      timestamp: new Date().toISOString()
    });
    return responseUtil.internalError(res, 'Failed to check phone', error.message);
  }
};

/**
 * Refresh access token
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.refreshToken - Refresh token
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with new access token
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Generate new access token
    const result = refreshAccessToken(refreshToken);

    if (!result) {
      return responseUtil.unauthorized(res, 'Invalid or expired refresh token');
    }

    // Verify refresh token exists in database
    const user = await User.findOne({ refreshToken, isDeleted: false });

    if (!user) {
      return responseUtil.unauthorized(res, 'Invalid refresh token');
    }

    return responseUtil.success(res, 'Token refreshed successfully', result);
  } catch (error) {
    console.error('Token refresh error:', error);
    return responseUtil.internalError(res, 'Token refresh failed', error.message);
  }
};

/**
 * User logout
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response message
 */
export const logout = async (req, res) => {
  try {
    // Remove refresh token
    await User.findByIdAndUpdate(req.user.id, {
      refreshToken: null
    });

    return responseUtil.success(res, 'Logged out successfully');
  } catch (error) {
    console.error('User logout error:', error);
    return responseUtil.internalError(res, 'Logout failed', error.message);
  }
};

/**
 * Get user profile with all enrollments
 * Includes enrollments where user is the buyer (owner) OR where someone else bought a ticket for them
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with user profile and enrollments
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('-password -refreshToken -isDeleted -deletedAt');

    if (!user) {
      return responseUtil.notFound(res, 'User not found');
    }

    // Fetch all enrollments where:
    // 1. User is the owner (buyer) - userId matches
    // 2. User's phone is a key in the tickets Map (someone bought ticket for them)
    const [enrollments, memberships, serviceSubscriptions] = await Promise.all([
      EventEnrollment.find({
        $or: [
          { userId: userId },
          { [`tickets.${user.phone}`]: { $exists: true } }
        ]
      })
        .populate('eventId', 'name description startDate endDate bookingStartDate bookingEndDate mode city price compareAtPrice imageUrls thumbnail location category')
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 }),
      // Fetch only active memberships (with successful payment) for this user's phone
      UserMembership.find({
        phone: user.phone.slice(-10),
        isDeleted: false,
        paymentStatus: 'SUCCESS'
      })
        .populate('membershipPlanId')
        .sort({ createdAt: -1 }),
      // Fetch all service subscriptions for this user's phone (including expired)
      UserServiceSubscription.find({
        phone: user.phone.slice(-10),
      })
        .populate('serviceId', 'name description category perks imageUrl')
        .sort({ createdAt: -1 })
    ]);

    // Enrich enrollments with relationship and myTicket info
    const enrichedEnrollments = enrollments
      .filter(enrollment => enrollment.userId !== null) // Filter out enrollments with deleted users
      .map(enrollment => {
        const isOwner = enrollment.userId._id.toString() === userId;
        const enrollmentObj = enrollment.toObject();
        const myTicket = enrollment.tickets.get(user.phone) || null;

        return {
          ...enrollmentObj,
          relationship: isOwner ? 'OWNER' : 'TICKET_HOLDER',
          myTicket: myTicket ? {
            phone: user.phone,
            status: myTicket.status,
            isTicketScanned: myTicket.isTicketScanned,
            ticketScannedAt: myTicket.ticketScannedAt
          } : null,
          // Include all tickets only if user is the owner
          tickets: isOwner ? enrollmentObj.tickets : undefined
        };
      });

    // Transform memberships to include only user-needed data
    const enrichedMemberships = memberships.map(membership => {
      const membershipObj = membership.toObject();
      return {
        _id: membershipObj._id,
        planName: membershipObj.planSnapshot?.name || membershipObj.membershipPlanId?.name,
        planDescription: membershipObj.planSnapshot?.description || membershipObj.membershipPlanId?.description,
        perks: membershipObj.planSnapshot?.perks || membershipObj.membershipPlanId?.perks || [],
        startDate: membershipObj.startDate,
        endDate: membershipObj.endDate,
        status: membership.getCurrentStatus(),
        daysRemaining: membershipObj.daysRemaining,
        isCurrentlyActive: membershipObj.isCurrentlyActive,
        amountPaid: membershipObj.amountPaid,
        purchasedAt: membershipObj.createdAt
      };
    });

    // Transform service subscriptions to include only user-needed data
    const enrichedServiceSubscriptions = serviceSubscriptions.map(subscription => {
      const subObj = subscription.toObject();
      return {
        _id: subObj._id,
        serviceName: subObj.serviceId?.name,
        serviceDescription: subObj.serviceId?.description,
        serviceCategory: subObj.serviceId?.category,
        perks: subObj.serviceId?.perks || [],
        imageUrl: subObj.serviceId?.imageUrl,
        startDate: subObj.startDate,
        endDate: subObj.endDate,
        status: subObj.status,
        isCurrentlyActive: subscription.isCurrentlyActive(),
        daysRemaining: subObj.endDate
          ? Math.max(0, Math.ceil((new Date(subObj.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
          : null, // null for lifetime subscriptions
        amountPaid: subObj.amountPaid,
        purchasedAt: subObj.createdAt
      };
    });

    return responseUtil.success(res, 'Profile retrieved successfully', {
      user,
      enrollments: enrichedEnrollments,
      memberships: enrichedMemberships,
      serviceSubscriptions: enrichedServiceSubscriptions
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return responseUtil.internalError(res, 'Failed to get profile', error.message);
  }
};

/**
 * Update user profile
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.body - Update data
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with updated user profile
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Check if email or phone already exists
    if (email || phone) {
      const existingUser = await User.findOne({
        _id: { $ne: req.user.id },
        isDeleted: false,
        $or: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : [])
        ]
      });

      if (existingUser) {
        if (existingUser.email === email) {
          return responseUtil.conflict(res, 'Email already in use');
        }
        return responseUtil.conflict(res, 'Phone number already in use');
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email, phone },
      { new: true, runValidators: true }
    ).select('-password -refreshToken -isDeleted -deletedAt');

    if (!user) {
      return responseUtil.notFound(res, 'User not found');
    }

    return responseUtil.success(res, 'Profile updated successfully', { user });
  } catch (error) {
    console.error('Update profile error:', error);
    return responseUtil.internalError(res, 'Failed to update profile', error.message);
  }
};

/**
 * Change user password
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.body - Request body
 * @param {string} req.body.currentPassword - Current password
 * @param {string} req.body.newPassword - New password
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response message
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return responseUtil.notFound(res, 'User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return responseUtil.unauthorized(res, 'Current password is incorrect');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.refreshToken = null; // Invalidate refresh token
    await user.save();

    return responseUtil.success(res, 'Password changed successfully');
  } catch (error) {
    console.error('Change password error:', error);
    return responseUtil.internalError(res, 'Failed to change password', error.message);
  }
};

/**
 * Delete user account (soft delete)
 * Also soft deletes all Connect-related data (follows, likes, posts)
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response message
 */
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return responseUtil.notFound(res, 'User not found');
    }

    // Soft delete all Connect-related data in parallel
    await Promise.all([
      // Soft delete the user
      user.softDelete(),
      // Soft delete all follow relationships (both followers and following)
      Connect.softDeleteByUser(userId),
      // Soft delete all likes by this user
      Like.softDeleteByUser(userId),
      // Soft delete all posts by this user
      Post.updateMany(
        { author: userId },
        { isDeleted: true, deletedAt: new Date() }
      ),
    ]);

    return responseUtil.success(res, 'Account deleted successfully');
  } catch (error) {
    console.error('Delete account error:', error);
    return responseUtil.internalError(res, 'Failed to delete account', error.message);
  }
};

// Admin-only user management endpoints

/**
 * Get all users (Admin only)
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {boolean} [req.query.includeDeleted=false] - Include soft deleted users
 * @param {string} [req.query.search] - Search term
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with users list
 */
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      includeDeleted = false,
      search
    } = req.query;

    const query = {};

    // Include deleted users if requested
    if (includeDeleted !== 'true') {
      query.isDeleted = false;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -refreshToken')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .setOptions({ includeDeleted: includeDeleted === 'true' }),
      User.countDocuments(query).setOptions({ includeDeleted: includeDeleted === 'true' })
    ]);

    return responseUtil.success(res, 'Users retrieved successfully', {
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    return responseUtil.internalError(res, 'Failed to get users', error.message);
  }
};

/**
 * Get user by ID (Admin only)
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.id - User ID
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with user data
 */
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -refreshToken')
      .setOptions({ includeDeleted: true });

    if (!user) {
      return responseUtil.notFound(res, 'User not found');
    }

    return responseUtil.success(res, 'User retrieved successfully', { user });
  } catch (error) {
    console.error('Get user by ID error:', error);
    return responseUtil.internalError(res, 'Failed to get user', error.message);
  }
};

/**
 * Update user by ID (Admin only)
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.id - User ID
 * @param {Object} req.body - Update data
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with updated user
 */
export const updateUserById = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Check if email or phone already exists
    if (email || phone) {
      const existingUser = await User.findOne({
        _id: { $ne: req.params.id },
        isDeleted: false,
        $or: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : [])
        ]
      });

      if (existingUser) {
        if (existingUser.email === email) {
          return responseUtil.conflict(res, 'Email already in use');
        }
        return responseUtil.conflict(res, 'Phone number already in use');
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phone },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!user) {
      return responseUtil.notFound(res, 'User not found');
    }

    return responseUtil.success(res, 'User updated successfully', { user });
  } catch (error) {
    console.error('Update user error:', error);
    return responseUtil.internalError(res, 'Failed to update user', error.message);
  }
};

/**
 * Soft delete user by ID (Admin only)
 * Also soft deletes all Connect-related data (follows, likes, posts)
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.id - User ID
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response message
 */
export const deleteUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return responseUtil.notFound(res, 'User not found');
    }

    if (user.isDeleted) {
      return responseUtil.badRequest(res, 'User already deleted');
    }

    // Soft delete all Connect-related data in parallel
    await Promise.all([
      // Soft delete the user
      user.softDelete(),
      // Soft delete all follow relationships (both followers and following)
      Connect.softDeleteByUser(userId),
      // Soft delete all likes by this user
      Like.softDeleteByUser(userId),
      // Soft delete all posts by this user
      Post.updateMany(
        { author: userId },
        { isDeleted: true, deletedAt: new Date() }
      ),
    ]);

    return responseUtil.success(res, 'User deleted successfully');
  } catch (error) {
    console.error('Delete user error:', error);
    return responseUtil.internalError(res, 'Failed to delete user', error.message);
  }
};

/**
 * Restore soft deleted user (Admin only)
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.id - User ID
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with restored user
 */
export const restoreUser = async (req, res) => {
  try {
    const user = await User.restore(req.params.id);

    if (!user) {
      return responseUtil.notFound(res, 'User not found or not deleted');
    }

    const userData = user.toObject();
    delete userData.password;
    delete userData.refreshToken;

    return responseUtil.success(res, 'User restored successfully', { user: userData });
  } catch (error) {
    console.error('Restore user error:', error);
    return responseUtil.internalError(res, 'Failed to restore user', error.message);
  }
};

/**
 * Permanently delete user (Admin only)
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.id - User ID
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response message
 */
export const permanentDeleteUser = async (req, res) => {
  try {
    const user = await User.permanentDelete(req.params.id);

    if (!user) {
      return responseUtil.notFound(res, 'User not found or not soft deleted');
    }

    return responseUtil.success(res, 'User permanently deleted');
  } catch (error) {
    console.error('Permanent delete user error:', error);
    return responseUtil.internalError(res, 'Failed to permanently delete user', error.message);
  }
};

export default {
  register,
  login,
  loginWithPhone,
  checkPhoneExists,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  restoreUser,
  permanentDeleteUser
};