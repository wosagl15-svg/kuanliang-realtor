"use server";
/**
 * 賣方資料庫 — server actions（2026-08-22）
 *
 * 這裡的每一顆按鈕都對應房仲當下的一個動作：剛掛電話、剛從屋主家出來、
 * 剛帶完看。所以全部設計成「一次一句話就能存」，不要求填完整張表。
 */
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import {
  createSeller,
  updateSeller,
  addSellerContact,
  deleteSellerContact,
  attachListingToSeller,
  findSellerByPhone,
  getSeller,
  listSellerContacts,
  computeIntent,
  type SellerInput,
} from "@/lib/seller";
import { aiClient, AI_MODEL, aiCost } from "@/lib/ai-client";
import {
  sellerContactLabel,
  sentimentLabel,
  motiveLabel,
  priceFlexLabel,
  sellerStageLabel,
} from "@/lib/seller-constants";
import {
  computeReportAuto,
  buildReportMessage,
  autoSuggestion,
  saveReport,
  markReportSent,
  type ReportManual,
} from "@/lib/seller-report";
import { getListing } from "@/lib/listing";

type Result<T = undefined> = { ok: boolean; error?: string; data?: T };

export async function createSellerAction(
  input: SellerInput,
): Promise<Result<{ id: string }> & { conflict?: { id: string; name: string } }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  if (!input.name?.trim()) return { ok: false, error: "請填屋主稱呼" };

  // 撞號：同一個屋主建兩次，兩邊各記一半歷程，比沒建還糟
  if (input.phone) {
    const dup = await findSellerByPhone(input.phone);
    if (dup) return { ok: false, error: "這支電話已經建過屋主了", conflict: dup };
  }

  const id = await createSeller(input);
  revalidatePath("/admin/sellers");
  revalidatePath("/admin/today");
  return { ok: true, data: { id } };
}

export async function updateSellerAction(id: string, input: Partial<SellerInput>): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  await updateSeller(id, input);
  revalidatePath(`/admin/sellers/${id}`);
  revalidatePath("/admin/sellers");
  revalidatePath("/admin/today");
  return { ok: true };
}

export async function addSellerContactAction(input: {
  sellerId: string;
  type: string;
  content?: string | null;
  sentiment?: string | null;
  priceMentioned?: number | null;
  listingId?: string | null;
  occurredAt?: string | null;
}): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  if (!input.content?.trim() && !input.sentiment) {
    return { ok: false, error: "至少寫一句話，或選一個屋主的態度" };
  }
  await addSellerContact({
    sellerId: input.sellerId,
    type: input.type,
    content: input.content ?? null,
    sentiment: input.sentiment ?? null,
    priceMentioned: input.priceMentioned ?? null,
    listingId: input.listingId ?? null,
    occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
  });
  revalidatePath(`/admin/sellers/${input.sellerId}`);
  revalidatePath("/admin/sellers");
  revalidatePath("/admin/today");
  return { ok: true };
}

export async function deleteSellerContactAction(id: string, sellerId: string): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  await deleteSellerContact(id, sellerId);
  revalidatePath(`/admin/sellers/${sellerId}`);
  return { ok: true };
}

export async function attachListingAction(listingId: string, sellerId: string): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  await attachListingToSeller(listingId, sellerId);
  revalidatePath(`/admin/sellers/${sellerId}`);
  revalidatePath("/admin/listings");
  return { ok: true };
}

// ---- AI 深度判讀 ----

export type SellerAiResult = {
  /** 他到底在想什麼 */
  reading: string;
  /** 下次見面該問哪幾題 */
  questions: string[];
  /** 具體話術建議 */
  approach: string;
  /** 風險：什麼情況會談崩 */
  risks: string[];
  usage?: { inputTokens: number; outputTokens: number; costTwd: number };
};

/**
 * 讀完整段歷程，寫一段人話。
 *
 * 分數（computeIntent）跟這個是兩件事，刻意分開：
 *   分數要穩定、可解釋、能排序 → 規則式
 *   這裡要的是「讀出言外之意」→ 那才是 AI 真正比規則強的地方
 * 沒有 API 金鑰時只是這顆按鈕不能按，前面的分數與回報表照常運作。
 */
export async function analyzeSellerAction(sellerId: string): Promise<Result<SellerAiResult>> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };

  const seller = await getSeller(sellerId);
  if (!seller) return { ok: false, error: "找不到這個屋主" };
  const logs = await listSellerContacts(sellerId, 60);
  if (logs.length < 2) {
    return { ok: false, error: "聯絡紀錄太少（至少要 2 筆）。AI 讀不出趨勢時給的判讀只是猜的。" };
  }

  const intent = computeIntent(seller, logs);
  const history = [...logs]
    .reverse()
    .map((l) => {
      const at = new Date(l.occurred_at).toISOString().slice(0, 10);
      const bits = [
        `${at} [${sellerContactLabel(l.type)}]`,
        l.content?.trim() || "",
        l.sentiment ? `（屋主態度：${sentimentLabel(l.sentiment)}）` : "",
        l.price_mentioned ? `（提到 ${l.price_mentioned} 萬）` : "",
      ].filter(Boolean);
      return bits.join(" ");
    })
    .join("\n");

  const profile = [
    `稱呼：${seller.name}`,
    `委託階段：${sellerStageLabel(seller.stage)}`,
    `賣的動機：${motiveLabel(seller.motive)}${seller.motive_note ? `（${seller.motive_note}）` : ""}`,
    `價格態度：${priceFlexLabel(seller.price_flex)}`,
    seller.ask_price ? `目前開價：${seller.ask_price} 萬` : "",
    seller.bottom_price ? `他透露過的底價：${seller.bottom_price} 萬` : "",
    seller.decision_maker ? `決策者：${seller.decision_maker}` : "決策者：還沒問出來",
    seller.co_owner_note ? `共有人：${seller.co_owner_note}` : "",
    seller.deadline_at ? `他說的期限：${new Date(seller.deadline_at).toISOString().slice(0, 10)}` : "",
    seller.personality_note ? `個性備註：${seller.personality_note}` : "",
    `系統規則式評分：${intent.score} 分（${intent.label}）`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `你是一位帶過上百件委託的資深房仲主管，正在幫底下的業務判讀一位屋主。

【屋主基本資料】
${profile}

【逐次聯絡歷程（舊 → 新）】
${history}

請只根據上面的內容判讀，**不要編造沒有出現過的事實**。沒講到的就說「還沒問出來」。

用 JSON 回覆，格式如下（不要有其他文字、不要用 markdown 包起來）：
{
  "reading": "他真正在想什麼。三到五句。特別注意：他嘴巴說的跟行為（有沒有降價、配不配合帶看）有沒有落差，落差在哪。",
  "questions": ["下次接觸該問出來的關鍵問題，三到五題，要具體到可以直接照著唸"],
  "approach": "建議怎麼跟他談，兩到三句。要具體，不要講「保持聯繫」這種廢話。",
  "risks": ["什麼情況下會談崩或跑掉，兩到三點"]
}`;

  try {
    const client = aiClient();
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    // 模型偶爾還是會包一層 ```json，剝掉再 parse
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(json) as Omit<SellerAiResult, "usage">;
    const cost = aiCost(res.usage.input_tokens, res.usage.output_tokens);

    // 判讀本身也是一筆歷程 —— 下次翻紀錄時要看得到「當時 AI 這樣說、後來呢」
    await addSellerContact({
      sellerId,
      type: "note",
      content: `🤖 AI 判讀：${parsed.reading}`,
    });

    return {
      ok: true,
      data: {
        ...parsed,
        usage: {
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
          costTwd: cost.costTwd,
        },
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "missing_anthropic_api_key") {
      return {
        ok: false,
        error:
          "還沒設定 AI 金鑰。正式站要設在 Vercel → Settings → Environment Variables 的 ANTHROPIC_API_KEY（本機的 .env.local 不會帶上雲端）。上面的規則式評分不受影響，照常可以用。",
      };
    }
    console.error("[seller/analyze]", e);
    return { ok: false, error: `判讀失敗：${msg}` };
  }
}

// ---- 屋主回報表 ----

export async function buildReportAction(input: {
  sellerId: string;
  listingId: string | null;
  days: number;
  manual: ReportManual;
  suggestion?: string | null;
}): Promise<Result<{ message: string; auto: Awaited<ReturnType<typeof computeReportAuto>>; suggestion: string }>> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };

  const seller = await getSeller(input.sellerId);
  if (!seller) return { ok: false, error: "找不到這個屋主" };

  const to = new Date();
  const from = new Date(to.getTime() - Math.max(1, Math.min(input.days, 180)) * 86400_000);
  const auto = await computeReportAuto(input.listingId, input.sellerId, from, to);
  const listing = input.listingId ? await getListing(input.listingId) : null;
  const suggestion = input.suggestion?.trim() || autoSuggestion(auto, input.manual);

  const message = buildReportMessage({
    sellerName: seller.name,
    listing,
    from,
    to,
    auto,
    manual: input.manual,
    suggestion,
  });

  return { ok: true, data: { message, auto, suggestion } };
}

/**
 * 存檔並記一筆「已回報」。
 *
 * 存檔這一步會重設回報時鐘（見 seller.ts addSellerContact），
 * 所以「產生回報表」跟「送出回報」一定要分成兩顆按鈕 ——
 * 只是點開來看看就把時鐘歸零，那個時鐘就沒有意義了。
 */
export async function sendReportAction(input: {
  sellerId: string;
  listingId: string | null;
  days: number;
  manual: ReportManual;
  message: string;
  suggestion: string;
  channel: string;
}): Promise<Result<{ id: string }>> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };

  const to = new Date();
  const from = new Date(to.getTime() - Math.max(1, Math.min(input.days, 180)) * 86400_000);
  const auto = await computeReportAuto(input.listingId, input.sellerId, from, to);

  const id = await saveReport({
    sellerId: input.sellerId,
    listingId: input.listingId,
    from,
    to,
    auto,
    manual: input.manual,
    summary: input.message,
    suggestion: input.suggestion,
  });
  await markReportSent(id, input.channel);

  // 這一筆才會讓「幾天沒回報」歸零
  await addSellerContact({
    sellerId: input.sellerId,
    type: "report",
    content: `已透過${input.channel === "line" ? " LINE " : input.channel === "phone" ? "電話" : "面談"}回報：帶看 ${auto.viewingBuyers} 組、推案 ${auto.pitches} 次${auto.offers ? `、出價 ${auto.offers} 組` : ""}`,
    listingId: input.listingId,
  });

  revalidatePath(`/admin/sellers/${input.sellerId}`);
  revalidatePath("/admin/sellers");
  revalidatePath("/admin/today");
  return { ok: true, data: { id } };
}
