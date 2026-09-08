import fs from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { listStaticPages, UNLISTED_PAGES } from "@/lib/static-pages";
import { CATEGORIES, getPosts } from "@/lib/blog";

/** 房價分析頁是最主要的搜尋入口，權重給高一點。 */
const PRICE_PAGES = new Set([
  "shalu-115-price",
  "qingshui-115-price",
  "wuqi-115-price",
  "longjing-115-price",
  "xitun-price",
]);

/** 用檔案的修改時間當 lastModified——重新產出過的頁面會自動告訴 Google「這篇更新了」。 */
function lastModified(slug: string): Date {
  try {
    return fs.statSync(path.join(process.cwd(), "public", slug, "index.html")).mtime;
  } catch {
    return new Date();
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // ⚠️ 網址一律「不帶結尾斜線」。Next 預設 trailingSlash:false，`/loan-guide/`
  // 會 308 轉到 `/loan-guide`；sitemap 若放帶斜線的版本，Google 會整批標成
  // 「有重新導向的網頁」而不收錄。canonical 也必須用同一種寫法。
  const fixed: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/card"), lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/card/booking"), lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];

  // 內部工具頁（UNLISTED_PAGES）自己帶 noindex，不能同時出現在 sitemap，
  // 否則 Search Console 會報「已提交的網址標記為 noindex」。
  const pages: MetadataRoute.Sitemap = listStaticPages()
    .filter((slug) => !UNLISTED_PAGES.has(slug))
    .map((slug) => ({
    url: absoluteUrl(`/${slug}`),
    lastModified: lastModified(slug),
    changeFrequency: PRICE_PAGES.has(slug) ? ("monthly" as const) : ("yearly" as const),
    priority: PRICE_PAGES.has(slug) ? 0.9 : slug === "tools" ? 0.8 : 0.7,
    }));

  // 網誌：列表、四個分類頁、每篇文章。草稿不會出現（getPosts 已濾掉）。
  const blog: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/blog"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...Object.keys(CATEGORIES).map((key) => ({
      url: absoluteUrl(`/blog/category/${key}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...getPosts().map((p) => ({
      url: absoluteUrl(`/blog/${p.slug}`),
      lastModified: new Date(p.updated ?? p.date),
      changeFrequency: "yearly" as const,
      priority: 0.8,
    })),
  ];

  return [...fixed, ...pages, ...blog];
}
