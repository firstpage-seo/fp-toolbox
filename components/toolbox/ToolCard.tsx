import Link from "next/link";
import Card from "@/components/ui/Card";
import { ToolIcon, categoryBgClass, categoryColorClass } from "@/lib/tool-icons";
import type { ToolManifest } from "@/lib/registry";

interface ToolCardProps {
  tool: ToolManifest;
}

/** Tool card: category-tinted SVG tile + name + description + category/owner meta. External tools link out. */
export default function ToolCard({ tool }: ToolCardProps) {
  const isExternal = Boolean(tool.externalLink);

  const card = (
    <Card hover className="relative flex h-full flex-col">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-[11px] ${categoryBgClass(tool.category)} ${categoryColorClass(tool.category)}`}
        >
          <ToolIcon name={tool.name} />
        </div>
        {isExternal ? (
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] bg-navy text-white px-2 py-0.5 rounded-[6px]">
            External
          </span>
        ) : null}
      </div>
      <h2 className="mt-3 text-[16.5px] font-extrabold text-navy group-hover:text-fp-700 transition-colors">
        {tool.name}
      </h2>
      <p className="mt-1 flex-1 text-[13.5px] text-muted leading-relaxed">
        {tool.description}
      </p>
      <div className="mt-3.5 flex items-center gap-2">
        <span
          className={`text-[11px] font-extrabold uppercase tracking-[0.07em] px-2.5 py-1 rounded-full ${categoryBgClass(tool.category)} ${categoryColorClass(tool.category)}`}
        >
          {tool.category}
        </span>
        <span className="ml-auto text-[11.5px] font-semibold text-muted">
          {tool.owner}
        </span>
      </div>
    </Card>
  );

  if (isExternal && tool.externalLink) {
    return (
      <Link
        href={tool.externalLink}
        target="_blank"
        rel="noreferrer"
        className="group block h-full"
      >
        {card}
      </Link>
    );
  }
  return (
    <Link href={`/tools/${tool.slug}`} className="group block h-full">
      {card}
    </Link>
  );
}
