// Onsite SEO Audit — shared types.

/** How a checklist item's status is produced. */
export type CheckKind = "auto" | "semi-auto" | "manual";

/** Per-row verdict. */
export type Verdict = "pass" | "fail" | "warn" | "manual" | "n-a";

export interface CheckItem {
  id: string; // e.g. "17.1"
  item: string; // human-readable check
  section: string; // section label
  kind: CheckKind;
  detailTab?: string; // linked detail tab / instruction
  instruction?: string; // manual instructions (for manual / semi-auto)
  verdict: Verdict;
  evidence?: string;
  details?: unknown; // supporting data for the UI
}

export interface AuditSection {
  name: string; // e.g. "Crawling"
  items: CheckItem[];
}

export interface CrawlPage {
  url: string;
  status: number;
  finalUrl: string;
  redirectChain: string[];
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  robotsMeta: string | null;
  canonical: string | null;
  h1s: string[];
  images: { src: string; alt: string | null; sizeKb: number | null }[];
  links: { href: string; anchor: string }[];
  internalLinks: string[];
  externalLinks: string[];
  jsonLd: string[];
  hasViewport: boolean;
  sizeKb: number | null;
  depth: number;
  error: string | null;
}

export interface CrawlResult {
  seedUrl: string;
  origin: string;
  pages: CrawlPage[];
  indexed: number; // pages with status 200
  byStatus: Record<number, number>;
  robotsTxt: string | null;
  sitemap: string | null;
  generatedAt: string;
  capped: boolean;
}

export interface AuditProgress {
  jobId: string;
  status: "queued" | "crawling" | "collecting" | "summarizing" | "done" | "error";
  phase: string;
  pagesCrawled: number;
  pagesTotal: number;
  message: string;
  error?: string;
  startedAt: number;
  updatedAt: number;
}

export interface AuditResult {
  jobId: string;
  target: string;
  domain: string;
  crawl: CrawlResult;
  sections: AuditSection[];
  summary: {
    passed: number;
    failed: number;
    warned: number;
    manual: number;
    total: number;
  };
  manualActions: { id: string; item: string; section: string; instruction: string }[];
  llmSummary: string;
  generatedAt: string;
}
