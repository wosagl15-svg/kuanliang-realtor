/**
 * 帶看物件連結解析（2026-08-14）
 *
 * 🔴 只解析「使用者自己貼進來的那串文字」，不連到任何外部網站抓資料。
 *    不爬 591 的原則沒有變 —— 這裡從頭到尾只做字串處理，
 *    連一個 HTTP request 都不會發出去。
 *
 * 為什麼要拆分享訊息：從 591 App 按「分享」複製出來的是一整段，長這樣
 *   「太子哈佛 3房2廳 1280萬 https://sale.591.com.tw/home/house/detail/2/12345678.html」
 * 業務會整段貼上。硬要他先把網址剪下來再打一次名稱，等於多兩個動作，
 * 多兩個動作就不會有人記。所以整段吃進來，自己拆。
 */

/** 各平台的網域對照。認不出來的一律標「連結」，不硬猜。 */
const PLATFORMS: { test: RegExp; label: string; emoji: string }[] = [
  { test: /(^|\.)591\.com\.tw$/i, label: "591", emoji: "🏠" },
  { test: /(^|\.)rakuya\.com\.tw$/i, label: "樂屋網", emoji: "🏠" },
  { test: /(^|\.)sinyi\.com\.tw$/i, label: "信義", emoji: "🏢" },
  { test: /(^|\.)yungching\.com\.tw$/i, label: "永慶", emoji: "🏢" },
  { test: /(^|\.)housefun\.com\.tw$/i, label: "好房網", emoji: "🏠" },
  { test: /(^|\.)yungching\.tw$/i, label: "永慶", emoji: "🏢" },
  { test: /(^|\.)hbhousing\.com\.tw$/i, label: "住商", emoji: "🏢" },
  { test: /(^|\.)century21\.com\.tw$/i, label: "21世紀", emoji: "🏢" },
  { test: /(^|\.)pchome\.com\.tw$/i, label: "PChome房屋", emoji: "🏠" },
  { test: /(^|\.)google\.[a-z.]+$/i, label: "地圖", emoji: "📍" },
  { test: /(^|\.)line\.me$/i, label: "LINE", emoji: "💬" },
];

export type ParsedListingLink = {
  /** 拆出來的網址（沒有就是 null） */
  url: string | null;
  /** 網址以外的文字，通常就是物件名稱 */
  label: string;
  /** 平台名稱，例：591 */
  platform: string | null;
  platformEmoji: string;
  /** 591 之類平台的物件編號，讓兩筆同名紀錄分得出來 */
  listingNo: string | null;
};

/** 從一段文字裡抓第一個網址。允許沒有 http:// 前綴的寫法。 */
function firstUrl(text: string): { url: string; start: number; end: number } | null {
  const m = text.match(/(https?:\/\/[^\s<>"'）)】」]+)|((?:www\.|[a-z0-9-]+\.)[a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?\/[^\s<>"'）)】」]*)/i);
  if (!m || m.index === undefined) return null;
  const raw = m[0].replace(/[.,、。]+$/, ""); // 句尾標點不算網址的一部分
  return {
    url: /^https?:\/\//i.test(raw) ? raw : `https://${raw}`,
    start: m.index,
    end: m.index + raw.length,
  };
}

/** 從 591 網址抓物件編號。格式驗證過兩種：/detail/2/12345678.html 與 /12345678 */
function listingNoOf(u: URL): string | null {
  const m =
    u.pathname.match(/\/detail\/\d+\/(\d{5,})/) ??
    u.pathname.match(/\/(\d{6,})(?:\.html)?\/?$/);
  return m ? m[1] : null;
}

export function parseListingLink(input: string): ParsedListingLink {
  const text = (input ?? "").trim();
  if (!text) return { url: null, label: "", platform: null, platformEmoji: "🔑", listingNo: null };

  const found = firstUrl(text);
  if (!found) {
    // 純文字：整段就是物件名稱，這是完全合法的用法（自家案子、別家口頭報的案子）
    return { url: null, label: text, platform: null, platformEmoji: "🔑", listingNo: null };
  }

  // 網址前後剩下的文字併起來當名稱
  const label = (text.slice(0, found.start) + " " + text.slice(found.end))
    .replace(/\s+/g, " ")
    .trim();

  let platform: string | null = null;
  let platformEmoji = "🔗";
  let listingNo: string | null = null;

  try {
    const u = new URL(found.url);
    const host = u.hostname.replace(/^www\./i, "");
    const hit = PLATFORMS.find((p) => p.test.test(host));
    if (hit) {
      platform = hit.label;
      platformEmoji = hit.emoji;
    } else {
      platform = host;
    }
    listingNo = listingNoOf(u);
  } catch {
    // URL 解析不了就當它不是網址，但文字還是留著
    return { url: null, label: text, platform: null, platformEmoji: "🔑", listingNo: null };
  }

  return { url: found.url, label, platform, platformEmoji, listingNo };
}

/**
 * 同一間物件的辨識鍵 —— 「推案時的反應 vs 看完的反應」要對得起來，全靠這個。
 *
 * 有網址就用網址（去掉 query 與 hash：591 分享連結常帶 utm、從搜尋頁點進來還會多參數，
 * 不去掉的話同一間會被當成兩間）。沒網址退回名稱正規化，但那就不保證了 ——
 * 這正是貼連結比打字有價值的地方。
 */
export function listingKey(url: string | null | undefined, title: string): string {
  if (url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./i, "").toLowerCase();
      const path = u.pathname.replace(/\/+$/, "").toLowerCase();
      return `u:${host}${path}`;
    } catch {
      /* 網址壞掉就退回用名稱 */
    }
  }
  return `t:${(title || "").normalize("NFKC").replace(/[\s　]/g, "").toLowerCase()}`;
}

/**
 * 這筆紀錄要顯示成什麼。
 * 優先序：業務自己打的名稱 → 平台+編號 → 網域。永遠不會空白，
 * 因為一列看不出是哪間的紀錄等於沒記。
 */
export function displayTitle(p: ParsedListingLink): string {
  if (p.label) return p.label;
  if (p.platform && p.listingNo) return `${p.platform} 物件 ${p.listingNo}`;
  if (p.platform) return `${p.platform} 物件`;
  return "（未填物件）";
}
