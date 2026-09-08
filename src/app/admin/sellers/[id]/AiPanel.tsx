"use client";
/**
 * AI 深度判讀（2026-08-22）
 *
 * 跟上面那個「意圖分數」是兩件事，刻意分開放：
 *   分數是規則算的，每一分都指得出是哪一句話造成的，隨時都在、不用按。
 *   這顆按鈕是花錢請 AI 把整段歷程讀一遍，寫出「他真正在想什麼」。
 * 分開的理由是信任：分數不會跳、可以拿來排序；AI 那段是參考，看完可以不同意。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import { analyzeSellerAction, type SellerAiResult } from "@/lib/actions/seller";

export default function AiPanel({ sellerId, logCount }: { sellerId: string; logCount: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [result, setResult] = useState<SellerAiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function run() {
    setLoading(true);
    setError(null);
    startTransition(() => {
      void (async () => {
        const r = await analyzeSellerAction(sellerId);
        setLoading(false);
        if (!r.ok || !r.data) {
          setError(r.error ?? "判讀失敗");
          return;
        }
        setResult(r.data);
        router.refresh(); // 判讀本身也會被記成一筆歷程
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <h2 style={{ fontSize: FS(16), fontWeight: 800, margin: 0 }}>🤖 AI 讀一遍歷程</h2>
        <button
          type="button"
          onClick={run}
          disabled={loading || logCount < 2}
          style={{
            padding: "7px 18px",
            borderRadius: 999,
            border: "none",
            background: loading || logCount < 2 ? CIS.textMute : CIS.blueDeep,
            color: CIS.onAccent,
            fontSize: FS(12),
            fontWeight: 800,
            cursor: loading || logCount < 2 ? "not-allowed" : "pointer",
            fontFamily: CIS.font,
          }}
        >
          {loading ? "讀取中…（約 10 秒）" : result ? "重新判讀" : "開始判讀"}
        </button>
        <span style={{ fontSize: FS(11), color: CIS.textMute }}>
          {logCount < 2 ? "聯絡紀錄至少要 2 筆才讀得出趨勢" : "每次約 NT$1｜判讀結果會存成一筆歷程"}
        </span>
      </div>
      <p style={{ fontSize: FS(11.5), color: CIS.textMute, margin: "0 0 12px", lineHeight: 1.7 }}>
        它看的是「嘴巴說的」跟「行為」有沒有落差 —— 說一毛不讓卻降過兩次價，跟說好談卻一次都沒鬆，是完全不同的兩種人。
      </p>

      {error && (
        <div
          style={{
            fontSize: FS(12.5),
            color: CHIP.warn.color,
            background: CHIP.warn.bg,
            border: `1px solid ${CHIP.warn.border}`,
            borderRadius: CIS.radiusSm,
            padding: "10px 14px",
            lineHeight: 1.7,
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              background: CIS.panel,
              border: `1px solid ${CIS.panelBorder}`,
              borderRadius: CIS.radiusSm,
              padding: 14,
            }}
          >
            <div style={{ fontSize: FS(11), fontWeight: 800, color: CIS.textMute, marginBottom: 6 }}>他在想什麼</div>
            <div style={{ fontSize: FS(13), lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{result.reading}</div>
          </div>

          {result.questions?.length > 0 && (
            <div>
              <div style={{ fontSize: FS(11), fontWeight: 800, color: CIS.textMute, marginBottom: 6 }}>
                下次見面要問出來的
              </div>
              <div style={{ display: "grid", gap: 5 }}>
                {result.questions.map((q, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: FS(12.5),
                      lineHeight: 1.7,
                      padding: "8px 12px",
                      background: CHIP.info.bg,
                      border: `1px solid ${CHIP.info.border}`,
                      borderRadius: CIS.radiusSm,
                      color: CHIP.info.color,
                    }}
                  >
                    {i + 1}. {q}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.approach && (
            <div>
              <div style={{ fontSize: FS(11), fontWeight: 800, color: CIS.textMute, marginBottom: 6 }}>怎麼談</div>
              <div style={{ fontSize: FS(13), lineHeight: 1.85 }}>{result.approach}</div>
            </div>
          )}

          {result.risks?.length > 0 && (
            <div>
              <div style={{ fontSize: FS(11), fontWeight: 800, color: CIS.textMute, marginBottom: 6 }}>
                什麼情況會談崩
              </div>
              <div style={{ display: "grid", gap: 5 }}>
                {result.risks.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: FS(12.5),
                      lineHeight: 1.7,
                      padding: "8px 12px",
                      background: CHIP.warn.bg,
                      border: `1px solid ${CHIP.warn.border}`,
                      borderRadius: CIS.radiusSm,
                      color: CHIP.warn.color,
                    }}
                  >
                    ⚠️ {r}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.usage && (
            <div style={{ fontSize: FS(10.5), color: CIS.textMute }}>
              本次花費約 NT${result.usage.costTwd}（in {result.usage.inputTokens} / out {result.usage.outputTokens} tokens）
            </div>
          )}
        </div>
      )}
    </section>
  );
}
