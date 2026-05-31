import { redirect } from "next/navigation";

export default async function PropertyDetailRedirect({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  redirect(`/app/properties?property=${propertyId}`);
}
