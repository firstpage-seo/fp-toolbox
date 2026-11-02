import type { ToolManifest } from "@/lib/registry";

const manifest: ToolManifest = {
  slug: "render-diff",
  name: "Render Diff Checker",
  description:
    "Compare a page's raw server HTML against its JS-rendered DOM — find client-side rendering that hides content from search engines.",
  category: "SEO Technical",
  owner: "FirstPage Team",
  status: "active",
  icon: "🔬",
};

export default manifest;
