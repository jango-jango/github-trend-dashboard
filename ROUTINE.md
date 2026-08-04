# Claude Code Routine（任意）

主経路は GitHub Actions（`.github/workflows/weekly-update.yml`）。
こちらは、自動生成コメントを人間向けの長め解説に差し替えたいとき用。

スケジュール例: 毎週月曜 09:30（Asia/Tokyo）※Actions のあと

```
github-trend-dashboard の週次コメントを磨く。

1. 最新の data/weekly.json を読む（repos と既存 trendComment）。
2. 日本語で傾向コメントを 3〜5 行に書き直す。
   - 言語・テーマ・用途の偏りを述べる
   - 個別リポジトリの宣伝にならないよう、横断的な傾向に留める
   - 推測で断定しない
3. trendComment だけ更新し、updatedAt / repos は維持する。
4. コミット: chore: refresh weekly trend comment
5. push する。

AI日次ニュースは対象外。
```
