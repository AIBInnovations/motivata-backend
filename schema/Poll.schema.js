import mongoose from "mongoose";

const pollSchema = new mongoose.Schema(
  {
    /**
     * Reference to Event - each event can have one poll
     */
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
      unique: true,
    },

    /**
     * Array of poll questions with their options
     */
    questions: [
      {
        questionText: {
          type: String,
          required: [true, "Question text is required"],
          trim: true,
          minlength: 1,
          maxlength: 500,
        },
        options: {
          type: [String],
          required: [true, "Options are required"],
          validate: {
            validator: function (v) {
              return v && v.length >= 2;
            },
            message: "At least 2 options are required for each question",
          },
        },
      },
    ],

    /**
     * Whether the poll is active and accepting submissions
     */
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// pollSchema.index({ eventId: 1 });
// pollSchema.index({ isActive: 1 });

const Poll = mongoose.model("Poll", pollSchema);

export default Poll;
