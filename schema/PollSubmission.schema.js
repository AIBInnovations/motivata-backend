import mongoose from "mongoose";

const pollSubmissionSchema = new mongoose.Schema(
  {
    /**
     * Reference to Poll
     */
    pollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Poll",
      required: [true, "Poll ID is required"],
    },

    /**
     * Reference to Event (denormalized for quick queries)
     */
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
    },

    /**
     * Reference to User who submitted the poll
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    /**
     * User's answers - array of question index to selected option index
     * Example: [
     *   { questionIndex: 0, selectedOptionIndex: 1 },
     *   { questionIndex: 1, selectedOptionIndex: 2 }
     * ]
     */
    answers: [
      {
        questionIndex: {
          type: Number,
          required: [true, "Question index is required"],
          min: 0,
        },
        selectedOptionIndex: {
          type: Number,
          required: [true, "Selected option index is required"],
          min: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for query performance
// pollSubmissionSchema.index({ pollId: 1 });
// pollSubmissionSchema.index({ eventId: 1 });
// pollSubmissionSchema.index({ userId: 1 });
// pollSubmissionSchema.index({ createdAt: -1 });

// Compound index to ensure one submission per user per poll
pollSubmissionSchema.index({ pollId: 1, userId: 1 }, { unique: true });

// Index for aggregating statistics
pollSubmissionSchema.index({ pollId: 1, "answers.questionIndex": 1 });

const PollSubmission = mongoose.model("PollSubmission", pollSubmissionSchema);

export default PollSubmission;
