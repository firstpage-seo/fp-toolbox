import type { ToolManifest } from "@/lib/registry";

const manifest: ToolManifest = {
  slug: "tool-usage",
  name: "Tool Usage Stats",
  description:
    "Who is using the toolbox — runs per tool, active users and LLM cost, all-time or in a window.",
  category: "Operations",
  owner: "FirstPage Team",
  status: "active",
  icon: "📊",
};

export default manifest;
