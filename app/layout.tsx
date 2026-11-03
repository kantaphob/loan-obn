import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";
import "./workspace-light.css";
import "./workspace-white.css";
import "./data-loading.css";
import "./workspace-glassose.css";
import "./workspace-structure.css";
import "./workspace-xianxia.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Loan OBN | พื้นที่ทำงาน", template: "%s" },
  description: "พื้นที่ทำงานสำหรับการเงิน สินเชื่อ และทรัพย์สิน",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
