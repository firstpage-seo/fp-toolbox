import PageHeader from "@/components/ui/PageHeader";
import ToolboxView from "@/components/toolbox/ToolboxView";
import { tools } from "@/lib/registry";

export default async function ToolboxPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const sp = await searchParams;
  const activeCount = tools.filter((t) => t.status === "active").length;

  return (
    <>
      <PageHeader
        title="Toolbox"
        description="Sales weapons built into the platform — client-ready deliverables generated from real HubSpot, GA4, GSC, PageSpeed and Ahrefs data. Search by name, description, category or owner."
        count={`${activeCount} tools`}
      />
      {/* Initial q/cat come from the URL as server props → full SSR first paint.
          Client updates write back via router.replace; back/forward sync via popstate. */}
      <ToolboxView initialQuery={sp.q ?? ""} initialCategory={sp.cat ?? null} />
    </>
  );
}
