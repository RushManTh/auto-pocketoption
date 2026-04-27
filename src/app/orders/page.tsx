import { OrderTable } from "@/components/order-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrderRows } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await getOrderRows();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-normal sm:text-2xl">Orders</h2>
        <p className="mt-1 text-sm text-muted-foreground">Paper, manual, and demo execution records.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Active and Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTable rows={orders} />
        </CardContent>
      </Card>
    </div>
  );
}
