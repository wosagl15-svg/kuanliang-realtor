import Link from "next/link";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import RequireLogin from "@/app/admin/_components/RequireLogin";
import { CIS, FS } from "@/app/admin/_components/cis";
import NewSellerClient, { type NewSellerPrefill } from "./NewSellerClient";

export const dynamic = "force-dynamic";

type SearchParams = {
  name?: string;
  phone?: string;
  email?: string;
  line?: string;
  note?: string;
  urgency?: string;
  from?: string;
  aid?: string;
};

export default async function NewSellerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!(await isCurrentUserAdmin())) {
    return <RequireLogin title="新增屋主" callbackUrl="/admin/sellers/new" />;
  }

  // 每日工作台把「談完的賣方線」推過來時帶著這些（見 lib/appointment-side.ts sellerIntakeHref）
  const sp = await searchParams;
  const prefill: NewSellerPrefill = {
    name: String(sp.name ?? "").slice(0, 80),
    phone: String(sp.phone ?? "").slice(0, 40),
    email: String(sp.email ?? "").slice(0, 160),
    line: String(sp.line ?? "").slice(0, 120),
    note: String(sp.note ?? "").slice(0, 2000),
    urgency: String(sp.urgency ?? "").slice(0, 16),
    fromCase: String(sp.from ?? "").slice(0, 40) || null,
    appointmentId: String(sp.aid ?? "").slice(0, 64) || null,
  };

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
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <Link href="/admin/sellers" style={{ fontSize: FS(13), color: CIS.textMute, textDecoration: "none" }}>
            ← 賣方資料庫
          </Link>
          <h1 style={{ fontSize: FS(24), fontWeight: 800, margin: "10px 0 6px" }}>新增屋主</h1>
          <p style={{ fontSize: FS(13), color: CIS.textSub, margin: 0, lineHeight: 1.7 }}>
            五個區塊，但真正決定成敗的是第②區那三題：<b>為什麼賣、誰能點頭、什麼時候要</b>。
            <br />
            <span style={{ color: CIS.textMute }}>
              沒問到就留白（不要猜著填）。留白會被系統列進「還缺哪幾題」，提醒你下次見面補問。
            </span>
          </p>
        </div>

        <NewSellerClient prefill={prefill} />
      </div>
    </main>
  );
}
