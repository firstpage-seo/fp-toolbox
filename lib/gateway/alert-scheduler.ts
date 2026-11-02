/**
 * Gateway alert scheduler — polls OpenRouter key usage every GATEWAY_POLL_MINUTES
 * (default 60), snapshots each ACTIVE key's spend, and pushes 80%/100% alerts:
 *  - in-app: rows in deepseek_alerts_log (rendered by /gateway)
 *  - webhook: SLACK_WEBHOOK_URL (fire-and-forget, never crashes the loop)
 * Deduped per (key, level, calendar month) by the DB unique index.
 *
 * Started from root instrumentation.ts (same pattern as lib/uptime-scheduler.ts).
 */
import { listAllKeys, listTeams, pruneSnapshots, recordAlert, recordUsageSnapshot } from "./db";
import { listKeys } from "./openrouter";

const globalKey = "__firstpageGatewayAlertSchedulerStarted";
const DEFAULT_POLL_MINUTES = 60;

type GlobalWithGateway = typeof globalThis & { [globalKey]?: boolean };

/** Start the hourly usage poller. Safe to call multiple times (HMR guard). */
export function startGatewayAlertScheduler(): void {
  const g = globalThis as GlobalWithGateway;
  if (g[globalKey]) return;
  g[globalKey] = true;

  const minutes = Math.max(10, Number(process.env.GATEWAY_POLL_MINUTES) || DEFAULT_POLL_MINUTES);
  const run = (): void => {
    runGatewayAlertCheck().catch((err) => {
      console.error("[gateway] alert check failed:", err);
    });
  };
  run(); // poll once at boot, then every N minutes
  setInterval(run, minutes * 60 * 1000);
  console.log(`[gateway] alert checker started (every ${minutes} min)`);
}

/** One poll pass: snapshot active keys' usage + emit new 80%/100% alerts. */
export async function runGatewayAlertCheck(): Promise<void> {
  if (!process.env.OPENROUTER_MANAGEMENT_KEY) {
    console.warn("[gateway] OPENROUTER_MANAGEMENT_KEY unset — skipping alert check");
    return;
  }

  const teams = await listTeams();
  const localKeys = await listAllKeys();
  if (teams.length === 0 || localKeys.length === 0) return;

  await pruneSnapshots(60);

  const remoteKeys = await listKeys();
  const usageByHash = new Map(remoteKeys.map((k) => [k.hash, k]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const webhook = process.env.SLACK_WEBHOOK_URL;

  for (const key of localKeys) {
    if (key.status !== "active") continue;
    const team = teamById.get(key.teamId);
    if (!team) continue;
    const remote = usageByHash.get(key.hash);
    if (!remote) continue; // externally revoked / hash mismatch — nothing to track

    const credit = remote.usageMonthly;
    const byok = remote.byokUsageMonthly;
    // Effective spend matches the OpenRouter dashboard: credits + BYOK when
    // BYOK counts against the limit (include_byok_in_limit), credits only otherwise.
    const usage = remote.includeByokInLimit ? credit + byok : credit;
    const limit = key.limitUsd;
    await recordUsageSnapshot(key.id, team.id, usage, limit);

    const pct = (usage / limit) * 100;
    if (pct >= 100) {
      const fresh = await recordAlert(team.id, key.id, "100", usage);
      if (fresh) {
        await pushWebhook(
          webhook,
          `🚨 *${team.name}* key *${key.label}* hit its $${limit.toFixed(2)}/month monthly limit ($${usage.toFixed(2)} spent: $${credit.toFixed(2)} credits + $${byok.toFixed(2)} BYOK). OpenRouter is blocking requests — champion: ${team.champion}.`
        );
      }
    } else if (pct >= 80) {
      const fresh = await recordAlert(team.id, key.id, "80", usage);
      if (fresh) {
        await pushWebhook(
          webhook,
          `⚠️ *${team.name}* key *${key.label}* is at ${Math.round(pct)}% of its $${limit.toFixed(2)}/month limit ($${usage.toFixed(2)} spent: $${credit.toFixed(2)} credits + $${byok.toFixed(2)} BYOK). ~$${Math.max(0, limit - usage).toFixed(2)} left — champion: ${team.champion}.`
        );
      }
    }
  }
}

async function pushWebhook(url: string | undefined, text: string): Promise<void> {
  if (!url) return; // in-app alert still recorded; webhook is optional
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("[gateway] webhook push failed:", err);
  }
}
