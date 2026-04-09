import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: "Health Track MVP",
  description: "基于 Dify 工作流的个性化饮食、运动、个人护理追踪平台"
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={manrope.className}>{children}</body>
    </html>
  );
}
