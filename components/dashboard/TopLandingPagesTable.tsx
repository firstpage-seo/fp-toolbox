import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import type { GscLandingPageRow } from "@/lib/dashboard";

export default function TopLandingPagesTable({ pages, error }: { pages: GscLandingPageRow[]; error: string | null }) {
  if (error) return <p className="py-8 text-sm text-rose-600">Couldn&apos;t load landing pages: {error}</p>;
  if (pages.length === 0) return <p className="py-8 text-center text-sm text-muted">No landing pages recorded for this period.</p>;

  return (
    <Table className="table-fixed min-w-[680px] text-[13.5px]">
      <TableHeader>
        <TableRow className="border-border">
          <TableHead className="h-auto w-[40%] px-0 pb-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">Landing page</TableHead>
          <TableHead className="h-auto px-0 pb-2 pr-4 text-right text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">Impressions</TableHead>
          <TableHead className="h-auto px-0 pb-2 pr-4 text-right text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">Clicks</TableHead>
          <TableHead className="h-auto px-0 pb-2 pr-4 text-right text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">CTR</TableHead>
          <TableHead className="h-auto px-0 pb-2 text-right text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">Position</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pages.map((page) => (
          <TableRow key={page.url} className="border-border">
            <TableCell className="px-0 py-2.5 pr-4 font-semibold text-navy">
              <a href={page.url} target="_blank" rel="noopener noreferrer" className="block whitespace-normal break-all text-fp-600 hover:underline focus-visible:underline">
                {page.url}
              </a>
            </TableCell>
            <TableCell className="px-0 py-2.5 pr-4 text-right tabular-nums">{page.impressions.toLocaleString()}</TableCell>
            <TableCell className="px-0 py-2.5 pr-4 text-right tabular-nums">{page.clicks.toLocaleString()}</TableCell>
            <TableCell className="px-0 py-2.5 pr-4 text-right tabular-nums">{(page.ctr * 100).toFixed(1)}%</TableCell>
            <TableCell className="px-0 py-2.5 text-right tabular-nums">{page.position.toFixed(1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
