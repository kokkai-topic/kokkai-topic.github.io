# 国会トピックマップ

国会会議録から具体的な争点を抽出し、議論量（文字数）の割合を可視化する静的サイト。
設計の全決定事項は DESIGN.md を参照。

## 構成

- pipeline/ — データ処理 (TypeScript、tsx で直接実行。ビルド不要)
- data/ — コミットされる派生データ（トピック台帳・割当・集計）
- cache/ — git管理外（生の会議録・LLMバッチ入出力）
- site/ — Astro製サイト (GitHub Pages へ自動デプロイ)

## コマンド（すべてリポジトリルートで実行）

- `npm run fetch` — 新着会議録を cache/raw/ へ取得（`-- --from YYYY-MM-DD --until YYYY-MM-DD` で期間指定）
- `npm run batch` — 未分類会議のLLM入力バッチを cache/llm/input/ へ生成
- `npm run ingest -- --batch <batchId>` — LLM出力を検証して台帳・割当に反映
- `npm run aggregate` — data/aggregates/ と data/topic-details/ を再生成
- `npm run merge-topics -- --map <file>` — トピック統合（台帳掃除）
- `npm test` — パイプラインのユニットテスト
- `npm --prefix site run dev` / `npm --prefix site run build` — サイト開発・ビルド

## 週次更新

`.claude/skills/update-data/SKILL.md` の手順に従う。
LLM分類はAPIではなく Claude Code セッション内で行う（コードからLLMを呼ばない）。
