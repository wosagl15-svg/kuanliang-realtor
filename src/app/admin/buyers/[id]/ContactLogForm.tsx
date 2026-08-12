"use client";
/**
 * 快速記一筆互動（2026-08-12）
 *
 * 為什麼要低摩擦：熱度分數、沉睡提醒、嘴巴 vs 行為的落差，全都靠這張表。
 * 記錄越麻煩，業務越不記，這三個功能就全部失準。所以設計成兩下就記完。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP } from "@/app/admin/_components/cis";
import { CONTACT_TYPES } from "@/lib/buyer-constants";
import { addContactAction } from "@/lib/actions/buyer";

export default function ContactLogForm({ buyerId }: { buyerId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<string>("call");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await addContactAction({ buyerId, type, content: content.trim() || undefined });
      if (r.ok) {
        setContent("");
        router.refresh();
      } else {
        setError(r.error ?? "記錄失敗");
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {CONTACT_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            style={{
              padding: "6px 13px",
              borderRadius: 999,
              border: `1px solid ${type === t.key ? CIS.blue : CIS.cardBorder}`,
              background: type === t.key ? "rgba(200,150,62,0.16)" : "transparent",
              color: type === t.key ? CIS.blueSoft : CIS.textMute,
              fontSize: 12.5,
              fontWeight: type === t.key ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !pending) submit();
          }}
          placeholder="聊了什麼？例：帶看示範海景大苑，嫌樓層太低"
          style={{
            flex: "1 1 320px",
            padding: "9px 12px",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${CIS.cardBorder}`,
            borderRadius: CIS.radiusSm,
            color: CIS.text,
            fontSize: 13.5,
            fontFamily: CIS.font,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          style={{
            padding: "9px 20px",
            borderRadius: CIS.radiusSm,
            border: "none",
            background: pending ? "rgba(255,255,255,0.08)" : CIS.blue,
            color: pending ? CIS.textMute : "#1a1200",
            fontWeight: 700,
            fontSize: 13,
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "記錄中…" : "記一筆"}
        </button>
      </div>

      {error && <p style={{ color: CHIP.danger.color, fontSize: 12.5, marginBottom: 0 }}>⚠️ {error}</p>}
    </div>
  );
}
