import { tool } from "ai";
import { z } from "zod/v4";
import { readConfig } from "@/lib/config";
import type { ToolsConfig } from "@/lib/config/types";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const SEARXNG_TIMEOUT_MS = 8000;
const TAVILY_TIMEOUT_MS = 10000;
const MAX_RESULTS = 5;

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
}

interface SearXNGResult {
  title: string;
  url: string;
  content?: string;
}

interface SearXNGResponse {
  results: SearXNGResult[];
}

function formatResults(
  results: Array<{ title: string; url: string; content: string }>,
  answer?: string,
  source?: string,
): string {
  const lines: string[] = [];
  if (source) lines.push(`*Source: ${source}*\n`);
  if (answer) lines.push(`**Summary:** ${answer}\n`);
  for (const r of results) {
    lines.push(`### [${r.title}](${r.url})`);
    if (r.content) lines.push(r.content.trim());
    lines.push("");
  }
  return lines.join("\n").trim();
}

async function searchTavily(
  query: string,
  apiKey: string,
  maxResults: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TAVILY_TIMEOUT_MS);
  try {
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        include_answer: true,
        search_depth: "basic",
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return "TAVILY_AUTH_ERROR";
      }
      return null;
    }
    const data = (await res.json()) as TavilyResponse;
    if (!data.results?.length) return null;
    const mapped = data.results.slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    }));
    return formatResults(mapped, data.answer, "Tavily");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function searchSearXNG(
  query: string,
  baseUrl: string,
  maxResults: number,
): Promise<string | null> {
  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "auto");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARXNG_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as SearXNGResponse;
    if (!data.results?.length) return null;
    const mapped = data.results.slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content ?? "",
    }));
    const instance = new URL(baseUrl).hostname;
    return formatResults(mapped, undefined, `SearXNG (${instance})`);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const webSearchTool = tool({
  description:
    "Search the web for current information. Returns a list of relevant results with titles, URLs, and content snippets. " +
    "Use this when the user asks about recent events, current data, or anything that may not be in your training data.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    maxResults: z
      .number()
      .optional()
      .describe(`Number of results to return (default ${MAX_RESULTS}, max 10)`),
  }),
  execute: async ({ query, maxResults = MAX_RESULTS }) => {
    const clampedMax = Math.min(Math.max(1, maxResults), 10);

    let config: ToolsConfig;
    try {
      config = await readConfig<ToolsConfig>("tools");
    } catch {
      config = { tavilyApiKey: "", searxngUrl: "https://searx.be" };
    }

    // Try Tavily first if key is configured
    if (config.tavilyApiKey.trim()) {
      const result = await searchTavily(query, config.tavilyApiKey.trim(), clampedMax);
      if (result === "TAVILY_AUTH_ERROR") {
        return (
          "Tavily API key is invalid or expired. " +
          "Please update it in Settings > Tools. " +
          "Falling back to SearXNG..."
        );
      }
      if (result) return result;
    }

    // Fallback: SearXNG
    const searxngUrl = config.searxngUrl.trim() || "https://searx.be";
    const fallback = await searchSearXNG(query, searxngUrl, clampedMax);
    if (fallback) return fallback;

    return (
      `No results found for "${query}". ` +
      "For better results, configure a Tavily API key in Settings > Tools. " +
      "Get a free key at https://app.tavily.com"
    );
  },
});
