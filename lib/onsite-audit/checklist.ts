// Onsite SEO Audit — the full SEO Implementation Checklist as a data model.
//
// Every item is tagged:
//   auto       -> filled by the engine (crawl + GSC/GA4/PSI/Ahrefs/security)
//   semi-auto  -> LLM judgment over collected data (content / E-E-A-T / competitor)
//   manual     -> needs a human / client access / separate task; surfaced as a to-do
//
// This mirrors the "SEO Implementation Checklist" template tab. Thresholds and
// verdict logic live in the engine; this file is purely the source of truth for
// what is checked.

import type { AuditSection, CheckItem } from "./types";

function item(
  section: string,
  id: string,
  text: string,
  kind: CheckItem["kind"],
  extra: Partial<CheckItem> = {}
): CheckItem {
  return { id, item: text, section, kind, verdict: "manual", ...extra };
}

export const CHECKLIST: AuditSection[] = [
  {
    name: "Pre-Check",
    items: [
      item("Pre-Check", "1.1", "BENCHMARK REPORT IN SENTR", "manual", {
        instruction: "No onsite begins until benchmark report is added by AM in Sentr.",
      }),
      item("Pre-Check", "1.2", "IS DOMAIN/COUNTRY/CMS/CONFIG suitable for achieving SEO goals?", "manual", {
        instruction: "Check domain matches country (GMB + location) and CMS is editable.",
      }),
      item("Pre-Check", "1.3", "CMS", "manual", { instruction: "Confirm which CMS the site runs." }),
      item("Pre-Check", "1.4", "Domain Authority", "auto", { detailTab: "https://moz.com/domain-analysis" }),
      item("Pre-Check", "1.5", "Number of Referring Domains", "auto", { detailTab: "https://ahrefs.com/backlink-checker" }),
      item("Pre-Check", "1.6", "Number of Indexed Pages", "auto", { detailTab: "Use site: search in Google. site:example.com" }),
      item("Pre-Check", "1.7", "Does the client need a separate Traffic Drop Investigation?", "manual", {
        instruction: "AM please create separate task.",
      }),
      item("Pre-Check", "2.1", "All Google Logins: GSC, GTM + GA4", "manual", { instruction: "Confirm client access to GSC, GTM and GA4." }),
      item("Pre-Check", "2.2", "Install GA4", "manual", { instruction: "https://support.google.com/analytics/answer/1008080" }),
      item("Pre-Check", "2.3", "Install & Set up GSC", "manual", { instruction: "https://support.google.com/webmasters/answer/34592" }),
      item("Pre-Check", "2.4", "GA links to GSC", "manual", {}),
      item("Pre-Check", "2.5", "GEO Targeting set up?", "auto", {}),
      item("Pre-Check", "2.6", "CMS access", "manual", {}),
      item("Pre-Check", "2.7", "Cpanel", "manual", {}),
      item("Pre-Check", "3.1", "Files - All Files Backup", "manual", {
        instruction: "Use FTP/SFTP to download all files/folders, upload to Google Drive. https://wordpress.org/plugins/updraftplus/",
      }),
      item("Pre-Check", "3.2", "Database - All Database Backup", "manual", {
        instruction: "Use phpMyAdmin to generate SQL, upload to Google Drive.",
      }),
      item("Pre-Check", "4.1", "Keyword research", "semi-auto", { detailTab: "https://moz.com/learn/seo/what-is-keyword-research" }),
      item("Pre-Check", "4.2", "Keyword allocation", "manual", {
        instruction: "Define target pages and allocate a cluster of KWs (2-10 to each).",
      }),
      item("Pre-Check", "4.3", "Does the client need a separate Keyword Ranking Drop Investigation?", "manual", {
        instruction: "Refer to '4. Keyword Drop' tab. AM to create separate task.",
      }),
      item("Pre-Check", "5.1", "Can we add a new page?", "manual", {}),
      item("Pre-Check", "5.2", "Can we add a new header menu item?", "manual", {}),
      item("Pre-Check", "5.3", "Can we add a new submenu item?", "manual", {}),
      item("Pre-Check", "5.4", "Can we add an Accordion menu without a design issue?", "manual", {}),
      item("Pre-Check", "5.5", "Can we add SEO Title, Descriptions and H tags without a design issue?", "manual", {}),
      item("Pre-Check", "5.6", "Can we add SEO Title, Descriptions and H tags without a structural issue in the code?", "manual", {}),
      item("Pre-Check", "5.7", "Can we add a new category page?", "manual", {}),
      item("Pre-Check", "5.8", "How do GTM code placements look? Placed under <head> and <body>?", "auto", {}),
      item("Pre-Check", "6.1", "Does the site have a security plugin/firewall active? Up-to-date plugins?", "manual", {
        instruction: "For WP - Wordfence etc, WIX/Shopify fine. Custom - use hosting firewall.",
      }),
      item("Pre-Check", "6.2", "Safe Browsing status", "auto", {
        detailTab: "https://transparencyreport.google.com/safe-browsing/search",
      }),
      item("Pre-Check", "6.3", "Site malware / blacklist scan", "auto", { detailTab: "https://sitecheck.sucuri.net/" }),
    ],
  },
  {
    name: "Crawling",
    items: [
      item("Crawling", "7.1", "Keyword Cannibalization Check (GSC)", "auto", { detailTab: "7. GSC Checks" }),
      item("Crawling", "7.2", "Low Hanging Fruit Pages (GSC queries ranking 4-20)", "auto", { detailTab: "7. GSC Checks" }),
      item("Crawling", "7.3", "High impressions/positioning but low clicks? (fix titles/descriptions)", "auto", { detailTab: "7. GSC Checks" }),
      item("Crawling", "7.4", "URLs indexed that shouldn't be (e.g. tags pages)?", "auto", { detailTab: "7. GSC Checks" }),
      item("Crawling", "7.5", "URLs that should be indexed but aren't?", "auto", { detailTab: "7. GSC Checks" }),
      item("Crawling", "7.6", "Any outdated content?", "auto", { detailTab: "7. GSC Checks" }),
      item("Crawling", "8.1", "Site confirmed mobile friendly?", "auto", { detailTab: "8. Mobile Checks" }),
      item("Crawling", "8.2", "Is all desktop content visible on mobile?", "auto", { detailTab: "8. Mobile Checks" }),
      item("Crawling", "8.3", "Any mobile UX concerns?", "auto", { detailTab: "8. Mobile Checks" }),
      item("Crawling", "8.4", "Is the site responsive?", "auto", { detailTab: "8. Mobile Checks" }),
      item("Crawling", "8.5", "Does the site avoid interstitials on mobile?", "auto", { detailTab: "8. Mobile Checks" }),
      item("Crawling", "8.7", "Mobile Issues in GSC?", "auto", { detailTab: "8. Mobile Checks" }),
      item("Crawling", "8.8", "Does the client need a separate UX/UI audit?", "manual", {}),
      item("Crawling", "9.1", "http vs https (Insecure Content Detected?)", "auto", { detailTab: "9. Implement HTTPS Protocol" }),
      item("Crawling", "9.2", "Mixed Content", "auto", { detailTab: "9. Implement HTTPS Protocol" }),
      item("Crawling", "9.3", "www vs non www", "auto", { detailTab: "9. Implement HTTPS Protocol" }),
      item("Crawling", "10.1", "Does a robots.txt document exist?", "auto", { detailTab: "10. Robots.txt" }),
      item("Crawling", "10.2", "Indexable sections being disallowed?", "auto", { detailTab: "10. Robots.txt" }),
      item("Crawling", "10.3", "Disallow blocks in place for URLs Google shouldn't crawl?", "auto", { detailTab: "10. Robots.txt" }),
      item("Crawling", "10.4", "Bot access to CSS and JS documents?", "auto", { detailTab: "10. Robots.txt" }),
      item("Crawling", "10.5", "Are the following disallowed: carts, thank-you, admin, duplicate content, account pages?", "auto", { detailTab: "10. Robots.txt" }),
      item("Crawling", "10.6", "Is the file named robots.txt (not ROBOTS.TXT)?", "auto", { detailTab: "10. Robots.txt" }),
      item("Crawling", "10.7", "Link in robots.txt to the sitemap?", "auto", { detailTab: "10. Robots.txt" }),
      item("Crawling", "11.1", "Does an XML sitemap(s) exist?", "auto", { detailTab: "11. Sitemap" }),
      item("Crawling", "11.2", "Is the sitemap a dynamic sitemap?", "auto", { detailTab: "11. Sitemap" }),
      item("Crawling", "11.3", "Are <loc> tags used and www/non-www accurate?", "auto", { detailTab: "11. Sitemap" }),
      item("Crawling", "11.4", "Are lastmod tags being used?", "auto", { detailTab: "11. Sitemap" }),
      item("Crawling", "11.5", "Blocked pages excluded from sitemap?", "auto", { detailTab: "11. Sitemap" }),
      item("Crawling", "11.6", "Paginated URLs avoided in the sitemap?", "auto", { detailTab: "11. Sitemap" }),
      item("Crawling", "11.7", "Non-indexable URLs removed from sitemap?", "auto", { detailTab: "11. Sitemap" }),
      item("Crawling", "11.8", "E-commerce: product images in sitemap?", "auto", { detailTab: "11. Sitemap" }),
      item("Crawling", "11.9", "XML sitemap submitted to GSC and error-free?", "auto", { detailTab: "11. Sitemap" }),
      item("Crawling", "12.1", "Faceted navigation/filters checked (+ canonicalisation)?", "auto", { detailTab: "12. Robots meta tags" }),
      item("Crawling", "12.2", "Search/thank-you/archive pages have noindex?", "auto", { detailTab: "12. Robots meta tags" }),
      item("Crawling", "12.3", "Any sections accidentally noindexed?", "auto", { detailTab: "12. Robots meta tags" }),
      item("Crawling", "13.1", "Canonical tags on every page (self-referencing)?", "auto", { detailTab: "13. Canonical tag" }),
      item("Crawling", "13.2", "Canonicals reference the correct version?", "auto", { detailTab: "13. Canonical tag" }),
      item("Crawling", "13.3", "Tracking/query strings point canonical to base URL?", "auto", { detailTab: "13. Canonical tag" }),
      item("Crawling", "13.4", "E-commerce: canonical to base product URL for variants?", "auto", { detailTab: "13. Canonical tag" }),
      item("Crawling", "13.5", "Internal search doesn't cause URL duplication?", "auto", {
        detailTab: "Sometimes search bar creates a dynamic URL - test if indexed (GSC).",
      }),
      item("Crawling", "13.6", "Blog categories/tags/archives not causing duplication?", "auto", {
        detailTab: "Noindex tags/archives in Yoast. Use site: search to identify.",
      }),
      item("Crawling", "13.7", "Is Google respecting the canonicals?", "auto", { detailTab: "13. Canonical tag" }),
      item("Crawling", "14.1", "On-page links to page 2 and onward?", "auto", { detailTab: "14. Pagination" }),
      item("Crawling", "14.2", "Both a 'View All' and paginated pages without correct canonical?", "auto", { detailTab: "14. Pagination" }),
      item("Crawling", "14.3", "rel=prev / rel=next being used?", "auto", { detailTab: "14. Pagination" }),
      item("Crawling", "14.4", "No page=1 in addition to root page?", "auto", { detailTab: "14. Pagination" }),
      item("Crawling", "14.5", "Caused duplication?", "auto", { detailTab: "14. Pagination" }),
      item("Crawling", "14.6", "Canonical refers to the page itself on paginated content?", "auto", { detailTab: "14. Pagination" }),
      item("Crawling", "15.1", "Multi-language/country?", "auto", { detailTab: "15. Hreflang tag" }),
      item("Crawling", "15.2", "Parameter (?lang=) or ccTLD or others?", "auto", { detailTab: "15. Hreflang tag" }),
      item("Crawling", "15.3", "Any hreflang issues? (missing self-ref, return links, non-canonical, wrong language, non-200)", "auto", { detailTab: "15. Hreflang tag" }),
      item("Crawling", "16.1", "Does the client require a content gap?", "manual", { instruction: "AM please create separate task." }),
      item("Crawling", "16.2", "Does the client require a detailed product/service competitor analysis?", "manual", { instruction: "AM please create separate task." }),
      item("Crawling", "16.3", "Does the client require a competitor health score comparison (SEMrush)?", "manual", { instruction: "AM please create separate task." }),
    ],
  },
  {
    name: "Content",
    items: [
      item("Content", "17.1", "Does each URL have a title? (excluding target pages)", "auto", { detailTab: "17.1 Page titles - Missing" }),
      item("Content", "17.2", "Is the site free of page title duplication?", "auto", { detailTab: "17.2 Page titles - Duplicate" }),
      item("Content", "17.3", "Are page titles using the 580px max width effectively?", "auto", { detailTab: "17.3 Page titles - Too Long" }),
      item("Content", "17.4", "Are there multiple page titles?", "auto", { detailTab: "17.4 Page titles - Multiple" }),
      item("Content", "18.1", "Does each URL have a description? (excluding target pages)", "auto", { detailTab: "18.1 Descriptions - Missing" }),
      item("Content", "18.2", "Is the site free of meta description duplication?", "auto", { detailTab: "18.2 Descriptions - Duplicate" }),
      item("Content", "18.3", "Are meta descriptions using the 155 char limit effectively?", "auto", { detailTab: "18.3 Descriptions - Too Long" }),
      item("Content", "19.1", "Do all pages contain a single, keyword-optimised H1?", "auto", { detailTab: "19.1 H1 - Missing" }),
      item("Content", "19.2", "Are there H1 duplicates?", "auto", { detailTab: "19.2 H1 - Duplicate" }),
      item("Content", "19.3", "Are there multiple H1 tags in a single page?", "auto", { detailTab: "19.3 H1 - Multiple" }),
      item("Content", "20.1", "Do images contain alt text?", "auto", { detailTab: "20.1 Image - Alt Text Missing" }),
      item("Content", "20.2", "Oversized images", "auto", { detailTab: "20.2 Image - Oversize" }),
      item("Content", "21.1", "Any duplicate content externally?", "semi-auto", { detailTab: "21.1 Duplicate Content - External" }),
      item("Content", "21.2", "Any duplicate content internally?", "auto", { detailTab: "21.2 Duplicate Content - Internal" }),
      item("Content", "22.1", "Review competitor content, titles, descriptions, headings (target pages)", "semi-auto", { detailTab: "22 Content suggestions" }),
      item("Content", "22.2", "Any thin / low content pages?", "auto", { detailTab: "22 Content suggestions" }),
      item("Content", "22.3", "Content that supports Personal & Conversational Search queries?", "semi-auto", { detailTab: "22 Content suggestions" }),
      item("Content", "22.4", "Will users understand the client's content?", "semi-auto", { detailTab: "22 Content suggestions" }),
      item("Content", "22.5", "Visual Aid analysis, does the client need it?", "manual", {}),
      item("Content", "22.6", "Does the client have author bios and list credentials? Links to external sources for EEAT?", "semi-auto", { detailTab: "22 Content suggestions" }),
      item("Content", "22.7", "Does the client break down long-form content into digestible subheadings for passage indexing?", "auto", { detailTab: "22 Content suggestions" }),
      item("Content", "22.8", "Does the client have a summary in their blog post to increase featured snippet chances?", "semi-auto", { detailTab: "22 Content suggestions" }),
      item("Content", "22.9", "Table of contents exist?", "auto", { detailTab: "22 Content suggestions" }),
      item("Content", "23.1", "Is there JSON-LD for Organization: name,url,logo,sameAs?", "auto", { detailTab: "23. Rich Snippets" }),
      item("Content", "23.2", "E-commerce: product, rating and review structured data correct?", "auto", { detailTab: "23. Rich Snippets" }),
      item("Content", "23.3", "Is there breadcrumb schema?", "auto", { detailTab: "23. Rich Snippets" }),
      item("Content", "23.4", "If internal search, has Sitelinks Search Box schema been added?", "auto", { detailTab: "23. Rich Snippets" }),
      item("Content", "23.5", "Is there article / how-to / blog post / person schema?", "auto", { detailTab: "23. Rich Snippets" }),
      item("Content", "23.6", "Does the client need to generate review schema?", "manual", { instruction: "AM please create separate task." }),
      item("Content", "23.7", "Is there FAQ schema? (Optional)", "auto", { detailTab: "23. Rich Snippets" }),
      item("Content", "23.8", "Schema being read properly in GSC? (enhancements)", "auto", { detailTab: "23. Rich Snippets" }),
      item("Content", "24.1", "Contextual links in homepage body copy?", "auto", { detailTab: "24. Internal linking" }),
      item("Content", "24.2", "E-commerce: links from product pages to thematically suitable products?", "auto", { detailTab: "24. Internal linking" }),
      item("Content", "24.3", "Breadcrumbs leveraged for hierarchical linking?", "auto", { detailTab: "24. Internal linking" }),
      item("Content", "24.4", "Automated links from category to relevant sub-category pages?", "auto", { detailTab: "24. Internal linking" }),
      item("Content", "24.5", "SEO footer links added to the site?", "auto", { detailTab: "24. Internal linking" }),
      item("Content", "24.6", "Any internal links with multiple redirected versions (redirect chains)?", "auto", { detailTab: "24.6 Redirect Chains" }),
      item("Content", "24.7", "Any orphan pages? / links not in <a href> format?", "auto", { detailTab: "24.7 Orphan URLs" }),
      item("Content", "24.8", "Any broken internal links?", "auto", { detailTab: "24.8 Broken Internal Links" }),
      item("Content", "24.9", "Suggestion for internal linking (GSC high external/internal link pages)?", "semi-auto", { detailTab: "24. Internal linking" }),
      item("Content", "25.1", "Is the navigation bar clear, organised, linking to important pages?", "auto", { detailTab: "25. Crawling Issues" }),
      item("Content", "25.2", "Is Google Bot able to access significant pages?", "auto", { detailTab: "25. Crawling Issues" }),
      item("Content", "25.3", "How many pages is Google crawling every day?", "auto", { detailTab: "25. Crawling Issues" }),
      item("Content", "25.4", "Which URLs are wasting crawl budget?", "auto", { detailTab: "25. Crawling Issues" }),
    ],
  },
  {
    name: "Technical",
    items: [
      item("Technical", "26.1", "Do URLs have a logical hierarchical folder structure with keywords?", "auto", { detailTab: "26.1 URL best practices" }),
      item("Technical", "26.2", "Clean URL - no excessive parameters?", "auto", { detailTab: "26.2 Parameters" }),
      item("Technical", "26.3", "Separator: use - instead of _?", "auto", { detailTab: "26.3 Underscores" }),
      item("Technical", "26.4", "Is lower case enforced for all URLs?", "auto", { detailTab: "26.4 Uppercase" }),
      item("Technical", "26.5", "Multiple slashes in URLs?", "auto", { detailTab: "26.5 Multiple Slashes" }),
      item("Technical", "26.6", "Are trailing slashes being incorporated? /seo (bad) /seo/ (good)", "auto", {
        detailTab: "Omitting the trailing slash forces an unnecessary 301 redirect.",
      }),
      item("Technical", "27.1", "Is the server returning a 404 status on error pages (not soft 404)?", "auto", { detailTab: "27.1 404s" }),
      item("Technical", "27.2", "Are there current server errors (5xx codes)?", "auto", { detailTab: "27.2 5xx" }),
      item("Technical", "27.3", "Are 302 redirects avoided?", "auto", { detailTab: "27.3 302 Redirects" }),
      item("Technical", "27.4", "Are 307s used over 302s for temporary product redirects?", "auto", {}),
      item("Technical", "27.5", "Is there a custom 404 page with CTA and links to main category pages?", "auto", { detailTab: "27.5 Competitor 404s" }),
      item("Technical", "28.1", "PageSpeed Insights: Mobile Score", "auto", { detailTab: "28. Page Speed" }),
      item("Technical", "28.2", "GTMetrix / Pingdom Score", "auto", { detailTab: "https://gtmetrix.com/" }),
      item("Technical", "28.3", "Site Speed (PSI via Screaming Frog)", "auto", { detailTab: "28. Page Speed" }),
      item("Technical", "28.4", "Core Web Vitals Test (GSC Groups)", "auto", { detailTab: "28.4 CWV" }),
      item("Technical", "28.5", "Wordpress site - is speed a significant issue? Separate speed audit?", "manual", { instruction: "AM please create separate task." }),
    ],
  },
  {
    name: "Local",
    items: [
      item("Local", "29.1", "Do individual stores have dedicated pages with proper titles & details?", "auto", { detailTab: "29. Local Search" }),
      item("Local", "29.2", "Is the site listed in reputable business directories?", "manual", { instruction: "Manual: verify directories for brick-and-mortar stores." }),
      item("Local", "29.3", "Is there a consistent NAP across the site and external sites?", "manual", { instruction: "Manual: check Name/Address/Phone consistency." }),
      item("Local", "29.4", "Has Google MyBusiness been setup and optimised for each location?", "manual", { instruction: "AM please create separate task." }),
    ],
  },
  {
    name: "Tracking",
    items: [
      item("Tracking", "30.1", "Are pageviews & goals/conversions set up in GA4?", "auto", { instruction: "AM please create separate task." }),
      item("Tracking", "30.3", "If ecommerce, is ecom tracking set up in GA4?", "auto", { instruction: "AM please create separate task." }),
      item("Tracking", "30.4", "Does the client need a separate CRO audit?", "manual", {}),
    ],
  },
  {
    name: "Off-Page",
    items: [
      item("Off-Page", "31.1", "Check backlink profile in Ahrefs", "auto", { detailTab: "https://ahrefs.com/blog/backlink-audit/" }),
      item("Off-Page", "31.2", "Is the current backlink budget enough? Increase 10% > 20%?", "auto", { detailTab: "31. Backlink profile" }),
      item("Off-Page", "31.3", "Does the site need a disavow? (SME N/A)", "auto", { detailTab: "31. Backlink profile" }),
    ],
  },
  {
    name: "Standard Procedures",
    items: [
      item("Standard Procedures", "32.1", "Backlink request", "manual", {
        instruction: "Ask AM to put the special requirement here (if any).",
      }),
      item("Standard Procedures", "32.2", "Backlink Monthly Task Created", "manual", { instruction: "Create the monthly backlink task in Sentr." }),
      item("Standard Procedures", "32.3", "Content request (TC)", "manual", { instruction: "New standard - min. 450 words which includes FAQs." }),
      item("Standard Procedures", "32.4", "Content request (EN)", "manual", { instruction: "Each target page gets copy." }),
      item("Standard Procedures", "32.5", "Check geographic LOCATION is added to keywords in Serpbook", "manual", {
        instruction: "Make sure the right search engine is selected. Add GMB/address.",
      }),
      item("Standard Procedures", "32.6", "Post Keywords, URLs in Notes | CAMPAIGN KEYWORDS AND TARGET URLS (YYYYMMDD)", "manual", {
        instruction: "ALWAYS PASTE THIS SHEET INTO SENTR. EVEN FOR REVIEWS.",
      }),
      item("Standard Procedures", "32.7", "Reply Onsite Tech ticket, Paste Checklist, Upload XLS", "manual", {
        instruction: "ALWAYS DOWNLOAD THIS SHEET AND ATTACH TO SENTR.",
      }),
      item("Standard Procedures", "32.8", "Update the responsibility and priority in Tab - Priorities & Status", "manual", {
        instruction: "ALWAYS UPDATE Priorities & Status Tab.",
      }),
    ],
  },
];
