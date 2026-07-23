import type { GenerateRequest, ResearchPacket, ResearchSource } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; TrizzyWriterAandR/1.0; +https://www.treytrizzy.com)";
const REQUEST_TIMEOUT_MS = 8000;
const MAX_SOURCES = 14;

const FOCUS_QUERIES: Record<string, string[]> = {
  "career-audit": [
    'independent R&B artist development streaming audience trends',
    'music industry independent artist direct to fan trends',
  ],
  "song-evaluation": [
    'Trap R&B song trends streaming short form video',
    'R&B hit songwriting hook structure current trends',
  ],
  "release-strategy": [
    'independent music release strategy streaming TikTok YouTube Shorts',
    'music release marketing fan conversion pre save current trends',
  ],
  "trace-development": [
    'R&B boy group current market trends younger audience',
    'virtual music group AI artist disclosure music industry',
  ],
  "brand-content": [
    'music artist content strategy short form fan conversion current trends',
    'independent artist brand storytelling audience growth',
  ],
  "deal-business": [
    'music distribution deal artist rights AI clause current',
    'record deal publishing master ownership independent artist current',
  ],
  "first-run-assignment": [
    'independent R&B artist development streaming audience trends',
    'virtual music group AI artist disclosure music industry',
  ],
};

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
    ndash: "-",
    mdash: "-",
  };

  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

function cleanText(value: string, maxLength = 420): string {
  return decodeEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).slice(0, maxLength);
}

function firstMatch(value: string, pattern: RegExp): string {
  return pattern.exec(value)?.[1]?.trim() || "";
}

function normalizeUrl(value: string): string {
  const decoded = decodeEntities(value.trim());
  const absolute = decoded.startsWith("//") ? `https:${decoded}` : decoded;

  try {
    const url = new URL(absolute);
    const redirected = url.searchParams.get("uddg");
    return redirected ? decodeURIComponent(redirected) : url.toString();
  } catch {
    return absolute;
  }
}

function sourceNameFromUrl(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Web result";
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  }

  return response.text();
}

function parseDuckDuckGo(html: string, query: string): ResearchSource[] {
  const blocks = html.split(/class=["']result(?:\s+results_links[^"']*)?["']/i).slice(1);
  const sources: ResearchSource[] = [];

  for (const block of blocks) {
    const anchor = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(
      block,
    );
    if (!anchor) continue;

    const url = normalizeUrl(anchor[1]);
    const title = cleanText(anchor[2], 220);
    if (!url.startsWith("http") || !title) continue;

    const snippet = firstMatch(
      block,
      /<(?:a|div)[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i,
    );

    sources.push({
      id: "",
      title,
      url,
      source: sourceNameFromUrl(url),
      excerpt: cleanText(snippet || title),
      query,
      kind: "web",
    });

    if (sources.length >= 5) break;
  }

  return sources;
}

function parseGoogleNewsRss(xml: string, query: string): ResearchSource[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  const sources: ResearchSource[] = [];

  for (const item of items) {
    const title = cleanText(firstMatch(item, /<title>([\s\S]*?)<\/title>/i), 220);
    const url = normalizeUrl(firstMatch(item, /<link>([\s\S]*?)<\/link>/i));
    const publisher = cleanText(
      firstMatch(item, /<source(?:\s+url=["'][^"']+["'])?>([\s\S]*?)<\/source>/i),
      120,
    );
    const description = cleanText(
      firstMatch(item, /<description>([\s\S]*?)<\/description>/i),
    );
    const publishedRaw = cleanText(firstMatch(item, /<pubDate>([\s\S]*?)<\/pubDate>/i), 120);
    const publishedDate = publishedRaw ? new Date(publishedRaw) : null;

    if (!title || !url.startsWith("http")) continue;

    sources.push({
      id: "",
      title,
      url,
      source: publisher || sourceNameFromUrl(url),
      excerpt: description || title,
      publishedAt:
        publishedDate && !Number.isNaN(publishedDate.getTime())
          ? publishedDate.toISOString()
          : undefined,
      query,
      kind: "news",
    });

    if (sources.length >= 6) break;
  }

  return sources;
}

async function searchWeb(query: string): Promise<ResearchSource[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  return parseDuckDuckGo(await fetchText(url), query);
}

async function searchNews(query: string): Promise<ResearchSource[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=en-US&gl=US&ceid=US:en`;
  return parseGoogleNewsRss(await fetchText(url), query);
}

async function inspectOfficialPage(url: string): Promise<ResearchSource | null> {
  const html = await fetchText(url);
  const title = cleanText(
    firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || sourceNameFromUrl(url),
    220,
  );
  const description = cleanText(
    firstMatch(
      html,
      /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    ) ||
      firstMatch(
        html,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*>/i,
      ),
  );

  return {
    id: "",
    title,
    url,
    source: sourceNameFromUrl(url),
    excerpt: description || `Official page retrieved successfully from ${sourceNameFromUrl(url)}.`,
    query: "configured official source",
    kind: "official",
  };
}

function buildQueries(request: GenerateRequest): { web: string[]; news: string[] } {
  const year = new Date().getUTCFullYear();
  const focusQueries = FOCUS_QUERIES[request.consultationFocus || "career-audit"] ||
    FOCUS_QUERIES["career-audit"];

  const web = [
    '"Trey Trizzy" music artist',
    '"tracefrommemphis" OR "TRACE from Memphis" R&B',
    `${focusQueries[0]} ${year}`,
  ];

  const news = [
    `${focusQueries[1]} ${year}`,
    `music industry AI virtual artists R&B ${year}`,
  ];

  return { web, news };
}

function dedupeSources(sources: ResearchSource[]): ResearchSource[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const result: ResearchSource[] = [];

  for (const source of sources) {
    const urlKey = source.url.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
    const titleKey = source.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!urlKey || seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    result.push(source);
    if (result.length >= MAX_SOURCES) break;
  }

  return result.map((source, index) => ({ ...source, id: `R${index + 1}` }));
}

function officialUrls(): string[] {
  const configured = (process.env.TRIZZY_OFFICIAL_URLS || "https://www.treytrizzy.com")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(configured)].slice(0, 4);
}

export async function buildCurrentResearchPacket(
  request: GenerateRequest,
): Promise<ResearchPacket> {
  const asOf = new Date().toISOString();
  if (process.env.TRIZZY_RESEARCH_ENABLED?.toLowerCase() === "false") {
    return {
      asOf,
      sources: [],
      warnings: ["Live research is disabled by TRIZZY_RESEARCH_ENABLED=false."],
    };
  }

  const warnings: string[] = [];
  const queries = buildQueries(request);
  const tasks: Array<Promise<ResearchSource[]>> = [
    ...officialUrls().map(async (url) => {
      try {
        const source = await inspectOfficialPage(url);
        return source ? [source] : [];
      } catch (error) {
        warnings.push(
          `Official source ${url} could not be retrieved: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
        return [];
      }
    }),
    ...queries.web.map(async (query) => {
      try {
        return await searchWeb(query);
      } catch (error) {
        warnings.push(
          `Web search failed for "${query}": ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
        return [];
      }
    }),
    ...queries.news.map(async (query) => {
      try {
        return await searchNews(query);
      } catch (error) {
        warnings.push(
          `News search failed for "${query}": ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
        return [];
      }
    }),
  ];

  const sourceGroups = await Promise.all(tasks);
  const sources = dedupeSources(sourceGroups.flat());

  if (!sources.length) {
    warnings.push(
      "No usable current sources were retrieved. The A&R response must treat current claims as unverified.",
    );
  }

  return { asOf, sources, warnings };
}
