import Link from "next/link";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import RequireLogin from "@/app/admin/_components/RequireLogin";
import { CIS } from "@/app/admin/_components/cis";
import NewBuyerClient from "./NewBuyerClient";

export const dynamic = "force-dynamic";

export default async function NewBuyerPage() {
  if (!(await isCurrentUserAdmin())) {
    return <RequireLogin title="新增買方" callbackUrl="/admin/buyers/new" />;
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
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <Link
            href="/admin/buyers"
            style={{ fontSize: 13, color: CIS.textMute, textDecoration: "none" }}
          >
            ← 買方名單
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "10px 0 6px" }}>新增買方</h1>
          <p style={{ fontSize: 13, color: CIS.textSub, margin: 0, lineHeight: 1.7 }}>
            把 LINE 對話或帶看逐字稿整段貼進來，AI 會抽出需求欄位。
            <br />
            <span style={{ color: CIS.textMute }}>
              沒講到的欄位會留白（不編造），沒把握的會標黃並附上原文出處。確認過再存檔。
            </span>
          </p>
        </div>

        <NewBuyerClient />
      </div>
    </main>
  );
}
