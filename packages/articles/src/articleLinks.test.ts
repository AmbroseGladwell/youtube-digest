import test from "node:test";
import assert from "node:assert/strict";
import { articleLinks } from "./articleLinks.js";
import { pageFrom } from "./pageFixtures.testHelper.js";

const PAGE = "https://blog.example.com/posts/design-adhd";

const linksIn = (html: string) => articleLinks(pageFrom(`<p>${html}</p>`, PAGE).querySelector("p")!, PAGE);

test("a link named in its own words is kept, with a relative address resolved against the page", () => {
  assert.deepEqual(linksIn('See the <a href="/toolkits/neurodiversity">Neurodiversity Design Toolkit</a>.'), [
    { text: "Neurodiversity Design Toolkit", href: "https://blog.example.com/toolkits/neurodiversity" },
  ]);
});

test("an http link is dropped, since a note only ever links somewhere secure", () => {
  assert.deepEqual(linksIn('<a href="http://old.example.org/guide">The old accessibility guide</a>'), []);
});

test("a link that only says here, more or its own address is dropped", () => {
  assert.deepEqual(
    linksIn(
      '<a href="https://a.example/1">here</a> <a href="https://a.example/2">Read more</a> <a href="https://a.example/3">https://a.example/3</a> <a href="https://a.example/4">[4]</a>',
    ),
    [],
  );
});

test("a link back into the same page, or to the site's front page, is not a resource", () => {
  assert.deepEqual(
    linksIn('<a href="#wrapping-up">Wrapping up the guide</a> <a href="/">Smart Interface Design</a> <a href="?ref=x">This very guide</a>'),
    [],
  );
});

test("a link elsewhere on the same site is kept, and its fragment dropped", () => {
  assert.deepEqual(linksIn('<a href="/posts/dyslexia#intro">Designing for dyslexia</a>'), [
    { text: "Designing for dyslexia", href: "https://blog.example.com/posts/dyslexia" },
  ]);
});

test("link text loses square brackets, so it can't break a Markdown link", () => {
  assert.deepEqual(linksIn('<a href="https://w3.example/coga">[W3C] Cognitive accessibility</a>'), [
    { text: "W3C Cognitive accessibility", href: "https://w3.example/coga" },
  ]);
});
