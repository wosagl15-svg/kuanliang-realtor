import type { Metadata } from "next";
import { OWNER } from "@/config/owner";

export const metadata: Metadata = {
  title: {
    default: `${OWNER.name}｜台中海線專業房仲 - 懂你又懂房`,
    template: `%s`,
  },
  description: "台中海線專業房仲吳冠良。資產配置、稅務諮詢、簡易裝潢，線上預約自己挑時段。",
  icons: { icon: OWNER.photoUrl },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Noto+Sans+TC:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
