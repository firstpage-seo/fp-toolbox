import { currentUsername } from "@/lib/auth";
import { getTeamsView, type TeamsView } from "@/lib/gateway/service";
import GatewayClient from "@/components/gateway/GatewayClient";
export const dynamic = "force-dynamic";

/**
 * /gateway — team-key management.
 * Champion view: own team's key + usage. Admin view (ADMIN_USERS): all teams,
 * team creation, all alerts.
 */
export default async function GatewayAdminPage() {
  const username = await currentUsername();
  let view: TeamsView;
  try {
    view = await getTeamsView(username);
  } catch (err) {
    console.error("gateway view failed:", err);
    view = {
      role: "none",
      teams: [],
      alerts: [],
      savings: null,
      error:
        "Gateway unavailable — the database or OpenRouter is unreachable. Check DATABASE_URL and OPENROUTER_MANAGEMENT_KEY, then reload.",
    };
  }

  return (
    <>
      <div className="bg-grad-banner text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-white text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-0.015em]">
              Team API Gateway
            </h1>
            <p className="mt-1.5 text-[14px] text-[oklch(0.93_0.02_250)]">
              Team API keys · OpenRouter BYOK · credit pool ${view.teams[0]?.creditUsd ?? 30}/mo per team
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GatewayClient initialView={view} username={username} />
      </main>
    </>
  );
}
