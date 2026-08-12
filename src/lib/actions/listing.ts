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
      return { ok: false, error: "尚未設定 ANTHROPIC_API_KEY，請先在 .env.local 填入金鑰" };
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
