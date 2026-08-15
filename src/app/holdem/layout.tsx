import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hold'em",
  description: "No-limit Texas Hold'em — two to six seats.",
};

export default function HoldemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
