/**
 * 商家與網站的 JSON-LD 節點，唯一的組裝點。
 *
 * 🔴 為什麼要抽出來：
 *    這個節點的形狀原本在三個地方各寫一份 —— 首頁 (src/app/page.tsx)、
 *    靜態頁腳本 (scripts/seo-build.mjs)、以及「應該要有卻沒有」的部落格。
 *    seo-build.mjs 裡甚至留了一行警告說「形狀要與 page.tsx 一致」，
 *    那就是在講這件事。資料早就共用 src/config/agent.json 了，
 *    但「怎麼組成節點」還是各寫各的，改一邊會忘記另一邊。
 *
 * 🔴 為什麼部落格一定要內嵌整個節點，不能只寫 @id：
 *    JSON-LD 的 `{"@id": ".../#agent"}` 只是一個「參照」，
 *    它假設讀的人已經看過定義那個 id 的頁面（首頁）。
 *    Google 爬全站，通常接得起來；但**AI 爬蟲常常只抓單獨一頁**，
 *    抓到的文章就變成「作者是某個不存在的 id」——等於沒有作者。
 *    這正是 GEO 要避免的：AI 讀完文章，說不出這是誰寫的。
 *    所以每一篇文章都把商家與作者完整帶一份。
 *
 * ⚠️ scripts/seo-build.mjs 是 .mjs、在 build 前獨立執行，沒辦法 import 這支 .ts，
 *    它仍然自己組一份。改這裡的形狀時，那邊要一起改。
 */
import { SITE_URL } from "@/lib/site";
import AGENT from "@/config/agent.json";

export const AGENT_ID = `${SITE_URL}/#agent`;
export const PERSON_ID = `${SITE_URL}/#wuguanliang`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** 商家本體。含負責人 Person，讓 AI 說得出「吳冠良」這個名字。 */
export function agentNode() {
  return {
    "@type": "RealEstateAgent",
    "@id": AGENT_ID,
    name: AGENT.name,
    alternateName: AGENT.alternateName,
    description: AGENT.description,
    slogan: AGENT.slogan,
    url: `${SITE_URL}/`,
    image: `${SITE_URL}${AGENT.imagePath}`,
    telephone: AGENT.telephone,
    email: AGENT.email,
    address: AGENT.address,
    geo: AGENT.geo,
    priceRange: AGENT.priceRange,
    areaServed: AGENT.areaServed.map((n) => ({
      "@type": "AdministrativeArea",
      name: `台中市${n}`,
    })),
    sameAs: AGENT.sameAs,
    hasMap: AGENT.hasMap,
    employee: {
      "@type": "Person",
      "@id": PERSON_ID,
      name: AGENT.personName,
      jobTitle: AGENT.jobTitle,
    },
  };
}

/** 網站本體。首頁一定要有；內頁用 isPartOf 指回來即可。 */
export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${SITE_URL}/`,
    name: AGENT.name,
    inLanguage: "zh-Hant-TW",
    publisher: { "@id": AGENT_ID },
  };
}
