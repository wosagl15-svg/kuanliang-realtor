/**
 * 買方需求 AI 抽取（2026-08-12）
 *
 * 把三種來源的自由文字轉成結構化欄位：
 *   ① LINE 對話貼上   ② 會議／帶看錄音逐字稿（30 分鐘等級）  ③ 官網自由描述表單
 * 三種走同一條管線，只有 sourceKind 不同（逐字稿要多忽略寒暄與離題）。
 *
 * 🔴 系統擁有者拍板的三條鐵律（不可違反）：
 *   1. 標信心度，不編數字 —— 客戶說「兩千左右吧看情況」不能寫死 2000，
 *      要標成 medium 信心 + 保留原話。寧可留白，不要編一個看起來很精確的假資料。
 *   2. 留原文出處 —— 每個欄位存下對應原句，抽錯時一眼看出問題在哪。
 *   3. 人工確認才入庫 —— 這支只負責「回傳解析結果」，絕不直接寫 DB。
 *      寫入由 /admin/buyers/new 的確認流程負責。AI 是省打字的，不是自動決策的。
 */
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { aiClient, aiCost, AI_MODEL } from "@/lib/ai-client";
import { DISTRICTS, SEED_TAGS } from "@/lib/buyer-constants";
import { extractPhones } from "@/lib/phone";

const MODEL = AI_MODEL;

const DISTRICT_KEYS = DISTRICTS.map((d) => d.key) as [string, ...string[]];

// ---- 輸出 schema ----
// 注意：結構化輸出不支援 min/max 之類數值約束，所以範圍檢查放在程式端 sanitize。

const FieldNote = z.object({
  field: z.string().describe("欄位代號，例 budget_max"),
  level: z.enum(["high", "medium", "low"]).describe("high=客戶明確講了；medium=有講但模糊；low=用推的"),
  evidence: z.string().nullable().describe("原文出處：這個判斷是根據哪一句話。找不到就 null"),
});

export const ExtractedBuyerSchema = z.object({
  name: z.string().nullable().describe("買方姓名或稱呼，例「陳先生」「林小姐一家」。沒提到就 null"),
  phone: z.string().nullable().describe("電話號碼，原樣輸出即可"),
  line_id: z.string().nullable(),

  budget_min: z.number().nullable().describe("總價下限，單位「萬元」。沒提到就 null，不要用房數或坪數推算"),
  budget_max: z.number().nullable().describe("總價上限，單位「萬元」。模糊表述取中間值但 level 要標 medium"),
  budget_raw: z.string().nullable().describe("預算的原話，例「兩千左右吧看情況」。有模糊表述時一定要填"),

  districts: z.array(z.enum(DISTRICT_KEYS)).describe("意向區域代號，只能從清單選。沒提到就空陣列"),
  community_names: z.array(z.string()).describe("客戶提到的社區／建案名稱，原樣輸出，之後由系統比對主檔"),
  landmarks: z.array(z.string()).describe("客戶提到的地標，例「Costco」「高鐵站」「弘光科大」"),

  room_min: z.number().nullable().describe("最少房數。「三房」→3。沒提到就 null"),
  elevator: z.enum(["any", "required", "exclude"]).describe("沒提到一律 any，不要猜"),
  parking: z.enum(["any", "required", "buyable", "none"]).describe("沒提到一律 any，不要猜"),
  purpose: z.enum(["self", "invest", "asset", "unknown"]).describe("沒提到一律 unknown"),

  size_min: z.number().nullable().describe("坪數下限（權狀坪）"),
  size_max: z.number().nullable(),
  age_max: z.number().nullable().describe("可接受的最高屋齡（年）"),
  floor_pref: z.string().nullable().describe("樓層偏好原話，例「不要一樓」「中高樓層」"),

  tags: z.array(z.string()).describe("需求標籤，優先使用系統既有標籤名稱"),
  avoid: z.array(z.string()).describe("明確表達不要的東西，例「不要路沖」「避開宮廟」"),

  decision_maker: z.string().nullable().describe("誰說了算，例「太太決定」「要問爸媽」。這欄最常漏但最影響成交"),
  funding_note: z.string().nullable().describe("資金／貸款狀況，例「要先賣掉現在的房子」「貸款成數要八成」"),
  urgency: z.enum(["asap", "soon", "explore", "unknown"]).describe("asap=這個月內；soon=1-3個月；explore=先了解"),
  personality_note: z.string().nullable().describe("個性與溝通偏好，例「很急、講話直接」「喜歡先看資料再約」"),

  viewing_plan: z.string().nullable().describe("有提到下次看屋時間就填，例「這週六下午」"),

  confidence: z.array(FieldNote).describe("每個有填的欄位都要有一筆，含原文出處"),
  unclear: z.array(z.string()).describe("需要跟客戶再確認的事項，用完整句子寫，業務會照著問"),
  summary: z.string().describe("兩三句話總結這個買方要什麼"),
});

export type ExtractedBuyer = z.infer<typeof ExtractedBuyerSchema>;

export type ExtractResult = {
  data: ExtractedBuyer;
  /** 保險絲：程式端也撈一次電話，避免 AI 漏抽把客戶電話弄丟 */
  phonesFound: string[];
  usage: { inputTokens: number; outputTokens: number; costUsd: number; costTwd: number };
  model: string;
};

export type SourceKind = "line" | "transcript" | "web_form" | "manual";

function systemPrompt(kind: SourceKind): string {
  const tagList = SEED_TAGS.map((t) => t.name).join("、");
  const districtList = DISTRICTS.map((d) => `${d.key}=${d.label}`).join("、");

  const kindNote =
    kind === "transcript"
      ? `
【這是錄音逐字稿】
逐字稿又長又雜：會有寒暄、天氣、閒聊、離題、好幾個人交錯講話、口誤與重複。
只抽「跟買房需求有關」的內容，其餘一律忽略。
如果同一件事前後講法不一致（先說預算 1800、後來說 2200），以**最後講的**為準，
並在 unclear 裡註明「預算前後不一致，需確認」。`
      : kind === "line"
        ? `
【這是 LINE 對話】
分辨誰是客戶、誰是房仲。只抽客戶的需求，不要把房仲的推薦話術當成客戶需求。
對話可能橫跨數週，以**最後提到**的需求為準。`
        : `
【這是客戶自己填的自由描述】
通常較短、較口語，可能一句話帶過。不要為了填滿欄位而推測。`;

  return `你是台中海線房仲的資料整理助手。任務：把一段自由文字，轉成結構化的買方需求欄位。
${kindNote}

# 三條鐵律（違反任何一條都是嚴重錯誤）

## 1. 寧可留白，不要編造
沒提到的欄位一律 null 或空陣列或預設值（any / unknown）。
**絕對不要**用其他資訊去推算：不要從「三房」推預算，不要從「有小孩」推學區需求，
不要從區域推坪數。客戶沒說就是沒說。
一個留白的欄位，業務看到會去問；一個編造的欄位，業務會拿去跟客戶講，然後出事。

## 2. 模糊表述要標 medium，並保留原話
「兩千左右吧看情況」→ budget_max 可以填 2000，但 confidence 必須標 medium，
且 budget_raw 要填原話「兩千左右吧看情況」。
「大概三房」「應該要車位吧」這類都是 medium。
只有客戶明確、肯定地講出來的才是 high。用推的是 low。

## 3. 每個有填的欄位都要有原文出處
confidence 陣列裡，evidence 要放**客戶原本講的那句話**（可截取片段），
不要自己改寫。這是給業務核對用的，抽錯時要能一眼看出問題在哪。

# 欄位規則

- **金額單位一律「萬元」**：「一千五百萬」→ 1500；「2000萬」→ 2000；「兩千三」→ 2300。
- **區域代號**只能從這裡選：${districtList}
  客戶講「海線」而沒指定區 → districts 留空，改在 unclear 寫「客戶說海線，需確認具體想找哪幾區」。
- **社區名稱**原樣放進 community_names，不要自己補全或改寫（系統會去比對主檔別名）。
- **標籤**優先使用既有標籤：${tagList}
  真的沒有對應的才自己造詞，但要簡短（不超過 10 字）。
- **elevator / parking / purpose** 沒提到就用預設值，不要猜。
- **unclear** 要寫成完整、可以直接照著問的句子，例：
  「請問您預算的上限大概到多少？」而不是「預算不明」。

# 輸出
只輸出符合 schema 的 JSON。`;
}

/** 逐字稿可能很長，粗估 token 以決定要不要提醒使用者。中文約 1 字 ≈ 1 token。 */
export function roughTokenCount(text: string): number {
  return Math.ceil(text.length * 1.1);
}

export async function extractBuyer(rawText: string, kind: SourceKind = "line"): Promise<ExtractResult> {
  const text = rawText.trim();
  if (!text) throw new Error("empty_text");
  if (text.length > 120_000) throw new Error("text_too_long");

  const response = await aiClient().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(ExtractedBuyerSchema),
    },
    system: systemPrompt(kind),
    messages: [
      {
        role: "user",
        content: `以下是要整理的內容：\n\n<content>\n${text}\n</content>`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("extraction_refused");
  }

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("extraction_failed");

  const inputTokens = response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0);
  const outputTokens = response.usage.output_tokens;
  const { costUsd, costTwd } = aiCost(inputTokens, outputTokens);

  return {
    data: sanitize(parsed),
    phonesFound: extractPhones(text),
    usage: { inputTokens, outputTokens, costUsd, costTwd },
    model: MODEL,
  };
}

/**
 * 程式端收斂：擋掉明顯不合理的值。
 * AI 再準也會偶爾把「1500 萬」寫成 15000000，這種一眼可辨的錯不該進資料庫。
 */
function sanitize(d: ExtractedBuyer): ExtractedBuyer {
  const fixMoney = (v: number | null): number | null => {
    if (v === null || !Number.isFinite(v)) return null;
    let n = Math.round(v);
    // 單位跑掉：15000000（元）→ 1500（萬）
    if (n >= 1_000_000) n = Math.round(n / 10_000);
    // 台中海線總價合理區間 50 萬 ~ 5 億
    if (n < 50 || n > 50_000) return null;
    return n;
  };

  const budgetMin = fixMoney(d.budget_min);
  const budgetMax = fixMoney(d.budget_max);

  return {
    ...d,
    budget_min: budgetMin !== null && budgetMax !== null && budgetMin > budgetMax ? budgetMax : budgetMin,
    budget_max: budgetMin !== null && budgetMax !== null && budgetMin > budgetMax ? budgetMin : budgetMax,
    room_min: d.room_min !== null && d.room_min >= 0 && d.room_min <= 10 ? Math.round(d.room_min) : null,
    size_min: d.size_min !== null && d.size_min > 0 && d.size_min <= 500 ? d.size_min : null,
    size_max: d.size_max !== null && d.size_max > 0 && d.size_max <= 500 ? d.size_max : null,
    age_max: d.age_max !== null && d.age_max >= 0 && d.age_max <= 100 ? Math.round(d.age_max) : null,
    tags: [...new Set(d.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20),
    avoid: [...new Set(d.avoid.map((t) => t.trim()).filter(Boolean))].slice(0, 20),
    community_names: [...new Set(d.community_names.map((t) => t.trim()).filter(Boolean))].slice(0, 10),
    districts: [...new Set(d.districts)],
  };
}

/** 把 confidence 陣列轉成 buyer_requirement.extraction_meta 要存的形狀 */
export function toExtractionMeta(d: ExtractedBuyer): Record<string, { level: string; evidence: string | null }> {
  const meta: Record<string, { level: string; evidence: string | null }> = {};
  for (const c of d.confidence) {
    meta[c.field] = { level: c.level, evidence: c.evidence };
  }
  if (d.budget_raw) {
    meta.budget_max = { ...(meta.budget_max ?? { level: "medium", evidence: null }), evidence: d.budget_raw };
  }
  return meta;
}

/** 哪些欄位是「AI 有填但信心不足」→ 介面要標黃、要業務確認 */
export function lowConfidenceFields(d: ExtractedBuyer): string[] {
  return d.confidence.filter((c) => c.level !== "high").map((c) => c.field);
}
