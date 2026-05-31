import { redirect } from "next/navigation";

export default async function LeadDetailRedirect({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  redirect(`/app/leads?lead=${leadId}`);
}
