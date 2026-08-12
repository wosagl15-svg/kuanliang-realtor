/**
 * 物件 AI 抽取（2026-08-12）
 *
 * 跟買方走同一條管線：貼一段物件描述（公司內網複製、同事 LINE 丟來的、委託書打的字）
 * → 抽成結構化欄位 → 人工確認 → 入庫。
 *
 * 這是讓系統「變真」最快的路：不靠外部平台、資料是自己的、不會過期。
 *
 * 🔴 同樣三條鐵律：不編造、標信心度、人工確認才入庫。
 *    物件價格抽錯的後果比買方需求更嚴重 —— 那是會直接拿去跟客戶報的數字。
 */
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { aiClient, aiCost, AI_MODEL } from "@/lib/ai-client";
import { DISTRICTS, SEED_TAGS } from "@/lib/buyer-constants";

const DISTRICT_KEYS = DISTRICTS.map((d) => d.key) as [string, ...string[]];

export const ExtractedListingSchema = z.object({
  title: z.string().describe("物件標題，20 字內，例「沙鹿高鐵三房車位」。沒有明確標題就自己組一個簡短的"),
  community_name: z.string().nullable().describe("社區／建案名稱，原樣輸出。沒提到就 null"),
  district: z.enum(DISTRICT_KEYS).nullable().describe("行政區代號，只能從清單選。判斷不出來就 null"),
  address: z.string().nullable().describe("地址或路段，例「中山路二段」。沒提到就 null"),

  price: z.number().nullable().describe("總價，單位「萬元」。「1280萬」→1280。沒提到就 null，絕對不要推算"),
  price_raw: z.string().nullable().describe("價格的原話，有「開價」「議價空間」「自售」等字樣時一定要填"),

  size_ping: z.number().nullable().describe("權狀坪數。有寫主建物／權狀兩種時取權狀"),
  rooms: z.number().nullable().describe("房數"),
  living_rooms: z.number().nullable().describe("廳數"),
  baths: z.number().nullable().describe("衛浴數"),
  floor_no: z.number().nullable().describe("所在樓層"),
  total_floors: z.number().nullable().describe("總樓層"),
  age_year: z.number().nullable().describe("屋齡（年）。若只給建成年份，用今年減去它"),

  has_elevator: z.boolean().nullable().describe("有無電梯。沒提到就 null，不要用樓層猜"),
  parking_count: z.number().describe("車位數量。沒提到填 0"),

  tags: z.array(z.string()).describe("物件特色標籤，優先用系統既有標籤"),

  confidence: z
    .array(
      z.object({
        field: z.string(),
        level: z.enum(["high", "medium", "low"]),
        evidence: z.string().nullable().describe("原文出處"),
      }),
    )
    .describe("每個有填的欄位都要有一筆"),
  unclear: z.array(z.string()).describe("需要跟屋主或同事確認的事項，寫成完整句子"),
  summary: z.string().describe("一兩句話總結這個物件的賣點"),
});

export type ExtractedListing = z.infer<typeof ExtractedListingSchema>;

export type ListingExtractResult = {
  data: ExtractedListing;
  usage: { inputTokens: number; outputTokens: number; costTwd: number };
};

function systemPrompt(): string {
  const districtList = DISTRICTS.map((d) => `${d.key}=${d.label}`).join("、");
  const tagList = SEED_TAGS.map((t) => t.name).join("、");

  return `你是台中海線房仲的資料整理助手。任務：把一段物件描述轉成結構化欄位。

# 三條鐵律

## 1. 寧可留白，不要編造
沒寫的欄位一律 null（車位數例外，沒提到填 0）。
**絕對不要推算**：不要從坪數推房數，不要從樓層推有無電梯，不要從屋齡推價格。
物件數字會被直接拿去跟客戶報，編一個看起來合理的數字比留白危險得多。

## 2. 價格特別小心
- 單位一律「萬元」：「1,280萬」→1280；「一千兩百八十萬」→1280。
- 出現「開價」「可議」「自售」「屋主自售」「急售」等字樣，price_raw 一定要填原話，
  並把 confidence 標成 medium —— 開價不等於成交價。
- 看到「單價 XX 萬/坪」不要拿來當總價。

## 3. 每個有填的欄位都要有原文出處
confidence 的 evidence 放原本那句話，不要改寫。

# 欄位規則
- **行政區**只能從這裡選：${districtList}
- **屋齡**：若只給「111年完工」這種民國年，換算成西元再減今年（今年是 ${new Date().getFullYear()} 年）。
- **標籤**優先用既有的：${tagList}
- **unclear** 寫成可以直接照著問的句子，例「請確認是開價還是屋主可接受的底價？」

只輸出符合 schema 的 JSON。`;
}

export async function extractListing(rawText: string): Promise<ListingExtractResult> {
  const text = rawText.trim();
  if (!text) throw new Error("empty_text");
  if (text.length > 40_000) throw new Error("text_too_long");

  const response = await aiClient().messages.parse({
    model: AI_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(ExtractedListingSchema) },
    system: systemPrompt(),
    messages: [{ role: "user", content: `以下是物件描述：\n\n<content>\n${text}\n</content>` }],
  });

  if (response.stop_reason === "refusal") throw new Error("extraction_refused");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("extraction_failed");

  const inputTokens = response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0);
  const outputTokens = response.usage.output_tokens;
  const { costTwd } = aiCost(inputTokens, outputTokens);

  return { data: sanitize(parsed), usage: { inputTokens, outputTokens, costTwd } };
}

/** 程式端收斂：擋掉單位跑掉與明顯不合理的值 */
function sanitize(d: ExtractedListing): ExtractedListing {
  let price = d.price;
  if (price !== null && Number.isFinite(price)) {
    price = Math.round(price);
    if (price >= 1_000_000) price = Math.round(price / 10_000); // 12800000 元 → 1280 萬
    if (price < 50 || price > 50_000) price = null;
  } else price = null;

  const clampInt = (v: number | null, min: number, max: number) =>
    v !== null && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null;

  return {
    ...d,
    title: d.title.trim().slice(0, 60) || "未命名物件",
    price,
    size_ping: d.size_ping !== null && d.size_ping > 0 && d.size_ping <= 1000 ? d.size_ping : null,
    rooms: clampInt(d.rooms, 0, 20),
    living_rooms: clampInt(d.living_rooms, 0, 10),
    baths: clampInt(d.baths, 0, 10),
    floor_no: clampInt(d.floor_no, -5, 200),
    total_floors: clampInt(d.total_floors, 1, 200),
    age_year: clampInt(d.age_year, 0, 120),
    parking_count: clampInt(d.parking_count, 0, 20) ?? 0,
    tags: [...new Set(d.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20),
  };
}
