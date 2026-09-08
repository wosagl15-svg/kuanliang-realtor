import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, postsByCategory, type CategoryKey } from "@/lib/blog";
import { SITE_URL } from "@/lib/site";
import { BLOG_CSS } from "../../blog-styles";
import { MobileBar, CtaBox, BlogFooter, PostCard } from "../../parts";

/**
 * 分類頁不只是篩選器，它本身就是一個可以排名的著陸頁
 * （「台中海線 房產知識」這種查詢會落在這裡，而不是首頁）。
 */
export function generateStaticParams() {
  return Object.keys(CATEGORIES).map((key) => ({ key }));
}

function isKey(k: string): k is CategoryKey {
  return k in CATEGORIES;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  if (!isKey(key)) return { title: "找不到這個分類" };
  const c = CATEGORIES[key];
  return {
    title: `${c.name}｜房產筆記｜海線房仲冠良`,
    description: c.desc,
    alternates: { canonical: `/blog/category/${key}` },
    openGraph: {
      type: "website",
      title: `${c.name}｜房產筆記`,
      description: c.desc,
      url: `${SITE_URL}/blog/category/${key}`,
      locale: "zh_TW",
    },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!isKey(key)) notFound();

  const c = CATEGORIES[key];
  const posts = postsByCategory(key);
  const keys = Object.keys(CATEGORIES) as CategoryKey[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/blog/category/${key}#page`,
    name: `${c.name}｜房產筆記`,
    description: c.desc,
    url: `${SITE_URL}/blog/category/${key}`,
    inLanguage: "zh-Hant-TW",
    isPartOf: { "@id": `${SITE_URL}/blog#blog` },
    about: { "@id": `${SITE_URL}/#agent` },
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BLOG_CSS }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="bhead">
        <div className="wrap">
          <p className="crumb">
            <Link href="/">首頁</Link> ／ <Link href="/blog">房產筆記</Link>
          </p>
          <h1>
            {c.icon} {c.name}
          </h1>
          <p className="lede">{c.desc}</p>
        </div>
      </header>

      <div className="wrap">
        <nav className="cats" aria-label="文章分類">
          <Link className="cat" href="/blog">
            全部
          </Link>
          {keys.map((k) => (
            <Link
              className="cat"
              key={k}
              href={`/blog/category/${k}`}
              aria-current={k === key ? "page" : undefined}
            >
              <span aria-hidden>{CATEGORIES[k].icon}</span>
              {CATEGORIES[k].name}
            </Link>
          ))}
        </nav>

        {posts.length === 0 ? (
          <section className="sec">
            <h2>
              <span className="chip" aria-hidden>✍️</span>
              這個分類還沒有文章
            </h2>
            <p className="sub">
              先看 <Link href="/blog">全部文章</Link> 或{" "}
              <Link href="/tools">買賣屋工具</Link>。
            </p>
          </section>
        ) : (
          <div className="grid">
            {posts.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        )}

        <CtaBox />
      </div>

      <BlogFooter />
      <MobileBar />
    </>
  );
}
