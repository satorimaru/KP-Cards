import { redirect } from "next/navigation";

export default async function LegacyTienLenRoom({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  redirect(`/tienlen/${roomId}`);
}
