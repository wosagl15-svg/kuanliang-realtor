import Link from "next/link";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import RequireLogin from "@/app/admin/_components/RequireLogin";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import { listCommunities, countBuyersWanting } from "@/lib/community";
import { districtLabel } from "@/lib/buyer-constants";
import CommunityForm from "./CommunityForm";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  if (!(await isCurrentUserAdmin())) {
    return <RequireLogin title="社區主檔" callbackUrl="/admin/communities" />;
  }

  const communities = await listCommunities();
  const withCounts = await Promise.all(
    communities.map(async (c) => ({ ...c, waiting: await countBuyersWanting(c.id) })),
  );

  // 依區域分組，海線核心區在前
  const grouped = new Map<string, typeof withCounts>();
  for (const c of withCounts) {
    const arr = grouped.get(c.district) ?? [];
    arr.push(c);
    grouped.set(c.district, arr);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: CIS.bg,
        color: CIS.text,
        fontFamily: CIS.font,
        padding: "28px 20px 60px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/admin/buyers" style={{ fontSize: FS(13), color: CIS.textMute, textDecoration: "none" }}>
          ← 買方名單
        </Link>

        <h1 style={{ fontSize: FS(24), fontWeight: 800, margin: "12px 0 6px" }}>社區主檔</h1>
        <p style={{ fontSize: FS(13), color: CIS.textSub, margin: "0 0 6px", lineHeight: 1.7 }}>
          社區建一次，全系統共用。走路到高鐵幾分鐘這種資訊建在這裡，就不用每個客戶都問一次。
        </p>
        <p style={{ fontSize: FS(12.5), color: CHIP.warn.color, margin: "0 0 22px", lineHeight: 1.7 }}>
          ⚠️ <strong>別名一定要建。</strong>客戶會講「哈佛」，你建的是「太子哈佛」——
          沒有別名，客戶提到的社區就掛不上主檔，「接到委託撈出想買的人」這個功能就失效。
        </p>

        <CommunityForm />

        <div style={{ marginTop: 24, display: "grid", gap: 18 }}>
          {withCounts.length === 0 && (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: CIS.textMute,
                background: CIS.card,
                border: `1px solid ${CIS.cardBorder}`,
                borderRadius: CIS.radius,
                fontSize: FS(13.5),
              }}
            >
              還沒有任何社區。先把你常經營的幾個社區建進來，或到
              <Link href="/admin/buyers" style={{ color: CIS.blueSoft, margin: "0 4px" }}>
                買方名單
              </Link>
              塞一批示範資料。
            </div>
          )}

          {[...grouped.entries()].map(([district, items]) => (
            <section key={district}>
              <div
                style={{
                  fontSize: FS(12),
                  fontWeight: 700,
                  color: CIS.blueSoft,
                  letterSpacing: "0.06em",
                  marginBottom: 10,
                }}
              >
                {districtLabel(district)}　<span style={{ color: CIS.textMute }}>{items.length} 個社區</span>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {items.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: CIS.card,
                      border: `1px solid ${CIS.cardBorder}`,
                      borderRadius: CIS.radius,
                      padding: "13px 16px",
                      display: "flex",
                      gap: 14,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                      <div style={{ fontSize: FS(15), fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                        {c.name}
                        {c.isDemo && (
                          <span
                            style={{
                              fontSize: FS(10.5),
                              padding: "2px 7px",
                              borderRadius: 999,
                              background: CHIP.neutral.bg,
                              color: CHIP.neutral.color,
                              border: `1px solid ${CHIP.neutral.border}`,
                            }}
                          >
                            示範
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: FS(12), color: CIS.textMute, marginTop: 4 }}>
                        {c.aliases.length > 0 ? (
                          <>別名：{c.aliases.join("、")}</>
                        ) : (
                          <span style={{ color: CHIP.warn.color }}>⚠ 尚未建別名</span>
                        )}
                      </div>
                    </div>

                    <div style={{ flex: "1 1 200px", fontSize: FS(12), color: CIS.textSub, lineHeight: 1.8 }}>
                      {c.built_year ? `${new Date().getFullYear() - c.built_year} 年屋　` : ""}
                      {c.hasElevator === true ? "有電梯　" : c.hasElevator === false ? "無電梯　" : ""}
                      {c.parking_type ? `${c.parking_type}車位　` : ""}
                      {c.walk_min_hsr ? `走高鐵 ${c.walk_min_hsr} 分　` : ""}
                      {c.walk_min_train ? `走火車站 ${c.walk_min_train} 分` : ""}
                      {c.school_zone && (
                        <div style={{ color: CIS.textMute }}>學區：{c.school_zone}</div>
                      )}
                    </div>

                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: FS(20),
                          fontWeight: 800,
                          color: c.waiting > 0 ? CHIP.success.color : CIS.textMute,
                          lineHeight: 1,
                        }}
                      >
                        {c.waiting}
                      </div>
                      <div style={{ fontSize: FS(10.5), color: CIS.textMute, marginTop: 4 }}>位買方在等</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
