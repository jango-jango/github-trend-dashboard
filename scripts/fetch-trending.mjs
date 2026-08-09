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
    id: "agent-skills",
    label: "コーディングエージェント／スキル",
    re: /\b(agent|skill|claude|copilot|llm|harness|cowork|aisuite|openwork)\b|エージェント|スキル|ハーネス/i,
  },
  {
    id: "learning",
    label: "学習・チュートリアル",
    re: /\b(beginners?|tutorials?|courses?|lessons?|learn(?:ing)?|guides?)\b|学習|入門|チュートリアル/i,
  },
  {
    id: "local-ai",
    label: "ローカル／自前ホストAI",
    re: /\b(self[- ]?host|local|companion|ollama|airi)\b|自前|ローカル/i,
  },
  {
    id: "security",
    label: "セキュリティ／リバース",
    re: /\b(security|pentest|reverse|vuln|exploit)\b|セキュリティ|リバース|浸透/i,
  },
  {
    id: "devtools",
    label: "エディタ／開発ツール",
    re: /\b(editor|ide|devtools|cli)\b|エディタ|開発ツール/i,
  },
];

function buildLanguages(repos) {
  const counts = new Map();
  for (const r of repos) {
    const lang = r.language || "Unknown";
    if (!counts.has(lang)) counts.set(lang, { name: lang, count: 0, repos: [] });
    const entry = counts.get(lang);
    entry.count += 1;
    entry.repos.push(r.name);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildThemes(repos) {
  const themes = [];
  for (const rule of THEME_RULES) {
    const matched = repos.filter((r) =>
      rule.re.test(`${r.name} ${r.description || ""}`),
    );
    if (matched.length === 0) continue;
    themes.push({
      id: rule.id,
      label: rule.label,
      count: matched.length,
      repos: matched.map((r) => r.name),
    });
  }
  themes.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"));
  return themes;
}

function buildMomentum(repos) {
  const deltas = repos
    .map((r) => r.starsThisPeriod)
    .filter((n) => typeof n === "number");
  if (deltas.length === 0) {
    return { max: null, median: null };
  }
  const sorted = [...deltas].sort((a, b) => a - b);
  return {
    max: Math.max(...deltas),
    median: sorted[Math.floor(sorted.length / 2)],
  };
}

function autoHeadline(themes, languages) {
  if (themes.length > 0) {
    const top = themes[0];
    return `${top.label}が ${top.count} 件（上位の中心）。横断的な偏りとして見る。`;
  }
  if (languages.length > 0) {
    const top = languages[0];
    return `言語は ${top.name} が最多（${top.count}）。テーマは分散。`;
  }
  return "今週の偏りは読み取りにくかった。";
}

function buildInsights(repos, headline) {
  const languages = buildLanguages(repos);
  const themes = buildThemes(repos);
  const momentum = buildMomentum(repos);
  return {
    headline: headline ?? autoHeadline(themes, languages),
    languages,
    themes,
    momentum,
  };
}

/** Flat comment for logs / legacy readers */
function insightsToComment(insights) {
  const lang = insights.languages
    .slice(0, 3)
    .map((l) => `${l.name}(${l.count})`)
    .join("、");
  const theme =
    insights.themes.length === 0
      ? "テーマは分散"
      : insights.themes
          .slice(0, 3)
          .map((t) => `${t.label}(${t.count})`)
          .join("、");
  const mom =
    insights.momentum.max == null
      ? "週間スター増分なし"
      : `週間スター増分 最大 +${insights.momentum.max.toLocaleString("en-US")}、中央値 +${insights.momentum.median.toLocaleString("en-US")}`;
  return `${insights.headline}\n言語: ${lang || "—"}\nテーマ: ${theme}\n${mom}`;
}

function readPrev() {
  if (!existsSync(OUT)) return null;
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const keepHeadline =
    process.argv.includes("--keep-headline") ||
    process.argv.includes("--keep-comment");
  const rebuildOnly = process.argv.includes("--rebuild-insights");

  let repos;
  let updatedAt = new Date().toISOString();
  let sourceUrl = SOURCE;
  const prev = readPrev();

  if (rebuildOnly) {
    if (!prev?.repos?.length) {
      console.error("No existing repos in data/weekly.json to rebuild.");
      process.exit(2);
    }
    repos = prev.repos;
    updatedAt = prev.updatedAt || updatedAt;
    sourceUrl = prev.sourceUrl || SOURCE;
  } else {
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
    repos = parseRepos(html);

    if (repos.length === 0) {
      console.error(
        "Parsed 0 repos. HTML structure may have changed. Not overwriting with empty data.",
      );
      process.exit(2);
    }
  }

  let headline;
  if (keepHeadline && prev?.insights?.headline?.trim()) {
    headline = prev.insights.headline.trim();
  } else if (keepHeadline && prev?.trendComment?.trim()) {
    // legacy: first line of old comment as headline
    headline = prev.trendComment.trim().split("\n")[0];
  }

  const insights = buildInsights(repos, headline);
  const trendComment = insightsToComment(insights);

  const payload = {
    updatedAt,
    period: "weekly",
    sourceUrl,
    count: repos.length,
    insights,
    trendComment,
    repos,
  };

  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${repos.length} repos → ${OUT}${rebuildOnly ? " (insights only)" : ""}`);
  console.log("--- headline ---");
  console.log(insights.headline);
  console.log("--- themes ---");
  for (const t of insights.themes) {
    console.log(`  ${t.label} (${t.count}): ${t.repos.join(", ")}`);
  }
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
