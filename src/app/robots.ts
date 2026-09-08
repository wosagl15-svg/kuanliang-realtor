import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** 不管哪一種爬蟲，這些都不該被收錄。 */
const NEVER_CRAWL = [
  "/api/",
  "/admin",
  "/admin/",
  // 預約管理連結帶 HMAC token，等於客戶的私人網址，絕對不能被收錄
  "/card/booking/manage",
];

/**
 * 想被 AI 搜尋引用，前提是它的爬蟲進得來。
 *
 * `User-Agent: *` 本來就已經允許它們了，這裡把幾隻主要的 AI 爬蟲**明寫出來**，
 * 目的是宣告立場：以後有人（或某個外掛）順手加了一條擋 AI 的規則時，
 * 這份清單會讓那個改動變得很明顯，而不是安靜地把引用來源掐掉。
 *
 * ⚠️ 兩件事要分清楚：
 * - OAI-SearchBot／PerplexityBot 是「搜尋用」，擋掉就不會被引用
 * - GPTBot／ClaudeBot 偏「訓練用」，擋不擋是立場問題
 * 冠良的目標是被 AI 找到並引用，所以兩種都開。
 */
const AI_CRAWLERS = [
  "OAI-SearchBot", // ChatGPT 搜尋
  "ChatGPT-User", // 使用者在 ChatGPT 裡點連結時
  "GPTBot", // OpenAI
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Google-Extended", // Google 的 AI 功能
  "Applebot-Extended",
  "CCBot", // Common Crawl，很多 AI 的資料來源
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: NEVER_CRAWL },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: NEVER_CRAWL })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
