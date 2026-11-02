"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ToolCard from "./ToolCard";
import ToolSearch from "./ToolSearch";
import CategoryFilter from "./CategoryFilter";
import SectionTitle from "@/components/ui/SectionTitle";
import EmptyState from "@/components/ui/EmptyState";
import { categoryBarClass } from "@/lib/tool-icons";
import { tools } from "@/lib/registry";

/** Explicit block order — Sales first (the sales-weapons story), Operations last. */
export const CATEGORY_ORDER = [
  "Sales",
  "SEO Research",
  "SEO Technical",
  "SEO Content",
  "Content",
  "Operations",
] as const;

function buildParams(q: string, cat: string | null): string {
  const p = new URLSearchParams();
  const trimmed = q.trim();
  if (trimmed) p.set("q", trimmed);
  if (cat) p.set("cat", cat);
  return p.toString();
}

function readSearch(location: Pick<Location, "search">): { q: string; cat: string | null } {
  const p = new URLSearchParams(location.search);
  return { q: p.get("q") ?? "", cat: p.get("cat") };
}

/**
 * Client toolbox body: search + category filter in a sticky bar, URL-synced via ?q= & ?cat=.
 * Initial state comes from the server-rendered props (full SSR first paint);
 * updates write back with router.replace; browser back/forward syncs via popstate.
 */
export default function ToolboxView({
  initialQuery,
  initialCategory,
}: {
  initialQuery: string;
  initialCategory: string | null;
}) {
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string | null>(initialCategory);

  // Keep state in sync when the user navigates back/forward. Every filter
  // write uses router.replace (no history entry), so this is defense-in-depth:
  // returning to the page from elsewhere remounts with fresh server props anyway.
  useEffect(() => {
    const onPop = () => {
      const { q, cat } = readSearch(window.location);
      setQuery(q);
      setCategory(cat);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const activeTools = useMemo(
    () => tools.filter((t) => t.status === "active"),
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeTools
      .filter((t) => {
        if (category && t.category !== category) return false;
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.owner.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeTools, query, category]);

  const updateQuery = (q: string) => {
    setQuery(q);
    router.replace(`/toolbox?${buildParams(q, category)}`, { scroll: false });
  };

  const updateCategory = (cat: string | null) => {
    setCategory(cat);
    router.replace(`/toolbox?${buildParams(query, cat)}`, { scroll: false });
  };

  const searching = query.trim().length > 0;
  const grid = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

  const controls = (
    <div className="sticky top-16 z-40 bg-white/96 backdrop-blur border-b border-border py-3.5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center gap-3">
        <ToolSearch value={query} onChange={updateQuery} />
        <CategoryFilter
          categories={[...CATEGORY_ORDER]}
          active={category}
          onChange={updateCategory}
        />
      </div>
    </div>
  );

  const body = searching ? (
    <>
      {filtered.length === 0 ? (
        <EmptyState
          title={`No tools match "${query.trim()}"`}
          description="Try a different search term or category."
        />
      ) : (
        <>
          <SectionTitle count={filtered.length} className="mb-4">
            Results
          </SectionTitle>
          <div className={grid}>
            {filtered.map((t) => (
              <ToolCard key={t.slug} tool={t} />
            ))}
          </div>
        </>
      )}
    </>
  ) : (
    <>
      {CATEGORY_ORDER.map((cat) => {
        const items = filtered.filter((t) => t.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} aria-label={cat} className="mb-9">
            <div className="flex items-center gap-3 mb-4">
              <span
                className={`w-1 h-[22px] rounded-[2px] ${categoryBarClass(cat)}`}
                aria-hidden
              />
              <SectionTitle count={items.length}>{cat}</SectionTitle>
            </div>
            <div className={grid}>
              {items.map((t) => (
                <ToolCard key={t.slug} tool={t} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );

  return (
    <div>
      {controls}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-9">{body}</main>
    </div>
  );
}
