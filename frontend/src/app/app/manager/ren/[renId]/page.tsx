import { redirect } from "next/navigation";

export default async function ManagerRenDrilldownPage({
  params,
}: {
  params: Promise<{ renId: string }>;
}) {
  const { renId } = await params;
  redirect(`/app/manager?ren=${renId}`);
}
