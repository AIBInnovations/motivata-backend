/**
 * One-time script: Register Calendly webhook for invitee.created events.
 * Run once: node scripts/registerCalendlyWebhook.js
 *
 * After running, copy the "signing_key" from the output into .env:
 *   CALENDLY_WEBHOOK_SIGNING_KEY=<signing_key>
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const PAT = process.env.CALENDLY_PAT;
const WEBHOOK_URL = 'https://motivata.synquic.com/api/app/calendly/webhook';

if (!PAT) {
  console.error('CALENDLY_PAT not set in .env');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' };

const run = async () => {
  // 1. Get current user URI
  const { data: me } = await axios.get('https://api.calendly.com/users/me', { headers });
  const userUri = me.resource.uri;
  const orgUri = me.resource.current_organization;
  console.log('User URI:', userUri);
  console.log('Org URI:', orgUri);

  // 2. List existing webhooks to avoid duplicates
  const { data: existing } = await axios.get(
    `https://api.calendly.com/webhook_subscriptions?organization=${encodeURIComponent(orgUri)}&scope=organization`,
    { headers }
  );
  const alreadyExists = existing.collection?.find(w => w.callback_url === WEBHOOK_URL);
  if (alreadyExists) {
    console.log('\nWebhook already registered:');
    console.log('  URI:', alreadyExists.uri);
    console.log('  State:', alreadyExists.state);
    console.log('  Signing Key:', alreadyExists.signing_key || '(not shown after creation)');
    console.log('\nIf you need the signing key, delete and re-register.');
    return;
  }

  // 3. Register webhook
  const { data: created } = await axios.post(
    'https://api.calendly.com/webhook_subscriptions',
    {
      url: WEBHOOK_URL,
      events: ['invitee.created', 'invitee.canceled'],
      organization: orgUri,
      scope: 'organization',
    },
    { headers }
  );

  console.log('\nWebhook registered successfully!');
  console.log('  URI:', created.resource.uri);
  console.log('  State:', created.resource.state);
  console.log('  Signing Key:', created.resource.signing_key);
  console.log('\nAdd this to your .env:');
  console.log(`  CALENDLY_WEBHOOK_SIGNING_KEY=${created.resource.signing_key}`);
};

run().catch(e => {
  console.error('Error:', e.response?.data || e.message);
  process.exit(1);
});
