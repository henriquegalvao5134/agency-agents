import { describe, expect, it } from "vitest";
import { NEWS_SOURCES } from "../lib/news-sources";
import { parseDollarQuote, parseNewsFeed } from "../lib/news.server";
describe("Requested news and currency", () => {
  it("includes all six requested sources", () => {
    expect(NEWS_SOURCES.map(s => s.name)).toEqual(["Agência Brasil", "G1", "Reuters", "BBC Brasil", "Blog Google", "Blog Meta"]);
  });
  it("preserves the official dollar value and reference date", () => {
    expect(parseDollarQuote([{ data: "19/11/2026", valor: "5.8889" }])).toEqual({ date: "19/11/2026", value: 5.8889 });
  });
  it("rejects invalid rates", () => {
    expect(() => parseDollarQuote([{ data: "19/11/2026", valor: "invalid" }])).toThrow();
  });
  it("reads published headlines without interpreting their HTML", () => {
    const items = parseNewsFeed('<rss><channel><item><title><![CDATA[<b>Economia</b> &amp; tecnologia]]></title><link>https://g1.globo.com/noticia</link><pubDate>Fri, 20 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>', "g1");
    expect(items[0]).toEqual({ source: "g1", title: "Economia & tecnologia", url: "https://g1.globo.com/noticia", published: "2026-11-20T12:00:00.000Z" });
  });
  it("excludes unsafe article links", () => {
    expect(parseNewsFeed('<rss><channel><item><title>Notícia</title><link>javascript:alert(1)</link></item></channel></rss>', "g1")).toEqual([]);
  });
});