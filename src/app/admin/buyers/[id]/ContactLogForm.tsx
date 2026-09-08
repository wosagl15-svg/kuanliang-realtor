"use client";
/**
 * 快速記一筆互動（2026-08-13 升級：帶看／推案可記物件與反應）
 *
 * 為什麼要低摩擦：熱度分數、沉睡提醒、嘴巴 vs 行為的落差，全都靠這張表。
 * 記錄越麻煩，業務越不記，這三個功能就全部失準。所以設計成兩下就記完。
 *
 * 🔴 帶看紀錄多兩個欄位（物件、反應），因為只有自由文字的話，
 *    系統看不懂他到底看了什麼、反應如何，就算不出「登記要三房但看的都是兩房」
 *    這種真正有價值的落差提示。物件用自由輸入 —— 帶看的常常是別家的案子或
 *    591 上看到的，硬要從自己的物件庫選反而卡住不給記。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import { CONTACT_TYPES, REACTIONS } from "@/lib/buyer-constants";
import { parseListingLink, displayTitle } from "@/lib/listing-link";
import { parseGrabbedBlock, grabbedTitle, grabbedSummary, unitPrice } from "@/lib/listing-grab";
import CommunityPicker from "./CommunityPicker";
import type { CommunityHit } from "@/lib/actions/buyer";
import { addContactAction } from "@/lib/actions/buyer";

/** 這幾種類型才需要記物件與反應 */
const NEEDS_PROPERTY = new Set(["viewing", "pitch"]);

const field: React.CSSProperties = {
  padding: "9px 12px",
  background: "#f5f8fd",
  border: `1px solid ${CIS.cardBorder}`,
  borderRadius: CIS.radiusSm,
  color: CIS.text,
  fontSize: FS(13.5),
  fontFamily: CIS.font,
  outline: "none",
};

export default function ContactLogForm({ buyerId }: { buyerId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<string>("call");
  const [content, setContent] = useState("");
  const [pasted, setPasted] = useState("");
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const [community, setCommunity] = useState<CommunityHit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsProperty = NEEDS_PROPERTY.has(type);

  // 貼進來的東西即時拆成「網址 + 名稱」。業務可以再改名稱，改過就以他為準。
  // 書籤小工具抓的資料是結構化的，優先用；沒有才退回「從貼上文字拆網址」
  const grabbed = parseGrabbedBlock(pasted);
  const parsed = parseListingLink(pasted);
  const autoName = grabbed ? grabbedTitle(grabbed) : displayTitle(parsed);
  // 名稱三層來源，由強到弱：主檔選定的 → 手打的 → 從貼上內容拆出來的
  const typedName = nameEdit !== null ? nameEdit : grabbed ? grabbedTitle(grabbed) : parsed.label;
  const finalName = community ? community.display : typedName;
  const listingUrl = grabbed?.url ?? parsed.url;
  const ppp = grabbed ? unitPrice(grabbed) : null;

  function submit() {
    setError(null);
    const title = (finalName || autoName).trim();
    // 名稱併進內容前面，讓紀錄一眼看得出看了哪間（連結另存 listing_url）
    // 規格摘要跟著存 —— 之後回頭看紀錄才知道當初推的是什麼條件的物件
    const spec = grabbed ? grabbedSummary(grabbed) : "";
    const noteText = [content.trim(), spec && `（${spec}）`].filter(Boolean).join(" ");
    const body =
      needsProperty && title && title !== "（未填物件）"
        ? `【${title}】${noteText}`
        : noteText;

    if (!body && !reaction && !listingUrl) {
      setError("至少貼個連結、寫一句話或選一個反應，不然這筆紀錄之後看不出意義");
      return;
    }

    startTransition(async () => {
      const r = await addContactAction({
        buyerId,
        type,
        content: body || undefined,
        listingUrl: needsProperty ? listingUrl : null,
        communityId: needsProperty ? (community?.id ?? null) : null,
        reaction: needsProperty ? reaction : null,
      });
      if (r.ok) {
        setContent("");
        setPasted("");
        setNameEdit(null);
        setCommunity(null);
        setReaction(null);
        router.refresh();
      } else {
        setError(r.error ?? "記錄失敗");
      }
    });
  }

  return (
    <div>
      {/* 類型 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {CONTACT_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setType(t.key);
              if (!NEEDS_PROPERTY.has(t.key)) setReaction(null);
            }}
            style={{
              padding: "6px 13px",
              borderRadius: 999,
              border: `1px solid ${type === t.key ? CIS.blue : CIS.cardBorder}`,
              background: type === t.key ? "#dfe9fb" : "transparent",
              color: type === t.key ? CIS.blueSoft : CIS.textMute,
              fontSize: FS(12.5),
              fontWeight: type === t.key ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* 帶看／推案：物件 + 反應 */}
      {needsProperty && (
        <div
          style={{
            padding: "12px 14px",
            background: "#f0f5fd",
            border: `1px solid ${CIS.blue}44`,
            borderRadius: CIS.radiusSm,
            marginBottom: 10,
          }}
        >
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={2}
            placeholder={
              "貼上物件連結，或整段分享訊息（591 App 按分享複製的那段直接貼）\n" +
              "例：太子哈佛 3房2廳 1280萬 https://sale.591.com.tw/home/house/detail/2/12345678.html"
            }
            style={{ ...field, width: "100%", marginBottom: 8, resize: "vertical", lineHeight: 1.6 }}
          />

          {/* 書籤小工具抓到的規格 —— 當場看得出抓對沒有，抓錯就不會存進去 */}
          {grabbed && (
            <div
              style={{
                padding: "10px 13px",
                background: CHIP.success.bg,
                border: `1px solid ${CHIP.success.border}`,
                borderRadius: CIS.radiusSm,
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: FS(12.5), color: CHIP.success.color, fontWeight: 700, marginBottom: 4 }}>
                ✅ 591 抓到 {grabbed.listingNo ? `編號 ${grabbed.listingNo}` : "這一間"}
              </div>
              <div style={{ fontSize: FS(12.5), color: CIS.textSub, lineHeight: 1.7 }}>
                {grabbedSummary(grabbed) || "（規格欄位沒抓到，可能不是詳情頁）"}
                {ppp && <span style={{ color: CIS.textMute }}>　·　每坪約 {ppp} 萬</span>}
              </div>
              {grabbed.address && (
                <div style={{ fontSize: FS(11.5), color: CIS.textMute, marginTop: 3 }}>{grabbed.address}</div>
              )}
            </div>
          )}

          {/* 貼上的連結認出什麼 */}
          {pasted.trim() && (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 8,
                fontSize: FS(12),
              }}
            >
              {parsed.platform ? (
                <span
                  style={{
                    padding: "2px 9px",
                    borderRadius: 999,
                    background: CHIP.info.bg,
                    color: CHIP.info.color,
                    border: `1px solid ${CHIP.info.border}`,
                    fontWeight: 700,
                  }}
                >
                  {parsed.platformEmoji} {parsed.platform}
                </span>
              ) : (
                <span style={{ color: CIS.textMute }}>沒偵測到連結，當純文字紀錄</span>
              )}
              {parsed.listingNo && <span style={{ color: CIS.textSub }}>編號 {parsed.listingNo}</span>}
              {parsed.url && (
                <a
                  href={parsed.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: CIS.blueSoft, textDecoration: "underline" }}
                >
                  開啟看看是不是這間 ↗
                </a>
              )}
            </div>
          )}

          {/* 物件／社區名稱 —— 永遠顯示，不必先貼連結。打字時先查內部主檔。 */}
          <div style={{ marginBottom: 10 }}>
            <CommunityPicker
              text={finalName}
              onTextChange={setNameEdit}
              selected={community}
              onSelect={(c) => {
                setCommunity(c);
                if (c) setNameEdit(c.display);
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: FS(11.5), color: CIS.textSub, marginRight: 2 }}>客戶反應：</span>
            {REACTIONS.map((r) => {
              const on = reaction === r.key;
              const c = CHIP[r.tone as keyof typeof CHIP];
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setReaction(on ? null : r.key)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    border: `1px solid ${on ? c.border : CIS.cardBorder}`,
                    background: on ? c.bg : "transparent",
                    color: on ? c.color : CIS.textMute,
                    fontSize: FS(12),
                    fontWeight: on ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 內容 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !pending) submit();
          }}
          placeholder={
            needsProperty
              ? "為什麼喜歡／不喜歡？例：嫌樓層太低、覺得客廳太小"
              : "聊了什麼？例：問還有沒有同社區高樓層的"
          }
          style={{ ...field, flex: "1 1 320px" }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          style={{
            padding: "9px 20px",
            borderRadius: CIS.radiusSm,
            border: "none",
            background: pending ? "#e4e9f2" : CIS.blue,
            color: pending ? CIS.textMute : CIS.onAccent,
            fontWeight: 700,
            fontSize: FS(13),
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "記錄中…" : "記一筆"}
        </button>
      </div>

      {error && <p style={{ color: CHIP.danger.color, fontSize: FS(12.5), marginBottom: 0 }}>⚠️ {error}</p>}
    </div>
  );
}
