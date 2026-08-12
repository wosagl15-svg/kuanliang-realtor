"use server";
/**
 * 社區主檔 — server actions（2026-08-12）
 *
 * 社區是整套配對的地基。別名維護是這頁最重要的功能：
 * 發現客戶都叫它「哈佛」，就把別名加進去，之後全系統的搜尋都認得。
 */
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import { createCommunity, updateCommunity, deleteCommunity, addAlias } from "@/lib/community";

export async function createCommunityAction(input: {
  name: string;
  aliasesText?: string;
  district: string;
  address?: string;
  hasElevator?: string;
  parkingType?: string;
  builtYear?: string;
  walkMinHsr?: string;
  walkMinTrain?: string;
  schoolZone?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  if (!input.name?.trim()) return { ok: false, error: "社區名稱必填" };
  if (!input.district) return { ok: false, error: "請選區域" };

  const toInt = (v?: string) => {
    if (!v?.trim()) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };

  try {
    const id = await createCommunity({
      name: input.name,
      // 別名支援用逗號、頓號、空白分隔
      aliases: (input.aliasesText ?? "")
        .split(/[,，、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      district: input.district,
      address: input.address?.trim() || null,
      hasElevator: input.hasElevator === "yes" ? true : input.hasElevator === "no" ? false : null,
      parkingType: input.parkingType?.trim() || null,
      builtYear: toInt(input.builtYear),
      walkMinHsr: toInt(input.walkMinHsr),
      walkMinTrain: toInt(input.walkMinTrain),
      schoolZone: input.schoolZone?.trim() || null,
    });
    revalidatePath("/admin/communities");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function addAliasAction(id: string, alias: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  if (!alias.trim()) return { ok: false, error: "別名不能空白" };
  try {
    await addAlias(id, alias);
    revalidatePath("/admin/communities");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateCommunityAction(
  id: string,
  input: { name?: string; district?: string; aliases?: string[]; schoolZone?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  try {
    await updateCommunity(id, input);
    revalidatePath("/admin/communities");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteCommunityAction(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "權限不足" };
  try {
    await deleteCommunity(id);
    revalidatePath("/admin/communities");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
