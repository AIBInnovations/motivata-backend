/**
 * @fileoverview Admin authentication controller
 * @module controllers/admin-auth
 */

import bcrypt from 'bcryptjs';
import Admin from '../../schema/Admin.schema.js';
import responseUtil from '../../utils/response.util.js';
import { generateTokens, refreshAccessToken } from '../../utils/jwt.util.js';

/**
 * Register a new admin
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Admin name
 * @param {string} req.body.email - Admin email
 * @param {string} req.body.phone - Admin phone
 * @param {string} req.body.password - Admin password
 * @param {string} [req.body.role] - Admin role
 * @param {string[]} [req.body.access] - Admin access permissions
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with admin data and tokens
 */
export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role, access } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingAdmin) {
      if (existingAdmin.email === email) {
        return responseUtil.conflict(res, 'Email already registered');
      }
      return responseUtil.conflict(res, 'Phone number already registered');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new admin
    const admin = new Admin({
      name,
      email,
      phone,
      password: hashedPassword,
      role: role || 'MANAGEMENT_STAFF',
      access: access || []
    });

    await admin.save();

    // Generate tokens
    const tokens = generateTokens({
      id: admin._id.toString(),
      email: admin.email,
      role: admin.role,
      userType: 'admin'
    });

    // Save refresh token to database
    admin.refreshToken = tokens.refreshToken;
    admin.lastLogin = new Date();
    await admin.save();

    // Remove sensitive data
    const adminData = admin.toObject();
    delete adminData.password;
    delete adminData.refreshToken;

    return responseUtil.created(res, 'Admin registered successfully', {
      admin: adminData,
      tokens
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    return responseUtil.internalError(res, 'Registration failed', error.message);
  }
};

/**
 * Admin login
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - Admin email
 * @param {string} req.body.password - Admin password
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with admin data and tokens
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return responseUtil.unauthorized(res, 'Invalid email or password');
    }

    // Check if admin is activated
    if (admin.status === 'DEACTIVATED') {
      return responseUtil.forbidden(res, 'Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return responseUtil.unauthorized(res, 'Invalid email or password');
    }

    // Generate tokens
    const tokens = generateTokens({
      id: admin._id.toString(),
      email: admin.email,
      role: admin.role,
      access: admin.access,
      userType: 'admin'
    });

    // Update refresh token and last login
    admin.refreshToken = tokens.refreshToken;
    admin.lastLogin = new Date();
    await admin.save();

    // Remove sensitive data
    const adminData = admin.toObject();
    delete adminData.password;
    delete adminData.refreshToken;

    return responseUtil.success(res, 'Login successful', {
      admin: adminData,
      tokens
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return responseUtil.internalError(res, 'Login failed', error.message);
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
    const admin = await Admin.findOne({ refreshToken });

    if (!admin) {
      return responseUtil.unauthorized(res, 'Invalid refresh token');
    }

    if (admin.status === 'DEACTIVATED') {
      return responseUtil.forbidden(res, 'Account is deactivated');
    }

    return responseUtil.success(res, 'Token refreshed successfully', result);
  } catch (error) {
    console.error('Token refresh error:', error);
    return responseUtil.internalError(res, 'Token refresh failed', error.message);
  }
};

/**
 * Admin logout
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response message
 */
export const logout = async (req, res) => {
  try {
    // Remove refresh token
    await Admin.findByIdAndUpdate(req.user.id, {
      refreshToken: null
    });

    return responseUtil.success(res, 'Logged out successfully');
  } catch (error) {
    console.error('Admin logout error:', error);
    return responseUtil.internalError(res, 'Logout failed', error.message);
  }
};

/**
 * Get admin profile
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with admin profile
 */
export const getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password -refreshToken');

    if (!admin) {
      return responseUtil.notFound(res, 'Admin not found');
    }

    return responseUtil.success(res, 'Profile retrieved successfully', { admin });
  } catch (error) {
    console.error('Get profile error:', error);
    return responseUtil.internalError(res, 'Failed to get profile', error.message);
  }
};

/**
 * Update admin profile
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.body - Update data
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with updated admin profile
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Check if email or phone already exists
    if (email || phone) {
      const existingAdmin = await Admin.findOne({
        _id: { $ne: req.user.id },
        $or: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : [])
        ]
      });

      if (existingAdmin) {
        if (existingAdmin.email === email) {
          return responseUtil.conflict(res, 'Email already in use');
        }
        return responseUtil.conflict(res, 'Phone number already in use');
      }
    }

    const admin = await Admin.findByIdAndUpdate(
      req.user.id,
      { name, email, phone },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!admin) {
      return responseUtil.notFound(res, 'Admin not found');
    }

    return responseUtil.success(res, 'Profile updated successfully', { admin });
  } catch (error) {
    console.error('Update profile error:', error);
    return responseUtil.internalError(res, 'Failed to update profile', error.message);
  }
};

/**
 * Change admin password
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

    const admin = await Admin.findById(req.user.id);

    if (!admin) {
      return responseUtil.notFound(res, 'Admin not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, admin.password);

    if (!isPasswordValid) {
      return responseUtil.unauthorized(res, 'Current password is incorrect');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    admin.password = hashedPassword;
    admin.refreshToken = null; // Invalidate refresh token
    await admin.save();

    return responseUtil.success(res, 'Password changed successfully');
  } catch (error) {
    console.error('Change password error:', error);
    return responseUtil.internalError(res, 'Failed to change password', error.message);
  }
};

/**
 * Get all admins (Super Admin only)
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {string} [req.query.status] - Filter by status
 * @param {string} [req.query.role] - Filter by role
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with admins list
 */
export const getAllAdmins = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      role,
      search
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [admins, total] = await Promise.all([
      Admin.find(query)
        .select('-password -refreshToken')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Admin.countDocuments(query)
    ]);

    return responseUtil.success(res, 'Admins retrieved successfully', {
      admins,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all admins error:', error);
    return responseUtil.internalError(res, 'Failed to get admins', error.message);
  }
};

/**
 * Get admin by ID (Super Admin only)
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.id - Admin ID
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with admin data
 */
export const getAdminById = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id).select('-password -refreshToken');

    if (!admin) {
      return responseUtil.notFound(res, 'Admin not found');
    }

    return responseUtil.success(res, 'Admin retrieved successfully', { admin });
  } catch (error) {
    console.error('Get admin by ID error:', error);
    return responseUtil.internalError(res, 'Failed to get admin', error.message);
  }
};

/**
 * Update admin by ID (Super Admin only)
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.id - Admin ID
 * @param {Object} req.body - Update data
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response with updated admin
 */
export const updateAdminById = async (req, res) => {
  try {
    const { name, email, phone, role, access, status } = req.body;

    // Check if email or phone already exists
    if (email || phone) {
      const existingAdmin = await Admin.findOne({
        _id: { $ne: req.params.id },
        $or: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : [])
        ]
      });

      if (existingAdmin) {
        if (existingAdmin.email === email) {
          return responseUtil.conflict(res, 'Email already in use');
        }
        return responseUtil.conflict(res, 'Phone number already in use');
      }
    }

    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, role, access, status },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!admin) {
      return responseUtil.notFound(res, 'Admin not found');
    }

    return responseUtil.success(res, 'Admin updated successfully', { admin });
  } catch (error) {
    console.error('Update admin error:', error);
    return responseUtil.internalError(res, 'Failed to update admin', error.message);
  }
};

/**
 * Delete admin by ID (Super Admin only)
 * @async
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.id - Admin ID
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Response message
 */
export const deleteAdminById = async (req, res) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user.id) {
      return responseUtil.badRequest(res, 'Cannot delete your own account');
    }

    const admin = await Admin.findByIdAndDelete(req.params.id);

    if (!admin) {
      return responseUtil.notFound(res, 'Admin not found');
    }

    return responseUtil.success(res, 'Admin deleted successfully');
  } catch (error) {
    console.error('Delete admin error:', error);
    return responseUtil.internalError(res, 'Failed to delete admin', error.message);
  }
};

export default {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  getAllAdmins,
  getAdminById,
  updateAdminById,
  deleteAdminById
};