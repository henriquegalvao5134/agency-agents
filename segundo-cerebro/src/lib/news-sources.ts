export const NEWS_SOURCES = [
  { id: "agencia", name: "Agência Brasil", url: "https://agenciabrasil.ebc.com.br/", feed: "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml" },
  { id: "g1", name: "G1", url: "https://g1.globo.com/", feed: "https://g1.globo.com/rss/g1/" },
  { id: "reuters", name: "Reuters", url: "https://www.reuters.com/", feed: null },
  { id: "bbc", name: "BBC Brasil", url: "https://www.bbc.com/portuguese", feed: "https://feeds.bbci.co.uk/portuguese/rss.xml" },
  { id: "google", name: "Blog Google", url: "https://blog.google/intl/pt-br/", feed: "https://blog.google/intl/pt-br/rss/" },
  { id: "meta", name: "Blog Meta", url: "https://about.fb.com/news/", feed: "https://about.fb.com/news/feed/" },
] as const;
export type NewsItem = { source: string; title: string; url: string; published: string | null };
export type NewsSourceResult = { id: string; items: NewsItem[]; error: string | null };
export type DollarQuote = { date: string; value: number };