/**
 * @fileoverview Analytics controller for admin dashboard statistics
 * @module controllers/analytics
 */

import User from "../../schema/User.schema.js";
import Admin from "../../schema/Admin.schema.js";
import Event from "../../schema/Event.schema.js";
import EventEnrollment from "../../schema/EventEnrollment.schema.js";
import CashEventEnrollment from "../../schema/CashEventEnrollment.schema.js";
import OfflineCash from "../../schema/OfflineCash.schema.js";
import Payment from "../../schema/Payment.schema.js";
import CommunicationLog from "../../schema/CommunicationLog.schema.js";
import Coupon from "../../schema/Coupon.schema.js";
import Voucher from "../../schema/Voucher.Schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Get date ranges for analytics
 * @returns {Object} Date ranges for different time periods
 */
const getDateRanges = () => {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const last3Months = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const last6Months = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const last12Months = new Date(now.getFullYear(), now.getMonth() - 12, 1);

  return {
    lifetime: {},
    thisMonth: { createdAt: { $gte: startOfThisMonth } },
    lastMonth: {
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    },
    last3Months: { createdAt: { $gte: last3Months } },
    last6Months: { createdAt: { $gte: last6Months } },
    last12Months: { createdAt: { $gte: last12Months } },
  };
};

/**
 * Get communication statistics
 * @param {Object} dateFilter - Date filter object
 * @returns {Promise<Object>} Communication stats
 */
const getCommunicationStats = async (dateFilter) => {
  const totalEmails = await CommunicationLog.countDocuments({
    type: "EMAIL",
    ...dateFilter,
  });

  const successfulEmails = await CommunicationLog.countDocuments({
    type: "EMAIL",
    status: "SUCCESS",
    ...dateFilter,
  });

  const failedEmails = await CommunicationLog.countDocuments({
    type: "EMAIL",
    status: "FAILED",
    ...dateFilter,
  });

  const totalWhatsApp = await CommunicationLog.countDocuments({
    type: "WHATSAPP",
    ...dateFilter,
  });

  const successfulWhatsApp = await CommunicationLog.countDocuments({
    type: "WHATSAPP",
    status: "SUCCESS",
    ...dateFilter,
  });

  const failedWhatsApp = await CommunicationLog.countDocuments({
    type: "WHATSAPP",
    status: "FAILED",
    ...dateFilter,
  });

  return {
    email: {
      total: totalEmails,
      successful: successfulEmails,
      failed: failedEmails,
      successRate:
        totalEmails > 0 ? ((successfulEmails / totalEmails) * 100).toFixed(2) + "%" : "0%",
    },
    whatsapp: {
      total: totalWhatsApp,
      successful: successfulWhatsApp,
      failed: failedWhatsApp,
      successRate:
        totalWhatsApp > 0
          ? ((successfulWhatsApp / totalWhatsApp) * 100).toFixed(2) + "%"
          : "0%",
    },
    totalCommunications: totalEmails + totalWhatsApp,
  };
};

/**
 * Get payment statistics with time breakdown
 * @param {Object} dateFilter - Date filter object
 * @returns {Promise<Object>} Payment stats
 */
const getPaymentStats = async (dateFilter) => {
  const paymentAggregation = await Payment.aggregate([
    { $match: { status: "SUCCESS", ...dateFilter } },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        totalRevenue: { $sum: "$finalAmount" },
        averageOrderValue: { $avg: "$finalAmount" },
        totalDiscount: { $sum: "$discountAmount" },
      },
    },
  ]);

  const stats = paymentAggregation[0] || {
    totalPayments: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    totalDiscount: 0,
  };

  // Get payment method breakdown
  const paymentMethods = await Payment.aggregate([
    { $match: { status: "SUCCESS", ...dateFilter } },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        revenue: { $sum: "$finalAmount" },
      },
    },
  ]);

  // Get coupon usage stats
  const couponUsage = await Payment.aggregate([
    {
      $match: {
        status: "SUCCESS",
        couponCode: { $ne: null },
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: "$couponCode",
        usageCount: { $sum: 1 },
        totalDiscount: { $sum: "$discountAmount" },
      },
    },
    { $sort: { usageCount: -1 } },
    { $limit: 10 },
  ]);

  return {
    totalPayments: stats.totalPayments,
    totalRevenue: stats.totalRevenue,
    averageOrderValue: stats.averageOrderValue
      ? parseFloat(stats.averageOrderValue.toFixed(2))
      : 0,
    totalDiscount: stats.totalDiscount,
    paymentMethods,
    topCoupons: couponUsage,
  };
};

/**
 * Get admin-wise cash ticket statistics
 * @param {Object} dateFilter - Date filter object
 * @returns {Promise<Array>} Admin stats
 */
const getAdminCashTicketStats = async (dateFilter) => {
  const adminStats = await OfflineCash.aggregate([
    { $match: { isDeleted: false, ...dateFilter } },
    {
      $group: {
        _id: "$generatedBy",
        totalTickets: { $sum: "$ticketCount" },
        totalRecords: { $sum: 1 },
        redeemedRecords: {
          $sum: { $cond: [{ $eq: ["$redeemed", true] }, 1, 0] },
        },
        redeemedTickets: {
          $sum: { $cond: [{ $eq: ["$redeemed", true] }, "$ticketCount", 0] },
        },
        totalRevenue: { $sum: "$priceCharged" },
      },
    },
    {
      $lookup: {
        from: "admins",
        localField: "_id",
        foreignField: "_id",
        as: "adminInfo",
      },
    },
    { $unwind: "$adminInfo" },
    {
      $project: {
        adminId: "$_id",
        adminName: "$adminInfo.name",
        adminUsername: "$adminInfo.username",
        adminRole: "$adminInfo.role",
        totalTickets: 1,
        totalRecords: 1,
        redeemedRecords: 1,
        pendingRecords: { $subtract: ["$totalRecords", "$redeemedRecords"] },
        redeemedTickets: 1,
        pendingTickets: { $subtract: ["$totalTickets", "$redeemedTickets"] },
        totalRevenue: 1,
      },
    },
    { $sort: { totalTickets: -1 } },
  ]);

  return adminStats;
};

/**
 * Get event-wise statistics
 * @param {Object} dateFilter - Date filter object
 * @returns {Promise<Array>} Event stats
 */
const getEventStats = async (dateFilter) => {
  // Online payments (Razorpay)
  const onlineStats = await Payment.aggregate([
    { $match: { status: "SUCCESS", type: "EVENT", ...dateFilter } },
    {
      $group: {
        _id: "$eventId",
        onlineTickets: { $sum: { $ifNull: ["$metadata.totalTickets", 1] } },
        onlineRevenue: { $sum: "$finalAmount" },
        onlineOrders: { $sum: 1 },
      },
    },
  ]);

  // Offline cash tickets
  const offlineStats = await OfflineCash.aggregate([
    { $match: { isDeleted: false, redeemed: true, ...dateFilter } },
    {
      $group: {
        _id: "$eventId",
        offlineTickets: { $sum: "$ticketCount" },
        offlineRevenue: { $sum: "$priceCharged" },
        offlineOrders: { $sum: 1 },
      },
    },
  ]);

  // Combine stats
  const statsMap = new Map();

  onlineStats.forEach((stat) => {
    statsMap.set(stat._id.toString(), {
      eventId: stat._id,
      onlineTickets: stat.onlineTickets,
      onlineRevenue: stat.onlineRevenue,
      onlineOrders: stat.onlineOrders,
      offlineTickets: 0,
      offlineRevenue: 0,
      offlineOrders: 0,
    });
  });

  offlineStats.forEach((stat) => {
    const key = stat._id.toString();
    if (statsMap.has(key)) {
      statsMap.get(key).offlineTickets = stat.offlineTickets;
      statsMap.get(key).offlineRevenue = stat.offlineRevenue;
      statsMap.get(key).offlineOrders = stat.offlineOrders;
    } else {
      statsMap.set(key, {
        eventId: stat._id,
        onlineTickets: 0,
        onlineRevenue: 0,
        onlineOrders: 0,
        offlineTickets: stat.offlineTickets,
        offlineRevenue: stat.offlineRevenue,
        offlineOrders: stat.offlineOrders,
      });
    }
  });

  // Get event details
  const eventIds = Array.from(statsMap.keys());
  const events = await Event.find({ _id: { $in: eventIds } }).select(
    "name startDate category mode city"
  );

  const eventMap = new Map(
    events.map((event) => [event._id.toString(), event])
  );

  const result = Array.from(statsMap.values()).map((stat) => {
    const event = eventMap.get(stat.eventId.toString());
    return {
      eventId: stat.eventId,
      eventName: event?.name || "Unknown Event",
      eventDate: event?.startDate || null,
      eventCategory: event?.category || null,
      eventMode: event?.mode || null,
      eventCity: event?.city || null,
      onlineTickets: stat.onlineTickets,
      onlineRevenue: stat.onlineRevenue,
      onlineOrders: stat.onlineOrders,
      offlineTickets: stat.offlineTickets,
      offlineRevenue: stat.offlineRevenue,
      offlineOrders: stat.offlineOrders,
      totalTickets: stat.onlineTickets + stat.offlineTickets,
      totalRevenue: stat.onlineRevenue + stat.offlineRevenue,
      totalOrders: stat.onlineOrders + stat.offlineOrders,
    };
  });

  return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

/**
 * Get comprehensive dashboard statistics
 * @route GET /api/web/analytics/dashboard
 * @access Admin
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 *
 * @returns {Promise<Object>} JSON response with comprehensive analytics
 *
 * @description
 * Returns comprehensive analytics for admin dashboard including:
 * - Communication statistics (Email & WhatsApp) with time breakdown
 * - User and admin counts
 * - Event enrollment statistics
 * - Cash ticket statistics
 * - Payment statistics with revenue breakdown
 * - Event-wise performance metrics
 * - Admin-wise cash ticket performance
 * - Coupon and voucher usage stats
 *
 * All metrics include time-based breakdowns:
 * - Lifetime
 * - This month
 * - Last month
 * - Last 3 months
 * - Last 6 months
 * - Last 12 months
 */
export const getDashboardStats = async (req, res) => {
  try {
    console.log("[ANALYTICS] Fetching dashboard statistics...");

    const dateRanges = getDateRanges();

    // 1. Communication Statistics (with time breakdown)
    console.log("[ANALYTICS] Fetching communication stats...");
    const communicationStats = {};
    for (const [period, filter] of Object.entries(dateRanges)) {
      communicationStats[period] = await getCommunicationStats(filter);
    }

    // 2. User Statistics
    console.log("[ANALYTICS] Fetching user stats...");
    const totalUsers = await User.countDocuments({ isDeleted: false });
    const usersThisMonth = await User.countDocuments({
      isDeleted: false,
      ...dateRanges.thisMonth,
    });
    const usersLastMonth = await User.countDocuments({
      isDeleted: false,
      ...dateRanges.lastMonth,
    });

    // 3. Admin Statistics (role-wise)
    console.log("[ANALYTICS] Fetching admin stats...");
    const adminsByRole = await Admin.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalAdmins = await Admin.countDocuments();
    const activeAdmins = await Admin.countDocuments({ status: "ACTIVATED" });

    // 4. Cash Ticket Statistics (with time breakdown)
    console.log("[ANALYTICS] Fetching cash ticket stats...");
    const cashTicketStats = {};
    for (const [period, filter] of Object.entries(dateRanges)) {
      const totalCashTickets = await OfflineCash.aggregate([
        { $match: { isDeleted: false, ...filter } },
        { $group: { _id: null, totalTickets: { $sum: "$ticketCount" } } },
      ]);

      const redeemedCashTickets = await OfflineCash.aggregate([
        { $match: { isDeleted: false, redeemed: true, ...filter } },
        { $group: { _id: null, redeemedTickets: { $sum: "$ticketCount" } } },
      ]);

      cashTicketStats[period] = {
        totalMinted: totalCashTickets[0]?.totalTickets || 0,
        redeemed: redeemedCashTickets[0]?.redeemedTickets || 0,
        pending:
          (totalCashTickets[0]?.totalTickets || 0) -
          (redeemedCashTickets[0]?.redeemedTickets || 0),
      };
    }

    // 5. Event Enrollment Statistics (with time breakdown)
    console.log("[ANALYTICS] Fetching enrollment stats...");
    const enrollmentStats = {};
    for (const [period, filter] of Object.entries(dateRanges)) {
      const onlineEnrollments = await EventEnrollment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalTickets: { $sum: "$ticketCount" },
          },
        },
      ]);

      const cashEnrollments = await CashEventEnrollment.countDocuments(filter);

      enrollmentStats[period] = {
        onlineEnrollments: onlineEnrollments[0]?.total || 0,
        onlineTickets: onlineEnrollments[0]?.totalTickets || 0,
        cashEnrollments: cashEnrollments,
        totalEnrollments:
          (onlineEnrollments[0]?.total || 0) + cashEnrollments,
      };
    }

    // 6. Payment Statistics (with time breakdown)
    console.log("[ANALYTICS] Fetching payment stats...");
    const paymentStats = {};
    for (const [period, filter] of Object.entries(dateRanges)) {
      paymentStats[period] = await getPaymentStats(filter);
    }

    // 7. Event-wise Statistics
    console.log("[ANALYTICS] Fetching event-wise stats...");
    const eventStatsLifetime = await getEventStats({});
    const eventStatsThisMonth = await getEventStats(dateRanges.thisMonth);

    // 8. Admin-wise Cash Ticket Statistics
    console.log("[ANALYTICS] Fetching admin-wise cash ticket stats...");
    const adminCashTicketStats = await getAdminCashTicketStats({});

    // 9. Event Statistics
    console.log("[ANALYTICS] Fetching event stats...");
    const totalEvents = await Event.countDocuments({ isDeleted: false });
    const liveEvents = await Event.countDocuments({
      isDeleted: false,
      isLive: true,
    });
    const upcomingEvents = await Event.countDocuments({
      isDeleted: false,
      isLive: true,
      startDate: { $gt: new Date() },
    });

    // Event by category
    const eventsByCategory = await Event.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]);

    // Event by mode
    const eventsByMode = await Event.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: "$mode",
          count: { $sum: 1 },
        },
      },
    ]);

    // 10. Coupon Statistics
    console.log("[ANALYTICS] Fetching coupon stats...");
    const totalCoupons = await Coupon.countDocuments({ isDeleted: false });
    const activeCoupons = await Coupon.countDocuments({
      isDeleted: false,
      isActive: true,
    });

    const topCoupons = await Coupon.find({ isDeleted: false })
      .sort({ usageCount: -1 })
      .limit(10)
      .select("code discountValue discountType usageCount usageLimit");

    // 11. Voucher Statistics
    console.log("[ANALYTICS] Fetching voucher stats...");
    const totalVouchers = await Voucher.countDocuments({ isDeleted: false });
    const activeVouchers = await Voucher.countDocuments({
      isDeleted: false,
      isActive: true,
    });

    const voucherStats = await Voucher.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          totalUsage: { $sum: "$usageCount" },
          totalClaimedPhones: { $sum: { $size: "$claimedPhones" } },
        },
      },
    ]);

    // 12. Top performing events (by revenue)
    console.log("[ANALYTICS] Fetching top performing events...");
    const topEventsByRevenue = eventStatsLifetime.slice(0, 10);

    // 13. Recent activity summary
    const recentPayments = await Payment.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const recentEnrollments = await EventEnrollment.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const recentCashTickets = await OfflineCash.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    console.log("[ANALYTICS] Successfully compiled all statistics");

    // Compile response
    const response = {
      communications: communicationStats,
      users: {
        total: totalUsers,
        thisMonth: usersThisMonth,
        lastMonth: usersLastMonth,
        growth:
          usersLastMonth > 0
            ? (((usersThisMonth - usersLastMonth) / usersLastMonth) * 100).toFixed(2) + "%"
            : "N/A",
      },
      admins: {
        total: totalAdmins,
        active: activeAdmins,
        inactive: totalAdmins - activeAdmins,
        byRole: adminsByRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
      cashTickets: cashTicketStats,
      enrollments: enrollmentStats,
      payments: paymentStats,
      events: {
        total: totalEvents,
        live: liveEvents,
        upcoming: upcomingEvents,
        past: totalEvents - liveEvents,
        byCategory: eventsByCategory.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byMode: eventsByMode.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
      eventStats: {
        lifetime: eventStatsLifetime,
        thisMonth: eventStatsThisMonth,
      },
      adminPerformance: adminCashTicketStats,
      coupons: {
        total: totalCoupons,
        active: activeCoupons,
        topCoupons: topCoupons.map((c) => ({
          code: c.code,
          discountValue: c.discountValue,
          discountType: c.discountType,
          usageCount: c.usageCount,
          usageLimit: c.usageLimit,
        })),
      },
      vouchers: {
        total: totalVouchers,
        active: activeVouchers,
        totalUsage: voucherStats[0]?.totalUsage || 0,
        totalClaimedPhones: voucherStats[0]?.totalClaimedPhones || 0,
      },
      topPerformingEvents: topEventsByRevenue,
      recentActivity: {
        last24Hours: {
          payments: recentPayments,
          enrollments: recentEnrollments,
          cashTickets: recentCashTickets,
        },
      },
      generatedAt: new Date(),
    };

    return responseUtil.success(
      res,
      "Dashboard statistics fetched successfully",
      response
    );
  } catch (error) {
    console.error("[ANALYTICS] Error fetching dashboard stats:", error);
    return responseUtil.internalError(
      res,
      "Failed to fetch dashboard statistics",
      error.message
    );
  }
};

/**
 * Get communication logs with filtering
 * @route GET /api/web/analytics/communications
 * @access Admin
 */
export const getCommunicationLogs = async (req, res) => {
  try {
    const {
      type,
      category,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = { isDeleted: false };

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await CommunicationLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("eventId", "name startDate")
      .populate("userId", "name email phone");

    const total = await CommunicationLog.countDocuments(filter);

    return responseUtil.success(res, "Communication logs fetched successfully", {
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[ANALYTICS] Error fetching communication logs:", error);
    return responseUtil.internalError(
      res,
      "Failed to fetch communication logs",
      error.message
    );
  }
};

export default {
  getDashboardStats,
  getCommunicationLogs,
};
