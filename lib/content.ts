import fs from "node:fs";
import path from "node:path";

export interface CaseStudy {
  slug: string;
  client: string;
  industry: string;
  result: string;
  body: string;
}

/** Load brand guide + case studies from content/ as markdown. */
export function loadBrandGuide(): string {
  const p = path.join(process.cwd(), "content", "brand", "guide.md");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

export function loadCaseStudies(): CaseStudy[] {
  const dir = path.join(process.cwd(), "content", "case-studies");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const slug = f.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const front = raw.split("\n---")[0] || "";
      const body = raw.includes("\n---") ? raw.slice(raw.indexOf("\n---") + 4) : raw;
      const field = (k: string) => {
        const m = front.match(new RegExp(`^${k}:\\s*(.+)$`, "m"));
        return m?.[1]?.trim() ?? "";
      };
      return { slug, client: field("client"), industry: field("industry"), result: field("result"), body };
    })
    .filter((c) => c.client);
}
