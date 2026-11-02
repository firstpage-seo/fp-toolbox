import { sendGreetings } from "./greeting";

// ponytail: single-instance self-hosted deployment — a plain setInterval in the
// server process is the cheapest way to get a real every-5-minute sender.
// (Multi-instance deployments would double-send; acceptable here.)
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Dev HMR can re-run module scope; guard with a process-wide flag.
const globalKey = "__firstpageGreetingSchedulerStarted";
type GlobalWithGreeting = typeof globalThis & { [globalKey]?: boolean };

/** Start the background greeting sender. Safe to call multiple times. */
export function startGreetingScheduler(): void {
  const g = globalThis as GlobalWithGreeting;
  if (g[globalKey]) return;
  g[globalKey] = true;

  const run = (): void => {
    sendGreetings().catch((err) => {
      console.error("[greeting] scheduler run failed:", err);
    });
  };

  run(); // send once at boot, then every 5 minutes
  setInterval(run, CHECK_INTERVAL_MS);
  console.log("[greeting] scheduler started (every 5 min)");
}