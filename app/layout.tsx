import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Appointment Setter Application | SolidBooked Pro",
  description: "Apply for the remote Appointment Setter role at SolidBooked Pro."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
