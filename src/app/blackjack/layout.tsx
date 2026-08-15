import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blackjack",
  description: "Six-seat blackjack versus the house.",
};

export default function BlackjackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
