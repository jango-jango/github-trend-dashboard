#!/usr/bin/env node
/**
 * Fetch GitHub Trending (weekly) Top N into data/weekly.json.
 * Scrapes https://github.com/trending?since=weekly — structure may change.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "data", "weekly.json");
const SOURCE = "https://github.com/trending?since=weekly";
const TOP_N = 10;
const UA =
  "Mozilla/5.0 (compatible; github-trend-dashboard/1.0; +https://github.com/trending)";

function parseCount(raw) {
  if (!raw) return null;
  return Number(String(raw).replace(/,/g, ""));
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRepos(html) {
  const articles = html.match(/<article[\s\S]*?<\/article>/g) ?? [];
  const repos = [];

  for (const article of articles) {
    const h2 = article.match(/<h2[\s\S]*?<\/h2>/);
    if (!h2) continue;

    const nameMatch = h2[0].match(/href="\/([^"/]+\/[^"/]+)"/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    if (name.startsWith("trending/") || name.startsWith("apps/")) continue;

    const descMatch = article.match(
      /<p class="[^"]*color-fg-muted[^"]*"[\s\S]*?>([\s\S]*?)<\/p>/,
    );
    const description = descMatch ? stripTags(descMatch[1]) : "";

    const langMatch = article.match(
      /itemprop="programmingLanguage">([^<]+)/,
    );
    const language = langMatch ? langMatch[1].trim() : null;

    const starsMatch = article.match(
      /href="[^"]*\/stargazers"[^>]*>[\s\S]*?([\d,]+)\s*<\/a>/,
    );
    const forksMatch = article.match(
      /href="[^"]*\/forks"[^>]*>[\s\S]*?([\d,]+)\s*<\/a>/,
    );
    const weekMatch = article.match(/([\d,]+)\s+stars this week/);

    repos.push({
      rank: repos.length + 1,
      name,
      url: `https://github.com/${name}`,
      description,
      language,
      stars: parseCount(starsMatch?.[1]),
      forks: parseCount(forksMatch?.[1]),
      starsThisPeriod: parseCount(weekMatch?.[1]),
    });

    if (repos.length >= TOP_N) break;
  }

  return repos;
}

const THEME_RULES = [
  {
    label: "コーディングエージェント／スキル",
    re: /\b(agent|skill|claude|copilot|llm|harness|cowork|aisuite|openwork)\b|エージェント|スキル|ハーネス/i,
  },
  {
    label: "学習・チュートリアル",
    re: /\b(beginner|tutorial|course|lesson|learn|guide)\b|学習|入門|チュートリアル/i,
  },
  {
    label: "ローカル／自前ホストAI",
    re: /\b(self[- ]?host|local|companion|ollama|airi)\b|自前|ローカル/i,
  },
  {
    label: "セキュリティ／リバース",
    re: /\b(security|pentest|reverse|vuln|exploit)\b|セキュリティ|リバース|浸透/i,
  },
  {
    label: "エディタ／開発ツール",
    re: /\b(editor|ide|devtools|cli)\b|エディタ|開発ツール/i,
  },
];

function topLanguageLine(repos) {
  const counts = new Map();
  for (const r of repos) {
    const lang = r.language || "Unknown";
    counts.set(lang, (counts.get(lang) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const head = ranked
    .slice(0, 3)
    .map(([lang, n]) => `${lang}(${n})`)
    .join("、");
  return `言語の偏り: ${head}。`;
}

function themeLine(repos) {
  const hits = [];
  for (const rule of THEME_RULES) {
    const matched = repos.filter((r) =>
      rule.re.test(`${r.name} ${r.description || ""}`),
    );
    if (matched.length > 0) hits.push([rule.label, matched.length]);
  }
  hits.sort((a, b) => b[1] - a[1]);
  if (hits.length === 0) {
    return "テーマは特定の一極に寄らず、用途が分散している。";
  }
  const top = hits
    .slice(0, 3)
    .map(([label, n]) => `${label}(${n})`)
    .join("、");
  return `テーマの偏り: ${top}。個別リポジトリの評価ではなく横断的な傾向として見る。`;
}

function momentumLine(repos) {
  const deltas = repos
    .map((r) => r.starsThisPeriod)
    .filter((n) => typeof n === "number");
  if (deltas.length === 0) return "週間スター増分のデータは取得できなかった。";
  const max = Math.max(...deltas);
  const median = [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)];
  return `週間スター増分は最大 +${max.toLocaleString("en-US")}、中央値 +${median.toLocaleString("en-US")}。`;
}

function buildTrendComment(repos) {
  return [topLanguageLine(repos), themeLine(repos), momentumLine(repos)].join(
    "\n",
  );
}

async function main() {
  const keepComment = process.argv.includes("--keep-comment");

  const res = await fetch(SOURCE, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    throw new Error(`Fetch failed: HTTP ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const repos = parseRepos(html);

  if (repos.length === 0) {
    console.error(
      "Parsed 0 repos. HTML structure may have changed. Not overwriting with empty data.",
    );
    process.exit(2);
  }

  let trendComment = buildTrendComment(repos);
  if (keepComment && existsSync(OUT)) {
    try {
      const prev = JSON.parse(readFileSync(OUT, "utf8"));
      if (typeof prev.trendComment === "string" && prev.trendComment.trim()) {
        trendComment = prev.trendComment;
      }
    } catch {
      /* use generated */
    }
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    period: "weekly",
    sourceUrl: SOURCE,
    count: repos.length,
    trendComment,
    repos,
  };

  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${repos.length} repos → ${OUT}`);
  console.log("--- trendComment ---");
  console.log(trendComment);
  for (const r of repos) {
    console.log(
      `${String(r.rank).padStart(2)}. +${r.starsThisPeriod ?? "?"}  ${r.name}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
