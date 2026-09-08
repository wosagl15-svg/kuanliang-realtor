/**
 * 591 物件資料 → 冠良自己的欄位（2026-08-21）
 *
 * 🔴 界線寫在這裡，改動前先讀完：
 *
 *   ✅ 抓「事實」：地址、坪數、房數、總價、型態、車位、屋齡、社區名。
 *      事實不受著作權保護，而且這些是他帶看時本來就要跟客戶講的東西。
 *
 *   ⛔ 不抓「別人做的東西」：
 *      - 標題的行銷文案（「獨家★易起找好房★✅…」那種）—— 那是別家仲介寫的
 *      - 物件照片 —— 有 591／仲介浮水印，著作權明確不是我們的
 *      - 所屬公司／經紀業名稱／仲介聯絡方式 —— 這正是系統擁有者說的「其他人的資料」
 *
 *   ⛔ 伺服器端不連 591。抓取只發生在使用者自己已登入、自己正在看的那一頁，
 *      由他自己按下書籤才執行（頁面是 Vue 動態渲染的，伺服器抓也只會拿到 ${price} 這種空殼）。
 *
 * ⚠️ 產出給客戶的東西一定要標「資料來源：591，實際以現場為準」。
 *    這一行同時擋掉兩個風險：資料過期，以及把別家的委託講成自己的案子。
 */

export type GrabbedListing = {
  /** 591 物件編號，唯一識別 */
  listingNo: string | null;
  url: string | null;
  /** 社區／大樓名。透天通常沒有，會是 null */
  community: string | null;
  address: string | null;
  district: string | null;
  /** 萬元 */
  priceWan: number | null;
  sizePing: number | null;
  rooms: number | null;
  /** 別墅／透天厝／電梯大樓／華廈／公寓 */
  shape: string | null;
  parking: string | null;
  ageYear: number | null;
  floor: string | null;
  /** 原始貼上的文字，存查用 */
  raw: string;
};

const EMPTY: Omit<GrabbedListing, "raw"> = {
  listingNo: null,
  url: null,
  community: null,
  address: null,
  district: null,
  priceWan: null,
  sizePing: null,
  rooms: null,
  shape: null,
  parking: null,
  ageYear: null,
  floor: null,
};

/** 書籤小工具複製出來的格式，每行 `鍵: 值`。人看得懂，程式也好解。 */
const KEYS: Record<string, keyof Omit<GrabbedListing, "raw">> = {
  編號: "listingNo",
  網址: "url",
  社區: "community",
  地址: "address",
  行政區: "district",
  總價: "priceWan",
  坪數: "sizePing",
  房數: "rooms",
  型態: "shape",
  車位: "parking",
  屋齡: "ageYear",
  樓層: "floor",
};

function num(s: string): number | null {
  const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/**
 * 解析書籤小工具產生的區塊。
 * 認不出來的行一律忽略 —— 寧可少填，不要猜一個看起來很精確的假值。
 */
export function parseGrabbedBlock(text: string): GrabbedListing | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  // 沒有這個標記就不是書籤產生的，交給別的解析路徑處理
  if (!/^【591物件】/m.test(t)) return null;

  const out: GrabbedListing = { ...EMPTY, raw: t };

  for (const line of t.split(/\r?\n/)) {
    const m = line.match(/^\s*([一-龥]{2,3})\s*[:：]\s*(.+)$/);
    if (!m) continue;
    const field = KEYS[m[1]];
    if (!field) continue;
    const v = m[2].trim();
    if (!v || v === "—" || v === "-") continue;

    if (field === "priceWan" || field === "sizePing" || field === "rooms" || field === "ageYear") {
      (out[field] as number | null) = num(v);
    } else {
      (out[field] as string | null) = v;
    }
  }

  // 標題那一行：【591物件】後面接社區名或地址，當作備援
  if (!out.community) {
    const h = t.match(/^【591物件】\s*(.+)$/m);
    const v = h?.[1]?.trim();
    if (v && v !== "（未命名）") out.community = v;
  }

  return out;
}

/**
 * 這筆物件在系統裡要顯示成什麼。
 * 有社區名用社區名（透天沒有社區名 → 用地址），這跟 community.kind 的規則一致。
 */
export function grabbedTitle(g: GrabbedListing): string {
  if (g.community) return g.community;
  if (g.address) return g.address;
  if (g.listingNo) return `591 物件 ${g.listingNo}`;
  return "（未填物件）";
}

/** 一行摘要：1880萬 · 47.35坪 · 4房 · 別墅 · 平面車位 */
export function grabbedSummary(g: GrabbedListing): string {
  const bits: string[] = [];
  if (g.priceWan) bits.push(`${g.priceWan} 萬`);
  if (g.sizePing) bits.push(`${g.sizePing} 坪`);
  if (g.rooms) bits.push(`${g.rooms} 房`);
  if (g.shape) bits.push(g.shape);
  if (g.ageYear !== null) bits.push(`屋齡 ${g.ageYear} 年`);
  if (g.parking) bits.push(g.parking);
  return bits.join("　·　");
}

/** 每坪單價（萬）。坪數或總價缺一就不算，不要湊一個假數字。 */
export function unitPrice(g: GrabbedListing): number | null {
  if (!g.priceWan || !g.sizePing || g.sizePing <= 0) return null;
  return Math.round((g.priceWan / g.sizePing) * 100) / 100;
}
