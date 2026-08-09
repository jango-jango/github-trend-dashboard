# GitHub Weekly Trend Dashboard

GitHub Trending（weekly）上位10を、言語・テーマの偏りと連動させて見る自分用ダッシュボード。

- サイト: https://jango-jango.github.io/github-trend-dashboard/
- 仕様メモ（ローカル monorepo）: `plans/2026-08-04-github-ai-trend-dashboard.md`

## MVP スコープ

- **やる**: 週間 Top10 取得 → 構造化 insights（headline / 言語 / テーマ）→ 1画面ファセット表示 → 最終更新 / 取得件数の自己診断
- **やらない**: AI 日次ニュース、日次/月間、通知、共有機能、タブ分割

## 画面

- **今週の読み** … 1〜2文の headline（自動生成。ROUTINE で磨ける）
- **テーマチップ / 言語バー** … 押すと下のリストがハイライト連動
- **Repositories** … 既定はテーマ別。順位表示にも切替可

## ローカル

```bash
npm run fetch          # data/weekly.json を更新（insights も自動生成）
npm run serve          # http://localhost:4173
```

オプション:

- `npm run fetch -- --keep-headline` … 既存の headline を維持（旧 `--keep-comment` も可）
- `npm run fetch -- --rebuild-insights` … 取得せず、既存 repos から insights だけ再計算
- `npm run fetch -- --fill-summaries` … 欠けている `summaryJa` だけ補完（機械翻訳・既存は維持）

## データスキーマ (`data/weekly.json`)

| フィールド | 説明 |
|---|---|
| `updatedAt` | ISO8601。自己診断の鮮度判定に使う |
| `count` | 取得件数（0 なら画面が赤く警告） |
| `insights.headline` | 今週の読み（1〜2文） |
| `insights.languages[]` | name / count / repos |
| `insights.themes[]` | id / label / count / repos |
| `insights.momentum` | max / median（週間スター増分） |
| `trendComment` | ログ・互換用の平坦テキスト（画面は `insights` を使う） |
| `repos[]` | rank / name / url / description / **summaryJa** / language / stars / forks / starsThisPeriod |

画面は `summaryJa`（日本語要約）を主表示し、英語 `description` は補助表示。週次取得時は同名リポジトリの `summaryJa` を引き継ぎ、新規のみ機械翻訳で埋める。

## 自動更新

GitHub Actions が毎週月曜 09:00 JST（`0 0 * * 1` UTC）に:

1. `node scripts/fetch-trending.mjs`
2. `data/weekly.json` をコミット＆push
3. Pages ワークフローが追従してサイト更新

手動実行: Actions → **Weekly trending update** → Run workflow

Claude Code Routine は任意（headline を磨きたいとき）。雛形は [`ROUTINE.md`](ROUTINE.md)。

## 中止条件

- 取得 0 件が 3 回連続 → スクレイプ先の構造変化とみなし見直し
- 運用開始から 2 週間一度も見ていない → park（AI ニュースには進まない）
