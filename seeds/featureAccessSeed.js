/**
 * @fileoverview Seed data for feature access settings
 * Initializes the 3 main features: SOS, CONNECT, CHALLENGE
 * @module seeds/featureAccessSeed
 */

import FeatureAccess from '../schema/FeatureAccess.schema.js';

const initialFeatures = [
  {
    featureKey: 'SOS',
    featureName: 'SOS Feature (Quizzes)',
    description: 'Access to SOS quizzes and assessments',
    requiresMembership: false,
    isActive: true,
  },
  {
    featureKey: 'CONNECT',
    featureName: 'Connect Feature (Clubs)',
    description: 'Access to clubs and community features',
    requiresMembership: false,
    isActive: true,
  },
  {
    featureKey: 'CHALLENGE',
    featureName: 'Challenge Feature (Challenges)',
    description: 'Access to challenges and competitions',
    requiresMembership: false,
    isActive: true,
  },
];

/**
 * Seeds feature access data
 * Uses upsert to avoid duplicates
 */
async function seedFeatureAccess() {
  try {
    console.log('[SEED] Starting feature access seed...');

    for (const feature of initialFeatures) {
      const result = await FeatureAccess.findOneAndUpdate(
        { featureKey: feature.featureKey },
        feature,
        { upsert: true, new: true }
      );
      console.log(`[SEED] ✅ ${feature.featureKey} - ${result.featureName}`);
    }

    console.log('[SEED] ✅ Feature access data seeded successfully');
  } catch (error) {
    console.error('[SEED] ❌ Error seeding feature access data:', error.message);
    throw error;
  }
}

export default seedFeatureAccess;
