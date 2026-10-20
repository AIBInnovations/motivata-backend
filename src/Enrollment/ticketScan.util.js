export const buildTicketScanClaim = (enrollmentId, matchedPhone, scannedAt, scannedBy) => {
  const base = `tickets.${matchedPhone}`;
  const set = {
    [`${base}.isTicketScanned`]: true,
    [`${base}.ticketScannedAt`]: scannedAt,
  };
  if (scannedBy !== undefined) {
    set[`${base}.ticketScannedBy`] = scannedBy;
  }
  return {
    filter: {
      _id: enrollmentId,
      [`${base}.status`]: "ACTIVE",
      [`${base}.isTicketScanned`]: { $ne: true },
    },
    update: { $set: set },
  };
};

export const claimTicketScan = async (EnrollmentModel, enrollmentId, matchedPhone, scannedAt, scannedBy) => {
  const { filter, update } = buildTicketScanClaim(enrollmentId, matchedPhone, scannedAt, scannedBy);
  const claimed = await EnrollmentModel.findOneAndUpdate(filter, update);
  return Boolean(claimed);
};
