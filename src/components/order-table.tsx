import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type OrderRow = {
  id: string;
  time: string;
  asset: string;
  direction: string;
  amount: string;
  expiry: string;
  mode: string;
  status: string;
  result: string;
};

export function OrderTable({ rows }: { rows: OrderRow[] }) {
  return (
    <>
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{row.time}</TableCell>
                  <TableCell className="font-medium">{row.asset}</TableCell>
                  <TableCell>{row.direction}</TableCell>
                  <TableCell>{row.amount}</TableCell>
                  <TableCell>{row.expiry}</TableCell>
                  <TableCell>{row.mode}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>{row.result}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No orders in the database yet.
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.direction} · {row.amount}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <MobileField label="Time" value={row.time} />
                <MobileField label="Expiry" value={row.expiry} />
                <MobileField label="Mode" value={row.mode} />
                <MobileField label="Result" value={row.result} />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            No orders in the database yet.
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
