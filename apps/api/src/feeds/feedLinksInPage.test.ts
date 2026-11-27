import test from "node:test";
import assert from "node:assert/strict";
import { feedLinksInPage } from "./feedLinksInPage.js";

test("a page's RSS and Atom links are found against its address, each once, and nothing after the head is read", () => {
  const html = `<!doctype html><html><head>
    <title>A blog</title>
    <link rel="stylesheet" href="/style.css">
    <LINK REL="alternate" TYPE="application/rss+xml" title="Posts" href="/feed">
    <link rel="alternate" type="application/atom+xml" href="https://blog.example/atom.xml">
    <link rel="alternate" type="application/rss+xml" href="/feed">
    <link rel="alternate" hreflang="fr" href="/fr/">
  </head><body><link rel="alternate" type="application/rss+xml" href="/comments/feed"></body></html>`;
  assert.deepEqual(feedLinksInPage(html, "https://blog.example/2026/post"), [
    { url: "https://blog.example/feed", title: "Posts" },
    { url: "https://blog.example/atom.xml", title: null },
  ]);
});

test("a page with no feed links gives none", () => {
  assert.deepEqual(feedLinksInPage("<html><head><title>x</title></head><body></body></html>", "https://site.example/"), []);
});
