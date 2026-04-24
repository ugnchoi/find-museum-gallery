import type { Metadata } from "next";
import { Inter, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const notoSerifKR = Noto_Serif_KR({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "문화 나들이 | 아이와 함께 가는 박물관·갤러리",
    template: "%s · 문화 나들이"
  },
  description:
    "내 주변의 박물관과 갤러리를 찾아, 아이와 함께 떠나는 오늘의 문화 나들이를 계획해보세요.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" }
    ]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${inter.variable} ${notoSerifKR.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
