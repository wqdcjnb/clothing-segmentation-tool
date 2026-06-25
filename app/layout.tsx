import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 服饰分割 - 模特服装抠图工具",
  description: "上传模特图，AI 自动分割服装，生成透明背景商品图",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
