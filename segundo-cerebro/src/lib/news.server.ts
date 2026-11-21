import { decodeHTML } from "entities";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { DollarQuote, NewsItem } from "./news-sources";

const itemSchema = z.object({ title: z.string(), link: z.string().url(), pubDate: z.string().optional() });
const feedSchema = z.object({ rss: z.object({ channel: z.object({ item: z.array(z.unknown()) }) }) });
export function parseNewsFeed(xml: string, source: string): NewsItem[] {
  const parsed: unknown = new XMLParser({ ignoreAttributes: true, processEntities: true, isArray: name => name === "item" }).parse(xml);
  const data = feedSchema.parse(parsed);
  return data.rss.channel.item.flatMap(raw => {
    const item = itemSchema.safeParse(raw);
    if (!item.success || !item.data.link.startsWith("https://")) return [];
    const date = item.data.pubDate ? new Date(item.data.pubDate) : null;
    return [{ source, title: decodeHTML(item.data.title).replace(/<[^>]*>/g, "").trim(), url: item.data.link, published: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null }];
  }).slice(0, 10);
}
export function parseDollarQuote(raw: unknown): DollarQuote {
  const rows = z.array(z.object({ data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/), valor: z.string() })).min(1).parse(raw);
  const row = rows[0];
  if (!row) throw new Error("Cotação vazia");
  const value = Number(row.valor.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) throw new Error("Cotação inválida");
  return { date: row.data, value };
}