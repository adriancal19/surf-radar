// Run by the GitHub Action in .github/workflows/send-alerts.yml.
// Usage: node scripts/send-alerts.js <path to the sent record>
//
// MODE=send       sends real alerts and records them (the daily schedule)
// MODE=dry-run    prints what would be sent, emails nobody and records nothing
// MODE=test-email sends one short test message to check the email setup
//
// Secrets, from GitHub: RESEND_API_KEY, ALERT_FROM, ALERT_TO (comma-separated).
// Nothing here should print them, because this repo's job logs are public.

import { readFile, writeFile } from 'node:fs/promises';
import { buoys } from '../buoys.js';
import { settings } from '../settings.js';
import { spots } from '../spots.js';
import {
  buildSurfEmail,
  buildTropicalEmail,
  findSurfAlerts,
  findTropicalAlerts,
  markSent,
  pruneSent,
} from '../src/alerts.js';
import { loadForecast } from '../src/pipeline.js';
import { fetchNhcSystems } from '../src/sources/nhc.js';

const statePath = process.argv[2];
const mode = process.env.MODE || 'send';
const { RESEND_API_KEY, ALERT_FROM, ALERT_TO } = process.env;
const recipients = (ALERT_TO ?? '').split(',').map((address) => address.trim()).filter(Boolean);
const emailReady = Boolean(RESEND_API_KEY && ALERT_FROM && recipients.length);
const now = new Date();

async function sendEmail(email, idempotencyKey) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'surf-radar',
      // If this job is ever rerun, Resend won't send the same email twice.
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from: ALERT_FROM, to: recipients, ...email }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    let message = body.message ?? 'no details';
    for (const address of [...recipients, ALERT_FROM]) message = message.replaceAll(address, '[hidden]');
    throw new Error(`Resend returned ${response.status}: ${message}`);
  }
}

function preview(email) {
  console.log(`--- Would send: ${email.subject}\n${email.text}\n`);
}

async function readSent() {
  try {
    return JSON.parse(await readFile(statePath, 'utf8'));
  } catch {
    return {};
  }
}

async function sendTest() {
  if (!emailReady) throw new Error('Email secrets are missing: RESEND_API_KEY, ALERT_FROM or ALERT_TO.');
  await sendEmail(
    {
      subject: 'Surf Radar test email',
      text: `Surf Radar alerts are set up. Real alerts will arrive when a spot is forecast at ${settings.alerts.minRating}+ three days out.\n\n${settings.siteUrl}`,
    },
    `test-${now.toISOString()}`,
  );
  console.log(`Test email sent to ${recipients.length} recipients.`);
}

async function run() {
  // Until the secrets are added, the daily job previews instead of failing every morning.
  const live = mode === 'send' && emailReady;
  if (mode === 'send' && !emailReady) console.log('Email secrets are not set yet, so this is a preview only.');

  let sent = pruneSent(await readSent(), now);
  let failed = false;

  const handle = async (label, alerts, build) => {
    if (alerts.length === 0) {
      console.log(`No new ${label} alerts.`);
      return;
    }
    const email = build(alerts);
    if (!live) {
      preview(email);
      return;
    }
    try {
      await sendEmail(email, alerts.map((alert) => alert.key).join(',').slice(0, 256));
      sent = markSent(sent, alerts, now);
      console.log(`Sent ${label} email with ${alerts.length} alerts.`);
    } catch (error) {
      console.error(`Could not send the ${label} email: ${error.message}`);
      failed = true;
    }
  };

  const forecast = await loadForecast(spots, buoys, settings);
  await handle('surf', findSurfAlerts(forecast, settings, sent), (alerts) => buildSurfEmail(alerts, settings));

  // A storm feed problem shouldn't stop surf alerts, but the job should still show as failed.
  try {
    const systems = await fetchNhcSystems(settings.tropical.minOutlookChance);
    await handle('tropical', findTropicalAlerts(systems, sent), (alerts) => buildTropicalEmail(alerts, settings));
  } catch (error) {
    console.error(`Could not check for tropical systems: ${error.message}`);
    failed = true;
  }

  if (live) await writeFile(statePath, JSON.stringify(sent, null, 2));
  if (failed) process.exit(1);
}

if (!statePath) {
  console.error('Usage: node scripts/send-alerts.js <path to the sent record>');
  process.exit(1);
}
if (mode === 'test-email') await sendTest();
else await run();
