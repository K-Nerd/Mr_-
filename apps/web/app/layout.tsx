import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "\ub9c8\uc2a4\ud130-\uce74\ud53c | TIG Welding Knowhow Hub",
  description: "Video learning, RAG chatbot, and photo feedback for pipe TIG welding training.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
