/**
 * 看過的案件 —— 以「物件」為單位，不是以時間為單位（2026-08-14）
 *
 * 同一間房子的推案與帶看會併成一組，才看得出系統擁有者要的那件事：
 * 「推案時說不錯，實際看完差多少」。照時間平鋪會被中間的通話洗散。
 */
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import { reactionLabel, REACTIONS } from "@/lib/buyer-constants";
import { groupViewings, gapNote, coolingPattern, type ViewingRow } from "@/lib/buyer-viewings";
import EventEditor from "./EventEditor";

function reactionStyle(reaction: string) {
  const tone = REACTIONS.find((r) => r.key === reaction)?.tone ?? "neutral";
  const c = CHIP[tone as keyof typeof CHIP];
  return { background: c.bg, color: c.color, border: `1px solid ${c.border}` };
}

function Pill({ reaction }: { reaction: string }) {
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: FS(11.5),
        fontWeight: 700,
        whiteSpace: "nowrap",
        ...reactionStyle(reaction),
      }}
    >
      {reactionLabel(reaction)}
    </span>
  );
}

export default function ViewedListings({ rows, buyerId }: { rows: ViewingRow[]; buyerId: string }) {
  const groups = groupViewings(rows);
  if (groups.length === 0) return null;

  const viewedCount = groups.filter((g) => g.events.some((e) => e.type === "viewing")).length;
  const cooling = coolingPattern(groups);

  // 帶看多間卻沒有一間正面 —— 通常是需求登記得不準，不是物件不好
  const positive = groups.filter((g) => g.viewReaction === "loved" || g.viewReaction === "offered").length;
  const ratedViews = groups.filter((g) => g.viewReaction).length;

  return (
    <div
      style={{
        background: CIS.card,
        border: `1px solid ${CIS.cardBorder}`,
        borderRadius: CIS.radius,
        padding: "18px 20px",
      }}
    >
      <h3 style={{ margin: "0 0 14px", fontSize: FS(14.5), color: CIS.text, fontWeight: 700 }}>
        看過的案件（{groups.length} 間，其中實際帶看 {viewedCount} 間）
      </h3>

      {/* 整體型態提醒：一間一間看不出來，攤開才看得到 */}
      {cooling && (
        <div
          style={{
            padding: "11px 14px",
            background: CHIP.warn.bg,
            border: `1px solid ${CHIP.warn.border}`,
            borderRadius: CIS.radiusSm,
            color: CHIP.warn.color,
            fontSize: FS(12.5),
            marginBottom: 12,
            lineHeight: 1.7,
          }}
        >
          ⚠️ 有評分的 {cooling.total} 間裡，{cooling.count} 間都是「推案時有興趣、看完變冷」。
          這種重複出現的落差通常不是客戶善變——多半是照片與現場有距離，或推案時把話講得比實際滿。
          下次推案前先講清楚缺點，反而比較不會白跑。
        </div>
      )}

      {ratedViews >= 3 && positive === 0 && (
        <div
          style={{
            padding: "11px 14px",
            background: CHIP.warn.bg,
            border: `1px solid ${CHIP.warn.border}`,
            borderRadius: CIS.radiusSm,
            color: CHIP.warn.color,
            fontSize: FS(12.5),
            marginBottom: 12,
            lineHeight: 1.7,
          }}
        >
          ⚠️ 帶看 {ratedViews} 間，沒有一間反應正面。多半不是物件不好，而是登記的需求跟他心裡要的不一樣——
          下次通話值得重新確認預算與必要條件，而不是繼續推同類型。
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {groups.map((g) => {
          const gap = gapNote(g);
          return (
            <div
              key={g.key}
              style={{
                padding: "12px 14px",
                background: "#f7f9fd",
                border: `1px solid ${CIS.cardBorder}`,
                borderRadius: CIS.radiusSm,
              }}
            >
              {/* 標題列 */}
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                {g.url ? (
                  <a
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: CIS.blueSoft,
                      fontSize: FS(14),
                      fontWeight: 700,
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                    }}
                  >
                    {g.title} ↗
                  </a>
                ) : (
                  <strong style={{ color: CIS.text, fontSize: FS(14) }}>{g.title}</strong>
                )}
                {g.platform && (
                  <span style={{ fontSize: FS(11.5), color: CIS.textMute }}>
                    {g.platformEmoji} {g.platform}
                    {g.listingNo ? ` · 編號 ${g.listingNo}` : ""}
                  </span>
                )}
              </div>

              {/* 推案 → 帶看的落差，這是這一區存在的理由 */}
              {gap && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                    margin: "9px 0 2px",
                    padding: "7px 11px",
                    borderRadius: CIS.radiusSm,
                    background: CHIP[gap.tone].bg,
                    border: `1px solid ${CHIP[gap.tone].border}`,
                    fontSize: FS(12),
                  }}
                >
                  <span style={{ color: CIS.textSub }}>📤 推案時</span>
                  <Pill reaction={g.pitchReaction as string} />
                  <span style={{ color: CIS.textMute }}>→</span>
                  <span style={{ color: CIS.textSub }}>🔑 看完</span>
                  <Pill reaction={g.viewReaction as string} />
                  <span style={{ color: CHIP[gap.tone].color, fontWeight: 600 }}>{gap.text}</span>
                </div>
              )}

              {/* 逐筆歷程 */}
              <div style={{ marginTop: 8, display: "grid", gap: 5 }}>
                {g.events.map((e) => (
                  <div
                    key={e.id}
                    style={{ display: "flex", gap: 9, alignItems: "baseline", flexWrap: "wrap", fontSize: FS(12.5) }}
                  >
                    <span style={{ color: CIS.textMute, fontSize: FS(11.5), flexShrink: 0 }}>
                      {e.at.toLocaleDateString("zh-TW")}
                    </span>
                    <span style={{ color: CIS.textSub, flexShrink: 0 }}>
                      {e.type === "viewing" ? "🔑 帶看" : "📤 推案"}
                    </span>
                    {e.reaction && <Pill reaction={e.reaction} />}
                    {e.note && <span style={{ color: CIS.textSub, lineHeight: 1.6 }}>{e.note}</span>}
                    <EventEditor
                      logId={e.id}
                      buyerId={buyerId}
                      title={g.title}
                      reaction={e.reaction}
                      note={e.note}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
