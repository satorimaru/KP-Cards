import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tiến Lên",
  description:
    "Play Tiến Lên (Thirteen) online with friends or bots. 2–4 players, Southern rules.",
};

export default function TienLenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
