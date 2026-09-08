"use client";
/**
 * 屋主回報表（2026-08-22）
 *
 * 一頁做完三件事：
 *   ① 自動撈出我們自己資料庫知道的（帶看幾組、推給幾個買方、買方嫌什麼、有沒有出價）
 *   ② 手動補外部平台的曝光數字（591 / 公司官網 / 社群）—— 那些數字在別人家後台，
 *      程式抓不到，所以每一格旁邊直接寫「去哪裡抄」
 *   ③ 組成一段可以直接貼進 LINE 的文字
 *
 * ⚠️「產生回報表」跟「已回報給屋主」是兩顆分開的按鈕。
 *    只是點開來看看就把「幾天沒回報」的時鐘歸零，那個時鐘就沒有意義了。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import { MANUAL_METRICS, type ReportManual } from "@/lib/seller-report";
import { buildReportAction, sendReportAction } from "@/lib/actions/seller";

const field: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: CIS.panel,
  border: `1px solid ${CIS.cardBorder}`,
  borderRadius: CIS.radiusSm,
  color: CIS.text,
  fontSize: FS(13),
  fontFamily: CIS.font,
  outline: "none",
};

type AutoStats = {
  viewings: number;
  viewingBuyers: number;
  pitches: number;
  matchedBuyers: number;
  offers: number;
  reactions: Array<{ key: string; label: string; count: number }>;
  objections: string[];
  contactsWithOwner: number;
};

export default function ReportPanel({
  sellerId,
  listings,
  lastReportAt,
}: {
  sellerId: string;
  listings: Array<{ id: string; title: string }>;
  lastReportAt: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [listingId, setListingId] = useState(listings[0]?.id ?? "");
  const [days, setDays] = useState(14);
  const [manual, setManual] = useState<ReportManual>({});
  const [suggestion, setSuggestion] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [auto, setAuto] = useState<AutoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function build() {
    setLoading(true);
    setError(null);
    setSent(false);
    startTransition(() => {
      void (async () => {
        const r = await buildReportAction({
          sellerId,
          listingId: listingId || null,
          days,
          manual,
          suggestion: suggestion || null,
        });
        setLoading(false);
        if (!r.ok || !r.data) {
          setError(r.error ?? "產生失敗");
          return;
        }
        setMessage(r.data.message);
        setAuto(r.data.auto as AutoStats);
        if (!suggestion) setSuggestion(r.data.suggestion);
      })();
    });
  }

  async function copy() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const el = document.createElement("textarea");
      el.value = message;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function markSent(channel: string) {
    if (!message) return;
    startTransition(() => {
      void (async () => {
        const r = await sendReportAction({
          sellerId,
          listingId: listingId || null,
          days,
          manual,
          message,
          suggestion,
          channel,
        });
        if (!r.ok) {
          setError(r.error ?? "存檔失敗");
          return;
        }
        setSent(true);
        router.refresh();
      })();
    });
  }

  const setMetric = (key: string, v: string) =>
    setManual((p) => ({ ...p, [key]: v ? Number(v) : undefined }));

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
        <h2 style={{ fontSize: FS(16), fontWeight: 800, margin: 0 }}>📣 屋主回報表</h2>
        <span style={{ fontSize: FS(11), color: CIS.textMute }}>
          {lastReportAt ? `上次回報：${lastReportAt}` : "還沒回報過"}
        </span>
      </div>
      <p style={{ fontSize: FS(11.5), color: CIS.textMute, margin: "0 0 14px", lineHeight: 1.7 }}>
        只講事實與數字。<b>不要出現「還在努力」「有在幫您看」這種話</b> ——
        屋主要的是知道你做了什麼，以及接下來要怎麼辦。
      </p>

      {/* 期間與物件 */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        {listings.length > 0 && (
          <div style={{ minWidth: 220 }}>
            <label style={{ display: "block", fontSize: FS(11), color: CIS.textSub, marginBottom: 4, fontWeight: 600 }}>
              哪一間
            </label>
            <select value={listingId} onChange={(e) => setListingId(e.target.value)} style={field}>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={{ width: 150 }}>
          <label style={{ display: "block", fontSize: FS(11), color: CIS.textSub, marginBottom: 4, fontWeight: 600 }}>
            回報期間
          </label>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={field}>
            <option value={7}>最近 7 天</option>
            <option value={14}>最近 14 天</option>
            <option value={30}>最近 30 天</option>
            <option value={90}>最近 90 天</option>
          </select>
        </div>
      </div>

      {listings.length === 0 && (
        <div
          style={{
            fontSize: FS(12),
            color: CHIP.warn.color,
            background: CHIP.warn.bg,
            border: `1px solid ${CHIP.warn.border}`,
            borderRadius: CIS.radiusSm,
            padding: "9px 13px",
            marginBottom: 14,
            lineHeight: 1.7,
          }}
        >
          這位屋主底下還沒掛物件，所以帶看與買方反應會是 0。
          先到上面「他的物件」把物件掛上來，回報表才有東西可以講。
        </div>
      )}

      {/* 手動填的外部數字 */}
      <div
        style={{
          background: CIS.panel,
          border: `1px solid ${CIS.panelBorder}`,
          borderRadius: CIS.radiusSm,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: FS(12), fontWeight: 800, marginBottom: 4 }}>外部平台的曝光數字（手動填）</div>
        <div style={{ fontSize: FS(11), color: CIS.textMute, marginBottom: 12, lineHeight: 1.7 }}>
          這些數字在 591、公司內部系統、FB 的後台裡，系統不會去爬（違反使用條款，而且抓來的資料會過期）。
          每一格旁邊寫了去哪裡抄，抄一次大概兩分鐘。留白的項目不會出現在回報文字裡。
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
          {MANUAL_METRICS.map((m) => (
            <div key={m.key}>
              <label
                style={{ display: "block", fontSize: FS(11.5), color: CIS.textSub, marginBottom: 4, fontWeight: 600 }}
              >
                {m.label}（{m.unit}）
              </label>
              <input
                type="number"
                value={manual[m.key] ?? ""}
                onChange={(e) => setMetric(m.key, e.target.value)}
                style={field}
                placeholder="留白＝不列入"
              />
              <div style={{ fontSize: FS(10), color: CIS.textMute, marginTop: 3, lineHeight: 1.5 }}>📍 {m.where}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: FS(11.5), color: CIS.textSub, marginBottom: 4, fontWeight: 600 }}>
          我的建議（留白就用系統依數字自動寫的那句）
        </label>
        <textarea
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          rows={2}
          style={{ ...field, resize: "vertical", lineHeight: 1.7 }}
          placeholder="例：建議這週把價格從 1280 調到 1250，我把附近三個月成交拿給您對照"
        />
      </div>

      <button
        type="button"
        onClick={build}
        disabled={loading}
        style={{
          padding: "10px 24px",
          borderRadius: 999,
          border: "none",
          background: loading ? CIS.textMute : CIS.blue,
          color: CIS.onAccent,
          fontSize: FS(13),
          fontWeight: 800,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: CIS.font,
        }}
      >
        {loading ? "整理中…" : message ? "重新產生" : "產生回報表"}
      </button>

      {error && <div style={{ fontSize: FS(12), color: CHIP.danger.color, marginTop: 10 }}>{error}</div>}

      {/* 自動數字一覽 */}
      {auto && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: FS(11), fontWeight: 800, color: CIS.textMute, marginBottom: 8 }}>
            系統自動算出來的（來自帶看與推案紀錄）
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "實際帶看", v: `${auto.viewingBuyers} 組`, tone: "info" as const },
              { label: "主動推案", v: `${auto.pitches} 次`, tone: "info" as const },
              { label: "條件相符買方", v: `${auto.matchedBuyers} 位`, tone: "info" as const },
              { label: "出價／斡旋", v: `${auto.offers} 組`, tone: auto.offers ? ("success" as const) : ("neutral" as const) },
              { label: "跟屋主聯絡", v: `${auto.contactsWithOwner} 次`, tone: "neutral" as const },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "8px 14px",
                  borderRadius: CIS.radiusSm,
                  background: CHIP[s.tone].bg,
                  border: `1px solid ${CHIP[s.tone].border}`,
                  minWidth: 96,
                }}
              >
                <div style={{ fontSize: FS(16), fontWeight: 900, color: CHIP[s.tone].color }}>{s.v}</div>
                <div style={{ fontSize: FS(10.5), fontWeight: 700, color: CHIP[s.tone].color }}>{s.label}</div>
              </div>
            ))}
          </div>
          {auto.objections.length > 0 && (
            <div style={{ marginTop: 10, fontSize: FS(11.5), color: CIS.textMute, lineHeight: 1.7 }}>
              💡 買方提到的顧慮共 {auto.objections.length} 則，已經放進回報文字裡。
              <b>這是說服屋主調價最有力的東西</b> —— 不是你想降價，是市場這樣說。
            </div>
          )}
        </div>
      )}

      {/* 產出的文字 */}
      {message && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: FS(11), fontWeight: 800, color: CIS.textMute }}>貼給屋主的內容</span>
            <button
              type="button"
              onClick={copy}
              style={{
                fontSize: FS(11),
                fontWeight: 700,
                padding: "4px 12px",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: CIS.font,
                border: `1px solid ${copied ? "#a6dcc0" : CIS.cardBorder}`,
                background: copied ? "#e6f7ee" : CIS.card,
                color: copied ? "#0f7a45" : CIS.textSub,
              }}
            >
              {copied ? "✓ 已複製" : "📋 複製全文"}
            </button>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={16}
            style={{ ...field, resize: "vertical", lineHeight: 1.8, fontSize: FS(12.5) }}
          />
          <div style={{ fontSize: FS(10.5), color: CIS.textMute, marginTop: 6 }}>
            可以直接在上面改。改完再按複製。
          </div>

          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: `1px dashed ${CIS.panelBorder}`,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: FS(11.5), fontWeight: 800, color: sent ? "#0f7a45" : CIS.red }}>
              {sent ? "✓ 已記錄，回報時鐘歸零" : "真的送出去之後，按下面對應的按鈕："}
            </span>
            {!sent &&
              [
                { key: "line", label: "💬 已用 LINE 傳給他" },
                { key: "phone", label: "📞 已打電話講過" },
                { key: "meet", label: "🤝 已當面講過" },
              ].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => markSent(c.key)}
                  style={{
                    fontSize: FS(11.5),
                    fontWeight: 700,
                    padding: "6px 14px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontFamily: CIS.font,
                    border: `1px solid ${CIS.cardBorder}`,
                    background: CIS.card,
                    color: CIS.textSub,
                  }}
                >
                  {c.label}
                </button>
              ))}
          </div>
          <div style={{ fontSize: FS(10.5), color: CIS.textMute, marginTop: 6, lineHeight: 1.6 }}>
            按下去才會存成回報紀錄、才會把「幾天沒回報」歸零。
            只是產生來看看不算 —— 否則那個時鐘就沒有意義了。
          </div>
        </div>
      )}
    </section>
  );
}
