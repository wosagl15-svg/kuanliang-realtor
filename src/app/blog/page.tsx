import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES, getPosts, type CategoryKey } from "@/lib/blog";
import { SITE_URL } from "@/lib/site";
import { BLOG_CSS } from "./blog-styles";
import { MobileBar, CtaBox, BlogFooter, PostCard } from "./parts";

const TITLE = "房產筆記｜台中海線買賣、稅務、實價登錄解析";
const DESC =
  "沙鹿、清水、梧棲、龍井、大肚、大甲、外埔的房產知識與成交數據。稅務、貸款、產權與實價登錄分析，用查得到的數字講話。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/blog" },
  openGraph: { type: "website", title: TITLE, description: DESC, url: `${SITE_URL}/blog`, locale: "zh_TW" },
};

export default function BlogIndex() {
  const posts = getPosts();
  const keys = Object.keys(CATEGORIES) as CategoryKey[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${SITE_URL}/blog#blog`,
    name: TITLE,
    description: DESC,
    url: `${SITE_URL}/blog`,
    inLanguage: "zh-Hant-TW",
    publisher: { "@id": `${SITE_URL}/#agent` },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: p.date,
      author: { "@id": `${SITE_URL}/#wuguanliang` },
    })),
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BLOG_CSS }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="bhead">
        <div className="wrap">
          <p className="crumb">
            <Link href="/">首頁</Link> ／ 房產筆記
          </p>
          <h1>房產筆記</h1>
          <p className="lede">
            海線七區的買賣、稅務與成交數據。只寫查得到來源的東西，數字都標出處。
          </p>
        </div>
      </header>

      <div className="wrap">
        <nav className="cats" aria-label="文章分類">
          <span className="cat" aria-current="page">
            全部
          </span>
          {keys.map((k) => (
            <Link className="cat" key={k} href={`/blog/category/${k}`}>
              <span aria-hidden>{CATEGORIES[k].icon}</span>
              {CATEGORIES[k].name}
            </Link>
          ))}
        </nav>
      </div>

      {posts.length === 0 ? (
        <div className="wrap">
          <section className="sec">
            <h2>
              <span className="chip" aria-hidden>✍️</span>
              第一篇正在寫
            </h2>
            <p className="sub">
              文章上線前，先看看已經整理好的{" "}
              <Link href="/tools">買賣屋工具與指南</Link>，或直接{" "}
              <Link href="/card/booking">預約聊聊</Link>。
            </p>
          </section>
        </div>
      ) : (
        <div className="wrap">
          {keys.map((k) => {
            const list = posts.filter((p) => p.category === k);
            if (list.length === 0) return null;
            return (
              <div key={k}>
                <section className="sec">
                  <h2>
                    <span className="chip" aria-hidden>{CATEGORIES[k].icon}</span>
                    {CATEGORIES[k].name}
                  </h2>
                  <p className="sub">{CATEGORIES[k].desc}</p>
                </section>
                <div className="grid">
                  {list.map((p) => (
                    <PostCard key={p.slug} post={p} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="wrap">
        <CtaBox />
      </div>

      <BlogFooter />
      <MobileBar />
    </>
  );
}
