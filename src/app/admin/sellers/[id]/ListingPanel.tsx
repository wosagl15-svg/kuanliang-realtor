"use client";
/**
 * 把物件掛到這個屋主底下（2026-08-22）
 *
 * 為什麼一定要掛：帶看紀錄是記在「物件」上的（誰去看了哪一間），
 * 沒有 seller ↔ listing 這條線，回報表就不知道要撈哪些帶看，
 * 屋主問「這兩週幾組看」你只能翻 LINE 對話用猜的。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import { attachListingAction } from "@/lib/actions/seller";

type Item = { id: string; title: string; district: string; price: number | null; status: string };

export default function ListingPanel({
  sellerId,
  mine,
  unclaimed,
}: {
  sellerId: string;
  mine: Item[];
  unclaimed: Item[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  function attach() {
    if (!pick) return;
    setBusy(true);
    startTransition(() => {
      void (async () => {
        await attachListingAction(pick, sellerId);
        setBusy(false);
        setPick("");
        router.refresh();
      })();
    });
  }

  return (
    <section
      style={{
        background: CIS.card,
        border: `1px solid ${CIS.cardBorder}`,
        borderRadius: CIS.radius,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <h2 style={{ fontSize: FS(16), fontWeight: 800, margin: 0 }}>🏘️ 他的物件</h2>
        <span style={{ fontSize: FS(13), fontWeight: 800, color: CIS.blueSoft }}>{mine.length}</span>
      </div>
      <p style={{ fontSize: FS(11.5), color: CIS.textMute, margin: "0 0 14px", lineHeight: 1.7 }}>
        帶看紀錄記在物件上。沒掛物件，屋主回報表就算不出「這兩週幾組看」。
      </p>

      {mine.length ? (
        <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
          {mine.map((l) => (
            <a
              key={l.id}
              href={`/admin/listings`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                padding: "10px 13px",
                background: CIS.panel,
                border: `1px solid ${CIS.panelBorder}`,
                borderRadius: CIS.radiusSm,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span style={{ fontSize: FS(13), fontWeight: 700 }}>{l.title}</span>
              <span style={{ fontSize: FS(11), color: CIS.textMute }}>
                {l.district}
                {l.price ? `・${l.price} 萬` : ""}
              </span>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  fontSize: FS(10),
                  fontWeight: 700,
                  padding: "1px 8px",
                  borderRadius: 999,
                  background: l.status === "onsale" ? CHIP.success.bg : CHIP.neutral.bg,
                  color: l.status === "onsale" ? CHIP.success.color : CHIP.neutral.color,
                  border: `1px solid ${l.status === "onsale" ? CHIP.success.border : CHIP.neutral.border}`,
                }}
              >
                {l.status === "onsale" ? "銷售中" : l.status}
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div
          style={{
            fontSize: FS(12),
            color: CIS.textMute,
            padding: "14px",
            background: CIS.panel,
            border: `1px dashed ${CIS.panelBorder}`,
            borderRadius: CIS.radiusSm,
            marginBottom: 14,
            lineHeight: 1.7,
          }}
        >
          還沒掛物件。下面選一間掛上來，或先去
          <a href="/admin/listings" style={{ color: CIS.blueSoft, fontWeight: 700 }}>
            {" "}
            物件庫{" "}
          </a>
          把這間房建進去。
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          style={{
            padding: "8px 11px",
            background: CIS.panel,
            border: `1px solid ${CIS.cardBorder}`,
            borderRadius: CIS.radiusSm,
            color: CIS.text,
            fontSize: FS(12.5),
            fontFamily: CIS.font,
            minWidth: 280,
          }}
        >
          <option value="">選一間還沒認領屋主的物件…</option>
          {unclaimed.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
              {l.price ? `（${l.price} 萬）` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={attach}
          disabled={!pick || busy}
          style={{
            padding: "8px 18px",
            borderRadius: 999,
            border: "none",
            background: !pick || busy ? CIS.textMute : CIS.blue,
            color: CIS.onAccent,
            fontSize: FS(12),
            fontWeight: 800,
            cursor: !pick || busy ? "not-allowed" : "pointer",
            fontFamily: CIS.font,
          }}
        >
          掛到這位屋主
        </button>
        {unclaimed.length === 0 && (
          <span style={{ fontSize: FS(11), color: CIS.textMute }}>目前沒有未認領的物件</span>
        )}
      </div>
    </section>
  );
}
