"use server";
/**
 * 物件庫 — server actions（2026-08-12）
 * 貼描述 → AI 抽欄位 → 人工確認 → 入庫。跟買方同一條管線。
 */
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import { createListing, updateListingStatus, deleteListing } from "@/lib/listing";
import { extractListing } from "@/lib/listing-extract";
import { findCommunities } from "@/lib/community";
import type { ListingExtractActionResult, SaveListingInput } from "@/lib/listing-action-types";

export async function extractListingAction(text: string): Promise<ListingExtractActionResult> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  if (!text?.trim()) return { ok: false, error: "請先貼上物件描述" };

  /**
   * 🔴 只貼一條網址是沒有用的 —— AI 拿到的就只有那串字，它不會、也不該去開那個網頁。
   *    這個錯誤如果只回「解析失敗」，使用者會一直重試，永遠不知道問題在哪。
   *    （公司內網型錄 es.houseol.com.tw 要登入才看得到，從伺服器更是連不進去。）
   */
  const t = text.trim();
  const urlOnly = /^https?:\/\/\S+$/i.test(t) || (t.split(/\s+/).length <= 2 && /^https?:\/\//i.test(t));
  if (urlOnly) {
    const internal = /houseol\.com\.tw/i.test(t);
    return {
      ok: false,
      error: internal
        ? "這是公司內網型錄的網址。系統不會去開它（要登入，而且那是公司系統）——請在型錄頁面上全選內容（Ctrl+A → Ctrl+C），把「文字」貼進來。"
        : "貼進來的是一條網址。系統只讀你貼的文字，不會去開那個網頁——請把物件描述的「文字」複製過來。",
    };
  }

  try {
    const r = await extractListing(text);
    // 抽到的社區名稱去比對主檔
    const communityHits = r.data.community_name
      ? (await findCommunities(r.data.community_name))
          .slice(0, 5)
          .map((h) => ({ id: h.id, name: h.name, matchKind: h.matchKind }))
      : [];
    return { ok: true, data: r.data, usage: r.usage, communityHits };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "missing_anthropic_api_key")
      return {
        ok: false,
        error:
          "還沒設定 AI 金鑰。正式站要設在 Vercel → Settings → Environment Variables 的 ANTHROPIC_API_KEY（本機的 .env.local 不會帶上雲端）。",
      };
    if (msg === "text_too_long") return { ok: false, error: "內容太長（超過 4 萬字），請分段" };
    console.error("[listing/extract]", e);
    return { ok: false, error: `解析失敗：${msg}` };
  }
}

export async function saveListingAction(
  input: SaveListingInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  if (!input.title?.trim()) return { ok: false, error: "物件標題必填" };
  if (!input.district) return { ok: false, error: "請選行政區，否則配對時撈不到" };

  try {
    const id = await createListing({
      title: input.title,
      communityId: input.communityId ?? null,
      district: input.district,
      address: input.address ?? null,
      price: input.price ?? null,
      sizePing: input.sizePing ?? null,
      rooms: input.rooms ?? null,
      livingRooms: input.livingRooms ?? null,
      baths: input.baths ?? null,
      floorNo: input.floorNo ?? null,
      totalFloors: input.totalFloors ?? null,
      ageYear: input.ageYear ?? null,
      hasElevator: input.hasElevator ?? null,
      parkingCount: input.parkingCount ?? 0,
      tags: input.tags ?? [],
      note: input.note ?? null,
      isDemo: false,
    });
    revalidatePath("/admin/listings");
    revalidatePath("/admin/buyers");
    return { ok: true, id };
  } catch (e) {
    console.error("[listing/save]", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setListingStatusAction(id: string, status: string): Promise<{ ok: boolean }> {
  if (!(await isCurrentUserAdmin())) return { ok: false };
  await updateListingStatus(id, status);
  revalidatePath("/admin/listings");
  return { ok: true };
}

export async function deleteListingAction(id: string): Promise<{ ok: boolean }> {
  if (!(await isCurrentUserAdmin())) return { ok: false };
  await deleteListing(id);
  revalidatePath("/admin/listings");
  return { ok: true };
}
