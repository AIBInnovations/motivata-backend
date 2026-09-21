import mongoose from "mongoose";

export const NOTIFICATION_CATEGORIES = [
  "CONNECTIONS",
  "SOS",
  "EVENTS",
  "OPPORTUNITIES",
  "CHALLENGES",
  "COMMUNITY",
  "GENERAL",
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, default: "GENERAL" },
    type: { type: String, trim: true, required: true },
    title: { type: String, trim: true, required: true, maxlength: 200 },
    body: { type: String, trim: true, default: "", maxlength: 1000 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
