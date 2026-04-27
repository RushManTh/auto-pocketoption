import { Search } from "lucide-react";
import { SignalTable } from "@/components/signal-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSignalRows } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const signals = await getSignalRows();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-normal sm:text-2xl">Signals</h2>
        <p className="mt-1 text-sm text-muted-foreground">Parsed Telegram messages and their execution state.</p>
      </div>
      <Card>
        <CardHeader className="gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Signal Feed</CardTitle>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search signal" />
          </div>
        </CardHeader>
        <CardContent>
          <SignalTable rows={signals} />
        </CardContent>
      </Card>
    </div>
  );
}
