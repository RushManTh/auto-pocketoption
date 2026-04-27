import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManualApprovalActions } from "@/components/manual-approval-actions";
import { getManualApprovalIntentRows } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function ManualApprovalPage() {
  const intents = await getManualApprovalIntentRows();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-normal sm:text-2xl">Manual Approval</h2>
        <p className="mt-1 text-sm text-muted-foreground">Review trade intents before any browser execution.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pending Intent</CardTitle>
        </CardHeader>
        <CardContent>
          {intents.length ? (
            <div className="space-y-3">
              {intents.map((intent) => (
                <div key={intent.id} className="rounded-md border p-3 sm:p-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">{intent.createdAt}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Asset</p>
                      <p className="font-medium">{intent.asset}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Direction</p>
                      <p className="font-medium">{intent.direction}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Amount</p>
                      <p className="font-medium">{intent.amount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expiry</p>
                      <p className="font-medium">{intent.expiry}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Risk</p>
                      <p className="font-medium text-emerald-600 dark:text-emerald-400">{intent.risk}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <ManualApprovalActions tradeIntentId={intent.id} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
              No trade intents are waiting for manual approval.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
