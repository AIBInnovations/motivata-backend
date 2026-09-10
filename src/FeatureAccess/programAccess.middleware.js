import mongoose from 'mongoose';
import SOSProgram from '../Quiz/schemas/sosProgram.schema.js';
import User from '../../schema/User.schema.js';
import responseUtil from '../../utils/response.util.js';
import { resolveFeatureAccess } from './featureAccess.service.js';

const GATED_PROGRAM_TYPES = {
  ISOS: 'SOS_INTENSIVE',
};

const GATE_MESSAGE = {
  SOS_INTENSIVE: 'Intensive SOS is for Members and Doers only',
};

const userPhone = async (req) => {
  if (req.user?.phone) return req.user.phone;
  if (!req.user?.id) return null;
  const user = await User.findById(req.user.id).select('phone').lean();
  return user?.phone || null;
};

export const requireProgramAccess = async (req, res, next) => {
  try {
    const programId = req.params?.programId || req.body?.programId;
    if (!programId || !mongoose.Types.ObjectId.isValid(programId)) return next();

    const program = await SOSProgram.findById(programId).select('type').lean();
    const featureKey = program ? GATED_PROGRAM_TYPES[program.type] : null;
    if (!featureKey) return next();

    const phone = await userPhone(req);
    if (!phone) {
      return responseUtil.forbidden(res, GATE_MESSAGE[featureKey], featureKey);
    }

    const access = await resolveFeatureAccess(featureKey, phone);
    if (!access.hasAccess) {
      console.log('[PROGRAM-ACCESS] Denied', { featureKey, programId, reason: access.reason });
      return responseUtil.forbidden(res, GATE_MESSAGE[featureKey], featureKey);
    }

    return next();
  } catch (error) {
    console.error('[PROGRAM-ACCESS] Error:', error.message);
    return responseUtil.internalError(res, 'Failed to verify program access', error.message);
  }
};

export default requireProgramAccess;
