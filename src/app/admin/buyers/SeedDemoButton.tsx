"use client";
/**
 * 一鍵塞海線示範社區與物件，讓配案畫面先跑起來（2026-08-12）
 * 示範資料一律有「示範·」前綴且 is_demo=1，隨時可以一鍵清掉。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import { seedDemoAction, clearDemoAction } from "@/lib/actions/buyer";

export default function SeedDemoButton({ hasDemo = false }: { hasDemo?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function seed() {
    setMsg(null);
    startTransition(async () => {
      const r = await seedDemoAction();
      setMsg(
        r.ok
          ? r.communities + r.listings + r.buyers === 0
            ? "示範資料已經在了，沒有重複建立"
            : `已建立 ${r.communities} 個社區、${r.listings} 筆物件、${r.buyers} 位買方`
          : `失敗：${r.error}`,
      );
      router.refresh();
    });
  }

  function clear() {
    setMsg(null);
    startTransition(async () => {
      const r = await clearDemoAction();
      setMsg(`已清除 ${r.buyers} 位買方、${r.communities} 個社區、${r.listings} 筆物件`);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={seed}
        disabled={pending}
        style={{
          padding: "9px 18px",
          borderRadius: CIS.radiusSm,
          border: `1px solid ${CIS.blue}`,
          background: "#e6eefc",
          color: CIS.blueSoft,
          fontWeight: 700,
          fontSize: FS(13),
          cursor: pending ? "not-allowed" : "pointer",
        }}
      >
        {pending ? "處理中…" : "塞一批海線示範資料"}
      </button>

      {hasDemo && (
        <button
          type="button"
          onClick={clear}
          disabled={pending}
          style={{
            padding: "9px 16px",
            borderRadius: CIS.radiusSm,
            border: `1px solid ${CIS.cardBorder}`,
            background: "transparent",
            color: CIS.textMute,
            fontSize: FS(13),
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          清除示範資料
        </button>
      )}

      {msg && <span style={{ fontSize: FS(12.5), color: CHIP.success.color }}>{msg}</span>}
    </div>
  );
}
