/**
 * 外部平台搜尋連結（2026-08-13 第二版：更精細）
 *
 * 🔴 只做「產生連結」，絕不抓取、絕不儲存任何 591 資料。
 *    爬取 = 把別人的物件抓回來存 → 違反使用條款、資料會過期。（已拍板不做）
 *    連結 = 開新分頁到 591 自己的搜尋頁 → 就是一條超連結。
 *
 * ⚠️ 以下參數全部在 591 網站上「實際操作篩選器並讀網址」驗證（2026-08-13），非憑印象：
 *
 *      regionid=8          台中市
 *      section=120,123     行政區，半形逗號多選
 *      price=800_1200      總價區間（萬），底線分隔；0_750 無下限、3000_ 無上限
 *      pattern=3           房數
 *      shape=2,5           建物型態，逗號多選
 *                            1=公寓  2=電梯大樓  3=透天厝  4=別墅  5=華廈
 *      area=30_40          權狀坪數區間
 *      label=7             含車位（label=9 是有陽台）
 *
 *   已確認 591 售屋搜尋**沒有屋齡篩選**（114 個標籤中零個含「年」或「齡」），
 *   所以屋齡永遠帶不進去，介面必須誠實告知。
 */
import { DISTRICTS } from "@/lib/buyer-constants";

export const REGION_TAICHUNG = 8;

/** 我們的區域代號 → 591 section。全部逐一點選驗證；沒驗證過的一律不列。 */
const SECTION_591: Partial<Record<string, number>> = {
  dadu: 119,
  shalu: 120,
  longjing: 121,
  wuqi: 122,
  qingshui: 123,
  dajia: 124,
  daan: 126,
};

/** 591 建物型態代號 */
const SHAPE = { 公寓: 1, 電梯大樓: 2, 透天厝: 3, 別墅: 4, 華廈: 5 } as const;

/** 591 特色標籤代號 */
const LABEL = { 含車位: 7, 有陽台: 9 } as const;

export type BuyerCriteria = {
  districts?: string[];
  budgetMin?: number | null;
  budgetMax?: number | null;
  /** 預算是模糊表述嗎（「800萬左右」）—— 影響上下限怎麼抓 */
  budgetFuzzy?: boolean;
  roomMin?: number | null;
  sizeMin?: number | null;
  sizeMax?: number | null;
  parking?: string | null;
  elevator?: string | null;
  ageMax?: number | null;
  /** 買方標籤，用來判斷型態（透天／公寓／華廈／電梯大樓） */
  tags?: string[];
};

export function sale591TaichungUrl(): string {
  return `https://sale.591.com.tw/?shType=list&regionid=${REGION_TAICHUNG}`;
}

export function land591TaichungUrl(): string {
  return `https://land.591.com.tw/list?type=2&kind=11&region=${REGION_TAICHUNG}`;
}

export function actualPriceUrl(): string {
  return "https://lvr.land.moi.gov.tw/";
}

/**
 * 算出要送進 591 的總價區間。
 *
 * 🔴 這裡是精準度的關鍵，不是單純把數字塞進去：
 *   - 只有上限時，下限不能填 0 —— 那會撈進一堆屋況落差很大的低總價物件，
 *     業務還要自己一筆筆濾掉，等於沒篩。改成上限的 75% 起跳。
 *   - 客戶說「800萬左右」時，硬卡 800 會漏掉 850 的物件，而那種他其實會看。
 *     模糊表述時上限放寬 10%。
 */
export function priceRange(
  min: number | null | undefined,
  max: number | null | undefined,
  fuzzy = false,
): { param: string; lo: number; hi: number | null } | null {
  const lo0 = min ?? null;
  const hi0 = max ?? null;

  if (lo0 !== null && hi0 !== null) {
    const hi = fuzzy ? Math.round(hi0 * 1.1) : hi0;
    return { param: `${Math.round(lo0)}_${hi}`, lo: Math.round(lo0), hi };
  }
  if (hi0 !== null) {
    const hi = fuzzy ? Math.round(hi0 * 1.1) : hi0;
    const lo = Math.round(hi0 * 0.75);
    return { param: `${lo}_${hi}`, lo, hi };
  }
  if (lo0 !== null) return { param: `${Math.round(lo0)}_`, lo: Math.round(lo0), hi: null };
  return null;
}

/** 依買方需求推斷建物型態。標籤優先，其次用電梯需求推。 */
function shapesFor(c: BuyerCriteria): number[] {
  const tags = c.tags ?? [];
  const picked = new Set<number>();

  if (tags.some((t) => t.includes("透天"))) picked.add(SHAPE.透天厝);
  if (tags.some((t) => t.includes("別墅"))) picked.add(SHAPE.別墅);
  if (tags.some((t) => t.includes("公寓"))) picked.add(SHAPE.公寓);
  if (tags.some((t) => t.includes("華廈"))) picked.add(SHAPE.華廈);
  if (tags.some((t) => t.includes("電梯大樓"))) picked.add(SHAPE.電梯大樓);

  if (picked.size) return [...picked];

  // 沒有型態標籤時，用電梯需求推：要電梯 → 電梯大樓＋華廈；不要電梯 → 公寓／透天／別墅
  if (c.elevator === "required") return [SHAPE.電梯大樓, SHAPE.華廈];
  if (c.elevator === "exclude") return [SHAPE.公寓, SHAPE.透天厝, SHAPE.別墅];
  return [];
}

export function build591Url(c: BuyerCriteria): string {
  const p = new URLSearchParams();
  p.set("shType", "list");
  p.set("regionid", String(REGION_TAICHUNG));

  const sections = (c.districts ?? [])
    .map((d) => SECTION_591[d])
    .filter((v): v is number => typeof v === "number");
  if (sections.length) p.set("section", sections.join(","));

  const pr = priceRange(c.budgetMin, c.budgetMax, c.budgetFuzzy);
  if (pr) p.set("price", pr.param);

  if (c.roomMin && c.roomMin >= 1 && c.roomMin <= 5) p.set("pattern", String(c.roomMin));

  const shapes = shapesFor(c);
  if (shapes.length) p.set("shape", shapes.join(","));

  // 坪數：只有兩邊都有才帶區間；只有下限時給一個合理上界，避免 591 認不得單邊寫法
  const sMin = c.sizeMin ?? null;
  const sMax = c.sizeMax ?? null;
  if (sMin !== null && sMax !== null) p.set("area", `${Math.round(sMin)}_${Math.round(sMax)}`);
  else if (sMin !== null) p.set("area", `${Math.round(sMin)}_200`);
  else if (sMax !== null) p.set("area", `0_${Math.round(sMax)}`);

  if (c.parking === "required") p.set("label", String(LABEL.含車位));

  return `https://sale.591.com.tw/?${p.toString()}`;
}

/** 這次連結實際帶進去了哪些條件 —— 顯示給使用者看，讓他知道搜尋範圍 */
export function mappedSummary(c: BuyerCriteria): string[] {
  const out: string[] = [];

  const districts = (c.districts ?? []).filter((d) => SECTION_591[d]);
  if (districts.length)
    out.push(districts.map((k) => DISTRICTS.find((d) => d.key === k)?.label ?? k).join("、"));

  const pr = priceRange(c.budgetMin, c.budgetMax, c.budgetFuzzy);
  if (pr) {
    const note =
      c.budgetFuzzy && c.budgetMax
        ? "（原話模糊，上限放寬 10%）"
        : c.budgetMin == null && c.budgetMax
          ? "（下限自動抓上限的 75%，避免撈進低總價落差物件）"
          : "";
    out.push(`${pr.lo}–${pr.hi ?? "不限"} 萬${note}`);
  }

  if (c.roomMin) out.push(`${c.roomMin} 房`);

  const shapes = shapesFor(c);
  if (shapes.length) {
    const names = Object.entries(SHAPE)
      .filter(([, v]) => shapes.includes(v))
      .map(([k]) => k);
    out.push(names.join("／"));
  }

  if (c.sizeMin || c.sizeMax) out.push(`${c.sizeMin ?? 0}–${c.sizeMax ?? "不限"} 坪`);
  if (c.parking === "required") out.push("含車位");

  return out;
}

/** 591 帶不進去、必須人工再篩的條件 —— 誠實告知，不要讓人以為全篩好了 */
export function unmappedCriteria(c: BuyerCriteria): string[] {
  const out: string[] = [];

  const unknown = (c.districts ?? []).filter((d) => !SECTION_591[d]);
  if (unknown.length) {
    out.push(
      `${unknown.map((k) => DISTRICTS.find((d) => d.key === k)?.label ?? k).join("、")}（未建對照，連結只帶到台中市）`,
    );
  }

  // 591 售屋搜尋沒有屋齡篩選（已驗證），永遠帶不進去
  if (c.ageMax) out.push(`屋齡 ${c.ageMax} 年以內（591 沒有這個篩選）`);

  return out;
}
