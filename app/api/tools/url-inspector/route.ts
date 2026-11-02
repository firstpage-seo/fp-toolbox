import { NextResponse } from "next/server";
import { getMcpUrlInspection, getMcpPsi } from "@/lib/mcp";
import { getGscSites, runQuery } from "@/lib/tool-api";

function hostOf(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return input.replace(/^sc-domain:/, "").replace(/^www\./, "").toLowerCase();
  }
}

/** Find the GSC site that owns this URL (hostname match) — null when unknown. */
async function findSite(url: string): Promise<string | null> {
  const target = hostOf(url);
  const sites = await getGscSites();
  const hit = sites.find((s) => hostOf(s.siteUrl) === target);
  return hit?.siteUrl ?? null;
}

export async function POST(request: Request) {
  const body = await request.json();
  const url = String(body.url || "").trim();
  const explicitSite = String(body.site || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid http(s) url is required" }, { status: 400 });
  }
  try {
    const { data } = await runQuery({
      toolSlug: "url-inspector",
      fetch: async () => {
        const site = explicitSite || (await findSite(url));
        const inspection = site
          ? await getMcpUrlInspection(site, url)
          : null;
        const psi = await getMcpPsi(url).catch(() => null);
        return {
          url,
          site,
          inspection,
          psi,
        };
      },
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
