import type { Metadata } from "next";
import { OWNER } from "@/config/owner";
import { SITE_URL } from "@/lib/site";
/* Vercel Web Analytics —— 只記瀏覽與自訂事件，不用 cookie，所以不需要同意橫幅。
   要在 Vercel 專案的 Analytics 分頁啟用，程式碼裝了但沒啟用不會有資料。 */
import { Analytics } from "@vercel/analytics/next";

const DESCRIPTION =
  "台中海線專業房仲吳冠良。資產配置、稅務諮詢、簡易裝潢，線上預約自己挑時段。";

export const metadata: Metadata = {
  // metadataBase 一定要設，否則 Next 產出的 og:image 之類會是相對路徑，
  // 分享到 LINE／FB 抓不到圖，canonical 也組不出絕對網址。
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${OWNER.name}｜台中海線專業房仲 - 懂你又懂房`,
    template: `%s`,
  },
  description: DESCRIPTION,
  // 內容曾同時掛在 kuanhome3.netlify.app 與 vercel 兩個網域，
  // canonical 是告訴 Google「正版在這裡」的唯一手段。
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_TW",
    siteName: "海線房仲冠良",
    url: SITE_URL,
    title: `${OWNER.name}｜台中海線專業房仲 - 懂你又懂房`,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
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
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
