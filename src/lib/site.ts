/**
 * 網站的正式網址，canonical、sitemap、robots、JSON-LD 全部以這裡為準。
 *
 * 2026-08-14：買下 kuanhome.com 之前，內容同時掛在 kuanhome3.netlify.app
 * 與 kuanliang-realtor.vercel.app 兩個網域上，同一篇文章有兩個網址，
 * Google 會把權重拆成兩半。收斂到單一網域之後，這個常數就是唯一的真相來源。
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://kuanhome.com"
).replace(/\/+$/, "");

/** 組出 canonical 用的絕對網址。path 傳 "/" 或 "/loan-guide/" 都可以。 */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}/${path.replace(/^\/+/, "")}`;
}
