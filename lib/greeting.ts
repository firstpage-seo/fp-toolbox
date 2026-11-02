import nodemailer from "nodemailer";
import { pool } from "./db";
import { greetingRecipients } from "./hubspot";
import type { GreetingRecipient } from "./hubspot";
import { buildGreetingEmail } from "./greeting-template";
import { cached } from "./cache";

export interface GreetingStats {
  sent: number;
  skippedNoOwner: number;
  failed: number;
}

export async function ensureGreetingTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS greeting_sent (
      contact_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      owner_id TEXT,
      owner_name TEXT NOT NULL DEFAULT '',
      owner_email TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      error TEXT,
      attempts INT NOT NULL DEFAULT 0
    )
  `);
  await pool.query(
    `ALTER TABLE greeting_sent ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0`
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS greeting_meta (
      meta_key TEXT PRIMARY KEY,
      meta_value TEXT NOT NULL
    )
  `);
}

/** Live only when deliberately enabled AND SMTP creds exist. */
function isLive(): boolean {
  return process.env.GREETING_DRY_RUN !== "1" && Boolean(process.env.SMTP_USER);
}

/** Max real send attempts per lead before giving up (default 3). */
function maxAttempts(): number {
  const n = Number(process.env.GREETING_MAX_ATTEMPTS ?? 3);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}

/**
 * Greeting sends only within HK business hours (Mon–Fri 09:00–18:00 HKT by
 * default) so a B2B email never lands at 3am. Override with
 * GREETING_HOURS_START / GREETING_HOURS_END (0–23, inclusive start, exclusive
 * end). Off-hours leads queue until the next window opens.
 */
function withinBusinessHours(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  if (weekday === "Sat" || weekday === "Sun") return false;
  const start = Number(process.env.GREETING_HOURS_START ?? 9);
  const end = Number(process.env.GREETING_HOURS_END ?? 18);
  return hour >= start && hour < end;
}

async function upsertGreeting(row: {
  contactId: string;
  email: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  subject: string;
  error: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO greeting_sent (contact_id, email, owner_id, owner_name, owner_email, subject, sent_at, error, attempts)
     VALUES ($1,$2,$3,$4,$5,$6, now(), $7, 1)
     ON CONFLICT (contact_id) DO UPDATE SET
       owner_id = EXCLUDED.owner_id,
       owner_name = EXCLUDED.owner_name,
       owner_email = EXCLUDED.owner_email,
       subject = EXCLUDED.subject,
       sent_at = now(),
       error = EXCLUDED.error,
       attempts = greeting_sent.attempts + 1`,
    [row.contactId, row.email, row.ownerId, row.ownerName, row.ownerEmail, row.subject, row.error]
  );
}

type SendItem = { recipient: GreetingRecipient; owner: { fullName: string; email: string } };

/**
 * Candidates for the current poll: recipients after the cold-start cutover,
 * not already successfully sent, with a resolvable owner. Shared by
 * sendGreetings() (the sender) and getGreetingStats() (the queued count) so the
 * page number can never drift from what the job would actually send.
 */
async function greetingCandidates(): Promise<{ toSend: SendItem[]; skippedNoOwner: number }> {
  await ensureGreetingTables();

  // Flip cutover: the moment the job first ran LIVE. A dedicated meta key —
  // the legacy `started_at` (written by the old dry-run code) is ignored, so
  // the cutover is genuinely the flip instant and no backlog is blasted.
  const { rows: startedRows } = await pool.query(
    `SELECT meta_value FROM greeting_meta WHERE meta_key = 'live_started_at'`
  );
  let startedAt: string;
  if (startedRows.length > 0) {
    startedAt = String(startedRows[0].meta_value);
  } else {
    startedAt = new Date().toISOString();
    if (isLive()) {
      await pool.query(
        `INSERT INTO greeting_meta (meta_key, meta_value) VALUES ('live_started_at', $1)
         ON CONFLICT (meta_key) DO NOTHING`,
        [startedAt]
      );
    }
  }

  // Resolved = already sent, or retried past the cap (give up, don't hammer).
  const { rows: resolvedRows } = await pool.query(
    `SELECT contact_id FROM greeting_sent WHERE error IS NULL OR attempts >= $1`,
    [maxAttempts()]
  );
  const resolved = new Set(resolvedRows.map((r) => String(r.contact_id)));

  const owners = await fetchOwners();

  const toSend: SendItem[] = [];
  let skippedNoOwner = 0;
  for (const r of await greetingRecipients(7)) {
    if (!(Date.parse(r.createdAt) >= Date.parse(startedAt))) continue;
    if (resolved.has(r.contactId)) continue;
    if (!r.ownerId) {
      skippedNoOwner++;
      continue;
    }
    const owner = owners.get(r.ownerId);
    if (!owner) {
      skippedNoOwner++;
      continue;
    }
    toSend.push({ recipient: r, owner });
  }
  return { toSend, skippedNoOwner };
}

async function fetchOwners(): Promise<Map<string, { fullName: string; email: string }>> {
  const token = process.env.HUBSPOT_SERVICE_KEY;
  if (!token) throw new Error("HUBSPOT_SERVICE_KEY not configured");
  const res = await fetch("https://api.hubapi.com/crm/v3/owners?limit=200", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HubSpot owners error ${res.status}`);
  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  const owners = new Map<string, { fullName: string; email: string }>();
  for (const o of data.results ?? []) {
    const email = String(o.email ?? "");
    const fullName = `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim();
    owners.set(String(o.id), { fullName: fullName || email, email });
  }
  return owners;
}

function greet(item: SendItem): { subject: string; text: string } {
  return buildGreetingEmail({
    ownerName: item.owner.fullName,
    company: item.recipient.company,
    lastName: item.recipient.lastName,
    firstName: item.recipient.firstName,
  });
}

async function printDryRun(item: SendItem): Promise<void> {
  console.log(
    `[greeting] dry-run would send to ${item.recipient.email} as ${item.owner.fullName} subject "${greet(item).subject}"`
  );
}

export interface GreetingStatsView {
  /** Successfully sent, all time. */
  totalSent: number;
  /** Successfully sent in the last N days. */
  sentDays: number;
  /** Errored rows still under the retry cap = pending retry. */
  retrying: number;
  /** Would-send queue right now (same selection the sender uses), memoized 5 min. */
  queued: number;
  /** Configured for live send (not dry-run). */
  live: boolean;
}

/** KPI view for the /leads page — counts from greeting_sent + live queued count, never throws. */
export async function getGreetingStats(days = 30): Promise<GreetingStatsView> {
  const live = isLive();
  const empty: GreetingStatsView = { totalSent: 0, sentDays: 0, retrying: 0, queued: 0, live };
  try {
    let queued = 0;
    try {
      queued = await cached(
        "greeting-queued",
        () => greetingCandidates().then((c) => c.toSend.length),
        5 * 60 * 1000
      );
    } catch (err) {
      console.error("getGreetingStats queued failed:", err);
    }
    const [{ rows: total }, { rows: windowed }, { rows: retry }] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM greeting_sent WHERE error IS NULL`),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM greeting_sent
         WHERE error IS NULL AND sent_at > now() - make_interval(days => ${Math.max(1, Math.floor(days))})`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM greeting_sent WHERE error IS NOT NULL AND attempts < $1`,
        [maxAttempts()]
      ),
    ]);
    return {
      totalSent: total[0].n ?? 0,
      sentDays: windowed[0].n ?? 0,
      retrying: retry[0].n ?? 0,
      queued,
      live,
    };
  } catch (err) {
    console.error("getGreetingStats failed:", err);
    return empty;
  }
}

export interface GreetingLogRow {
  contactId: string;
  email: string;
  ownerName: string;
  subject: string;
  sentAt: string;
  error: string | null;
}

/** Most recent greeting_sent rows — the "recently sent" (+ retrying) list for /leads. Never throws. */
export async function listRecentGreetings(limit = 20): Promise<GreetingLogRow[]> {
  try {
    await ensureGreetingTables();
    const { rows } = await pool.query(
      `SELECT contact_id, email, owner_name, subject, sent_at, error
       FROM greeting_sent
       ORDER BY sent_at DESC
       LIMIT ${Math.max(1, Math.min(100, Math.floor(limit)))}`
    );
    return rows.map((r) => ({
      contactId: String(r.contact_id),
      email: String(r.email),
      ownerName: String(r.owner_name ?? ""),
      subject: String(r.subject ?? ""),
      sentAt: String(r.sent_at ?? ""),
      error: r.error ? String(r.error) : null,
    }));
  } catch (err) {
    console.error("listRecentGreetings failed:", err);
    return [];
  }
}

export async function sendGreetings(): Promise<GreetingStats> {
  const stats: GreetingStats = { sent: 0, skippedNoOwner: 0, failed: 0 };
  try {
    const { toSend, skippedNoOwner } = await greetingCandidates();
    stats.skippedNoOwner = skippedNoOwner;

    if (!isLive()) {
      for (const item of toSend) {
        await printDryRun(item);
        stats.sent++;
      }
      return stats;
    }

    // Business-hours gate — only real sends are held back; queued leads wait
    // for the next window. Dry-run above is intentionally not gated (safe).
    if (!withinBusinessHours()) {
      console.log(
        `[greeting] outside business hours — ${toSend.length} lead(s) queued for the next window`
      );
      return stats;
    }

    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
    try {
      await transport.verify();
    } catch (err) {
      console.log(
        `[greeting] SMTP verify failed (${err instanceof Error ? err.message : String(err)}) — dry-run, no rows written`
      );
      for (const item of toSend) {
        await printDryRun(item);
        stats.sent++;
      }
      return stats;
    }

    for (const item of toSend) {
      try {
        const { subject, text } = greet(item);
        await transport.sendMail({
          from: { name: item.owner.fullName, address: process.env.SMTP_USER! },
          to: item.recipient.email,
          replyTo: item.owner.email,
          subject,
          text,
        });
        await upsertGreeting({
          contactId: item.recipient.contactId,
          email: item.recipient.email,
          ownerId: item.recipient.ownerId!,
          ownerName: item.owner.fullName,
          ownerEmail: item.owner.email,
          subject,
          error: null,
        });
        stats.sent++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await upsertGreeting({
          contactId: item.recipient.contactId,
          email: item.recipient.email,
          ownerId: item.recipient.ownerId!,
          ownerName: item.owner.fullName,
          ownerEmail: item.owner.email,
          subject: "",
          error: message,
        }).catch((dbErr) => console.error("[greeting] failed to record error:", dbErr));
        stats.failed++;
        console.error(`[greeting] send failed for ${item.recipient.email}:`, message);
      }
    }

    return stats;
  } catch (err) {
    console.error("sendGreetings failed:", err);
    return stats;
  }
}