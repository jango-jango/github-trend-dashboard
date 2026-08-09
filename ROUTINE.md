# Claude Code Routine（任意）

主経路は GitHub Actions（`.github/workflows/weekly-update.yml`）。
こちらは、自動生成の「今週の読み」を人間向けに磨きたいとき用。

スケジュール例: 毎週月曜 09:30（Asia/Tokyo）※Actions のあと

```
github-trend-dashboard の週次 headline を磨く。

1. 最新の data/weekly.json を読む（repos と insights）。
2. insights.headline だけを日本語 1〜2 文に書き直す。
   - 言語・テーマの偏りから「今週のシグナル」を述べる
   - 個別リポジトリの宣伝にならないよう、横断的な傾向に留める
   - 推測で断定しない
3. insights.languages / themes / momentum / updatedAt / repos は維持する。
4. コミット: chore: refresh weekly trend headline
5. push する。

AI日次ニュースは対象外。
```
