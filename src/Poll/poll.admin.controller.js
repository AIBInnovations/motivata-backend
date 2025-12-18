/**
 * @fileoverview Admin Poll Controller
 * @module Poll/admin.controller
 */

import Poll from "../../schema/Poll.schema.js";
import PollSubmission from "../../schema/PollSubmission.schema.js";
import Event from "../../schema/Event.schema.js";
import responseUtil from "../../utils/response.util.js";
import { sendPollNotification } from "../../utils/fcm.util.js";

/**
 * Create a new poll for an event
 * POST /api/web/polls
 */
export const createPoll = async (req, res) => {
  try {
    const { eventId, questions } = req.body;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return responseUtil.notFound(res, "Event not found");
    }

    // Check if poll already exists for this event
    const existingPoll = await Poll.findOne({ eventId });
    if (existingPoll) {
      return responseUtil.badRequest(res, "Poll already exists for this event");
    }

    const poll = new Poll({
      eventId,
      questions,
    });

    await poll.save();

    // Send push notification to enrolled users (async, don't wait)
    sendPollNotification({
      eventId,
      pollId: poll._id,
      eventName: event.name,
      action: "created",
    }).catch((err) => console.error("[FCM] Poll creation notification error:", err));

    return responseUtil.created(res, "Poll created successfully", poll);
  } catch (error) {
    console.error("Create poll error:", error);
    return responseUtil.internalError(res, "Failed to create poll", error.message);
  }
};

/**
 * Get poll by event ID
 * GET /api/web/polls/event/:eventId
 */
export const getPollByEventId = async (req, res) => {
  try {
    const { eventId } = req.params;

    const poll = await Poll.findOne({ eventId });
    if (!poll) {
      return responseUtil.notFound(res, "Poll not found for this event");
    }

    return responseUtil.success(res, "Poll fetched successfully", poll);
  } catch (error) {
    console.error("Get poll error:", error);
    return responseUtil.internalError(res, "Failed to fetch poll", error.message);
  }
};

/**
 * Update poll
 * PUT /api/web/polls/:pollId
 */
export const updatePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { questions, isActive } = req.body;

    const updateData = {};
    if (questions !== undefined) updateData.questions = questions;
    if (isActive !== undefined) updateData.isActive = isActive;

    const poll = await Poll.findByIdAndUpdate(pollId, updateData, { new: true });

    if (!poll) {
      return responseUtil.notFound(res, "Poll not found");
    }

    // Send push notification for question updates (not just isActive toggle)
    if (questions !== undefined) {
      const event = await Event.findById(poll.eventId);
      if (event) {
        sendPollNotification({
          eventId: poll.eventId,
          pollId: poll._id,
          eventName: event.name,
          action: "updated",
        }).catch((err) => console.error("[FCM] Poll update notification error:", err));
      }
    }

    return responseUtil.success(res, "Poll updated successfully", poll);
  } catch (error) {
    console.error("Update poll error:", error);
    return responseUtil.internalError(res, "Failed to update poll", error.message);
  }
};

/**
 * Delete poll
 * DELETE /api/web/polls/:pollId
 */
export const deletePoll = async (req, res) => {
  try {
    const { pollId } = req.params;

    const poll = await Poll.findByIdAndDelete(pollId);
    if (!poll) {
      return responseUtil.notFound(res, "Poll not found");
    }

    // Also delete all submissions for this poll
    await PollSubmission.deleteMany({ pollId });

    return responseUtil.success(res, "Poll deleted successfully");
  } catch (error) {
    console.error("Delete poll error:", error);
    return responseUtil.internalError(res, "Failed to delete poll", error.message);
  }
};

/**
 * Get poll statistics
 * GET /api/web/polls/:pollId/stats
 */
export const getPollStats = async (req, res) => {
  try {
    const { pollId } = req.params;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return responseUtil.notFound(res, "Poll not found");
    }

    // Get total submissions count
    const totalSubmissions = await PollSubmission.countDocuments({ pollId });

    // Aggregate statistics for each question and option
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

    // Build stats response
    const questions = poll.questions.map((question, questionIndex) => {
      const options = question.options.map((optionText, optionIndex) => {
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
          optionText,
          count,
          percentage,
        };
      });

      return {
        questionIndex,
        questionText: question.questionText,
        options,
      };
    });

    return responseUtil.success(res, "Poll statistics fetched successfully", {
      pollId: poll._id,
      eventId: poll.eventId,
      totalSubmissions,
      questions,
    });
  } catch (error) {
    console.error("Get poll stats error:", error);
    return responseUtil.internalError(res, "Failed to fetch poll statistics", error.message);
  }
};

/**
 * Manually send poll notification to all enrolled users
 * POST /api/web/polls/:pollId/notify
 */
export const triggerPollNotification = async (req, res) => {
  try {
    const { pollId } = req.params;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return responseUtil.notFound(res, "Poll not found");
    }

    const event = await Event.findById(poll.eventId);
    if (!event) {
      return responseUtil.notFound(res, "Event not found");
    }

    // Send notification
    const result = await sendPollNotification({
      eventId: poll.eventId,
      pollId: poll._id,
      eventName: event.name,
      action: "created", // Use 'created' message for manual trigger
    });

    if (result.success) {
      return responseUtil.success(res, "Poll notification sent successfully", {
        successCount: result.successCount || 0,
        failureCount: result.failureCount || 0,
        message: result.message || null,
      });
    } else {
      return responseUtil.internalError(
        res,
        "Failed to send poll notification",
        result.error
      );
    }
  } catch (error) {
    console.error("Trigger poll notification error:", error);
    return responseUtil.internalError(
      res,
      "Failed to send poll notification",
      error.message
    );
  }
};

export default {
  createPoll,
  getPollByEventId,
  updatePoll,
  deletePoll,
  getPollStats,
  triggerPollNotification,
};
