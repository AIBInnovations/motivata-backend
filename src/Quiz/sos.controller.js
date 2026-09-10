/**
 * @fileoverview SOS Program and Quiz controller with CRUD operations and user progress tracking
 * @module controllers/sos
 */

import SOSProgram from "./schemas/sosProgram.schema.js";
import SOSQuiz from "./schemas/sosQuiz.schema.js";
import UserSOSProgress from "./schemas/userSOSProgress.schema.js";
import SOSArticle from "./schemas/sosArticle.schema.js";
import DailySOSQuestion from "./schemas/dailySosQuestion.schema.js";
import DailySOSAnswer from "./schemas/dailySosAnswer.schema.js";
import { dateKeyIST } from "../../utils/timezone.util.js";
import QoLFactor from "./schemas/qolFactor.schema.js";
import QoLEntry from "./schemas/qolEntry.schema.js";
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

    const { skip, limit: limitNum, sort: sortOptions, page: pageNum } = buildPaginationOptions({ page, limit, sortBy, sortOrder });

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

    const pagination = buildPaginationMeta(totalCount, pageNum, limitNum);

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

    const { skip, limit: limitNum, sort: sortOptions, page: pageNum } = buildPaginationOptions({ page, limit, sortBy, sortOrder });

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

    const pagination = buildPaginationMeta(totalCount, pageNum, limitNum);

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
const isAnswerEmpty = (answer) => {
  if (answer === undefined || answer === null || answer === "") return true;
  if (typeof answer === "boolean" || typeof answer === "number") return false;
  if (Array.isArray(answer)) return answer.every((a) => !a || !String(a).trim());
  if (typeof answer === "object") {
    return Object.values(answer).every((v) => !v || !String(v).trim());
  }
  return !String(answer).trim();
};

const mergeQuizQuestions = (storedQuestions, incomingQuestions) => {
  const storedById = new Map(
    storedQuestions.map((question) => [String(question._id), question])
  );

  return incomingQuestions.map((incoming) => {
    const stored = incoming._id ? storedById.get(String(incoming._id)) : null;

    if (!stored) {
      const { _id, ...withoutId } = incoming;
      return withoutId;
    }

    const merged = stored.toObject();
    for (const [key, value] of Object.entries(incoming)) {
      if (key !== "_id" && value !== undefined) {
        merged[key] = value;
      }
    }
    merged._id = stored._id;
    return merged;
  });
};

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

    const quiz = await SOSQuiz.findById(quizId);

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    if (Array.isArray(updates.questions)) {
      quiz.questions = mergeQuizQuestions(quiz.questions, updates.questions);
      delete updates.questions;
    }

    Object.assign(quiz, updates);
    await quiz.save();

    await quiz.populate([
      { path: "programId", select: "title type durationDays" },
      { path: "createdBy", select: "name email" },
      { path: "updatedBy", select: "name email" },
    ]);

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

    const programIds = programs.map((p) => p._id);

    // Count active (findByDay-eligible) quizzes per program so clients can avoid
    // selecting a program that has no quiz content yet.
    const quizCounts = await SOSQuiz.aggregate([
      { $match: { programId: { $in: programIds }, isActive: true, isDeleted: false } },
      { $group: { _id: "$programId", count: { $sum: 1 } } },
    ]);
    const quizCountMap = new Map(
      quizCounts.map((q) => [q._id.toString(), q.count])
    );

    // If user is logged in, get their progress for each program
    let userProgress = [];
    if (userId) {
      userProgress = await UserSOSProgress.find({
        userId,
        programId: { $in: programIds },
      }).select("programId status currentDay daysCompleted");
    }

    const programsWithProgress = programs.map((program) => {
      const progress = userProgress.find((p) => p.programId.toString() === program._id.toString());
      const quizCount = quizCountMap.get(program._id.toString()) || 0;
      return {
        ...program.toObject(),
        quizCount,
        hasQuiz: quizCount > 0,
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
    const existing = await UserSOSProgress.findOne({ userId, programId });

    let progress;
    const now = new Date();

    if (existing) {
      if (existing.status === "in_progress") {
        return responseUtil.badRequest(res, "You are already enrolled in this program");
      }
      // Atomically reset all fields and set to in_progress
      progress = await UserSOSProgress.findOneAndUpdate(
        { userId, programId },
        {
          $set: {
            status: "in_progress",
            currentDay: 1,
            startedAt: now,
            lastActivityAt: now,
            dailyProgress: [],
            totalScore: 0,
            maxPossibleScore: 0,
            daysCompleted: 0,
            currentStreak: 0,
            longestStreak: 0,
          },
          $unset: {
            completedAt: "",
            lastStreakDate: "",
          },
        },
        { new: true }
      );
    } else {
      progress = new UserSOSProgress({ userId, programId });
      await progress.startProgram();
    }

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

    const allDayQuizzes = await SOSQuiz.find({ programId, isActive: true })
      .select("dayNumber title description")
      .sort({ dayNumber: 1 });

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
      days: allDayQuizzes.map((q) => ({
        dayNumber: q.dayNumber,
        title: q.title,
        description: q.description,
      })),
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
 * Get quiz questions for any day in a program (for users who started the program)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getDayQuiz = async (req, res) => {
  try {
    const { programId, dayNumber } = req.params;
    const userId = req.user.id;

    const day = parseInt(dayNumber, 10);

    // Verify user has started this program
    const progress = await UserSOSProgress.findByUserAndProgram(userId, programId);

    if (!progress) {
      return responseUtil.notFound(res, "You have not started this program");
    }

    // Verify the program exists
    const program = await SOSProgram.findById(programId);
    if (!program) {
      return responseUtil.notFound(res, "Program not found");
    }

    // Validate day number is within program duration
    if (day < 1 || day > program.durationDays) {
      return responseUtil.badRequest(res, `Day number must be between 1 and ${program.durationDays}`);
    }

    // Get quiz for the requested day
    const quiz = await SOSQuiz.findByDay(programId, day);

    // Get user's responses for this day if they exist
    const dayProgress = progress.dailyProgress.find((d) => d.dayNumber === day);

    // If no quiz exists but the user already completed this day, return progress data gracefully
    if (!quiz) {
      if (dayProgress?.status === "completed") {
        return responseUtil.success(res, "Quiz fetched successfully", {
          quiz: null,
          dayNumber: day,
          totalDays: program.durationDays,
          isCompleted: true,
          userResponses: dayProgress.responses,
        });
      }
      return responseUtil.notFound(res, `No quiz available for day ${day}`);
    }

    const sanitizedQuiz = quiz.toObject();
    sanitizedQuiz.questions = sanitizedQuiz.questions.map((q) => {
      const sanitized = { ...q };
      return sanitized;
    });

    return responseUtil.success(res, "Quiz fetched successfully", {
      quiz: sanitizedQuiz,
      dayNumber: day,
      totalDays: program.durationDays,
      isCompleted: dayProgress?.status === "completed",
      userResponses: dayProgress?.status === "completed" ? dayProgress.responses : null,
    });
  } catch (error) {
    console.error("Get day quiz error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid ID format");
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

    const unansweredRequired = quiz.questions.filter((question) => {
      if (question.isRequired === false) return false;
      const userResponse = responses.find(
        (r) => r.questionId === question._id.toString()
      );
      return isAnswerEmpty(userResponse?.answer);
    });

    if (unansweredRequired.length > 0) {
      return responseUtil.badRequest(
        res,
        `Please answer all required questions before submitting. ${unansweredRequired.length} of ${quiz.questions.length} still unanswered.`
      );
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

    const { skip, limit: limitNum, sort: sortOptions, page: pageNum } = buildPaginationOptions({ page, limit, sortBy, sortOrder });

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

    const pagination = buildPaginationMeta(totalCount, pageNum, limitNum);

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

/**
 * Download certificate for a completed SOS program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const downloadCertificate = async (req, res) => {
  try {
    const { programId } = req.params;
    const userId = req.user.id;

    const progress = await UserSOSProgress.findByUserAndProgram(userId, programId);

    if (!progress) {
      return responseUtil.notFound(res, "You have not started this program");
    }

    if (progress.status !== "completed") {
      return responseUtil.badRequest(res, "Certificate is only available after completing the program");
    }

    const program = progress.programId;

    const User = (await import("../../schema/User.schema.js")).default;
    const user = await User.findById(userId).select("name email phone");

    const scorePercentage =
      progress.maxPossibleScore > 0 ? Math.round((progress.totalScore / progress.maxPossibleScore) * 100) : 0;

    return responseUtil.success(res, "Certificate data fetched successfully", {
      certificate: {
        recipientName: user.name,
        recipientEmail: user.email,
        programTitle: program.title,
        programType: program.type,
        durationDays: program.durationDays,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
        totalScore: progress.totalScore,
        maxPossibleScore: progress.maxPossibleScore,
        scorePercentage,
        daysCompleted: progress.daysCompleted,
        longestStreak: progress.longestStreak,
        issuedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Download certificate error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch certificate", error.message);
  }
};

/**
 * Reset user's progress for a program back to not_started
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const resetProgram = async (req, res) => {
  try {
    const { programId } = req.body;
    const userId = req.user.id;

    const existing = await UserSOSProgress.findOne({ userId, programId });

    if (!existing) {
      return responseUtil.notFound(res, "No progress found for this program");
    }

    const updated = await UserSOSProgress.findOneAndUpdate(
      { userId, programId },
      {
        $set: {
          status: "not_started",
          currentDay: 1,
          lastActivityAt: new Date(),
          dailyProgress: [],
          totalScore: 0,
          maxPossibleScore: 0,
          daysCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
        },
        $unset: {
          startedAt: "",
          completedAt: "",
          lastStreakDate: "",
        },
      },
      { new: true }
    );

    return responseUtil.success(res, "Progress reset successfully", {
      progress: {
        programId: updated.programId,
        status: updated.status,
        currentDay: updated.currentDay,
      },
    });
  } catch (error) {
    console.error("Reset program error:", error.name, error.message, error.stack);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }

    if (error.name === "ValidationError") {
      return responseUtil.validationError(res, "Validation failed", Object.keys(error.errors).map(k => ({ field: k, message: error.errors[k].message })));
    }

    return responseUtil.internalError(res, "Failed to reset program", error.message);
  }
};

/**
 * Retry an SOS program after completion or abandonment
 * Resets all progress and restarts the program from day 1
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const retryProgram = async (req, res) => {
  try {
    const { programId } = req.params;
    const userId = req.user.id;

    const existing = await UserSOSProgress.findOne({ userId, programId });

    if (!existing) {
      return responseUtil.notFound(res, "No progress found for this program");
    }

    const now = new Date();

    const updated = await UserSOSProgress.findOneAndUpdate(
      { userId, programId },
      {
        $set: {
          status: "in_progress",
          currentDay: 1,
          startedAt: now,
          lastActivityAt: now,
          dailyProgress: [],
          totalScore: 0,
          maxPossibleScore: 0,
          daysCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
        },
        $unset: {
          completedAt: "",
          lastStreakDate: "",
        },
      },
      { new: true }
    );

    return responseUtil.success(res, "Program restarted successfully", {
      progress: {
        programId: updated.programId,
        status: updated.status,
        currentDay: updated.currentDay,
        startedAt: updated.startedAt,
      },
    });
  } catch (error) {
    console.error("Retry program error:", error.name, error.message, error.stack);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }

    if (error.name === "ValidationError") {
      return responseUtil.validationError(
        res,
        "Validation failed",
        Object.keys(error.errors).map((k) => ({ field: k, message: error.errors[k].message }))
      );
    }

    return responseUtil.internalError(res, "Failed to retry program", error.message);
  }
};

// ============================================
// SOS SCHEDULING CONTROLLERS (User)
// ============================================

/**
 * Get scheduling info for a paid SOS program (Calendly URI)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getScheduleInfo = async (req, res) => {
  try {
    const { programId } = req.params;
    const userId = req.user.id;

    const program = await SOSProgram.findById(programId);
    if (!program) {
      return responseUtil.notFound(res, "Program not found");
    }

    if (!program.requiresScheduling) {
      return responseUtil.badRequest(res, "This program does not require scheduling");
    }

    if (!program.calendlyEventTypeUri) {
      return responseUtil.serviceUnavailable(res, "Scheduling is not configured for this program");
    }

    // Check if user has a progress record (i.e., paid/enrolled)
    const progress = await UserSOSProgress.findOne({ userId, programId });

    return responseUtil.success(res, "Schedule info retrieved", {
      programId,
      programTitle: program.title,
      sessionType: program.sessionType,
      calendlyUri: program.calendlyEventTypeUri,
      schedulingStatus: progress?.schedulingStatus || "pending",
      scheduledAt: progress?.scheduledAt || null,
    });
  } catch (error) {
    console.error("Get schedule info error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }
    return responseUtil.internalError(res, "Failed to get schedule info", error.message);
  }
};

/**
 * Confirm session scheduled (app calls this after Calendly booking)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const confirmSchedule = async (req, res) => {
  try {
    const { programId } = req.params;
    const userId = req.user.id;
    const { scheduledAt, calendlyInviteeUri } = req.body;

    const program = await SOSProgram.findById(programId);
    if (!program) {
      return responseUtil.notFound(res, "Program not found");
    }

    let progress = await UserSOSProgress.findOne({ userId, programId });

    if (!progress) {
      // Create progress record if it doesn't exist (first interaction after payment)
      progress = new UserSOSProgress({
        userId,
        programId,
        status: "not_started",
        schedulingStatus: "scheduled",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        calendlyInviteeUri: calendlyInviteeUri || null,
      });
    } else {
      progress.schedulingStatus = "scheduled";
      progress.scheduledAt = scheduledAt ? new Date(scheduledAt) : new Date();
      if (calendlyInviteeUri) progress.calendlyInviteeUri = calendlyInviteeUri;
    }

    await progress.save();

    return responseUtil.success(res, "Session scheduled successfully", {
      programId,
      schedulingStatus: progress.schedulingStatus,
      scheduledAt: progress.scheduledAt,
    });
  } catch (error) {
    console.error("Confirm schedule error:", error);
    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid program ID format");
    }
    return responseUtil.internalError(res, "Failed to confirm schedule", error.message);
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
  getDayQuiz,
  submitDayQuiz,
  getLeaderboard,
  downloadCertificate,
  resetProgram,
  retryProgram,
  getScheduleInfo,
  confirmSchedule,
  // Admin progress controllers
  getAllUserProgress,
  getProgramStats,
};

// ============================================
// SOS ARTICLE CONTROLLERS
// ============================================

export const createArticle = async (req, res) => {
  try {
    const article = new SOSArticle({ ...req.body, createdBy: req.user.id });
    await article.save();

    return responseUtil.created(res, "Article created successfully", { article });
  } catch (error) {
    console.error("Create SOS article error:", error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, "An article already exists for this day");
    }

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.message.includes("Day number") || error.message.includes("Program not found")) {
      return responseUtil.badRequest(res, error.message);
    }

    return responseUtil.internalError(res, "Failed to create article", error.message);
  }
};

export const getAllArticles = async (req, res) => {
  try {
    const { page = 1, limit = 50, programId, isActive } = req.query;
    const { skip, limit: limitNum, page: pageNum } = buildPaginationOptions({ page, limit, sortBy: "dayNumber", sortOrder: "asc" });

    const query = {};
    if (programId) query.programId = programId;
    if (typeof isActive !== "undefined") {
      query.isActive = isActive === "true" || isActive === true;
    }

    const [articles, totalCount] = await Promise.all([
      SOSArticle.find(query)
        .sort({ programId: 1, dayNumber: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate("programId", "title type durationDays"),
      SOSArticle.countDocuments(query),
    ]);

    const pagination = buildPaginationMeta(totalCount, pageNum, limitNum);

    return responseUtil.success(res, "Articles fetched successfully", { articles, pagination });
  } catch (error) {
    console.error("Get all articles error:", error);
    return responseUtil.internalError(res, "Failed to fetch articles", error.message);
  }
};

export const getArticleById = async (req, res) => {
  try {
    const { articleId } = req.params;

    const article = await SOSArticle.findById(articleId)
      .populate("programId", "title type durationDays")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!article) {
      return responseUtil.notFound(res, "Article not found");
    }

    return responseUtil.success(res, "Article fetched successfully", { article });
  } catch (error) {
    console.error("Get article by ID error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid article ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch article", error.message);
  }
};

export const updateArticle = async (req, res) => {
  try {
    const { articleId } = req.params;
    const updates = { ...req.body, updatedBy: req.user.id };

    delete updates.programId;
    delete updates.dayNumber;
    delete updates.createdBy;
    delete updates.isDeleted;
    delete updates.deletedAt;
    delete updates.deletedBy;

    const article = await SOSArticle.findByIdAndUpdate(articleId, updates, {
      new: true,
      runValidators: true,
    }).populate("programId", "title type durationDays");

    if (!article) {
      return responseUtil.notFound(res, "Article not found");
    }

    return responseUtil.success(res, "Article updated successfully", { article });
  } catch (error) {
    console.error("Update article error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid article ID format");
    }

    return responseUtil.internalError(res, "Failed to update article", error.message);
  }
};

export const deleteArticle = async (req, res) => {
  try {
    const { articleId } = req.params;

    const article = await SOSArticle.findById(articleId);

    if (!article) {
      return responseUtil.notFound(res, "Article not found");
    }

    await article.softDelete(req.user.id);

    return responseUtil.success(res, "Article deleted successfully");
  } catch (error) {
    console.error("Delete article error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid article ID format");
    }

    return responseUtil.internalError(res, "Failed to delete article", error.message);
  }
};

export const getDayArticle = async (req, res) => {
  try {
    const { programId, dayNumber } = req.params;
    const day = parseInt(dayNumber, 10);

    const article = await SOSArticle.findByDay(programId, day);

    if (!article) {
      return responseUtil.notFound(res, `No article available for day ${day}`);
    }

    return responseUtil.success(res, "Article fetched successfully", {
      article: {
        _id: article._id,
        dayNumber: article.dayNumber,
        title: article.title,
        body: article.body,
        audioUrl: article.audioUrl,
      },
    });
  } catch (error) {
    console.error("Get day article error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch article", error.message);
  }
};

// ============================================
// DAILY SOS QUESTION CONTROLLERS
// ============================================

export const createDailyQuestion = async (req, res) => {
  try {
    const question = new DailySOSQuestion({ ...req.body, createdBy: req.user.id });
    await question.save();

    return responseUtil.created(res, "Daily question scheduled successfully", { question });
  } catch (error) {
    console.error("Create daily SOS question error:", error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, "A question is already scheduled for this date");
    }

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(res, "Failed to schedule question", error.message);
  }
};

export const getDailyQuestions = async (req, res) => {
  try {
    const { from, to } = req.query;

    const query = {};
    if (from || to) {
      query.dateKey = {};
      if (from) query.dateKey.$gte = from;
      if (to) query.dateKey.$lte = to;
    }

    const questions = await DailySOSQuestion.find(query).sort({ dateKey: 1 });

    const answerCounts = await DailySOSAnswer.aggregate([
      { $match: { questionId: { $in: questions.map((q) => q._id) } } },
      { $group: { _id: "$questionId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(answerCounts.map((a) => [String(a._id), a.count]));

    const withCounts = questions.map((q) => ({
      ...q.toObject(),
      answerCount: countMap.get(String(q._id)) || 0,
    }));

    return responseUtil.success(res, "Daily questions fetched successfully", {
      questions: withCounts,
      today: dateKeyIST(),
    });
  } catch (error) {
    console.error("Get daily SOS questions error:", error);
    return responseUtil.internalError(res, "Failed to fetch questions", error.message);
  }
};

export const updateDailyQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const updates = { ...req.body, updatedBy: req.user.id };

    delete updates.dateKey;
    delete updates.createdBy;
    delete updates.isDeleted;

    const question = await DailySOSQuestion.findByIdAndUpdate(questionId, updates, {
      new: true,
      runValidators: true,
    });

    if (!question) {
      return responseUtil.notFound(res, "Question not found");
    }

    return responseUtil.success(res, "Question updated successfully", { question });
  } catch (error) {
    console.error("Update daily SOS question error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid question ID format");
    }

    return responseUtil.internalError(res, "Failed to update question", error.message);
  }
};

export const deleteDailyQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await DailySOSQuestion.findById(questionId);
    if (!question) {
      return responseUtil.notFound(res, "Question not found");
    }

    await question.softDelete(req.user.id);

    return responseUtil.success(res, "Question removed successfully");
  } catch (error) {
    console.error("Delete daily SOS question error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid question ID format");
    }

    return responseUtil.internalError(res, "Failed to remove question", error.message);
  }
};

export const getTodayDailyQuestion = async (req, res) => {
  try {
    const today = dateKeyIST();
    const question = await DailySOSQuestion.findByDateKey(today);

    if (!question) {
      return responseUtil.success(res, "No question scheduled for today", {
        question: null,
        answered: false,
        date: today,
      });
    }

    const existing = await DailySOSAnswer.findForUserOnDate(req.user.id, today);

    return responseUtil.success(res, "Today's question fetched successfully", {
      question: {
        _id: question._id,
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.options,
      },
      answered: !!existing,
      answer: existing ? existing.answer : null,
      date: today,
    });
  } catch (error) {
    console.error("Get today's daily SOS question error:", error);
    return responseUtil.internalError(res, "Failed to fetch today's question", error.message);
  }
};

export const submitDailyAnswer = async (req, res) => {
  try {
    const today = dateKeyIST();
    const question = await DailySOSQuestion.findByDateKey(today);

    if (!question) {
      return responseUtil.notFound(res, "No question is scheduled for today");
    }

    const existing = await DailySOSAnswer.findForUserOnDate(req.user.id, today);
    if (existing) {
      return responseUtil.conflict(res, "You have already answered today's question");
    }

    const answer = await DailySOSAnswer.create({
      userId: req.user.id,
      questionId: question._id,
      dateKey: today,
      answer: req.body.answer,
    });

    return responseUtil.created(res, "Answer saved successfully", {
      answer: { _id: answer._id, dateKey: answer.dateKey, answeredAt: answer.answeredAt },
    });
  } catch (error) {
    console.error("Submit daily SOS answer error:", error);

    if (error.code === 11000) {
      return responseUtil.conflict(res, "You have already answered today's question");
    }

    return responseUtil.internalError(res, "Failed to save your answer", error.message);
  }
};

export const getDailyAnswerHistory = async (req, res) => {
  try {
    const { limit = 30 } = req.query;

    const answers = await DailySOSAnswer.find({ userId: req.user.id })
      .sort({ dateKey: -1 })
      .limit(Number(limit))
      .populate("questionId", "questionText questionType");

    return responseUtil.success(res, "History fetched successfully", {
      answers: answers.map((a) => ({
        _id: a._id,
        dateKey: a.dateKey,
        answer: a.answer,
        answeredAt: a.answeredAt,
        questionText: a.questionId ? a.questionId.questionText : null,
      })),
    });
  } catch (error) {
    console.error("Get daily SOS history error:", error);
    return responseUtil.internalError(res, "Failed to fetch history", error.message);
  }
};

// ============================================
// QUALITY OF LIFE CONTROLLERS
// ============================================

const summariseScores = (scores) => {
  if (!scores.length) return { mostDegrading: null, mostSorted: null };

  const diffs = scores.map((s) => s.difference);
  const maxDiff = Math.max(...diffs);
  const minDiff = Math.min(...diffs);

  const atMax = scores.filter((s) => s.difference === maxDiff);
  const atMin = scores.filter((s) => s.difference === minDiff);

  return {
    mostDegrading: {
      factorName: atMax[0].factorName,
      difference: maxDiff,
      tiedWith: atMax.slice(1).map((s) => s.factorName),
    },
    mostSorted: {
      factorName: atMin[0].factorName,
      difference: minDiff,
      tiedWith: atMin.slice(1).map((s) => s.factorName),
    },
  };
};

export const getQoLFactors = async (req, res) => {
  try {
    const factors = await QoLFactor.findActiveOrdered();
    return responseUtil.success(res, "Factors fetched successfully", {
      factors: factors.map((f) => ({ _id: f._id, name: f.name, order: f.order })),
    });
  } catch (error) {
    console.error("Get QoL factors error:", error);
    return responseUtil.internalError(res, "Failed to fetch factors", error.message);
  }
};

export const submitQoLEntry = async (req, res) => {
  try {
    const { scores } = req.body;
    const userId = req.user.id;
    const today = dateKeyIST();

    const factors = await QoLFactor.findActiveOrdered();
    if (!factors.length) {
      return responseUtil.badRequest(res, "No quality of life factors are configured yet");
    }

    const factorMap = new Map(factors.map((f) => [String(f._id), f]));

    const enriched = [];
    for (const entry of scores) {
      const factor = factorMap.get(String(entry.factorId));
      if (!factor) {
        return responseUtil.badRequest(res, `Unknown factor: ${entry.factorId}`);
      }
      enriched.push({
        factorId: factor._id,
        factorName: factor.name,
        current: entry.current,
        required: entry.required,
        difference: entry.required - entry.current,
      });
    }

    if (enriched.length !== factors.length) {
      return responseUtil.badRequest(
        res,
        `Please rate all ${factors.length} areas before submitting`
      );
    }

    const summary = summariseScores(enriched);

    const saved = await QoLEntry.findOneAndUpdate(
      { userId, dateKey: today },
      { userId, dateKey: today, scores: enriched, ...summary },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return responseUtil.success(res, "Quality of life saved successfully", { entry: saved });
  } catch (error) {
    console.error("Submit QoL entry error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(res, "Failed to save your ratings", error.message);
  }
};

export const getLatestQoLEntry = async (req, res) => {
  try {
    const entry = await QoLEntry.findLatestForUser(req.user.id);

    return responseUtil.success(res, "Latest entry fetched successfully", {
      entry,
      today: dateKeyIST(),
      hasEntryToday: !!entry && entry.dateKey === dateKeyIST(),
    });
  } catch (error) {
    console.error("Get latest QoL entry error:", error);
    return responseUtil.internalError(res, "Failed to fetch your ratings", error.message);
  }
};

export const getQoLHistory = async (req, res) => {
  try {
    const { limit = 12 } = req.query;

    const entries = await QoLEntry.find({ userId: req.user.id })
      .sort({ dateKey: -1 })
      .limit(Number(limit));

    return responseUtil.success(res, "History fetched successfully", { entries });
  } catch (error) {
    console.error("Get QoL history error:", error);
    return responseUtil.internalError(res, "Failed to fetch history", error.message);
  }
};

export const createQoLFactor = async (req, res) => {
  try {
    const factor = await QoLFactor.create({ ...req.body, createdBy: req.user.id });
    return responseUtil.created(res, "Factor added successfully", { factor });
  } catch (error) {
    console.error("Create QoL factor error:", error);
    return responseUtil.internalError(res, "Failed to add factor", error.message);
  }
};

export const getAllQoLFactors = async (req, res) => {
  try {
    const factors = await QoLFactor.find({}).sort({ order: 1, name: 1 });
    return responseUtil.success(res, "Factors fetched successfully", { factors });
  } catch (error) {
    console.error("Get all QoL factors error:", error);
    return responseUtil.internalError(res, "Failed to fetch factors", error.message);
  }
};

export const updateQoLFactor = async (req, res) => {
  try {
    const { factorId } = req.params;
    const factor = await QoLFactor.findByIdAndUpdate(
      factorId,
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    );

    if (!factor) {
      return responseUtil.notFound(res, "Factor not found");
    }

    return responseUtil.success(res, "Factor updated successfully", { factor });
  } catch (error) {
    console.error("Update QoL factor error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid factor ID format");
    }

    return responseUtil.internalError(res, "Failed to update factor", error.message);
  }
};

export const deleteQoLFactor = async (req, res) => {
  try {
    const { factorId } = req.params;

    const factor = await QoLFactor.findById(factorId);
    if (!factor) {
      return responseUtil.notFound(res, "Factor not found");
    }

    await factor.softDelete(req.user.id);

    return responseUtil.success(res, "Factor removed successfully");
  } catch (error) {
    console.error("Delete QoL factor error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid factor ID format");
    }

    return responseUtil.internalError(res, "Failed to remove factor", error.message);
  }
};
