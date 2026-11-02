/**
 * Server bootstrap hook (Next.js instrumentation).
 * Starts the 5-minute uptime checker for the dashboard target and the hourly
 * gateway usage poller (80%/100% alerts).
 * Node runtime only — never runs in the edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startUptimeScheduler } = await import("./lib/uptime-scheduler");
    startUptimeScheduler();
    const { startGatewayAlertScheduler } = await import("./lib/gateway/alert-scheduler");
    startGatewayAlertScheduler();
    const { startGreetingScheduler } = await import("./lib/greeting-scheduler");
    startGreetingScheduler();
  }
}
