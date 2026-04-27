import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type SignalRow = {
  id: string;
  time: string;
  source: string;
  asset: string;
  direction: string;
  expiry: string;
  status: string;
  confidence: string;
};

export function SignalTable({ rows }: { rows: SignalRow[] }) {
  return (
    <>
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{row.time}</TableCell>
                  <TableCell className="max-w-64 truncate">{row.source}</TableCell>
                  <TableCell className="font-medium">{row.asset}</TableCell>
                  <TableCell>{row.direction}</TableCell>
                  <TableCell>{row.expiry}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>{row.confidence}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No signals in the database yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 lg:hidden">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.asset}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.source}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <MobileField label="Time" value={row.time} />
                <MobileField label="Direction" value={row.direction} />
                <MobileField label="Expiry" value={row.expiry} />
                <MobileField label="Confidence" value={row.confidence} />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            No signals in the database yet.
          </div>
        )}
      </div>
    </>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 px-2 py-1.5">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-medium">{value}</p>
    </div>
  );
}
