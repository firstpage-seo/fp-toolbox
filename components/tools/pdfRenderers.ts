"use client";

/**
 * Per-tool HTML renderers for server-side PDF export. Interfaces mirror the
 * server-side output shapes (structural typing — client code must not import
 * server modules). All styles are inline because browserless /pdf renders the
 * HTML standalone without Tailwind.
 */

const STYLE = `
  <style>
    body { font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 36px; font-size: 13px; line-height: 1.55; }
    h1 { font-size: 22px; color: #1e3a5f; margin: 0 0 4px; }
    h2 { font-size: 16px; color: #1e3a5f; border-bottom: 2px solid #dbeafe; padding-bottom: 6px; margin: 26px 0 10px; }
    h3 { font-size: 13px; color: #1e3a5f; margin: 16px 0 6px; }
    p { margin: 8px 0; }
    ul { margin: 6px 0; padding-left: 20px; }
    li { margin: 3px 0; }
    .subtitle { color: #64748b; font-size: 13px; }
    .muted { color: #64748b; font-size: 11px; }
    .stats { margin: 14px 0; }
    .stat { display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin: 4px 8px 4px 0; vertical-align: top; }
    .stat b { display: block; font-size: 18px; color: #1e3a5f; }
    .stat span { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 10px 0; }
    .slide { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 12px 0; page-break-inside: avoid; }
    .badge { display: inline-block; background: #dbeafe; color: #1e40af; border-radius: 999px; padding: 2px 10px; font-size: 11px; margin-left: 8px; }
  </style>
`;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${STYLE}</head><body>${body}</body></html>`;
}

function list(items: string[]): string {
  if (!items.length) return "";
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function stat(value: string, label: string): string {
  return `<div class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
}

// ---- Pitch Deck ------------------------------------------------------------

export interface DeckSlide {
  heading: string;
  bullets: string[];
  stat?: { value: string; label: string };
}

export interface Deck {
  title: string;
  subtitle: string;
  slides: DeckSlide[];
}

export function deckToHtml(deck: Deck): string {
  const slides = deck.slides
    .map(
      (s) => `
      <div class="slide">
        <h3>${esc(s.heading)}</h3>
        ${s.stat ? `<div class="stats">${stat(s.stat.value, s.stat.label)}</div>` : ""}
        ${list(s.bullets)}
      </div>`
    )
    .join("");
  return page(deck.title, `<h1>${esc(deck.title)}</h1><p class="subtitle">${esc(deck.subtitle)}</p>${slides}`);
}

// ---- Proposal --------------------------------------------------------------

export interface ProposalSection {
  heading: string;
  paragraphs: string[];
  bullets: string[];
}

export interface Proposal {
  title: string;
  sections: ProposalSection[];
}

export function proposalToHtml(p: Proposal): string {
  const sections = p.sections
    .map(
      (s) => `
      <section>
        <h2>${esc(s.heading)}</h2>
        ${s.paragraphs.map((t) => `<p>${esc(t)}</p>`).join("")}
        ${list(s.bullets)}
      </section>`
    )
    .join("");
  return page(p.title, `<h1>${esc(p.title)}</h1>${sections}`);
}

// ---- Meeting Prep ----------------------------------------------------------

export interface MeetingBrief {
  title: string;
  overview: string;
  keyFindings: { stat: string; insight: string }[];
  talkingPoints: string[];
  questions: string[];
  recommendations: string[];
}

export function meetingBriefToHtml(b: MeetingBrief): string {
  const findings = b.keyFindings
    .map(
      (f) => `
      <div class="card">
        <b>${esc(f.stat)}</b>
        <p class="muted" style="margin:4px 0 0">${esc(f.insight)}</p>
      </div>`
    )
    .join("");
  return page(
    b.title,
    `<h1>${esc(b.title)}</h1><p>${esc(b.overview)}</p>
     <h2>Key findings</h2>${findings}
     <h2>Talking points</h2>${list(b.talkingPoints)}
     <h2>Questions to ask</h2>${list(b.questions)}
     <h2>Recommendations</h2>${list(b.recommendations)}`
  );
}

// ---- Monthly Report --------------------------------------------------------

export interface MonthlyReport {
  title: string;
  summary: string;
  sections: { heading: string; paragraphs: string[]; bullets: string[] }[];
}

export function reportToHtml(r: MonthlyReport): string {
  const sections = r.sections
    .map(
      (s) => `
      <section>
        <h2>${esc(s.heading)}</h2>
        ${s.paragraphs.map((t) => `<p>${esc(t)}</p>`).join("")}
        ${list(s.bullets)}
      </section>`
    )
    .join("");
  return page(r.title, `<h1>${esc(r.title)}</h1><p>${esc(r.summary)}</p>${sections}`);
}

// ---- Content Brief ---------------------------------------------------------

export interface ContentBriefOutput {
  keyword: string;
  title: string;
  searchIntent: string;
  targetAudience: string;
  wordCount: number;
  outline: { heading: string; points: string[] }[];
  faqIdeas: string[];
}

export function contentBriefToHtml(b: ContentBriefOutput): string {
  const outline = b.outline
    .map(
      (o, i) => `
      <div class="slide">
        <h3>${i + 1}. ${esc(o.heading)}</h3>
        ${list(o.points)}
      </div>`
    )
    .join("");
  return page(
    b.title,
    `<h1>${esc(b.title)}</h1>
     <div class="stats">
       ${stat(b.keyword, "Keyword")}
       ${stat(b.searchIntent, "Intent")}
       ${stat(b.targetAudience, "Audience")}
       ${stat(String(b.wordCount), "Word count")}
     </div>
     <h2>Outline</h2>${outline}
     <h2>FAQ ideas</h2>${list(b.faqIdeas)}`
  );
}
