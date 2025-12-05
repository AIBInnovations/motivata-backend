/**
 * @fileoverview SOS Program and Quiz controller with CRUD operations and user progress tracking
 * @module controllers/sos
 */

import SOSProgram from "./schemas/sosProgram.schema.js";
import SOSQuiz from "./schemas/sosQuiz.schema.js";
import UserSOSProgress from "./schemas/userSOSProgress.schema.js";
import responseUtil from "../../utils/response.util.js";
import { buildPaginationOptions, buildPaginationMeta } from "../shared/pagination.util.js";

// ============================================
// SOS PROGRAM CONTROLLERS (Admin)
// ============================================

/**
 * Create a new SOS program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const createProgram = async (req, res) => {
  try {
    const programData = {
      ...req.body,
      createdBy: req.user.id,
    };

    const program = new SOSProgram(programData);
    await program.save();

    return responseUtil.created(res, "SOS program created successfully", { program });
  } catch (error) {
    console.error("Create SOS program error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.message.includes("duration")) {
      return responseUtil.badRequest(res, error.message);
    }

    return responseUtil.internalError(res, "Failed to create program", error.message);
  }
};

/**
 * Get all SOS programs with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAllPrograms = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", type, isActive, search } = req.query;

    const { skip, limitNum, sortOptions } = buildPaginationOptions({ page, limit, sortBy, sortOrder });

    const query = {};

    if (type) {
      query.type = type;
    }

    if (typeof isActive !== "undefined") {
      query.isActive = isActive === "true" || isActive === true;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const [programs, totalCount] = await Promise.all([
      SOSProgram.find(query).sort(sortOptions).skip(skip).limit(limitNum).populate("createdBy", "name email"),
      SOSProgram.countDocuments(query),
    ]);

    const pagination = buildPaginationMeta({ page, limit: limitNum, totalCount });

    return responseUtil.success(res, "Programs fetched successfully", {
      programs,
      pagination,
    });
  } catch (error) {
    console.error("Get all programs error:", error);
    return responseUtil.internalError(res, "Failed to fetch programs", error.message);
  }
};

/**
 * Get single SOS program by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getProgramById = async (req, res) => {
  try {
    const { programId } = req.params;

    const program = await SOSProgram.findById(programId)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!program) {
      return responseUtil.notFound(res, "Program not found");
    }

    // Get quiz count for this program
    const quizCount = await SOSQuiz.countDocuments({ programId, isDeleted: false });

    return responseUtil.success(res, "Program fetched successfully", {
      program,
      quizCount,
    });
  } catch (error) {
    console.error("Get program by ID error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch program", error.message);
  }
};

/**
 * Update SOS program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateProgram = async (req, res) => {
  try {
    const { programId } = req.params;
    const updates = {
      ...req.body,
      updatedBy: req.user.id,
    };

    // Don't allow type or durationDays changes after creation
    delete updates.type;
    delete updates.durationDays;
    delete updates.createdBy;
    delete updates.isDeleted;
    delete updates.deletedAt;
    delete updates.deletedBy;

    const program = await SOSProgram.findByIdAndUpdate(programId, updates, {
      new: true,
      runValidators: true,
    })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!program) {
      return responseUtil.notFound(res, "Program not found");
    }

    return responseUtil.success(res, "Program updated successfully", { program });
  } catch (error) {
    console.error("Update program error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }

    return responseUtil.internalError(res, "Failed to update program", error.message);
  }
};

/**
 * Soft delete SOS program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteProgram = async (req, res) => {
  try {
    const { programId } = req.params;

    const program = await SOSProgram.findById(programId);

    if (!program) {
      return responseUtil.notFound(res, "Program not found");
    }

    await program.softDelete(req.user.id);

    return responseUtil.success(res, "Program deleted successfully");
  } catch (error) {
    console.error("Delete program error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }

    return responseUtil.internalError(res, "Failed to delete program", error.message);
  }
};

/**
 * Toggle program active status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const toggleProgramStatus = async (req, res) => {
  try {
    const { programId } = req.params;

    const program = await SOSProgram.findById(programId);

    if (!program) {
      return responseUtil.notFound(res, "Program not found");
    }

    program.isActive = !program.isActive;
    program.updatedBy = req.user.id;
    await program.save();

    return responseUtil.success(res, `Program ${program.isActive ? "activated" : "deactivated"} successfully`, {
      program,
    });
  } catch (error) {
    console.error("Toggle program status error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }

    return responseUtil.internalError(res, "Failed to toggle program status", error.message);
  }
};

// ============================================
// SOS QUIZ CONTROLLERS (Admin)
// ============================================

/**
 * Create a new SOS quiz for a program day
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const createQuiz = async (req, res) => {
  try {
    const quizData = {
      ...req.body,
      createdBy: req.user.id,
    };

    const quiz = new SOSQuiz(quizData);
    await quiz.save();

    return responseUtil.created(res, "Quiz created successfully", { quiz });
  } catch (error) {
    console.error("Create SOS quiz error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.code === 11000) {
      return responseUtil.conflict(res, "A quiz already exists for this program day");
    }

    if (error.message.includes("Day number") || error.message.includes("Program not found")) {
      return responseUtil.badRequest(res, error.message);
    }

    return responseUtil.internalError(res, "Failed to create quiz", error.message);
  }
};

/**
 * Get all quizzes with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAllQuizzes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "dayNumber",
      sortOrder = "asc",
      programId,
      dayNumber,
      isActive,
    } = req.query;

    const { skip, limitNum, sortOptions } = buildPaginationOptions({ page, limit, sortBy, sortOrder });

    const query = {};

    if (programId) {
      query.programId = programId;
    }

    if (dayNumber) {
      query.dayNumber = parseInt(dayNumber, 10);
    }

    if (typeof isActive !== "undefined") {
      query.isActive = isActive === "true" || isActive === true;
    }

    const [quizzes, totalCount] = await Promise.all([
      SOSQuiz.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate("programId", "title type durationDays")
        .populate("createdBy", "name email"),
      SOSQuiz.countDocuments(query),
    ]);

    const pagination = buildPaginationMeta({ page, limit: limitNum, totalCount });

    return responseUtil.success(res, "Quizzes fetched successfully", {
      quizzes,
      pagination,
    });
  } catch (error) {
    console.error("Get all SOS quizzes error:", error);
    return responseUtil.internalError(res, "Failed to fetch quizzes", error.message);
  }
};

/**
 * Get quizzes by program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getQuizzesByProgram = async (req, res) => {
  try {
    const { programId } = req.params;

    const program = await SOSProgram.findById(programId);
    if (!program) {
      return responseUtil.notFound(res, "Program not found");
    }

    const quizzes = await SOSQuiz.findByProgram(programId);

    return responseUtil.success(res, "Quizzes fetched successfully", {
      program: {
        _id: program._id,
        title: program.title,
        type: program.type,
        durationDays: program.durationDays,
      },
      quizzes,
      totalQuizzes: quizzes.length,
      daysWithQuiz: quizzes.map((q) => q.dayNumber),
    });
  } catch (error) {
    console.error("Get quizzes by program error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch quizzes", error.message);
  }
};

/**
 * Get quiz by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getQuizById = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await SOSQuiz.findById(quizId)
      .populate("programId", "title type durationDays")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    return responseUtil.success(res, "Quiz fetched successfully", { quiz });
  } catch (error) {
    console.error("Get quiz by ID error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid quiz ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch quiz", error.message);
  }
};

/**
 * Update SOS quiz
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const updates = {
      ...req.body,
      updatedBy: req.user.id,
    };

    // Don't allow changing programId or dayNumber
    delete updates.programId;
    delete updates.dayNumber;
    delete updates.createdBy;
    delete updates.isDeleted;
    delete updates.deletedAt;
    delete updates.deletedBy;

    const quiz = await SOSQuiz.findByIdAndUpdate(quizId, updates, {
      new: true,
      runValidators: true,
    })
      .populate("programId", "title type durationDays")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    return responseUtil.success(res, "Quiz updated successfully", { quiz });
  } catch (error) {
    console.error("Update SOS quiz error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid quiz ID format");
    }

    return responseUtil.internalError(res, "Failed to update quiz", error.message);
  }
};

/**
 * Soft delete SOS quiz
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await SOSQuiz.findById(quizId);

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    await quiz.softDelete(req.user.id);

    return responseUtil.success(res, "Quiz deleted successfully");
  } catch (error) {
    console.error("Delete SOS quiz error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid quiz ID format");
    }

    return responseUtil.internalError(res, "Failed to delete quiz", error.message);
  }
};

// ============================================
// USER PROGRESS CONTROLLERS
// ============================================

/**
 * Get available programs for user (active programs)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAvailablePrograms = async (req, res) => {
  try {
    const { type } = req.query;
    const userId = req.user?.id;

    const query = { isActive: true };
    if (type) {
      query.type = type;
    }

    const programs = await SOSProgram.findActive(query).sort({ createdAt: -1 });

    // If user is logged in, get their progress for each program
    let userProgress = [];
    if (userId) {
      userProgress = await UserSOSProgress.find({
        userId,
        programId: { $in: programs.map((p) => p._id) },
      }).select("programId status currentDay daysCompleted");
    }

    const programsWithProgress = programs.map((program) => {
      const progress = userProgress.find((p) => p.programId.toString() === program._id.toString());
      return {
        ...program.toObject(),
        userProgress: progress
          ? {
              status: progress.status,
              currentDay: progress.currentDay,
              daysCompleted: progress.daysCompleted,
            }
          : null,
      };
    });

    return responseUtil.success(res, "Programs fetched successfully", {
      programs: programsWithProgress,
    });
  } catch (error) {
    console.error("Get available programs error:", error);
    return responseUtil.internalError(res, "Failed to fetch programs", error.message);
  }
};

/**
 * Start a program (create user progress)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const startProgram = async (req, res) => {
  try {
    const { programId } = req.body;
    const userId = req.user.id;

    // Check if program exists and is active
    const program = await SOSProgram.findById(programId);
    if (!program) {
      return responseUtil.notFound(res, "Program not found");
    }

    if (!program.isActive) {
      return responseUtil.badRequest(res, "This program is not currently available");
    }

    // Check if user already has progress for this program
    let progress = await UserSOSProgress.findByUserAndProgram(userId, programId);

    if (progress) {
      if (progress.status === "in_progress") {
        return responseUtil.badRequest(res, "You are already enrolled in this program");
      }
      if (progress.status === "completed") {
        return responseUtil.badRequest(res, "You have already completed this program");
      }
      // If abandoned, allow restart
      progress.status = "not_started";
    } else {
      progress = new UserSOSProgress({
        userId,
        programId,
      });
    }

    await progress.startProgram();

    return responseUtil.success(res, "Program started successfully", {
      progress: {
        programId: progress.programId,
        status: progress.status,
        currentDay: progress.currentDay,
        startedAt: progress.startedAt,
      },
    });
  } catch (error) {
    console.error("Start program error:", error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, "You are already enrolled in this program");
    }

    return responseUtil.internalError(res, "Failed to start program", error.message);
  }
};

/**
 * Get user's progress for all programs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const progress = await UserSOSProgress.find(query)
      .populate("programId", "title type durationDays imageUrl")
      .sort({ lastActivityAt: -1 });

    return responseUtil.success(res, "Progress fetched successfully", { progress });
  } catch (error) {
    console.error("Get user progress error:", error);
    return responseUtil.internalError(res, "Failed to fetch progress", error.message);
  }
};

/**
 * Get user's progress for a specific program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getProgramProgress = async (req, res) => {
  try {
    const { programId } = req.params;
    const userId = req.user.id;

    const progress = await UserSOSProgress.findByUserAndProgram(userId, programId);

    if (!progress) {
      return responseUtil.notFound(res, "You have not started this program");
    }

    // Get program details
    const program = await SOSProgram.findById(programId);

    // Get quiz for current day
    const currentDayQuiz = await SOSQuiz.findByDay(programId, progress.currentDay);

    return responseUtil.success(res, "Progress fetched successfully", {
      progress,
      program: {
        _id: program._id,
        title: program.title,
        type: program.type,
        durationDays: program.durationDays,
      },
      currentDayQuiz: currentDayQuiz
        ? {
            _id: currentDayQuiz._id,
            title: currentDayQuiz.title,
            description: currentDayQuiz.description,
            questionCount: currentDayQuiz.questionCount,
          }
        : null,
    });
  } catch (error) {
    console.error("Get program progress error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch progress", error.message);
  }
};

/**
 * Get quiz for today's day in a program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getTodayQuiz = async (req, res) => {
  try {
    const { programId } = req.params;
    const userId = req.user.id;

    // Get user's progress
    const progress = await UserSOSProgress.findByUserAndProgram(userId, programId);

    if (!progress) {
      return responseUtil.notFound(res, "You have not started this program");
    }

    if (progress.status === "completed") {
      return responseUtil.badRequest(res, "You have already completed this program");
    }

    if (progress.status !== "in_progress") {
      return responseUtil.badRequest(res, "Please start the program first");
    }

    // Check if today's quiz is already completed
    const todayProgress = progress.dailyProgress.find((d) => d.dayNumber === progress.currentDay);
    if (todayProgress && todayProgress.status === "completed") {
      return responseUtil.badRequest(res, "You have already completed today's quiz");
    }

    // Get quiz for current day
    const quiz = await SOSQuiz.findByDay(programId, progress.currentDay);

    if (!quiz) {
      return responseUtil.notFound(res, `No quiz available for day ${progress.currentDay}`);
    }

    // Return quiz without correct answers (for non-choice types)
    const sanitizedQuiz = quiz.toObject();
    sanitizedQuiz.questions = sanitizedQuiz.questions.map((q) => {
      const sanitized = { ...q };
      // Keep options but don't include correct answer indicators for non-choice types
      return sanitized;
    });

    return responseUtil.success(res, "Quiz fetched successfully", {
      quiz: sanitizedQuiz,
      dayNumber: progress.currentDay,
      totalDays: (await SOSProgram.findById(programId)).durationDays,
    });
  } catch (error) {
    console.error("Get today's quiz error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch quiz", error.message);
  }
};

/**
 * Submit quiz responses for a day
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const submitDayQuiz = async (req, res) => {
  try {
    const { programId, dayNumber } = req.params;
    const { responses } = req.body;
    const userId = req.user.id;

    // Get user's progress
    const progress = await UserSOSProgress.findByUserAndProgram(userId, programId);

    if (!progress) {
      return responseUtil.notFound(res, "You have not started this program");
    }

    if (progress.status !== "in_progress") {
      return responseUtil.badRequest(res, "Program is not in progress");
    }

    const day = parseInt(dayNumber, 10);
    if (day !== progress.currentDay) {
      return responseUtil.badRequest(res, `Please complete day ${progress.currentDay} first`);
    }

    // Check if already completed
    const existingDayProgress = progress.dailyProgress.find((d) => d.dayNumber === day);
    if (existingDayProgress && existingDayProgress.status === "completed") {
      return responseUtil.badRequest(res, "You have already completed this day's quiz");
    }

    // Get the quiz
    const quiz = await SOSQuiz.findByDay(programId, day);
    if (!quiz) {
      return responseUtil.notFound(res, `No quiz found for day ${day}`);
    }

    // Calculate score
    let score = 0;
    let maxScore = 0;
    const gradedResponses = [];

    for (const question of quiz.questions) {
      maxScore += question.points || 0;
      const userResponse = responses.find((r) => r.questionId === question._id.toString());

      const gradedResponse = {
        questionId: question._id,
        answer: userResponse?.answer || null,
        pointsEarned: 0,
      };

      // For SOS quizzes, all responses are valid (no right/wrong)
      // Points are earned for completion
      if (userResponse && userResponse.answer !== null && userResponse.answer !== "") {
        gradedResponse.pointsEarned = question.points || 0;
        score += gradedResponse.pointsEarned;
      }

      gradedResponses.push(gradedResponse);
    }

    // Record day completion
    await progress.recordDayCompletion(day, quiz._id, gradedResponses, score, maxScore);

    // Get program to check if this was the last day
    const program = await SOSProgram.findById(programId);
    const isLastDay = day >= program.durationDays;

    if (isLastDay) {
      await progress.completeProgram();
    }

    return responseUtil.success(res, isLastDay ? "Congratulations! You've completed the program!" : "Day completed successfully", {
      dayNumber: day,
      score,
      maxScore,
      daysCompleted: progress.daysCompleted,
      totalDays: program.durationDays,
      programCompleted: isLastDay,
      currentStreak: progress.currentStreak,
      longestStreak: progress.longestStreak,
    });
  } catch (error) {
    console.error("Submit day quiz error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid ID format");
    }

    return responseUtil.internalError(res, "Failed to submit quiz", error.message);
  }
};

/**
 * Get leaderboard for a program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getLeaderboard = async (req, res) => {
  try {
    const { programId } = req.params;
    const { limit = 10 } = req.query;

    const program = await SOSProgram.findById(programId);
    if (!program) {
      return responseUtil.notFound(res, "Program not found");
    }

    const leaderboard = await UserSOSProgress.getLeaderboard(programId, parseInt(limit, 10));

    return responseUtil.success(res, "Leaderboard fetched successfully", {
      program: {
        _id: program._id,
        title: program.title,
      },
      leaderboard: leaderboard.map((entry, index) => ({
        rank: index + 1,
        userId: entry.userId?._id,
        name: entry.userId?.name,
        avatar: entry.userId?.avatar,
        totalScore: entry.totalScore,
        daysCompleted: entry.daysCompleted,
        longestStreak: entry.longestStreak,
      })),
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch leaderboard", error.message);
  }
};

// ============================================
// ADMIN USER PROGRESS CONTROLLERS
// ============================================

/**
 * Get all user progress (admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAllUserProgress = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "lastActivityAt",
      sortOrder = "desc",
      status,
      programId,
      userId,
    } = req.query;

    const { skip, limitNum, sortOptions } = buildPaginationOptions({ page, limit, sortBy, sortOrder });

    const query = {};

    if (status) {
      query.status = status;
    }

    if (programId) {
      query.programId = programId;
    }

    if (userId) {
      query.userId = userId;
    }

    const [progressList, totalCount] = await Promise.all([
      UserSOSProgress.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate("userId", "name email phone")
        .populate("programId", "title type durationDays"),
      UserSOSProgress.countDocuments(query),
    ]);

    const pagination = buildPaginationMeta({ page, limit: limitNum, totalCount });

    return responseUtil.success(res, "Progress list fetched successfully", {
      progressList,
      pagination,
    });
  } catch (error) {
    console.error("Get all user progress error:", error);
    return responseUtil.internalError(res, "Failed to fetch progress list", error.message);
  }
};

/**
 * Get program statistics (admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getProgramStats = async (req, res) => {
  try {
    const { programId } = req.params;

    const program = await SOSProgram.findById(programId);
    if (!program) {
      return responseUtil.notFound(res, "Program not found");
    }

    const [totalEnrolled, inProgress, completed, abandoned, quizCount] = await Promise.all([
      UserSOSProgress.countDocuments({ programId }),
      UserSOSProgress.countDocuments({ programId, status: "in_progress" }),
      UserSOSProgress.countDocuments({ programId, status: "completed" }),
      UserSOSProgress.countDocuments({ programId, status: "abandoned" }),
      SOSQuiz.countDocuments({ programId, isDeleted: false }),
    ]);

    // Get average completion stats
    const completedUsers = await UserSOSProgress.find({ programId, status: "completed" }).select(
      "totalScore maxPossibleScore daysCompleted"
    );

    const avgScore =
      completedUsers.length > 0
        ? completedUsers.reduce((sum, u) => sum + (u.maxPossibleScore > 0 ? (u.totalScore / u.maxPossibleScore) * 100 : 0), 0) /
          completedUsers.length
        : 0;

    return responseUtil.success(res, "Program stats fetched successfully", {
      program: {
        _id: program._id,
        title: program.title,
        type: program.type,
        durationDays: program.durationDays,
        isActive: program.isActive,
      },
      stats: {
        totalEnrolled,
        inProgress,
        completed,
        abandoned,
        completionRate: totalEnrolled > 0 ? Math.round((completed / totalEnrolled) * 100) : 0,
        quizCount,
        quizCoverage: Math.round((quizCount / program.durationDays) * 100),
        averageScore: Math.round(avgScore * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Get program stats error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch program stats", error.message);
  }
};

export default {
  // Program controllers
  createProgram,
  getAllPrograms,
  getProgramById,
  updateProgram,
  deleteProgram,
  toggleProgramStatus,
  // Quiz controllers
  createQuiz,
  getAllQuizzes,
  getQuizzesByProgram,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  // User progress controllers
  getAvailablePrograms,
  startProgram,
  getUserProgress,
  getProgramProgress,
  getTodayQuiz,
  submitDayQuiz,
  getLeaderboard,
  // Admin progress controllers
  getAllUserProgress,
  getProgramStats,
};
