import type { Metadata } from "next";
import { Lato, Montserrat } from "next/font/google";
import "./globals.css";

const lato = Lato({ variable: "--font-lato", subsets: ["latin"], weight: ["400", "700"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "LAIRE Workspace", template: "%s | LAIRE Workspace" },
  description: "Projects, tasks and approvals for LAIRE and its clients.",
  icons: { icon: "/laire-mark.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lato.variable} ${montserrat.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
