import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, getPost, getPosts, relatedPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/site";
import { agentNode, websiteNode, AGENT_ID, PERSON_ID } from "@/lib/agent-node";
import { getStaticPageTitle } from "@/lib/static-pages";
import { BLOG_CSS } from "../blog-styles";
import { MobileBar, CtaBox, BlogFooter } from "../parts";
import CardDeck from "@/app/blog/CardDeck";

/** 站內既有頁面的中文名，讓文章的「延伸閱讀」印得出人看得懂的字。 */
const PAGE_NAMES: Record<string, string> = {
  "/loan-guide": "貸款成數與寬限期",
  "/buyer-cost": "購屋成本試算",
  "/actual-price": "實價登錄怎麼查",
  "/land-tax": "土地增值稅試算",
  "/selfuse-tax": "自用住宅稅率",
  "/repurchase-tax": "重購退稅",
  "/building-line": "建築線申請指南",
  "/existing-road-faq": "既成道路常見問題",
  "/easement": "地役權（不動產役權）",
  "/self-build-guide": "自地自建全流程",
  "/coowned-land": "共有土地怎麼處理",
  "/seller-guide": "賣屋流程指南",
  "/buy-house-guide": "買房流程指南",
  "/shalu-115-price": "沙鹿 115 年成交分析",
  "/qingshui-115-price": "清水 115 年成交分析",
  "/wuqi-115-price": "梧棲 115 年成交分析",
  "/presale": "預售屋注意事項",
  "/qingan3-guide": "青安 3.0 海線指南",
  "/tools": "全部買賣屋工具",
};

/**
 * 延伸閱讀要顯示的名稱。
 * PAGE_NAMES 只是「取個更短更好唸的名字」的覆寫表，不是唯一來源——
 * 表裡沒有就去讀那頁自己的 <title>，最後才退回網址。
 * （2026-08-22：以前沒有中間這層，漏建的頁會直接印出 `/road-access` 這種原始路徑。）
 */
function relatedName(href: string): string {
  return PAGE_NAMES[href] ?? getStaticPageTitle(href) ?? href;
}

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "找不到這篇文章" };

  return {
    title: `${post.title}｜海線房仲冠良`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      locale: "zh_TW",
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
    },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const cat = CATEGORIES[post.category];
  const url = `${SITE_URL}/blog/${post.slug}`;
  const more = relatedPosts(post);

  const jsonLd = {
    "@context": "https://schema.org",
    // 商家與網站整份帶在每篇文章裡，不是只寫 @id 參照。
    // AI 爬蟲常常只抓單獨一頁，只給參照的話那篇文章等於沒有作者。見 src/lib/agent-node.ts。
    "@graph": [
      agentNode(),
      websiteNode(),
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.description,
        url,
        inLanguage: "zh-Hant-TW",
        datePublished: post.date,
        dateModified: post.updated ?? post.date,
        keywords: post.tags.join(", "),
        articleSection: cat.name,
        author: { "@id": PERSON_ID },
        publisher: { "@id": AGENT_ID },
        mainEntityOfPage: { "@id": url },
        isPartOf: { "@id": `${SITE_URL}/blog#blog` },
      },
      // 有影片的頁面加 VideoObject，Google 搜尋結果會多一個影片縮圖，點擊率差很多。
      ...(post.youtube
        ? [
            {
              "@type": "VideoObject",
              "@id": `${url}#video`,
              name: post.title,
              description: post.description,
              thumbnailUrl: [`https://i.ytimg.com/vi/${post.youtube}/maxresdefault.jpg`],
              uploadDate: post.videoDate ?? post.date,
              embedUrl: `https://www.youtube.com/embed/${post.youtube}`,
              contentUrl: `https://www.youtube.com/shorts/${post.youtube}`,
              inLanguage: "zh-Hant-TW",
            },
          ]
        : []),
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首頁", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "房產筆記", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: cat.name, item: `${SITE_URL}/blog/category/${post.category}` },
          { "@type": "ListItem", position: 4, name: post.title, item: url },
        ],
      },
    ],
  };

  /* 影片只寫一次，依 youtubeAtEnd 決定掛在文章前面還是後面。
     複製兩份的話，改一邊忘了改另一邊就會兩個版面不一致。 */
  const video = post.youtube ? (
    <section className={`video${post.youtubeVertical ? " vertical" : ""}`}>
      <iframe
        // nocookie 版本在使用者沒播放前不會種追蹤 cookie
        src={`https://www.youtube-nocookie.com/embed/${post.youtube}`}
        title={post.title}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </section>
  ) : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BLOG_CSS }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="bhead">
        <div className="wrap">
          <p className="crumb">
            <Link href="/">首頁</Link> ／ <Link href="/blog">房產筆記</Link> ／{" "}
            <Link href={`/blog/category/${post.category}`}>{cat.name}</Link>
          </p>
          <h1>{post.title}</h1>
          <p className="meta">
            {post.date}
            {post.updated && post.updated !== post.date ? `（${post.updated} 更新）` : ""}・約{" "}
            {post.readingMinutes} 分鐘
          </p>
          <p className="lede">{post.description}</p>
        </div>
      </header>

      <div className="wrap">
        {post.youtube && !post.youtubeAtEnd && video}

        {/* 圖卡組：整段解說由卡片承載，文字段落只留給法條 */}
        <CardDeck cards={post.cards} />

        <article className="article" dangerouslySetInnerHTML={{ __html: post.html }} />

        {post.youtube && post.youtubeAtEnd && video}

        {post.related.length > 0 && (
          <section className="rel">
            <h2>延伸閱讀・站內工具</h2>
            <div className="rellist">
              {post.related.map((href) => (
                <Link key={href} href={href}>
                  <span className="e" aria-hidden>🔗</span>
                  {relatedName(href)}
                </Link>
              ))}
            </div>
          </section>
        )}

        <CtaBox />

        {more.length > 0 && (
          <section className="rel">
            <h2>其他文章</h2>
            <div className="rellist">
              {more.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`}>
                  <span className="e" aria-hidden>{p.emoji}</span>
                  {p.title}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <BlogFooter />
      <MobileBar />
    </>
  );
}
