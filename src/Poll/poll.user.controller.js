/**
 * @fileoverview User Poll Controller
 * @module Poll/user.controller
 */

import Poll from "../../schema/Poll.schema.js";
import PollSubmission from "../../schema/PollSubmission.schema.js";
import EventEnrollment from "../../schema/EventEnrollment.schema.js";
import CashEventEnrollment from "../../schema/CashEventEnrollment.schema.js";
import User from "../../schema/User.schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Helper function to normalize phone number to 10 digits
 */
const normalizePhone = (phone) => {
  if (!phone) return null;
  // Remove all non-digit characters and get last 10 digits
  return phone.replace(/\D/g, "").slice(-10);
};

/**
 * Helper function to get all phone variations for searching
 */
const getPhoneVariations = (phone) => {
  if (!phone) return [];
  const normalized = normalizePhone(phone);
  if (!normalized) return [];

  return [
    normalized,                    // 9179621765
    `+91${normalized}`,           // +919179621765
    `91${normalized}`,            // 919179621765
    phone,                         // original format
    phone.replace(/^\+/, ""),     // without leading +
  ];
};

/**
 * Helper function to check if user is enrolled in an event
 * Checks:
 * 1. Direct EventEnrollment by userId
 * 2. EventEnrollment tickets Map by phone
 * 3. CashEventEnrollment by userId
 * 4. CashEventEnrollment by phone
 */
const checkUserEnrollment = async (eventId, userId) => {
  // 1. Check direct EventEnrollment by userId
  const directEnrollment = await EventEnrollment.findOne({ eventId, userId });
  if (directEnrollment) {
    return true;
  }

  // 2. Check CashEventEnrollment by userId
  const cashEnrollmentByUser = await CashEventEnrollment.findOne({
    eventId,
    userId,
    status: "ACTIVE"
  });
  if (cashEnrollmentByUser) {
    return true;
  }

  // Get user's phone number for phone-based checks
  const user = await User.findById(userId).select("phone");
  if (!user || !user.phone) {
    return false;
  }

  const phoneVariations = getPhoneVariations(user.phone);
  const normalizedPhone = normalizePhone(user.phone);

  // 3. Check if user's phone exists in any EventEnrollment's tickets Map
  const ticketEnrollment = await EventEnrollment.findOne({
    eventId,
    $or: phoneVariations.map((p) => ({
      [`tickets.${p}`]: { $exists: true },
    })),
  });
  if (ticketEnrollment) {
    return true;
  }

  // 4. Check CashEventEnrollment by phone (uses 10-digit format)
  const cashEnrollmentByPhone = await CashEventEnrollment.findOne({
    eventId,
    phone: normalizedPhone,
    status: "ACTIVE"
  });
  if (cashEnrollmentByPhone) {
    return true;
  }

  return false;
};

/**
 * Helper function to calculate poll statistics
 */
const calculatePollStats = async (pollId, poll) => {
  const totalSubmissions = await PollSubmission.countDocuments({ pollId });

  const statsAggregation = await PollSubmission.aggregate([
    { $match: { pollId: poll._id } },
    { $unwind: "$answers" },
    {
      $group: {
        _id: {
          questionIndex: "$answers.questionIndex",
          selectedOptionIndex: "$answers.selectedOptionIndex",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.questionIndex": 1, "_id.selectedOptionIndex": 1 } },
  ]);

  const questions = poll.questions.map((question, questionIndex) => {
    const options = question.options.map((_, optionIndex) => {
      const stat = statsAggregation.find(
        (s) =>
          s._id.questionIndex === questionIndex &&
          s._id.selectedOptionIndex === optionIndex
      );
      const count = stat ? stat.count : 0;
      const percentage =
        totalSubmissions > 0
          ? Math.round((count / totalSubmissions) * 10000) / 100
          : 0;

      return {
        optionIndex,
        percentage,
      };
    });

    return {
      questionIndex,
      options,
    };
  });

  return {
    totalSubmissions,
    questions,
  };
};

/**
 * Get poll for an event (user must be enrolled)
 * GET /api/app/polls/event/:eventId
 */
export const getPollByEventId = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Check if user is enrolled in this event (direct or via ticket)
    const isEnrolled = await checkUserEnrollment(eventId, userId);

    if (!isEnrolled) {
      return responseUtil.forbidden(
        res,
        "You must be enrolled in this event to view the poll"
      );
    }

    // Get poll for this event
    const poll = await Poll.findOne({ eventId, isActive: true });
    if (!poll) {
      return responseUtil.notFound(res, "No poll available for this event");
    }

    // Check if user has already submitted
    const existingSubmission = await PollSubmission.findOne({
      pollId: poll._id,
      userId,
    });

    const responseData = {
      _id: poll._id,
      eventId: poll.eventId,
      questions: poll.questions,
      hasSubmitted: !!existingSubmission,
      submission: null,
      stats: null,
    };

    // If user has submitted, include their answers and stats
    if (existingSubmission) {
      responseData.submission = {
        answers: existingSubmission.answers,
        submittedAt: existingSubmission.createdAt,
      };
      responseData.stats = await calculatePollStats(poll._id, poll);
    }

    return responseUtil.success(res, "Poll fetched successfully", responseData);
  } catch (error) {
    console.error("Get poll error:", error);
    return responseUtil.internalError(res, "Failed to fetch poll", error.message);
  }
};

/**
 * Submit poll answers
 * POST /api/app/polls/:pollId/submit
 */
export const submitPoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { answers } = req.body;
    const userId = req.user.id;

    // Get poll
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return responseUtil.notFound(res, "Poll not found");
    }

    // Check if poll is active
    if (!poll.isActive) {
      return responseUtil.badRequest(
        res,
        "This poll is no longer accepting submissions"
      );
    }

    // Check if user is enrolled in this event (direct or via ticket)
    const isEnrolled = await checkUserEnrollment(poll.eventId, userId);

    if (!isEnrolled) {
      return responseUtil.forbidden(
        res,
        "You must be enrolled in this event to submit the poll"
      );
    }

    // Check if user has already submitted
    const existingSubmission = await PollSubmission.findOne({ pollId, userId });
    if (existingSubmission) {
      return responseUtil.badRequest(res, "You have already submitted this poll");
    }

    // Validate answers
    for (const answer of answers) {
      if (answer.questionIndex >= poll.questions.length) {
        return responseUtil.badRequest(
          res,
          `Invalid answer: question index ${answer.questionIndex} does not exist`
        );
      }
      const question = poll.questions[answer.questionIndex];
      if (answer.selectedOptionIndex >= question.options.length) {
        return responseUtil.badRequest(
          res,
          `Invalid answer: option index ${answer.selectedOptionIndex} does not exist for question ${answer.questionIndex}`
        );
      }
    }

    // Create submission
    const submission = new PollSubmission({
      pollId,
      eventId: poll.eventId,
      userId,
      answers,
    });

    await submission.save();

    // Calculate and return stats
    const stats = await calculatePollStats(poll._id, poll);

    return responseUtil.created(res, "Poll submitted successfully", {
      submission: {
        _id: submission._id,
        pollId: submission.pollId,
        eventId: submission.eventId,
        userId: submission.userId,
        answers: submission.answers,
        createdAt: submission.createdAt,
      },
      stats,
    });
  } catch (error) {
    // Handle duplicate submission error
    if (error.code === 11000) {
      return responseUtil.badRequest(res, "You have already submitted this poll");
    }
    console.error("Submit poll error:", error);
    return responseUtil.internalError(res, "Failed to submit poll", error.message);
  }
};

export default {
  getPollByEventId,
  submitPoll,
};
