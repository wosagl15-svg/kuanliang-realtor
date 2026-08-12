import type { NextConfig } from "next";

/**
 * 購屋攻略站的 40 個工具／指南頁是靜態 HTML，放在 public/ 底下。
 * 例如 public/qingan3/index.html。
 *
 * Next.js 不會自動把 `/qingan3/` 對到該資料夾的 index.html，
 * 所以這裡加一條 rewrite：凡是 public 裡存在的靜態頁目錄，
 * 用 `/目錄名` 或 `/目錄名/` 都能開啟。
 */
const STATIC_PAGES = [
  "actual-price", "auction", "building-line", "buy-house-guide", "buyer-cost",
  "coowned-land", "dadu-life", "dajia-life", "elder-benefits", "escrow",
  "existing-road-faq", "farmhouse", "haixian-school-map", "haunted-house",
  "inheritance", "inheritance-guide", "land-tax", "landlord-check", "leak-check",
  "loan-guide", "longjing-life", "offer-deposit", "presale", "qingan3",
  "qingan3-guide", "qingshui-life", "rental-subsidy", "repurchase-tax",
  "save-elec", "self-build-guide", "self-sale-vs-agent", "selfuse-tax",
  "seller-guide", "shalu-life", "tools", "will-guide", "wuqi-life",
  "xitun-price", "xu-ping-reform", "yifang-yanglao",
];

const nextConfig: NextConfig = {
  // 名片頁的大頭照如果放外部網址（例如 CDN），把網域加進來
  images: { remotePatterns: [] },

  async rewrites() {
    return STATIC_PAGES.flatMap((p) => [
      { source: `/${p}`, destination: `/${p}/index.html` },
      { source: `/${p}/`, destination: `/${p}/index.html` },
    ]);
  },
};

export default nextConfig;
