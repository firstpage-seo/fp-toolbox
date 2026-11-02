import pitchDeck from "@/app/tools/pitch-deck/tool";
import proposal from "@/app/tools/proposal/tool";
import gscExplorer from "@/app/tools/gsc-explorer/tool";
import ga4Snapshot from "@/app/tools/ga4-snapshot/tool";
import psiAuditor from "@/app/tools/psi-auditor/tool";
import mobileDesktopPsi from "@/app/tools/mobile-desktop-psi/tool";
import cwvBatch from "@/app/tools/cwv-batch/tool";
import urlInspector from "@/app/tools/url-inspector/tool";
import competitorProfiler from "@/app/tools/competitor-profiler/tool";
import aiVisibility from "@/app/tools/ai-visibility/tool";
import keywordGap from "@/app/tools/keyword-gap/tool";
import serpLandscape from "@/app/tools/serp-landscape/tool";
import leadScorer from "@/app/tools/lead-scorer/tool";
import pipelinePulse from "@/app/tools/pipeline-pulse/tool";
import spamReport from "@/app/tools/spam-report/tool";
import toolUsage from "@/app/tools/tool-usage/tool";
import meetingPrep from "@/app/tools/meeting-prep/tool";
import metaGenerator from "@/app/tools/meta-generator/tool";
import contentBrief from "@/app/tools/content-brief/tool";
import schemaGenerator from "@/app/tools/schema-generator/tool";
import seoRoi from "@/app/tools/seo-roi/tool";
import monthlyReport from "@/app/tools/monthly-report/tool";
import onsiteAudit from "@/app/tools/onsite-audit/tool";
import pageScreenshot from "@/app/tools/page-screenshot/tool";
import renderDiff from "@/app/tools/render-diff/tool";
import faqParaphrase from "@/app/tools/faq-paraphrase/tool";

export interface ToolManifest {
  slug: string;
  name: string;
  description: string;
  category: string;
  owner: string;
  status: "active" | "deprecated" | "planned";
  model?: string;
  externalLink?: string;
  icon?: string;
}

/** Static registry index — adding a tool = add one import line. Code is the source of truth. */
export const tools: ToolManifest[] = [pitchDeck, proposal, gscExplorer, ga4Snapshot, psiAuditor, mobileDesktopPsi, cwvBatch, urlInspector, competitorProfiler, aiVisibility, keywordGap, serpLandscape, leadScorer, pipelinePulse, spamReport, toolUsage, meetingPrep, metaGenerator, contentBrief, schemaGenerator, seoRoi, monthlyReport, onsiteAudit, pageScreenshot, renderDiff, faqParaphrase,
  // External tools — standalone deployments without an app/tools/<slug>/ page.
  // `externalLink` makes the toolbox card link out (target=_blank) instead of /tools/<slug>.
  {
    slug: "faq-schema-generator",
    name: "FAQ Schema Generator",
    description:
      "Standalone FAQ structured-data generator, hosted externally — the fast path to FAQ JSON-LD.",
    category: "SEO Technical",
    owner: "FirstPage Team",
    status: "active",
    icon: "❓",
    externalLink: "https://faq-generator.firstpage.com.hk",
  },
];
