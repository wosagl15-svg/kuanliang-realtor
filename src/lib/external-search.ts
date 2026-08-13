/**
 * 外部平台搜尋連結（2026-08-13 更新）
 *
 * 🔴 這裡只做「產生連結」，絕不抓取、絕不儲存任何 591 資料。
 *    爬取 = 把別人的物件抓下來存進我們的資料庫 → 違反使用條款、資料會過期。（已拍板不做）
 *    連結 = 開一個新分頁到 591 自己的搜尋頁 → 就是一條超連結，看到的永遠是他們當下最新的。
 *
 * ⚠️ 以下參數全部是 2026-08-13 在 591 網站上「實際操作篩選器並讀網址」驗證出來的，
 *    不是憑印象猜的。若哪天 591 改版導致連結失效，重跑一次同樣的驗證流程即可。
 *
 *      regionid=8              台中市（標題確認顯示「台中市買房」）
 *      section=120,123         行政區，多選用半形逗號
 *      price=1000_1250         總價區間，單位「萬」，底線分隔
 *      price=0_750             無下限
 *      price=3000_             無上限
 *      pattern=3               房數（3 房）
 */
import { DISTRICTS } from "@/lib/buyer-constants";

/** 591 售屋的縣市代號。只列我們服務的台中，其餘要用再查，不憑印象填。 */
export const REGION_TAICHUNG = 8;

/**
 * 我們的區域代號 → 591 的 section 代號。
 * 全部逐一點選驗證過；沒驗證過的區一律不列（寧可少帶一個參數，也不要帶錯的）。
 */
const SECTION_591: Partial<Record<string, number>> = {
  dadu: 119, // 大肚
  shalu: 120, // 沙鹿
  longjing: 121, // 龍井
  wuqi: 122, // 梧棲
  qingshui: 123, // 清水
  dajia: 124, // 大甲
  daan: 126, // 大安
};

export type BuyerCriteria = {
  districts?: string[];
  budgetMin?: number | null;
  budgetMax?: number | null;
  roomMin?: number | null;
};

/** 台中市買屋列表（沒帶條件時的預設） */
export function sale591TaichungUrl(): string {
  return `https://sale.591.com.tw/?shType=list&regionid=${REGION_TAICHUNG}`;
}

/** 台中土地列表 */
export function land591TaichungUrl(): string {
  return `https://land.591.com.tw/list?type=2&kind=11&region=${REGION_TAICHUNG}`;
}

/** 實價登錄（內政部官方，公開資料，可自由連結） */
export function actualPriceUrl(): string {
  return "https://lvr.land.moi.gov.tw/";
}

/**
 * 依買方需求組出 591 搜尋連結。
 * 帶得進去的條件才帶，帶不進去的（車位、電梯、屋齡、社區名）在 UI 另外提示要人工再篩。
 */
export function build591Url(c: BuyerCriteria): string {
  const p = new URLSearchParams();
  p.set("shType", "list");
  p.set("regionid", String(REGION_TAICHUNG));

  // 行政區：只帶驗證過的；有區域但全都沒對照表時就不帶（退回整個台中市）
  const sections = (c.districts ?? [])
    .map((d) => SECTION_591[d])
    .filter((v): v is number => typeof v === "number");
  if (sections.length) p.set("section", sections.join(","));

  // 總價（萬）
  const min = c.budgetMin ?? null;
  const max = c.budgetMax ?? null;
  if (min !== null && max !== null) p.set("price", `${Math.round(min)}_${Math.round(max)}`);
  else if (max !== null) p.set("price", `0_${Math.round(max)}`);
  else if (min !== null) p.set("price", `${Math.round(min)}_`);

  // 房數：591 的 pattern 是「幾房」，我們存的是下限，取下限帶進去
  if (c.roomMin && c.roomMin >= 1 && c.roomMin <= 5) p.set("pattern", String(c.roomMin));

  return `https://sale.591.com.tw/?${p.toString()}`;
}

/** 哪些條件 591 連結帶不進去，需要人工在對方站上再篩 —— 誠實告訴使用者，不要讓他以為全篩好了 */
export function unmappedCriteria(c: BuyerCriteria & { parking?: string; elevator?: string; ageMax?: number | null }): string[] {
  const out: string[] = [];
  const unknownDistricts = (c.districts ?? []).filter((d) => !SECTION_591[d]);
  if (unknownDistricts.length) {
    out.push(
      `${unknownDistricts.map((k) => DISTRICTS.find((d) => d.key === k)?.label ?? k).join("、")}（未建對照，連結只帶到台中市）`,
    );
  }
  if (c.parking === "required") out.push("車位需求");
  if (c.elevator === "required" || c.elevator === "exclude") out.push("電梯需求");
  if (c.ageMax) out.push(`屋齡 ${c.ageMax} 年以內`);
  return out;
}
