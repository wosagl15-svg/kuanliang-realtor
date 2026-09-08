"use client";
/**
 * 新增屋主（2026-08-22）
 *
 * 為什麼不做成「貼一段話讓 AI 抽」（買方那頁的做法）：
 *   賣方的關鍵欄位是**問出來的**，不是客戶自己講的 ——
 *   「為什麼賣」「誰能點頭」「什麼時候要賣掉」這三題，屋主不會主動說。
 *   做成 AI 抽取只會抽到一堆空值，然後業務以為已經建好了。
 *   一格一格填反而會逼人發現「啊我還沒問這題」，那才是這張表真正的價值。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import {
  SELLER_STAGES,
  SELL_MOTIVES,
  PRICE_FLEX,
  SELLER_SOURCES,
} from "@/lib/seller-constants";
import { createSellerAction, addSellerContactAction } from "@/lib/actions/seller";

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

const label: React.CSSProperties = {
  display: "block",
  fontSize: FS(12),
  color: CIS.textSub,
  marginBottom: 5,
  fontWeight: 600,
};

const hint: React.CSSProperties = {
  fontSize: FS(11),
  color: CIS.textMute,
  marginTop: 4,
  lineHeight: 1.6,
};

export type NewSellerPrefill = {
  name: string;
  phone: string;
  email: string;
  line: string;
  note: string;
  urgency: string;
  fromCase: string | null;
  appointmentId: string | null;
};

export default function NewSellerClient({ prefill }: { prefill: NewSellerPrefill }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [name, setName] = useState(prefill.name);
  const [phone, setPhone] = useState(prefill.phone);
  const [email, setEmail] = useState(prefill.email);
  const [line, setLine] = useState(prefill.line);
  const [source, setSource] = useState(prefill.fromCase ? "booking" : "manual");
  const [stage, setStage] = useState("lead");
  const [motive, setMotive] = useState("unknown");
  const [motiveNote, setMotiveNote] = useState("");
  const [priceFlex, setPriceFlex] = useState("unknown");
  const [askPrice, setAskPrice] = useState("");
  const [bottomPrice, setBottomPrice] = useState("");
  const [decisionMaker, setDecisionMaker] = useState("");
  const [coOwnerNote, setCoOwnerNote] = useState("");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [mandateStart, setMandateStart] = useState("");
  const [mandateEnd, setMandateEnd] = useState("");
  const [mandateKind, setMandateKind] = useState("");
  const [personalityNote, setPersonalityNote] = useState("");
  // 預約時客戶自己寫的備註，直接當第一筆聯絡歷程存進去 —— 那本來就是第一次接觸
  const [firstLog, setFirstLog] = useState(
    prefill.note ? `預約時提到：${prefill.note}` : "",
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ id: string; name: string } | null>(null);

  const motiveMeta = SELL_MOTIVES.find((m) => m.key === motive);

  function save() {
    setSaving(true);
    setError(null);
    setConflict(null);
    startTransition(() => {
      void (async () => {
        const r = await createSellerAction({
          name,
          phone: phone || null,
          email: email || null,
          lineUserId: line || null,
          source,
          stage: stage as never,
          motive,
          motiveNote: motiveNote || null,
          priceFlex,
          askPrice: askPrice ? Number(askPrice) : null,
          bottomPrice: bottomPrice ? Number(bottomPrice) : null,
          decisionMaker: decisionMaker || null,
          coOwnerNote: coOwnerNote || null,
          deadlineAt: deadlineAt || null,
          mandateStart: mandateStart || null,
          mandateEnd: mandateEnd || null,
          mandateKind: mandateKind || null,
          personalityNote: personalityNote || null,
          appointmentId: prefill.appointmentId,
        });
        if (!r.ok || !r.data) {
          setSaving(false);
          setError(r.error ?? "存檔失敗");
          if (r.conflict) setConflict(r.conflict);
          return;
        }
        if (firstLog.trim()) {
          await addSellerContactAction({
            sellerId: r.data.id,
            type: prefill.fromCase ? "meet" : "note",
            content: firstLog.trim(),
          });
        }
        router.push(`/admin/sellers/${r.data.id}`);
      })();
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {prefill.fromCase && (
        <div
          style={{
            fontSize: FS(12),
            fontWeight: 600,
            color: CHIP.info.color,
            background: CHIP.info.bg,
            border: `1px solid ${CHIP.info.border}`,
            borderRadius: CIS.radiusSm,
            padding: "9px 13px",
            lineHeight: 1.7,
          }}
        >
          🏷️ 從預約案件 <b>{prefill.fromCase}</b> 轉過來的賣方線。聯絡方式已帶入，
          底下三題（為什麼賣、誰能點頭、什麼時候要）才是決定這件案子能不能成的關鍵 —— 現在還記得就趕快填。
        </div>
      )}

      {/* ---- 聯絡方式 ---- */}
      <section
        style={{
          background: CIS.card,
          border: `1px solid ${CIS.cardBorder}`,
          borderRadius: CIS.radius,
          padding: 18,
        }}
      >
        <h2 style={{ fontSize: FS(14), fontWeight: 800, margin: "0 0 14px" }}>① 聯絡方式</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <div>
            <label style={label}>屋主稱呼 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={field} placeholder="例：王先生" />
          </div>
          <div>
            <label style={label}>電話</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={field} placeholder="09xxxxxxxx" />
            <div style={hint}>建過的號碼會擋下來，避免同一個屋主被建兩次</div>
          </div>
          <div>
            <label style={label}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={field} />
          </div>
          <div>
            <label style={label}>LINE</label>
            <input value={line} onChange={(e) => setLine(e.target.value)} style={field} />
          </div>
          <div>
            <label style={label}>從哪來的</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} style={field}>
              {SELLER_SOURCES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>委託階段</label>
            <select value={stage} onChange={(e) => setStage(e.target.value)} style={field}>
              {SELLER_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <div style={hint}>{SELLER_STAGES.find((s) => s.key === stage)?.hint}</div>
          </div>
        </div>
      </section>

      {/* ---- 為什麼賣 ---- */}
      <section
        style={{
          background: CIS.card,
          border: `1px solid ${CIS.cardBorder}`,
          borderRadius: CIS.radius,
          padding: 18,
        }}
      >
        <h2 style={{ fontSize: FS(14), fontWeight: 800, margin: "0 0 4px" }}>② 為什麼賣 —— 最重要的一題</h2>
        <p style={{ fontSize: FS(11.5), color: CIS.textMute, margin: "0 0 14px", lineHeight: 1.7 }}>
          動機決定他能不能等。等得起的人不會降價，等不起的人時間到了自己會鬆。
          這一題沒問出來，後面所有的議價都是在猜。
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {SELL_MOTIVES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMotive(m.key)}
              style={{
                padding: "7px 13px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: FS(12),
                fontWeight: 700,
                fontFamily: CIS.font,
                border: `1px solid ${motive === m.key ? CIS.blue : CIS.cardBorder}`,
                background: motive === m.key ? "#dfe9fb" : CIS.card,
                color: motive === m.key ? CIS.blueSoft : CIS.textSub,
              }}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
        {motiveMeta && motiveMeta.key !== "unknown" && (
          <div
            style={{
              fontSize: FS(11.5),
              color: CHIP.info.color,
              background: CHIP.info.bg,
              border: `1px solid ${CHIP.info.border}`,
              borderRadius: CIS.radiusSm,
              padding: "8px 12px",
              marginBottom: 12,
            }}
          >
            💡 {motiveMeta.hint}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={label}>他實際怎麼說的</label>
            <textarea
              value={motiveNote}
              onChange={(e) => setMotiveNote(e.target.value)}
              rows={2}
              style={{ ...field, resize: "vertical", lineHeight: 1.7 }}
              placeholder="例：小孩要在北部念書，明年三月前一定要處理掉"
            />
          </div>
          <div>
            <label style={label}>什麼時候要賣掉（期限）</label>
            <input type="date" value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)} style={field} />
            <div style={hint}>有期限就有底線。期限快到時系統會自動加分並提醒你去談</div>
          </div>
          <div>
            <label style={label}>誰能點頭（決策者）</label>
            <input
              value={decisionMaker}
              onChange={(e) => setDecisionMaker(e.target.value)}
              style={field}
              placeholder="例：太太說了算／要跟大哥商量"
            />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={label}>共有人狀況</label>
            <input
              value={coOwnerNote}
              onChange={(e) => setCoOwnerNote(e.target.value)}
              style={field}
              placeholder="例：三兄妹共有，二妹人在國外"
            />
            <div style={hint}>多一個人點頭就多一次翻案的機會。有共有人時系統會扣分提醒你先取得共識</div>
          </div>
        </div>
      </section>

      {/* ---- 價格 ---- */}
      <section
        style={{
          background: CIS.card,
          border: `1px solid ${CIS.cardBorder}`,
          borderRadius: CIS.radius,
          padding: 18,
        }}
      >
        <h2 style={{ fontSize: FS(14), fontWeight: 800, margin: "0 0 14px" }}>③ 價格</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {PRICE_FLEX.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPriceFlex(p.key)}
              style={{
                padding: "7px 13px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: FS(12),
                fontWeight: 700,
                fontFamily: CIS.font,
                border: `1px solid ${priceFlex === p.key ? CIS.blue : CIS.cardBorder}`,
                background: priceFlex === p.key ? "#dfe9fb" : CIS.card,
                color: priceFlex === p.key ? CIS.blueSoft : CIS.textSub,
              }}
            >
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <div>
            <label style={label}>目前開價（萬）</label>
            <input
              type="number"
              value={askPrice}
              onChange={(e) => setAskPrice(e.target.value)}
              style={field}
              placeholder="1280"
            />
          </div>
          <div>
            <label style={label}>他透露過的底價（萬）</label>
            <input
              type="number"
              value={bottomPrice}
              onChange={(e) => setBottomPrice(e.target.value)}
              style={field}
              placeholder="留白＝還沒說"
            />
            <div style={hint}>只有他自己講過才填。用猜的填進去，之後會拿假數字去談</div>
          </div>
        </div>
      </section>

      {/* ---- 委託書 ---- */}
      <section
        style={{
          background: CIS.card,
          border: `1px solid ${CIS.cardBorder}`,
          borderRadius: CIS.radius,
          padding: 18,
        }}
      >
        <h2 style={{ fontSize: FS(14), fontWeight: 800, margin: "0 0 14px" }}>④ 委託書（簽了才填）</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <div>
            <label style={label}>委託起</label>
            <input type="date" value={mandateStart} onChange={(e) => setMandateStart(e.target.value)} style={field} />
          </div>
          <div>
            <label style={label}>委託迄</label>
            <input type="date" value={mandateEnd} onChange={(e) => setMandateEnd(e.target.value)} style={field} />
            <div style={hint}>到期前兩週系統會提醒你去談續約</div>
          </div>
          <div>
            <label style={label}>委託型態</label>
            <select value={mandateKind} onChange={(e) => setMandateKind(e.target.value)} style={field}>
              <option value="">未填</option>
              <option value="exclusive">專任委託</option>
              <option value="general">一般委託</option>
            </select>
          </div>
        </div>
      </section>

      {/* ---- 第一筆歷程 ---- */}
      <section
        style={{
          background: CIS.card,
          border: `1px solid ${CIS.cardBorder}`,
          borderRadius: CIS.radius,
          padding: 18,
        }}
      >
        <h2 style={{ fontSize: FS(14), fontWeight: 800, margin: "0 0 4px" }}>⑤ 這次談了什麼</h2>
        <p style={{ fontSize: FS(11.5), color: CIS.textMute, margin: "0 0 12px", lineHeight: 1.7 }}>
          會存成第一筆聯絡歷程。之後每次聯絡都在詳情頁補一句，意圖判讀與屋主回報表都是從這些紀錄長出來的。
        </p>
        <textarea
          value={firstLog}
          onChange={(e) => setFirstLog(e.target.value)}
          rows={3}
          style={{ ...field, resize: "vertical", lineHeight: 1.7 }}
          placeholder="例：第一次到府拜訪，屋主堅持 1280 不讓，但提到明年三月要搬走"
        />
        <div>
          <label style={{ ...label, marginTop: 12 }}>個性備註（怎麼跟他相處）</label>
          <input
            value={personalityNote}
            onChange={(e) => setPersonalityNote(e.target.value)}
            style={field}
            placeholder="例：話少、不喜歡被催，講數據比講感情有效"
          />
        </div>
      </section>

      {error && (
        <div
          style={{
            fontSize: FS(12.5),
            color: CHIP.danger.color,
            background: CHIP.danger.bg,
            border: `1px solid ${CHIP.danger.border}`,
            borderRadius: CIS.radiusSm,
            padding: "10px 14px",
            lineHeight: 1.7,
          }}
        >
          {error}
          {conflict && (
            <>
              {" "}
              <a href={`/admin/sellers/${conflict.id}`} style={{ color: CHIP.danger.color, fontWeight: 800 }}>
                → 開啟「{conflict.name}」
              </a>
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={save}
          disabled={saving || !name.trim()}
          style={{
            padding: "11px 28px",
            borderRadius: 999,
            border: "none",
            background: saving || !name.trim() ? CIS.textMute : CIS.blue,
            color: CIS.onAccent,
            fontSize: FS(13),
            fontWeight: 800,
            cursor: saving || !name.trim() ? "not-allowed" : "pointer",
            fontFamily: CIS.font,
          }}
        >
          {saving ? "存檔中…" : "存檔並開啟"}
        </button>
        <span style={{ fontSize: FS(11), color: CIS.textMute }}>
          只有「屋主稱呼」是必填。其他欄位之後在詳情頁隨時可以補。
        </span>
      </div>
    </div>
  );
}
