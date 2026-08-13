import Link from "next/link";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import RequireLogin from "@/app/admin/_components/RequireLogin";
import { CIS, CHIP } from "@/app/admin/_components/cis";
import { listListings } from "@/lib/listing";
import { matchBuyersForListing } from "@/lib/buyer-match";
import { districtLabel } from "@/lib/buyer-constants";
import { sale591TaichungUrl, land591TaichungUrl, actualPriceUrl } from "@/lib/external-search";
import NewListingClient from "./NewListingClient";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  if (!(await isCurrentUserAdmin())) {
    return <RequireLogin title="物件庫" callbackUrl="/admin/listings" />;
  }

  const listings = await listListings({ status: "onsale" });
  // 每筆物件先算好「有幾位買方符合」—— 這是接到案子第一個想知道的數字
  const withMatches = await Promise.all(
    listings.slice(0, 60).map(async (l) => {
      const m = await matchBuyersForListing(l.id, { limit: 200 });
      return { ...l, matchCount: m.matched.length };
    }),
  );

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
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Link href="/admin/buyers" style={{ fontSize: 13, color: CIS.textMute, textDecoration: "none" }}>
          ← 買方名單
        </Link>

        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "12px 0 6px" }}>物件庫</h1>
        <p style={{ fontSize: 13, color: CIS.textSub, margin: "0 0 18px", lineHeight: 1.7 }}>
          貼一段物件描述，AI 抽成欄位存進來。每筆物件會即時算出<strong>有幾位買方符合</strong>。
        </p>

        {/* 外部查詢：只開連結，不抓取 */}
        <section
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${CIS.cardBorder}`,
            borderRadius: CIS.radius,
            padding: "13px 16px",
            marginBottom: 18,
            display: "flex",
            gap: 14,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, color: CIS.textMute }}>去外部平台找物件：</span>
          {[
            { href: sale591TaichungUrl(), label: "591 台中買屋" },
            { href: land591TaichungUrl(), label: "591 台中土地" },
            { href: actualPriceUrl(), label: "內政部實價登錄" },
          ].map((x) => (
            <a
              key={x.href}
              href={x.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12.5,
                color: CIS.blueSoft,
                textDecoration: "none",
                padding: "5px 12px",
                borderRadius: 999,
                border: `1px solid ${CIS.cardBorder}`,
              }}
            >
              {x.label} ↗
            </a>
          ))}
          <span style={{ fontSize: 11.5, color: CIS.textMute, flexBasis: "100%", lineHeight: 1.7 }}>
            這幾條是<strong>純連結</strong>，開新分頁到對方網站，看到的是他們當下最新的資料。
            系統不抓取、不儲存任何 591 內容 —— 抓下來存會違反使用條款，而且資料一過期，
            推給客戶已下架的物件反而傷專業。找到適合的物件請用上面的欄位建成自己的資料。
          </span>
        </section>

        <NewListingClient />

        {/* 物件清單 */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, color: CIS.textMute, marginBottom: 10 }}>
            在售物件 {withMatches.length} 筆
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {withMatches.map((l) => (
              <div
                key={l.id}
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
                <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    {l.title}
                    {l.is_demo === 1 && (
                      <span
                        style={{
                          fontSize: 10.5,
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
                  <div style={{ fontSize: 12, color: CIS.textMute, marginTop: 4 }}>
                    {districtLabel(l.district)}
                    {l.size_ping ? `　${l.size_ping} 坪` : ""}
                    {l.rooms ? `　${l.rooms} 房` : ""}
                    {l.parking_count > 0 ? `　${l.parking_count} 車位` : ""}
                    {l.age_year !== null ? `　屋齡 ${l.age_year} 年` : ""}
                  </div>
                </div>

                <div style={{ flexShrink: 0, fontSize: 18, fontWeight: 800, color: CIS.blueSoft }}>
                  {l.price ? `${l.price} 萬` : "未定價"}
                </div>

                <div style={{ flexShrink: 0, textAlign: "right", minWidth: 88 }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: l.matchCount > 0 ? CHIP.success.color : CIS.textMute,
                      lineHeight: 1,
                    }}
                  >
                    {l.matchCount}
                  </div>
                  <div style={{ fontSize: 10.5, color: CIS.textMute, marginTop: 4 }}>位買方符合</div>
                </div>
              </div>
            ))}

            {withMatches.length === 0 && (
              <div
                style={{
                  padding: 30,
                  textAlign: "center",
                  color: CIS.textMute,
                  background: CIS.card,
                  border: `1px solid ${CIS.cardBorder}`,
                  borderRadius: CIS.radius,
                  fontSize: 13.5,
                }}
              >
                物件庫是空的。上面貼一段物件描述試試，或到
                <Link href="/admin/buyers" style={{ color: CIS.blueSoft, margin: "0 4px" }}>
                  買方名單
                </Link>
                塞一批示範資料。
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
