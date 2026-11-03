import test from "node:test";
import assert from "node:assert/strict";
import { ExtractedArticle, type ArticleRead } from "@overview/domain";
import { BLOG_PAGE, FRONT_PAGE, LINE_BROKEN_ESSAY, NEWS_PAGE, NO_ARTICLE_PAGE, pageFrom, paragraphs, PAYWALLED_PAGE, UNLOCKED_PAGE } from "./pageFixtures.testHelper.js";
import { readArticle } from "./readArticle.js";

const read = (html: string, url?: string) => {
  const page = pageFrom(html, url);
  return readArticle(page, page.location.href);
};

const articleOf = (result: ArticleRead) => {
  assert.equal(result.status, "read");
  return (result as Extract<ArticleRead, { status: "read" }>).article;
};

test("a news story gives its text, sections and metadata, in the shape the rest of the app reads", () => {
  const article = articleOf(read(NEWS_PAGE));
  assert.doesNotThrow(() => ExtractedArticle.parse(article));
  assert.equal(article.url, "https://news.example.com/2026/11/bridge-repairs");
  assert.equal(article.siteName, "Example News");
  assert.equal(article.author, "Asha Rao, Tom Lee");
  assert.equal(article.publishedAt, "2026-11-01T09:30:00.000Z");
  assert.equal(article.language, "en-GB");
  assert.equal(article.imageUrl, "https://news.example.com/images/bridge.jpg");
});

test("the share image falls back through the tags a page may use", () => {
  const withTags = (tags: string) => NEWS_PAGE.replace('<meta property="og:image" content="/images/bridge.jpg">', tags);
  assert.equal(articleOf(read(withTags('<meta name="twitter:image" content="https://cdn.example/t.jpg">'))).imageUrl, "https://cdn.example/t.jpg");
  const linked = withTags("").replace('"headline":"Bridge repairs",', '"headline":"Bridge repairs","image":[{"@type":"ImageObject","url":"https://cdn.example/ld.jpg"}],');
  assert.equal(articleOf(read(linked)).imageUrl, "https://cdn.example/ld.jpg");
});

test("a page with no share image, or only an insecure one, has none rather than a broken one", () => {
  assert.equal(articleOf(read(BLOG_PAGE, "https://sam.example.org/cold-showers")).imageUrl, null);
  const insecure = NEWS_PAGE.replace('content="/images/bridge.jpg"', 'content="http://cdn.example/a.jpg"');
  assert.equal(articleOf(read(insecure)).imageUrl, null);
});

test("sections follow the headings, keep the ids a link can point at, and leave the page's furniture behind", () => {
  const { sections, title } = articleOf(read(NEWS_PAGE));
  assert.deepEqual(sections.map(({ heading, anchor }) => [heading, anchor]), [
    [null, null],
    ["Who pays", "who-pays"],
    ["What happens next", "what-next"],
  ]);
  const text = sections.map((section) => section.text).join(" ");
  assert.doesNotMatch(text, /Sign up to our newsletter|Home/);
  assert.ok(!sections.some(({ heading }) => heading === title));
});

test("the word count is measured from the sections rather than taken from anywhere else", () => {
  const { sections, wordCount } = articleOf(read(NEWS_PAGE));
  assert.equal(wordCount, sections.map(({ text }) => text).join(" ").split(/\s+/).length);
});

test("a blog with no structured data falls back to its meta tags", () => {
  const article = articleOf(read(BLOG_PAGE, "https://sam.example.org/cold-showers"));
  assert.equal(article.author, "Sam Field");
  assert.equal(article.publishedAt, "2026-08-14T07:00:00.000Z");
  assert.equal(article.sections.length, 1);
  assert.equal(article.sections[0]!.heading, null);
});

test("a page built by script reads the same, because this runs on what the browser ended up with", () => {
  const page = pageFrom(`<!doctype html><html><head><title>Rendered late</title></head><body><div id="root"></div></body></html>`);
  page.getElementById("root")!.innerHTML = `<article><h1>Rendered late</h1>${paragraphs(10)}</article>`;
  assert.equal(readArticle(page, page.location.href).status, "read");
});

test("a page declared paywalled that shows only a teaser is named as paywalled", () => {
  const teaser = read(PAYWALLED_PAGE);
  assert.equal(teaser.status === "failed" && teaser.reason, "paywalled");
  assert.ok(teaser.status === "failed" && (teaser.shownWords ?? 0) > 0, "the words it did show are counted, for the reader");
});

test("a paywalled page the reader can see in full is read, which is why this runs in their tab", () => {
  assert.ok(articleOf(read(UNLOCKED_PAGE)).wordCount > 400);
});

test("a page with no article says so rather than summarising a shop's menu", () => {
  assert.deepEqual(read(NO_ARTICLE_PAGE), { status: "failed", reason: "nothing-readable" });
});

test("reading leaves the reader's page exactly as it was", () => {
  const page = pageFrom(NEWS_PAGE);
  const before = page.documentElement.outerHTML;
  readArticle(page, page.location.href);
  assert.equal(page.documentElement.outerHTML, before);
});

test("unparseable structured data is ignored rather than failing the read", () => {
  const broken = NEWS_PAGE.replace('{"@context"', '{not json "@context"');
  const article = articleOf(read(broken));
  assert.equal(article.siteName, "Example News");
  assert.equal(article.publishedAt, null);
});

test("an essay laid out with line breaks instead of paragraphs is still an article", () => {
  assert.ok(articleOf(read(LINE_BROKEN_ESSAY, "https://essays.example/great-work")).wordCount > 500);
});

test("a front page is refused however much text it has, because headlines are not sentences", () => {
  assert.deepEqual(read(FRONT_PAGE, "https://news.example.com/"), { status: "failed", reason: "nothing-readable" });
});
