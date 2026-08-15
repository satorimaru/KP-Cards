import { redirect } from "next/navigation";

export default async function LegacyTienLenSolo({
  searchParams,
}: {
  searchParams: Promise<{ bots?: string }>;
}) {
  const { bots } = await searchParams;
  const query = bots ? `?bots=${encodeURIComponent(bots)}` : "";
  redirect(`/tienlen/solo${query}`);
}
