/**
 * 外部平台搜尋連結（2026-08-12）
 *
 * 🔴 這裡只做「產生連結」，絕不抓取、絕不儲存任何 591 資料。
 *    差別很重要：
 *      爬取 = 把別人的物件抓下來存進我們的資料庫 → 違反使用條款、資料會過期、無差異化。（已拍板不做）
 *      連結 = 開一個新分頁到 591 自己的搜尋頁 → 就是一條超連結，看到的永遠是他們當下最新的資料。
 *
 * ⚠️ 網址格式是實際開過驗證的（2026-08-12）：
 *      https://sale.591.com.tw/?shType=list&regionid=8  → 標題顯示「台中市買房」
 *    行政區的 section id 是動態載入的，沒有公開穩定的對照表，所以不硬掰參數。
 *    區域／社區名稱改用「一鍵複製」讓使用者貼進 591 自己的搜尋框 —— 少一次點擊，但不會壞。
 */

/** 591 售屋的縣市代號。只列我們服務的台中，其餘要用再查，不憑印象填。 */
export const REGION_TAICHUNG = 8;

/** 台中市買屋列表（已驗證可開） */
export function sale591TaichungUrl(): string {
  return `https://sale.591.com.tw/?shType=list&regionid=${REGION_TAICHUNG}`;
}

/** 台中土地列表（頁面上抓到的官方連結格式） */
export function land591TaichungUrl(): string {
  return `https://land.591.com.tw/list?type=2&kind=11&region=${REGION_TAICHUNG}`;
}

/**
 * 依買方需求組出要貼進 591 搜尋框的關鍵字。
 * 例：「沙鹿 三房 車位」
 */
export function buildSearchKeywords(opts: {
  districtLabels?: string[];
  communityNames?: string[];
  roomMin?: number | null;
  needParking?: boolean;
}): string {
  const parts: string[] = [];
  if (opts.communityNames?.length) parts.push(...opts.communityNames);
  else if (opts.districtLabels?.length) parts.push(...opts.districtLabels.map((d) => d.replace(/區$/, "")));
  if (opts.roomMin) parts.push(`${opts.roomMin}房`);
  if (opts.needParking) parts.push("車位");
  return parts.join(" ");
}

/** 實價登錄（內政部官方，公開資料，可自由連結） */
export function actualPriceUrl(): string {
  return "https://lvr.land.moi.gov.tw/";
}
