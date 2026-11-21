import { createServerFn } from "@tanstack/react-start";
import { NEWS_SOURCES, type DollarQuote, type NewsSourceResult } from "./news-sources";
import { logWarning } from "./error-capture";

// Public information only; fixed upstream URLs prevent user-controlled fetches.
export const getDailyNews = createServerFn({ method: "GET" }).handler(async () => {
  const { parseNewsFeed, parseDollarQuote } = await import("./news.server");
  const sources: Promise<NewsSourceResult[]> = Promise.all(NEWS_SOURCES.map(async source => {
    if (!source.feed) return { id: source.id, items: [], error: "Leitura no site; feed público não disponível." };
    try {
      const response = await fetch(source.feed, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/rss+xml, application/xml, text/xml" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      const items = parseNewsFeed(xml, source.id);
      return { id: source.id, items, error: items.length ? null : "Nenhuma notícia recebida desta fonte." };
    } catch (error) {
      logWarning("News source unavailable", source.id, error instanceof Error ? error.message : "feed error");
      return { id: source.id, items: [], error: "Não foi possível atualizar esta fonte. Consulte o site original." };
    }
  }));
  const dollar = async (): Promise<{ quote: DollarQuote | null; error: string | null }> => {
    try {
      const response = await fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json", { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw: unknown = await response.json();
      return { quote: parseDollarQuote(raw), error: null };
    } catch { return { quote: null, error: "Cotação indisponível no Banco Central neste momento." }; }
  };
  const [feeds, exchange] = await Promise.all([sources, dollar()]);
  return { sources: feeds, dollar: exchange, fetchedAt: new Date().toISOString() };
});