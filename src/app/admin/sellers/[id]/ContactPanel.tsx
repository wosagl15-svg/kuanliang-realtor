"use client";
/**
 * 聯絡歷程：新增 + 時間軸（2026-08-22）
 *
 * 設計上唯一的要求：**掛掉電話後三十秒內要能存完。**
 * 所以預設就展開、游標直接落在輸入框、態度是一排按鈕不是下拉選單。
 * 只要多一個步驟，現場的房仲就不會填 —— 不填，意圖判讀跟回報表全是空的。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import {
  SELLER_CONTACT_TYPES,
  SELLER_SENTIMENTS,
  sellerContactEmoji,
  sellerContactLabel,
  sentimentLabel,
} from "@/lib/seller-constants";
import { addSellerContactAction, deleteSellerContactAction } from "@/lib/actions/seller";

export type ContactItem = {
  id: string;
  type: string;
  content: string | null;
  sentiment: string | null;
  price_mentioned: number | null;
  occurred_at: string;
};

const field: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  background: CIS.panel,
  border: `1px solid ${CIS.cardBorder}`,
  borderRadius: CIS.radiusSm,
  color: CIS.text,
  fontSize: FS(13.5),
  fontFamily: CIS.font,
  outline: "none",
};

function twDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 8 * 60 * 60_000);
  const wd = ["日", "一", "二", "三", "四", "五", "六"][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${wd}）${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export default function ContactPanel({
  sellerId,
  items,
  listings,
}: {
  sellerId: string;
  items: ContactItem[];
  listings: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [type, setType] = useState("call");
  const [content, setContent] = useState("");
  const [sentiment, setSentiment] = useState<string>("");
  const [price, setPrice] = useState("");
  const [listingId, setListingId] = useState<string>(listings[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setSaving(true);
    setError(null);
    startTransition(() => {
      void (async () => {
        const r = await addSellerContactAction({
          sellerId,
          type,
          content: content.trim() || null,
          sentiment: sentiment || null,
          priceMentioned: price ? Number(price) : null,
          listingId: listingId || null,
        });
        setSaving(false);
        if (!r.ok) {
          setError(r.error ?? "存檔失敗");
          return;
        }
        setContent("");
        setSentiment("");
        setPrice("");
        router.refresh();
      })();
    });
  }

  function remove(id: string) {
    startTransition(() => {
      void (async () => {
        await deleteSellerContactAction(id, sellerId);
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
        <h2 style={{ fontSize: FS(16), fontWeight: 800, margin: 0 }}>📇 聯絡歷程</h2>
        <span style={{ fontSize: FS(13), fontWeight: 800, color: CIS.blueSoft }}>{items.length}</span>
      </div>
      <p style={{ fontSize: FS(11.5), color: CIS.textMute, margin: "0 0 14px", lineHeight: 1.7 }}>
        每次聯絡完記一句話就好。上面的意圖判讀與下面的屋主回報表，全部都是從這裡長出來的。
      </p>

      {/* 新增 */}
      <div
        style={{
          background: CIS.panel,
          border: `1px solid ${CIS.panelBorder}`,
          borderRadius: CIS.radiusSm,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {SELLER_CONTACT_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              style={{
                padding: "5px 11px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: FS(11.5),
                fontWeight: 700,
                fontFamily: CIS.font,
                border: `1px solid ${type === t.key ? CIS.blue : CIS.cardBorder}`,
                background: type === t.key ? "#dfe9fb" : CIS.card,
                color: type === t.key ? CIS.blueSoft : CIS.textSub,
              }}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          style={{ ...field, resize: "vertical", lineHeight: 1.7 }}
          placeholder={
            type === "report"
              ? "回報了什麼：帶看幾組、買方怎麼說、建議是什麼"
              : type === "marketing"
                ? "做了什麼曝光：例：FB 貼文 + 591 精選刊登三天"
                : type === "offer"
                  ? "誰出多少、屋主怎麼回"
                  : "他說了什麼、你說了什麼。一兩句就夠"
          }
        />

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
          <span style={{ fontSize: FS(11), color: CIS.textMute, alignSelf: "center", marginRight: 2 }}>
            屋主態度：
          </span>
          {SELLER_SENTIMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSentiment(sentiment === s.key ? "" : s.key)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: FS(11),
                fontWeight: 700,
                fontFamily: CIS.font,
                border: `1px solid ${sentiment === s.key ? CIS.blue : CIS.cardBorder}`,
                background: sentiment === s.key ? "#dfe9fb" : CIS.card,
                color: sentiment === s.key ? CIS.blueSoft : CIS.textSub,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="這次講的價格（萬）"
            style={{ ...field, width: 190 }}
          />
          {listings.length > 0 && (
            <select value={listingId} onChange={(e) => setListingId(e.target.value)} style={{ ...field, width: 240 }}>
              <option value="">不指定物件</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{
              padding: "9px 22px",
              borderRadius: 999,
              border: "none",
              background: saving ? CIS.textMute : CIS.blue,
              color: CIS.onAccent,
              fontSize: FS(12.5),
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: CIS.font,
            }}
          >
            {saving ? "存檔中…" : "記一筆"}
          </button>
        </div>
        <div style={{ fontSize: FS(10.5), color: CIS.textMute, marginTop: 8, lineHeight: 1.6 }}>
          💡 填了價格會自動更新開價，並畫出「開價鬆動曲線」—— 屋主降過一次價，就會有第二次。
          <br />
          💡 只有「📣 屋主回報」這個類型會把「幾天沒回報」歸零。通話與帶看回饋都不算：屋主要的是你主動告訴他。
        </div>
        {error && (
          <div style={{ fontSize: FS(12), color: CHIP.danger.color, marginTop: 8 }}>{error}</div>
        )}
      </div>

      {/* 時間軸 */}
      {items.length ? (
        <div style={{ display: "grid", gap: 6 }}>
          {items.map((it) => {
            const tone = SELLER_SENTIMENTS.find((s) => s.key === it.sentiment)?.tone;
            const chip = tone ? CHIP[tone as keyof typeof CHIP] : null;
            return (
              <div
                key={it.id}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: CIS.radiusSm,
                  background: CIS.card,
                  border: `1px solid ${CIS.cardBorder}`,
                }}
              >
                <span style={{ fontSize: FS(14), flexShrink: 0 }}>{sellerContactEmoji(it.type)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: FS(11), fontWeight: 700, color: CIS.textSub }}>
                      {sellerContactLabel(it.type)}
                    </span>
                    <span style={{ fontSize: FS(10.5), color: CIS.textMute, fontVariantNumeric: "tabular-nums" }}>
                      {twDate(it.occurred_at)}
                    </span>
                    {chip && (
                      <span
                        style={{
                          fontSize: FS(10),
                          fontWeight: 700,
                          padding: "1px 8px",
                          borderRadius: 999,
                          background: chip.bg,
                          color: chip.color,
                          border: `1px solid ${chip.border}`,
                        }}
                      >
                        {sentimentLabel(it.sentiment)}
                      </span>
                    )}
                    {it.price_mentioned ? (
                      <span
                        style={{
                          fontSize: FS(10),
                          fontWeight: 800,
                          padding: "1px 8px",
                          borderRadius: 999,
                          background: CHIP.warn.bg,
                          color: CHIP.warn.color,
                          border: `1px solid ${CHIP.warn.border}`,
                        }}
                      >
                        {it.price_mentioned} 萬
                      </span>
                    ) : null}
                  </div>
                  {it.content && (
                    <div style={{ fontSize: FS(12.5), color: CIS.text, marginTop: 3, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                      {it.content}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  title="刪除這筆"
                  style={{
                    background: "none",
                    border: "none",
                    color: CIS.textMute,
                    cursor: "pointer",
                    fontSize: FS(12),
                    flexShrink: 0,
                    alignSelf: "flex-start",
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            fontSize: FS(12),
            color: CIS.textMute,
            padding: "16px 14px",
            background: CIS.panel,
            border: `1px dashed ${CIS.panelBorder}`,
            borderRadius: CIS.radiusSm,
          }}
        >
          還沒有紀錄。上面記第一筆，意圖判讀才有東西可以算。
        </div>
      )}
    </section>
  );
}
