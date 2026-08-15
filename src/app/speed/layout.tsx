import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Speed",
  description: "Speed — a fast two-player card race. Coming next.",
};

export default function SpeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
