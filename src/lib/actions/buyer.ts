"use server";
/**
 * 買方資料庫 — server actions（2026-08-12）
 *
 * 所有寫入一律先過 isCurrentUserAdmin()。第一版團隊共用不分權限，
 * 但「誰建的 / 誰匯出的」一定要記，因為系統越好用，將來被整包帶走的損失越大。
 */
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import {
  createBuyer,
  updateBuyer,
  saveRequirement,
  setBuyerTags,
  setBuyerCommunities,
  addContactLog,
  updateContactLog,
  deleteContactLog,
  createFreeTag,
  deleteBuyer,
  setBroadcastOptOut,
  seedDemoBuyers,
  clearDemoBuyers,
  BuyerPhoneConflictError,
} from "@/lib/buyer";
import { extractBuyer, toExtractionMeta, type ExtractedBuyer, type SourceKind } from "@/lib/buyer-extract";
import { parseBuyerByRules } from "@/lib/buyer-parse-rules";
import { extractPhones } from "@/lib/phone";
import type { ExtractActionResult, SaveBuyerInput } from "@/lib/buyer-action-types";
import { findCommunities, createCommunity, seedDemoCommunities, clearDemoData } from "@/lib/community";
import { seedDemoListings } from "@/lib/listing";

async function actor(): Promise<string | null> {
  const session = await auth();
  const u = session?.user as { email?: string | null } | undefined;
  return u?.email ?? null;
}

// ---- AI 解析（不寫入，只回傳讓人確認）----

/**
 * 解析貼上的內容。
 *
 * 🔴 沒有 ANTHROPIC_API_KEY 時不再直接報錯 —— 改用規則解析（buyer-parse-rules.ts）。
 *    原本「沒金鑰就一筆都建不了」等於整套系統被一把鑰匙鎖死，那是設計錯誤。
 *    AI 是升級（懂上下文、抓得到「太太決定」這種），不是能不能用的前提。
 */
export async function extractBuyerAction(text: string, kind: SourceKind): Promise<ExtractActionResult> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  if (!text?.trim()) return { ok: false, error: "請先貼上內容" };

  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  // 沒金鑰 → 直接走規則，不必先丟一次例外
  if (!hasKey) return rulesResult(text);

  try {
    const result = await extractBuyer(text, kind);
    return {
      ok: true,
      engine: "ai",
      data: result.data,
      phonesFound: result.phonesFound,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costTwd: result.usage.costTwd,
      },
      communityMatches: await matchCommunityNames(result.data.community_names),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "text_too_long") return { ok: false, error: "內容太長（超過 12 萬字），請分段貼上" };
    if (msg === "extraction_refused")
      return { ok: false, error: "內容被安全機制擋下，請確認貼上的是一般客戶對話" };
    // 金鑰失效、額度用完、網路斷線 → 不要讓使用者卡住，降級用規則解析
    console.error("[buyer/extract] AI 失敗，降級規則解析:", e);
    return rulesResult(text);
  }
}

async function rulesResult(text: string): Promise<ExtractActionResult> {
  const data = parseBuyerByRules(text);
  return {
    ok: true,
    engine: "rules",
    data,
    phonesFound: extractPhones(text),
    communityMatches: await matchCommunityNames(data.community_names),
  };
}

/** 抽到的社區名稱去比對主檔（含別名） */
async function matchCommunityNames(names: string[]): Promise<ExtractActionResult["communityMatches"]> {
  const out: NonNullable<ExtractActionResult["communityMatches"]> = [];
  for (const nameRaw of names) {
    const hits = await findCommunities(nameRaw);
    out.push({
      query: nameRaw,
      hits: hits.slice(0, 5).map((h) => ({ id: h.id, name: h.name, matchKind: h.matchKind })),
    });
  }
  return out;
}

// ---- 確認後存檔 ----

export async function saveBuyerAction(
  input: SaveBuyerInput,
): Promise<{ ok: boolean; error?: string; buyerId?: string; conflict?: { id: string; name: string } }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  if (!input.name?.trim() && !input.phone?.trim())
    return { ok: false, error: "至少要有姓名或電話，不然這筆資料以後找不回來" };

  const who = await actor();

  try {
    let buyerId = input.buyerId;

    if (buyerId) {
      await updateBuyer(buyerId, {
        name: input.name,
        phoneRaw: input.phone,
        lineUserId: input.lineUserId ?? null,
        email: input.email ?? null,
        stage: (input.stage as never) ?? undefined,
        decisionMaker: input.decisionMaker ?? null,
        fundingNote: input.fundingNote ?? null,
        urgency: input.urgency ?? null,
        personalityNote: input.personalityNote ?? null,
      });
    } else {
      buyerId = await createBuyer({
        name: input.name,
        phoneRaw: input.phone,
        lineUserId: input.lineUserId ?? null,
        email: input.email ?? null,
        source: input.source,
        stage: (input.stage as never) ?? "new",
        ownerEmail: who,
        decisionMaker: input.decisionMaker ?? null,
        fundingNote: input.fundingNote ?? null,
        urgency: input.urgency ?? null,
        personalityNote: input.personalityNote ?? null,
      });
    }

    // 標籤：名稱轉 id（沒有的自動建成自由標籤，不參與配對直到有人審過）
    const tagIds: string[] = [];
    for (const n of input.tagNames) {
      if (!n.trim()) continue;
      tagIds.push(await createFreeTag(n));
    }
    await setBuyerTags(buyerId, tagIds);
    await setBuyerCommunities(buyerId, input.communityIds);

    // 需求永遠存新版本，舊版退居歷史 —— 需求歷程是判斷「他到底在找什麼」的關鍵證據
    await saveRequirement(buyerId, {
      budgetMin: input.budgetMin ?? null,
      budgetMax: input.budgetMax ?? null,
      budgetFlexPct: input.budgetFlexPct ?? 0,
      districts: input.districts,
      roomMin: input.roomMin ?? null,
      elevator: input.elevator,
      parking: input.parking,
      purpose: input.purpose,
      sizeMin: input.sizeMin ?? null,
      sizeMax: input.sizeMax ?? null,
      ageMax: input.ageMax ?? null,
      floorPref: input.floorPref ?? null,
      soft: input.unclear?.length ? { unclear: input.unclear } : null,
      rawSourceText: input.rawSourceText ?? null,
      extractionMeta: (input.extractionMeta as never) ?? null,
      createdBy: who,
    });

    revalidatePath("/admin/buyers");
    return { ok: true, buyerId };
  } catch (e) {
    if (e instanceof BuyerPhoneConflictError) {
      return {
        ok: false,
        error: `這支電話已經是「${e.existingName}」的資料`,
        conflict: { id: e.existingId, name: e.existingName },
      };
    }
    console.error("[buyer/save]", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---- 互動紀錄 ----

export async function addContactAction(input: {
  buyerId: string;
  type: string;
  content?: string;
  listingId?: string | null;
  listingUrl?: string | null;
  communityId?: string | null;
  reaction?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  try {
    await addContactLog({ ...input, createdBy: await actor() });
    revalidatePath(`/admin/buyers/${input.buyerId}`);
    revalidatePath("/admin/buyers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setStageAction(buyerId: string, stage: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  try {
    await updateBuyer(buyerId, { stage: stage as never });
    revalidatePath("/admin/buyers");
    revalidatePath(`/admin/buyers/${buyerId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setOptOutAction(buyerId: string, optOut: boolean): Promise<{ ok: boolean }> {
  if (!(await isCurrentUserAdmin())) return { ok: false };
  await setBroadcastOptOut(buyerId, optOut);
  revalidatePath(`/admin/buyers/${buyerId}`);
  return { ok: true };
}

export async function deleteBuyerAction(buyerId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  try {
    await deleteBuyer(buyerId);
    revalidatePath("/admin/buyers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---- 示範資料 ----

export async function seedDemoAction(): Promise<{
  ok: boolean;
  communities: number;
  listings: number;
  buyers: number;
  error?: string;
}> {
  if (!(await isCurrentUserAdmin()))
    return { ok: false, communities: 0, listings: 0, buyers: 0, error: "權限不足" };
  try {
    // 順序有意義：社區 → 物件（要掛社區）→ 買方（要掛社區與標籤）
    const communities = await seedDemoCommunities();
    const listings = await seedDemoListings();
    const buyers = await seedDemoBuyers();
    revalidatePath("/admin/buyers");
    revalidatePath("/admin/listings");
    revalidatePath("/admin/communities");
    return { ok: true, communities, listings, buyers };
  } catch (e) {
    console.error("[buyer/seedDemo]", e);
    return {
      ok: false,
      communities: 0,
      listings: 0,
      buyers: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function clearDemoAction(): Promise<{
  ok: boolean;
  communities: number;
  listings: number;
  buyers: number;
}> {
  if (!(await isCurrentUserAdmin())) return { ok: false, communities: 0, listings: 0, buyers: 0 };
  const buyers = await clearDemoBuyers();
  const r = await clearDemoData();
  revalidatePath("/admin/buyers");
  revalidatePath("/admin/listings");
  revalidatePath("/admin/communities");
  return { ok: true, buyers, ...r };
}

/** 把 AI 抽取結果轉成存檔用的形狀（給前端確認頁用，避免前端自己拼錯欄位） */
export async function toSaveInput(d: ExtractedBuyer, rawText: string, source: string): Promise<SaveBuyerInput> {
  return {
    name: d.name ?? "",
    phone: d.phone ?? "",
    lineUserId: d.line_id ?? null,
    source,
    decisionMaker: d.decision_maker,
    fundingNote: d.funding_note,
    urgency: d.urgency === "unknown" ? null : d.urgency,
    personalityNote: d.personality_note,
    budgetMin: d.budget_min,
    budgetMax: d.budget_max,
    budgetFlexPct: 0,
    districts: d.districts,
    roomMin: d.room_min,
    elevator: d.elevator,
    parking: d.parking,
    purpose: d.purpose,
    sizeMin: d.size_min,
    sizeMax: d.size_max,
    ageMax: d.age_max,
    floorPref: d.floor_pref,
    tagNames: [...d.tags, ...d.avoid],
    communityIds: [],
    rawSourceText: rawText,
    extractionMeta: toExtractionMeta(d),
    unclear: d.unclear,
  };
}

// ---- 修改／刪除互動紀錄（2026-08-21）----

export async function updateContactAction(input: {
  logId: string;
  buyerId: string;
  content?: string | null;
  reaction?: string | null;
  listingUrl?: string | null;
  communityId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  try {
    const { logId, buyerId, ...rest } = input;
    await updateContactLog(logId, rest);
    revalidatePath(`/admin/buyers/${buyerId}`);
    revalidatePath("/admin/buyers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteContactAction(
  logId: string,
  buyerId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  try {
    await deleteContactLog(logId);
    revalidatePath(`/admin/buyers/${buyerId}`);
    revalidatePath("/admin/buyers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---- 社區主檔比對（先查自己的資料庫，不去外面抓）----

export type CommunityHit = {
  id: string;
  name: string;
  district: string;
  address: string | null;
  kind: string | null;
  matchKind: string;
  /** 這筆在畫面上該顯示的字：透天顯示地址，其餘顯示社區名 */
  display: string;
};

/**
 * 打字時即時比對社區主檔。
 * 🔴 只查自己的資料庫，不連任何外部網站 —— 不抓 591 的原則沒有變。
 */
export async function searchCommunitiesAction(q: string): Promise<CommunityHit[]> {
  if (!(await isCurrentUserAdmin())) return [];
  const query = (q ?? "").trim();
  if (query.length < 1) return [];
  try {
    const hits = await findCommunities(query);
    return hits.slice(0, 8).map((c) => ({
      id: c.id,
      name: c.name,
      district: c.district,
      address: c.address,
      kind: (c as { kind?: string | null }).kind ?? null,
      matchKind: c.matchKind,
      display: (c as { kind?: string | null }).kind === "house" && c.address ? c.address : c.name,
    }));
  } catch {
    return [];
  }
}

/**
 * 主檔裡沒有這個社區 → 當場建一筆。
 * 為什麼要能當場建：如果要業務先跳到社區主檔頁新增再回來，他就不會建，
 * 主檔永遠長不大，「輸入社區撈出所有想買的人」就永遠做不出來。
 */
export async function quickCreateCommunityAction(input: {
  name: string;
  kind: string;
  district?: string;
  address?: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "要有名稱" };
  // 透天用地址辨識，沒地址就沒有辨識度，會長出一堆同名假社區
  if (input.kind === "house" && !(input.address ?? "").trim()) {
    return { ok: false, error: "獨棟透天要填地址，不然之後認不出是哪一間" };
  }
  try {
    const existing = await findCommunities(name);
    const exact = existing.find((c) => c.matchKind === "正式名稱" || c.matchKind === "別名");
    if (exact) return { ok: true, id: exact.id };

    const id = await createCommunity({
      name,
      kind: input.kind,
      district: input.district ?? "",
      address: input.address ?? null,
    });
    revalidatePath("/admin/communities");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
