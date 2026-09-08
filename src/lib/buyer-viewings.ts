/**
 * 把互動紀錄裡的「推案／帶看」整理成以物件為單位的歷程（2026-08-14）
 *
 * 為什麼要用物件分組，而不是照時間列：
 *   同一間房子，客戶在 LINE 上看照片說「不錯耶」，實際帶去看完卻興趣缺缺。
 *   兩筆紀錄照時間攤開會被中間的通話洗散，看不出這是同一間的落差。
 *   分組之後才問得出真正的問題：**照片跟現場差在哪？**
 *
 * 這個落差要是一直重複出現（連續幾間都是推案熱、看完冷），代表的往往不是
 * 客戶善變，而是推的物件「照片好看但實體不行」，或是描述時把話講太滿。
 */
import { REACTIONS } from "@/lib/buyer-constants";
import { parseListingLink, listingKey, displayTitle, type ParsedListingLink } from "@/lib/listing-link";

export type ViewingRow = {
  id: string;
  type: string;
  content: string | null;
  listing_url: string | null;
  reaction: string | null;
  occurred_at: Date | string;
};

export type ViewingEvent = {
  id: string;
  /** viewing = 帶看、pitch = 推案 */
  type: string;
  at: Date;
  reaction: string | null;
  note: string;
};

export type ViewingGroup = {
  key: string;
  title: string;
  /** 名稱是業務打的（true）還是從網址湊出來的（false） */
  titleIsTyped: boolean;
  url: string | null;
  platform: string | null;
  platformEmoji: string;
  listingNo: string | null;
  /** 舊 → 新 */
  events: ViewingEvent[];
  latestAt: Date;
  pitchReaction: string | null;
  viewReaction: string | null;
  /** 帶看分數 − 推案分數。負數＝看完之後變冷。兩邊都有評分才算得出來。 */
  gap: number | null;
};

function weightOf(reaction: string | null): number | null {
  if (!reaction) return null;
  const r = REACTIONS.find((x) => x.key === reaction);
  return r ? r.weight : null;
}

/** 內容存的是「【物件名】備註」，拆回來 */
function splitContent(content: string | null): { title: string; note: string } {
  const raw = (content ?? "").trim();
  const m = raw.match(/^【(.+?)】([\s\S]*)$/);
  return m ? { title: m[1].trim(), note: m[2].trim() } : { title: raw, note: "" };
}

export function groupViewings(rows: ViewingRow[]): ViewingGroup[] {
  const map = new Map<string, ViewingGroup>();

  for (const r of rows) {
    if (r.type !== "viewing" && r.type !== "pitch") continue;

    const { title, note } = splitContent(r.content);
    const link: ParsedListingLink = r.listing_url
      ? { ...parseListingLink(r.listing_url), label: "" } // label 由 content 來，不要讓網址殘留的文字混進去
      : { url: null, label: title, platform: null, platformEmoji: "🔑", listingNo: null };

    // title 是人打的名稱，displayTitle 是從網址湊出來的（「591 物件 12345678」）。
    // 兩者要分清楚：同一間物件推案時打了名字、帶看時只貼網址，
    // 若不分就會被後來那筆的自動名稱蓋掉，變成一排看不出是哪間的編號。
    // 存檔時名稱就已經寫進 content 了，所以無法從欄位分辨。
    // 但自動名稱長得就是 displayTitle 的樣子，比對得出來。
    const auto = displayTitle(link);
    const typed = title && title !== auto ? title : "";
    const shown = typed || auto;
    const key = listingKey(r.listing_url, shown);
    const at = new Date(r.occurred_at);

    let g = map.get(key);
    if (!g) {
      g = {
        key,
        title: shown || "（未填物件）",
        titleIsTyped: Boolean(typed),
        url: r.listing_url ?? null,
        platform: link.platform,
        platformEmoji: link.platformEmoji,
        listingNo: link.listingNo,
        events: [],
        latestAt: at,
        pitchReaction: null,
        viewReaction: null,
        gap: null,
      };
      map.set(key, g);
    }

    // 同一組裡若有一筆帶了網址，整組都用它（可能第一次推案只打了名字）
    if (!g.url && r.listing_url) {
      g.url = r.listing_url;
      g.platform = link.platform;
      g.platformEmoji = link.platformEmoji;
      g.listingNo = link.listingNo;
    }
    // 人打的名稱永遠贏過自動湊的編號名稱
    if (typed && !g.titleIsTyped) {
      g.title = typed;
      g.titleIsTyped = true;
    } else if (shown && g.title === "（未填物件）") {
      g.title = shown;
    }

    g.events.push({ id: r.id, type: r.type, at, reaction: r.reaction ?? null, note });
    if (at > g.latestAt) g.latestAt = at;
  }

  for (const g of map.values()) {
    g.events.sort((a, b) => a.at.getTime() - b.at.getTime());

    // 各取最後一次的評分：客戶可能被推了兩次、看了兩次，以最新的為準
    for (const e of g.events) {
      if (!e.reaction) continue;
      if (e.type === "pitch") g.pitchReaction = e.reaction;
      else g.viewReaction = e.reaction;
    }

    const p = weightOf(g.pitchReaction);
    const v = weightOf(g.viewReaction);
    g.gap = p !== null && v !== null ? v - p : null;
  }

  return [...map.values()].sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());
}

/** 落差要怎麼講給人聽。只在推案與帶看都有評分時才有話說。 */
export function gapNote(g: ViewingGroup): { tone: "warn" | "success" | "neutral"; text: string } | null {
  if (g.gap === null) return null;
  if (g.gap <= -2)
    return { tone: "warn", text: "看之前很有興趣，看完落差很大 —— 值得問清楚是屋況、環境還是價格" };
  if (g.gap === -1) return { tone: "warn", text: "看完之後熱度掉了一些" };
  if (g.gap === 0) return { tone: "neutral", text: "看之前與看之後感覺一致" };
  if (g.gap === 1) return { tone: "success", text: "實際看過比看照片更喜歡" };
  return { tone: "success", text: "現場加分很多 —— 這類型的物件可以多推" };
}

/** 整體提醒：連續多間都「推案熱、看完冷」，問題多半不在客戶身上 */
export function coolingPattern(groups: ViewingGroup[]): { count: number; total: number } | null {
  const rated = groups.filter((g) => g.gap !== null);
  if (rated.length < 2) return null;
  const cooling = rated.filter((g) => (g.gap as number) < 0).length;
  return cooling >= 2 ? { count: cooling, total: rated.length } : null;
}
