import { queryOptions } from "@tanstack/react-query";
import { getDailyNews } from "./news.functions";
export const newsQueryOptions = () => queryOptions({
  queryKey: ["daily-news"], queryFn: () => getDailyNews(), staleTime: 10 * 60 * 1000, retry: false,
});