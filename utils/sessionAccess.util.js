const MEETING_LINK_STATUSES = new Set(["confirmed", "scheduled", "completed"]);
const MEETING_LINK_PAYMENT_STATUSES = new Set(["paid", "free"]);

export const bookingGrantsMeetingLink = (booking) => {
  if (!booking) return false;
  return (
    MEETING_LINK_STATUSES.has(booking.status) &&
    MEETING_LINK_PAYMENT_STATUSES.has(booking.paymentStatus)
  );
};

export const normalizeFocusArea = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 100) : undefined;
};

export const stripMeetingLink = (sessionObj, allowed) => {
  if (!sessionObj) return sessionObj;
  if (!allowed || !sessionObj.meetingLink) {
    delete sessionObj.meetingLink;
  }
  return sessionObj;
};
