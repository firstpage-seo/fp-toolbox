import { runUptimeCheck } from "./uptime";

// ponytail: single-instance self-hosted deployment — a plain setInterval in the
// server process is the cheapest way to get a real every-5-minute checker.
// (Multi-instance deployments would double-probe; acceptable here.)
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Dev HMR can re-run module scope; guard with a process-wide flag.
const globalKey = "__firstpageUptimeSchedulerStarted";
type GlobalWithUptime = typeof globalThis & { [globalKey]?: boolean };

/** Start the background uptime checker. Safe to call multiple times. */
export function startUptimeScheduler(): void {
  const g = globalThis as GlobalWithUptime;
  if (g[globalKey]) return;
  g[globalKey] = true;

  const target = process.env.DASHBOARD_TARGET_URL || "https://firstpage.hk";
  const run = (): void => {
    runUptimeCheck(target).catch((err) => {
      console.error("uptime check failed:", err);
    });
  };

  run(); // probe once at boot, then every 5 minutes
  setInterval(run, CHECK_INTERVAL_MS);
  console.log(`[uptime] checker started for ${target} (every 5 min)`);
}
