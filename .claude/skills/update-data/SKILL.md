---
name: update-data
description: 国会会議録の週次データ更新。新着会議録の取得→LLM分類→集計→コミットまでを一括実行する。「データ更新」「週次更新」で起動。
---

# 週次データ更新

リポジトリルートで実行すること。LLM分類はこのClaude Codeセッション内で行う（外部APIは呼ばない）。

## 手順

1. `npm run fetch` — 新着会議録を cache/raw/ に取得
2. `npm run batch` — 未分類会議のバッチを cache/llm/input/ に生成。pending batches 一覧を控える
3. 各バッチを**順番に**処理する:
   a. `data/topics.json`（トピック台帳）を読む。**前のバッチのingestで台帳が更新されるため、毎バッチ読み直すこと**
   b. `cache/llm/input/<batchId>.json` を読む
   c. 下記「分類ルール」に従い全発言にトピックを割り当て、`cache/llm/output/<batchId>.json` を書く
   d. `npm run ingest -- --batch <batchId>` を実行。エラーが出たら出力を修正して再実行
4. `npm run aggregate`
5. `npm --prefix site run build` でビルドが通ることを確認
6. `git diff --stat` を確認し、コミットしてpush（メッセージ例: `data: 2026-06-11時点までの会議録を反映`）

## 分類ルール

出力フォーマット（cache/llm/output/<batchId>.json）:

```json
{
  "batchId": "<入力と同じ値>",
  "assignments": [{ "speechId": "...", "topicId": "t0001 | other | procedural | new:1" }],
  "newTopics": [{ "tempId": "new:1", "name": "争点名", "description": "1文の説明" }]
}
```

- 入力の全発言IDを**過不足なく1回ずつ**割り当てる
- topicId は次のいずれか: 既存台帳のID ／ newTopics で提案する tempId ／ "other"（政策論点でない実質発言）／ "procedural"（機械判定をすり抜けた議事進行: 委員の紹介、休憩宣言、採決手続きなど）
- **既存トピックを最優先で再利用する**。新規作成は台帳のどのトピックにも該当しない場合のみ
- 粒度は「具体的な争点」:
  - 良い例: 「ガソリン税・暫定税率」「選択的夫婦別姓」「日米関税交渉」「マイナ保険証」
  - 悪い例: 「経済政策」（広すぎる）「○○委員の質問」（狭すぎる）
- name は20文字以内。description は争点の内容を説明する1文
- 大臣・政府参考人の答弁は、直前の質問と同じトピックに割り当てる
- 複数論点にまたがる発言は中心的な論点1つに割り当てる（1発言=1トピック）
- 確信が持てない発言は "other" に逃がす（誤った具体トピックに入れるより安全）

## 台帳の掃除（月1回程度）

1. `data/topics.json` を読み、同一争点の重複（表記揺れ）を探す
2. 統合マップ `{"統合元ID": "統合先ID"}` を `cache/merge-map.json` に書く
3. `npm run merge-topics -- --map cache/merge-map.json`
4. `npm run aggregate` で再集計し、コミット

## バックフィル（会期の遡り処理）

サブスクリプションの利用上限を考慮し、1セッションで処理するのは20バッチ程度まで。

```
npm run fetch -- --from 2026-01-26 --until 2026-02-28
npm run batch
```

のように期間を区切って取得し、数日に分けて消化する。進捗は `npm run batch` の pending 件数で確認できる。
