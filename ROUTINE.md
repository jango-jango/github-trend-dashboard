# Claude Code Routine（任意）

主経路は GitHub Actions（`.github/workflows/weekly-update.yml`）。
こちらは、自動生成の「今週の読み」と各リポジトリの日本語要約を磨きたいとき用。

スケジュール例: 毎週月曜 09:30（Asia/Tokyo）※Actions のあと

```
github-trend-dashboard の週次テキストを磨く。

1. 最新の data/weekly.json を読む（repos と insights）。
2. insights.headline を日本語 1〜2 文に書き直す。
   - 言語・テーマの偏りから「今週のシグナル」を述べる
   - 個別リポジトリの宣伝にならないよう、横断的な傾向に留める
   - 推測で断定しない
3. 各 repos[].summaryJa を、何をするものか分かる日本語 1 文に整える。
   - 英語 description の直訳ではなく、用途が伝わる要約にする
   - 宣伝口調・過度な断定は避ける
   - description / 数値フィールドは変えない
4. insights.languages / themes / momentum / updatedAt は維持する。
5. コミット: chore: refresh weekly trend copy
6. push する。

AI日次ニュースは対象外。
```
