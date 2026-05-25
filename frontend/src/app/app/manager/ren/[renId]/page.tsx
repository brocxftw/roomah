import Link from "next/link";

export default async function ManagerRenDrilldownPage({
  params,
}: {
  params: Promise<{ renId: string }>;
}) {
  const { renId } = await params;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">REN Drill-down</h2>
      <p className="text-muted-foreground">
        Viewing team data for REN `{renId}`. Use the manager dashboard API to
        filter leads and viewings for this REN in the next implementation pass.
      </p>
      <div className="flex gap-3">
        <Link href="/app/leads" className="rounded-md border px-4 py-2 text-sm">
          View Leads
        </Link>
        <Link
          href="/app/viewings"
          className="rounded-md border px-4 py-2 text-sm"
        >
          View Viewings
        </Link>
      </div>
    </div>
  );
}
