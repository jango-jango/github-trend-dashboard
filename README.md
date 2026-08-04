# GitHub Weekly Trend Dashboard

GitHub Trending（weekly）上位10と短い傾向コメントを、静的1ページで見る自分用ダッシュボード。

- サイト: https://jango-jango.github.io/github-trend-dashboard/
- 仕様メモ（ローカル monorepo）: `plans/2026-08-04-github-ai-trend-dashboard.md`

## MVP スコープ

- **やる**: 週間 Top10 取得 → 傾向コメント → GitHub Pages 表示 → 最終更新日時 / 取得件数の自己診断
- **やらない**: AI 日次ニュース、日次/月間、通知、共有機能

## ローカル

```bash
npm run fetch          # data/weekly.json を更新（傾向コメントも自動生成）
npm run serve          # http://localhost:4173
```

`npm run fetch -- --keep-comment` で既存コメントを維持できる。

## データスキーマ (`data/weekly.json`)

| フィールド | 説明 |
|---|---|
| `updatedAt` | ISO8601。自己診断の鮮度判定に使う |
| `count` | 取得件数（0 なら画面が赤く警告） |
| `trendComment` | 3行程度の傾向コメント（言語・テーマ・増分） |
| `repos[]` | rank / name / url / description / language / stars / forks / starsThisPeriod |

## 自動更新

GitHub Actions が毎週月曜 09:00 JST（`0 0 * * 1` UTC）に:

1. `node scripts/fetch-trending.mjs`
2. `data/weekly.json` をコミット＆push
3. Pages ワークフローが追従してサイト更新

手動実行: Actions → **Weekly trending update** → Run workflow

Claude Code Routine は任意（より長い解説コメントに差し替えたいとき）。雛形は [`ROUTINE.md`](ROUTINE.md)。

## 中止条件

- 取得 0 件が 3 回連続 → スクレイプ先の構造変化とみなし見直し
- 運用開始から 2 週間一度も見ていない → park（AI ニュースには進まない）
