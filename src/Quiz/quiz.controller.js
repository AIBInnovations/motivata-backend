/**
 * @fileoverview Quiz controller with CRUD operations, submission handling, and comprehensive error handling
 * @module controllers/quiz
 */

import Quiz from "../../schema/Quiz.schema.js";
import responseUtil from "../../utils/response.util.js";

/**
 * Create a new quiz
 * @param {Object} req - Express request object
 * @param {Object} req.body - Quiz data
 * @param {string} req.body.title - Quiz title
 * @param {string} [req.body.shortDescription] - Brief description
 * @param {boolean} [req.body.isPaid] - Whether quiz is paid
 * @param {number} [req.body.price] - Quiz price (required if isPaid)
 * @param {number} [req.body.compareAtPrice] - Compare at price
 * @param {string} [req.body.enrollmentType] - Enrollment type (REGISTERED/OPEN)
 * @param {Array} [req.body.questions] - Quiz questions
 * @param {number} [req.body.timeLimit] - Time limit in minutes
 * @param {boolean} [req.body.shuffleQuestions] - Shuffle questions
 * @param {boolean} [req.body.showResults] - Show results after submission
 * @param {number} [req.body.maxAttempts] - Maximum attempts allowed
 * @param {Object} res - Express response object
 * @returns {Object} Response with created quiz
 */
export const createQuiz = async (req, res) => {
  try {
    const quizData = {
      ...req.body,
      createdBy: req.user.id,
    };

    // Validate compareAtPrice is greater than or equal to price
    if (quizData.compareAtPrice != null && quizData.price != null) {
      if (quizData.compareAtPrice < quizData.price) {
        return responseUtil.badRequest(
          res,
          "Compare at price must be greater than or equal to current price"
        );
      }
    }

    // Validate paid quiz has price
    if (quizData.isPaid && (!quizData.price || quizData.price <= 0)) {
      return responseUtil.badRequest(res, "Paid quizzes must have a price greater than 0");
    }

    const quiz = new Quiz(quizData);
    await quiz.save();

    return responseUtil.created(res, "Quiz created successfully", { quiz });
  } catch (error) {
    console.error("Create quiz error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.code === 11000) {
      return responseUtil.conflict(res, "A quiz with this title already exists");
    }

    return responseUtil.internalError(res, "Failed to create quiz", error.message);
  }
};

/**
 * Get all quizzes with pagination and filters
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {string} [req.query.sortBy=createdAt] - Sort field
 * @param {string} [req.query.sortOrder=desc] - Sort order (asc/desc)
 * @param {boolean} [req.query.isLive] - Filter by live status
 * @param {boolean} [req.query.isPaid] - Filter by paid status
 * @param {string} [req.query.enrollmentType] - Filter by enrollment type
 * @param {string} [req.query.search] - Search in title and description
 * @param {Object} res - Express response object
 * @returns {Object} Response with paginated quizzes
 */
export const getAllQuizzes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      isLive,
      isPaid,
      enrollmentType,
      search,
    } = req.query;

    // Validate pagination params
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    // Build query
    const query = {};

    if (typeof isLive !== "undefined") {
      query.isLive = isLive === "true" || isLive === true;
    }

    if (typeof isPaid !== "undefined") {
      query.isPaid = isPaid === "true" || isPaid === true;
    }

    if (enrollmentType) {
      if (!["REGISTERED", "OPEN"].includes(enrollmentType)) {
        return responseUtil.badRequest(res, "Invalid enrollment type. Use REGISTERED or OPEN");
      }
      query.enrollmentType = enrollmentType;
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ title: searchRegex }, { shortDescription: searchRegex }];
    }

    // Calculate pagination
    const skip = (pageNum - 1) * limitNum;
    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    // Execute query with pagination (exclude submissions for list view)
    const [quizzes, totalCount] = await Promise.all([
      Quiz.find(query)
        .select("-submissions -questions")
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate("createdBy", "name email"),
      Quiz.countDocuments(query),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    return responseUtil.success(res, "Quizzes fetched successfully", {
      quizzes,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    console.error("Get all quizzes error:", error);
    return responseUtil.internalError(res, "Failed to fetch quizzes", error.message);
  }
};

/**
 * Get single quiz by ID
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with quiz details
 */
export const getQuizById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    const quiz = await Quiz.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("enrollments", "name email phone");

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
 * Get quiz for user (without correct answers)
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with quiz (answers hidden)
 */
export const getQuizForUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    const quiz = await Quiz.findById(id).select("-submissions");

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    // Check if quiz is live
    if (!quiz.isLive) {
      return responseUtil.forbidden(res, "This quiz is not currently available");
    }

    // Check enrollment for REGISTERED quizzes
    if (quiz.enrollmentType === "REGISTERED" && userId) {
      if (!quiz.isUserEnrolled(userId)) {
        return responseUtil.forbidden(res, "You must be enrolled to access this quiz");
      }
    } else if (quiz.enrollmentType === "REGISTERED" && !userId) {
      return responseUtil.unauthorized(res, "Please login and enroll to access this quiz");
    }

    // Check if user can attempt
    if (userId && !quiz.canUserAttempt(userId)) {
      return responseUtil.forbidden(res, "You have reached the maximum number of attempts for this quiz");
    }

    // Remove correct answers from questions for user view
    const sanitizedQuiz = quiz.toObject();
    if (sanitizedQuiz.questions) {
      sanitizedQuiz.questions = sanitizedQuiz.questions.map((q) => {
        const sanitizedQuestion = { ...q };
        delete sanitizedQuestion.correctAnswer;
        if (sanitizedQuestion.options) {
          sanitizedQuestion.options = sanitizedQuestion.options.map((opt) => ({
            text: opt.text,
            _id: opt._id,
          }));
        }
        return sanitizedQuestion;
      });

      // Shuffle questions if enabled
      if (quiz.shuffleQuestions) {
        sanitizedQuiz.questions = shuffleArray([...sanitizedQuiz.questions]);
      }
    }

    // Get user's attempt count
    let attemptCount = 0;
    if (userId) {
      attemptCount = quiz.getUserAttemptCount(userId);
    }

    return responseUtil.success(res, "Quiz fetched successfully", {
      quiz: sanitizedQuiz,
      attemptCount,
      remainingAttempts: quiz.maxAttempts ? quiz.maxAttempts - attemptCount : null,
    });
  } catch (error) {
    console.error("Get quiz for user error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid quiz ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch quiz", error.message);
  }
};

/**
 * Update quiz
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} req.body - Updated quiz data
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated quiz
 */
export const updateQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    const updates = {
      ...req.body,
      updatedBy: req.user.id,
    };

    // Remove fields that shouldn't be updated directly
    delete updates.createdBy;
    delete updates.isDeleted;
    delete updates.deletedAt;
    delete updates.deletedBy;
    delete updates.submissions; // Don't allow direct modification of submissions
    delete updates.enrollments; // Use separate endpoint for enrollments

    // Validate compareAtPrice if both price and compareAtPrice are being updated
    if (updates.compareAtPrice != null && updates.price != null) {
      if (updates.compareAtPrice < updates.price) {
        return responseUtil.badRequest(
          res,
          "Compare at price must be greater than or equal to current price"
        );
      }
    }

    // If only compareAtPrice is being updated, check against existing price
    if (updates.compareAtPrice != null && updates.price == null) {
      const existingQuiz = await Quiz.findById(id);
      if (!existingQuiz) {
        return responseUtil.notFound(res, "Quiz not found");
      }
      if (updates.compareAtPrice < existingQuiz.price) {
        return responseUtil.badRequest(
          res,
          "Compare at price must be greater than or equal to current price"
        );
      }
    }

    // Validate paid quiz has price
    if (updates.isPaid && (!updates.price || updates.price <= 0)) {
      const existingQuiz = await Quiz.findById(id);
      if (existingQuiz && (!existingQuiz.price || existingQuiz.price <= 0)) {
        return responseUtil.badRequest(res, "Paid quizzes must have a price greater than 0");
      }
    }

    const quiz = await Quiz.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    return responseUtil.success(res, "Quiz updated successfully", { quiz });
  } catch (error) {
    console.error("Update quiz error:", error);

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
 * Add questions to quiz
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} req.body - Questions data
 * @param {Array} req.body.questions - Array of questions to add
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated quiz
 */
export const addQuestions = async (req, res) => {
  try {
    const { id } = req.params;
    const { questions } = req.body;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return responseUtil.badRequest(res, "Questions array is required");
    }

    const quiz = await Quiz.findById(id);

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    // Check if quiz has submissions
    if (quiz.submissions && quiz.submissions.length > 0) {
      return responseUtil.badRequest(
        res,
        "Cannot add questions to a quiz that has submissions. Please create a new quiz."
      );
    }

    // Add questions with order numbers
    const startOrder = quiz.questions.length;
    const questionsWithOrder = questions.map((q, index) => ({
      ...q,
      order: q.order ?? startOrder + index,
    }));

    quiz.questions.push(...questionsWithOrder);
    quiz.updatedBy = req.user.id;
    await quiz.save();

    return responseUtil.success(res, "Questions added successfully", { quiz });
  } catch (error) {
    console.error("Add questions error:", error);

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

    return responseUtil.internalError(res, "Failed to add questions", error.message);
  }
};

/**
 * Update a specific question
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {string} req.params.questionId - Question ID
 * @param {Object} req.body - Updated question data
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated quiz
 */
export const updateQuestion = async (req, res) => {
  try {
    const { id, questionId } = req.params;

    if (!id || !questionId) {
      return responseUtil.badRequest(res, "Quiz ID and Question ID are required");
    }

    const quiz = await Quiz.findById(id);

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    const questionIndex = quiz.questions.findIndex((q) => q._id.toString() === questionId);

    if (questionIndex === -1) {
      return responseUtil.notFound(res, "Question not found");
    }

    // Check if quiz has submissions
    if (quiz.submissions && quiz.submissions.length > 0) {
      return responseUtil.badRequest(
        res,
        "Cannot modify questions for a quiz that has submissions. Please create a new quiz."
      );
    }

    // Update question fields
    const updates = req.body;
    delete updates._id; // Don't allow _id updates

    Object.assign(quiz.questions[questionIndex], updates);
    quiz.updatedBy = req.user.id;
    await quiz.save();

    return responseUtil.success(res, "Question updated successfully", { quiz });
  } catch (error) {
    console.error("Update question error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map((key) => ({
        field: key,
        message: error.errors[key].message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid ID format");
    }

    return responseUtil.internalError(res, "Failed to update question", error.message);
  }
};

/**
 * Delete a specific question
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {string} req.params.questionId - Question ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated quiz
 */
export const deleteQuestion = async (req, res) => {
  try {
    const { id, questionId } = req.params;

    if (!id || !questionId) {
      return responseUtil.badRequest(res, "Quiz ID and Question ID are required");
    }

    const quiz = await Quiz.findById(id);

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    const questionIndex = quiz.questions.findIndex((q) => q._id.toString() === questionId);

    if (questionIndex === -1) {
      return responseUtil.notFound(res, "Question not found");
    }

    // Check if quiz has submissions
    if (quiz.submissions && quiz.submissions.length > 0) {
      return responseUtil.badRequest(
        res,
        "Cannot delete questions from a quiz that has submissions. Please create a new quiz."
      );
    }

    quiz.questions.splice(questionIndex, 1);
    quiz.updatedBy = req.user.id;
    await quiz.save();

    return responseUtil.success(res, "Question deleted successfully", { quiz });
  } catch (error) {
    console.error("Delete question error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid ID format");
    }

    return responseUtil.internalError(res, "Failed to delete question", error.message);
  }
};

/**
 * Submit quiz answers
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} req.body - Submission data
 * @param {Array} req.body.answers - Array of answers
 * @param {number} [req.body.timeTaken] - Time taken in seconds
 * @param {Object} res - Express response object
 * @returns {Object} Response with submission result
 */
export const submitQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers, timeTaken } = req.body;
    const userId = req.user.id;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    if (!answers || !Array.isArray(answers)) {
      return responseUtil.badRequest(res, "Answers array is required");
    }

    const quiz = await Quiz.findById(id);

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    // Check if quiz is live
    if (!quiz.isLive) {
      return responseUtil.forbidden(res, "This quiz is not currently available");
    }

    // Check enrollment for REGISTERED quizzes
    if (quiz.enrollmentType === "REGISTERED" && !quiz.isUserEnrolled(userId)) {
      return responseUtil.forbidden(res, "You must be enrolled to submit this quiz");
    }

    // Check if user can attempt
    if (!quiz.canUserAttempt(userId)) {
      return responseUtil.forbidden(res, "You have reached the maximum number of attempts for this quiz");
    }

    // Check time limit
    if (quiz.timeLimit && timeTaken) {
      const timeLimitSeconds = quiz.timeLimit * 60;
      if (timeTaken > timeLimitSeconds + 30) {
        // 30 seconds grace period
        return responseUtil.badRequest(res, "Time limit exceeded");
      }
    }

    // Grade the submission
    const gradedAnswers = [];
    let totalScore = 0;
    let totalPossiblePoints = 0;

    for (const question of quiz.questions) {
      totalPossiblePoints += question.points || 0;
      const userAnswer = answers.find((a) => a.questionId === question._id.toString());

      const gradedAnswer = {
        questionId: question._id,
        answer: userAnswer?.answer || null,
        selectedOptions: userAnswer?.selectedOptions || [],
        skipped: !userAnswer || (!userAnswer.answer && (!userAnswer.selectedOptions || userAnswer.selectedOptions.length === 0)),
        isCorrect: null,
        pointsAwarded: 0,
      };

      if (!gradedAnswer.skipped) {
        let isCorrect = false;

        if (question.questionType === "QNA") {
          // For QNA, mark as pending for manual review
          gradedAnswer.isCorrect = null;
        } else if (question.questionType === "MCQ_SINGLE") {
          // For single choice MCQ
          if (
            userAnswer.selectedOptions &&
            userAnswer.selectedOptions.length === 1
          ) {
            const selectedIndex = userAnswer.selectedOptions[0];
            isCorrect =
              question.options[selectedIndex] &&
              question.options[selectedIndex].isCorrect;
            gradedAnswer.isCorrect = isCorrect;
            if (isCorrect) {
              gradedAnswer.pointsAwarded = question.points || 0;
              totalScore += gradedAnswer.pointsAwarded;
            }
          }
        } else if (question.questionType === "MCQ_MULTIPLE") {
          // For multiple choice MCQ
          const correctIndices = question.options
            .map((opt, idx) => (opt.isCorrect ? idx : -1))
            .filter((idx) => idx !== -1);
          const selectedIndices = userAnswer.selectedOptions || [];

          // Check if arrays are equal
          isCorrect =
            correctIndices.length === selectedIndices.length &&
            correctIndices.every((idx) => selectedIndices.includes(idx));
          gradedAnswer.isCorrect = isCorrect;
          if (isCorrect) {
            gradedAnswer.pointsAwarded = question.points || 0;
            totalScore += gradedAnswer.pointsAwarded;
          }
        }
      }

      gradedAnswers.push(gradedAnswer);
    }

    // Create submission
    const submission = {
      userId,
      answers: gradedAnswers,
      score: totalScore,
      totalPoints: totalPossiblePoints,
      submittedAt: new Date(),
      timeTaken: timeTaken || null,
      status: quiz.questions.some((q) => q.questionType === "QNA") ? "PENDING" : "GRADED",
    };

    quiz.submissions.push(submission);
    await quiz.save();

    // Prepare response based on showResults setting
    const result = {
      submissionId: quiz.submissions[quiz.submissions.length - 1]._id,
      score: totalScore,
      totalPoints: totalPossiblePoints,
      percentage: totalPossiblePoints > 0 ? Math.round((totalScore / totalPossiblePoints) * 100) : 0,
      status: submission.status,
      submittedAt: submission.submittedAt,
    };

    if (quiz.showResults) {
      result.answers = gradedAnswers.map((a) => ({
        questionId: a.questionId,
        isCorrect: a.isCorrect,
        pointsAwarded: a.pointsAwarded,
        skipped: a.skipped,
      }));
    }

    return responseUtil.success(res, "Quiz submitted successfully", { result });
  } catch (error) {
    console.error("Submit quiz error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid ID format");
    }

    return responseUtil.internalError(res, "Failed to submit quiz", error.message);
  }
};

/**
 * Get user's submissions for a quiz
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with user's submissions
 */
export const getUserSubmissions = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    const quiz = await Quiz.findById(id).select("title submissions maxAttempts showResults");

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    const userSubmissions = quiz.submissions.filter(
      (sub) => sub.userId.toString() === userId.toString()
    );

    const submissions = userSubmissions.map((sub) => ({
      submissionId: sub._id,
      score: sub.score,
      totalPoints: sub.totalPoints,
      percentage: sub.totalPoints > 0 ? Math.round((sub.score / sub.totalPoints) * 100) : 0,
      status: sub.status,
      submittedAt: sub.submittedAt,
      timeTaken: sub.timeTaken,
      answers: quiz.showResults ? sub.answers : undefined,
    }));

    return responseUtil.success(res, "Submissions fetched successfully", {
      quizTitle: quiz.title,
      submissions,
      attemptCount: userSubmissions.length,
      maxAttempts: quiz.maxAttempts,
      remainingAttempts: quiz.maxAttempts ? quiz.maxAttempts - userSubmissions.length : null,
    });
  } catch (error) {
    console.error("Get user submissions error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid quiz ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch submissions", error.message);
  }
};

/**
 * Get all submissions for a quiz (admin)
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=20] - Items per page
 * @param {string} [req.query.status] - Filter by status
 * @param {Object} res - Express response object
 * @returns {Object} Response with all submissions
 */
export const getAllSubmissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    const quiz = await Quiz.findById(id)
      .select("title submissions")
      .populate("submissions.userId", "name email phone");

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    let submissions = quiz.submissions;

    // Filter by status if provided
    if (status) {
      if (!["PENDING", "GRADED", "REVIEWED"].includes(status)) {
        return responseUtil.badRequest(res, "Invalid status. Use PENDING, GRADED, or REVIEWED");
      }
      submissions = submissions.filter((sub) => sub.status === status);
    }

    // Sort by submittedAt descending
    submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    // Paginate
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedSubmissions = submissions.slice(startIndex, endIndex);

    const totalCount = submissions.length;
    const totalPages = Math.ceil(totalCount / limitNum);

    return responseUtil.success(res, "Submissions fetched successfully", {
      quizTitle: quiz.title,
      submissions: paginatedSubmissions,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Get all submissions error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid quiz ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch submissions", error.message);
  }
};

/**
 * Grade/Review a submission (admin)
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {string} req.params.submissionId - Submission ID
 * @param {Object} req.body - Grading data
 * @param {Array} req.body.grades - Array of grades for QNA questions
 * @param {Object} res - Express response object
 * @returns {Object} Response with graded submission
 */
export const gradeSubmission = async (req, res) => {
  try {
    const { id, submissionId } = req.params;
    const { grades } = req.body;

    if (!id || !submissionId) {
      return responseUtil.badRequest(res, "Quiz ID and Submission ID are required");
    }

    if (!grades || !Array.isArray(grades)) {
      return responseUtil.badRequest(res, "Grades array is required");
    }

    const quiz = await Quiz.findById(id);

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    const submissionIndex = quiz.submissions.findIndex(
      (sub) => sub._id.toString() === submissionId
    );

    if (submissionIndex === -1) {
      return responseUtil.notFound(res, "Submission not found");
    }

    const submission = quiz.submissions[submissionIndex];
    let newScore = 0;

    // Apply grades
    for (const grade of grades) {
      const answerIndex = submission.answers.findIndex(
        (a) => a.questionId.toString() === grade.questionId
      );

      if (answerIndex !== -1) {
        submission.answers[answerIndex].isCorrect = grade.isCorrect;
        submission.answers[answerIndex].pointsAwarded = grade.points || 0;
      }
    }

    // Recalculate total score
    for (const answer of submission.answers) {
      newScore += answer.pointsAwarded || 0;
    }

    submission.score = newScore;
    submission.status = "REVIEWED";

    await quiz.save();

    return responseUtil.success(res, "Submission graded successfully", {
      submission: {
        submissionId: submission._id,
        score: submission.score,
        totalPoints: submission.totalPoints,
        percentage:
          submission.totalPoints > 0
            ? Math.round((submission.score / submission.totalPoints) * 100)
            : 0,
        status: submission.status,
        answers: submission.answers,
      },
    });
  } catch (error) {
    console.error("Grade submission error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid ID format");
    }

    return responseUtil.internalError(res, "Failed to grade submission", error.message);
  }
};

/**
 * Enroll user in quiz
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming enrollment
 */
export const enrollUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    const quiz = await Quiz.findById(id);

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    if (!quiz.isLive) {
      return responseUtil.forbidden(res, "This quiz is not currently available for enrollment");
    }

    if (quiz.isUserEnrolled(userId)) {
      return responseUtil.badRequest(res, "You are already enrolled in this quiz");
    }

    // For paid quizzes, check payment (this would integrate with payment system)
    if (quiz.isPaid) {
      // TODO: Integrate with payment verification
      return responseUtil.badRequest(res, "Paid quiz enrollment requires payment verification");
    }

    await quiz.enrollUser(userId);

    return responseUtil.success(res, "Successfully enrolled in quiz", {
      quizId: quiz._id,
      quizTitle: quiz.title,
    });
  } catch (error) {
    console.error("Enroll user error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid quiz ID format");
    }

    return responseUtil.internalError(res, "Failed to enroll in quiz", error.message);
  }
};

/**
 * Soft delete quiz
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming deletion
 */
export const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    const quiz = await Quiz.findById(id);

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    await quiz.softDelete(req.user.id);

    return responseUtil.success(res, "Quiz deleted successfully");
  } catch (error) {
    console.error("Delete quiz error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid quiz ID format");
    }

    return responseUtil.internalError(res, "Failed to delete quiz", error.message);
  }
};

/**
 * Restore soft deleted quiz
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with restored quiz
 */
export const restoreQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    const quiz = await Quiz.findOne({ _id: id, isDeleted: true }).select(
      "+isDeleted +deletedAt +deletedBy"
    );

    if (!quiz) {
      return responseUtil.notFound(res, "Deleted quiz not found");
    }

    await quiz.restore();

    return responseUtil.success(res, "Quiz restored successfully", { quiz });
  } catch (error) {
    console.error("Restore quiz error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid quiz ID format");
    }

    return responseUtil.internalError(res, "Failed to restore quiz", error.message);
  }
};

/**
 * Get all soft deleted quizzes
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {Object} res - Express response object
 * @returns {Object} Response with deleted quizzes
 */
export const getDeletedQuizzes = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [quizzes, totalCount] = await Promise.all([
      Quiz.findDeleted()
        .select("-questions -submissions")
        .skip(skip)
        .limit(limitNum)
        .populate("createdBy", "name email")
        .populate("deletedBy", "name email")
        .sort({ deletedAt: -1 }),
      Quiz.countDocuments({ isDeleted: true }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return responseUtil.success(res, "Deleted quizzes fetched successfully", {
      quizzes,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Get deleted quizzes error:", error);
    return responseUtil.internalError(res, "Failed to fetch deleted quizzes", error.message);
  }
};

/**
 * Permanently delete quiz (Super Admin only)
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} res - Express response object
 * @returns {Object} Response confirming permanent deletion
 */
export const permanentDeleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    const quiz = await Quiz.findById(id).select("+isDeleted");

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    if (!quiz.isDeleted) {
      return responseUtil.badRequest(res, "Quiz must be soft deleted first");
    }

    await Quiz.permanentDelete(id);

    return responseUtil.success(res, "Quiz permanently deleted");
  } catch (error) {
    console.error("Permanent delete quiz error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid quiz ID format");
    }

    return responseUtil.internalError(res, "Failed to permanently delete quiz", error.message);
  }
};

/**
 * Toggle quiz live status
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated quiz
 */
export const toggleQuizLiveStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    const quiz = await Quiz.findById(id);

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    // Validate quiz has questions before going live
    if (!quiz.isLive && (!quiz.questions || quiz.questions.length === 0)) {
      return responseUtil.badRequest(res, "Cannot activate quiz without questions");
    }

    quiz.isLive = !quiz.isLive;
    quiz.updatedBy = req.user.id;
    await quiz.save();

    return responseUtil.success(
      res,
      `Quiz ${quiz.isLive ? "activated" : "deactivated"} successfully`,
      { quiz }
    );
  } catch (error) {
    console.error("Toggle quiz live status error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid quiz ID format");
    }

    return responseUtil.internalError(res, "Failed to toggle quiz status", error.message);
  }
};

/**
 * Get quiz statistics
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Quiz ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with quiz statistics
 */
export const getQuizStats = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return responseUtil.badRequest(res, "Quiz ID is required");
    }

    const quiz = await Quiz.findById(id).select(
      "title questions submissions enrollments isLive maxAttempts"
    );

    if (!quiz) {
      return responseUtil.notFound(res, "Quiz not found");
    }

    const submissions = quiz.submissions || [];
    const totalSubmissions = submissions.length;
    const uniqueParticipants = [...new Set(submissions.map((s) => s.userId.toString()))].length;

    // Calculate scores
    const scores = submissions.map((s) =>
      s.totalPoints > 0 ? (s.score / s.totalPoints) * 100 : 0
    );
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    // Status breakdown
    const statusBreakdown = {
      PENDING: submissions.filter((s) => s.status === "PENDING").length,
      GRADED: submissions.filter((s) => s.status === "GRADED").length,
      REVIEWED: submissions.filter((s) => s.status === "REVIEWED").length,
    };

    const stats = {
      quizId: quiz._id,
      title: quiz.title,
      isLive: quiz.isLive,
      questionCount: quiz.questions?.length || 0,
      totalPoints: quiz.totalPoints,
      enrollmentCount: quiz.enrollments?.length || 0,
      totalSubmissions,
      uniqueParticipants,
      averageScore: Math.round(averageScore * 100) / 100,
      highestScore: Math.round(highestScore * 100) / 100,
      lowestScore: Math.round(lowestScore * 100) / 100,
      statusBreakdown,
      maxAttempts: quiz.maxAttempts,
    };

    return responseUtil.success(res, "Quiz statistics retrieved successfully", { stats });
  } catch (error) {
    console.error("Get quiz stats error:", error);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid quiz ID format");
    }

    return responseUtil.internalError(res, "Failed to fetch quiz statistics", error.message);
  }
};

/**
 * Get quizzes for dropdown (lightweight)
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {boolean} [req.query.isLive] - Filter by live status
 * @param {string} [req.query.search] - Search by title
 * @param {Object} res - Express response object
 * @returns {Object} Response with quizzes list for dropdown
 */
export const getQuizzesForDropdown = async (req, res) => {
  try {
    const { isLive, search } = req.query;

    const query = {};

    if (typeof isLive !== "undefined") {
      query.isLive = isLive === "true" || isLive === true;
    }

    if (search) {
      query.title = new RegExp(search, "i");
    }

    const quizzes = await Quiz.find(query)
      .select("_id title isPaid price enrollmentType isLive questionCount")
      .sort({ title: 1 })
      .lean();

    return responseUtil.success(res, "Quizzes fetched successfully", { quizzes });
  } catch (error) {
    console.error("Get quizzes for dropdown error:", error);
    return responseUtil.internalError(res, "Failed to fetch quizzes", error.message);
  }
};

/**
 * Shuffle array helper function
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export default {
  createQuiz,
  getAllQuizzes,
  getQuizById,
  getQuizForUser,
  updateQuiz,
  addQuestions,
  updateQuestion,
  deleteQuestion,
  submitQuiz,
  getUserSubmissions,
  getAllSubmissions,
  gradeSubmission,
  enrollUser,
  deleteQuiz,
  restoreQuiz,
  getDeletedQuizzes,
  permanentDeleteQuiz,
  toggleQuizLiveStatus,
  getQuizStats,
  getQuizzesForDropdown,
};
