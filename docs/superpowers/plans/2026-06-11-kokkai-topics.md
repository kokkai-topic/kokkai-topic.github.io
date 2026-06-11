# 国会トピックマップ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 国会会議録APIから発言を取得し、LLM（Claude Codeセッション内）で具体的争点に分類し、議論量の割合をツリーマップで可視化する静的サイトを構築・公開する。

**Architecture:** TypeScriptパイプライン（fetch→batch→LLM分類→ingest→aggregate）が派生JSONを生成し、Astro+EChartsの静的サイトがそれを表示。LLM分類はAPIではなくClaude Codeセッション内で実行（入出力はJSONファイル経由）。GitHub Pagesへ自動デプロイ。詳細な設計判断は `DESIGN.md` 参照。

**Tech Stack:** TypeScript (tsx実行), vitest, Astro 5, ECharts 5, GitHub Pages + Actions。リポジトリ作業名: `kokkai-topics`、サイト作業名:「国会トピックマップ」（変更可）。

**前提:** 作業ディレクトリ `C:\Users\81804\Desktop\40.サイト作成\01.国会議論割合` がリポジトリルートになる。`DESIGN.md` が既に存在する。全コマンドはリポジトリルートで実行。

**データフロー:**

```
国会会議録API → cache/raw/{issueID}.json          (git管理外)
  → batch → cache/llm/input/{batchId}.json        (git管理外)
  → [Claude Codeが分類] → cache/llm/output/{batchId}.json
  → ingest → data/topics.json (台帳) + data/assignments/{issueID}.json
  → aggregate → data/aggregates/ + data/topic-details/
  → Astroビルド (site/) → GitHub Pages
```

---

### Task 1: プロジェクト初期化

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `data/meta.json`, `data/topics.json`, `CLAUDE.md`

- [ ] **Step 1: git初期化**

```bash
git init -b main
```

- [ ] **Step 2: package.json を作成**

```json
{
  "name": "kokkai-topics",
  "private": true,
  "type": "module",
  "scripts": {
    "fetch": "tsx pipeline/src/fetch.ts",
    "batch": "tsx pipeline/src/batch.ts",
    "ingest": "tsx pipeline/src/ingest.ts",
    "aggregate": "tsx pipeline/src/aggregate.ts",
    "merge-topics": "tsx pipeline/src/merge-topics.ts",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: 開発依存をインストール**

```bash
npm install -D typescript tsx vitest @types/node
```

- [ ] **Step 4: tsconfig.json を作成**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["pipeline/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 5: vitest.config.ts を作成**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["pipeline/tests/**/*.test.ts"] },
});
```

- [ ] **Step 6: .gitignore を作成**

```
node_modules/
cache/
site/dist/
site/.astro/
site/public/data/
```

- [ ] **Step 7: 初期データファイルを作成**

`data/meta.json`（sessionStartDateはTask 11で実際の召集日に更新する）:

```json
{
  "sessionStartDate": "2026-01-01",
  "sessionLabel": "2026年通常国会",
  "fetchWindowDays": 45,
  "ingestedBatches": []
}
```

`data/topics.json`:

```json
{
  "nextId": 1,
  "topics": []
}
```

- [ ] **Step 8: CLAUDE.md を作成**

```markdown
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
```

- [ ] **Step 9: コミット**

```bash
git add -A
git commit -m "chore: プロジェクト初期化（設計書・パイプライン土台・初期データ）"
```

---

### Task 2: 型定義とISO週ユーティリティ

**Files:**
- Create: `pipeline/src/types.ts`, `pipeline/src/week.ts`
- Test: `pipeline/tests/week.test.ts`

- [ ] **Step 1: 型定義 pipeline/src/types.ts を作成**

```ts
export interface SpeechRecord {
  speechId: string;
  issueId: string;
  date: string; // YYYY-MM-DD
  house: string; // 衆議院 | 参議院
  meeting: string;
  speaker: string;
  group: string | null; // 会派
  position: string | null;
  chars: number; // 空白除去後の文字数（集計単位）
  text: string;
  url: string; // 国会会議録検索システムの原文URL
  procedural: boolean;
}

export interface Topic {
  id: string; // t0001 形式
  name: string;
  description: string;
  firstSeen: string; // YYYY-MM-DD
}

export interface Registry {
  nextId: number;
  topics: Topic[];
}

/** topicId は Topic.id | "other" | "procedural" */
export interface Assignment {
  speechId: string;
  topicId: string;
}

export interface AssignmentFile {
  issueId: string;
  expected: number; // この会議の集計対象発言数（ヘッダ除外後）
  assignments: Assignment[];
}

export interface BatchInputSpeech {
  id: string;
  speaker: string;
  position: string | null;
  group: string | null;
  chars: number;
  text: string;
}

export interface BatchInput {
  batchId: string;
  issueId: string;
  date: string;
  house: string;
  meeting: string;
  speeches: BatchInputSpeech[];
}

export interface NewTopicProposal {
  tempId: string; // "new:1" 形式
  name: string;
  description: string;
}

export interface BatchOutput {
  batchId: string;
  assignments: Assignment[]; // topicId に tempId も書ける
  newTopics: NewTopicProposal[];
}

export interface Meta {
  sessionStartDate: string;
  sessionLabel: string;
  fetchWindowDays: number;
  ingestedBatches: string[];
}
```

- [ ] **Step 2: 失敗するテスト pipeline/tests/week.test.ts を書く**

```ts
import { describe, expect, it } from "vitest";
import { isoWeek, mondayOfIsoWeek } from "../src/week";

describe("isoWeek", () => {
  it("年初・年末の境界を正しく扱う", () => {
    expect(isoWeek("2026-06-11")).toBe("2026-W24");
    expect(isoWeek("2025-12-29")).toBe("2026-W01"); // 月曜・翌年のW01に属する
    expect(isoWeek("2026-01-04")).toBe("2026-W01");
    expect(isoWeek("2025-12-28")).toBe("2025-W52");
  });
});

describe("mondayOfIsoWeek", () => {
  it("週キーから月曜日の日付を返す", () => {
    expect(mondayOfIsoWeek("2026-W24")).toBe("2026-06-08");
    expect(mondayOfIsoWeek("2026-W01")).toBe("2025-12-29");
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`../src/week` が存在しない）

- [ ] **Step 4: pipeline/src/week.ts を実装**

```ts
export function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // 月曜=0
  d.setUTCDate(d.getUTCDate() - day + 3); // この週の木曜日
  const isoYear = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Thu = new Date(Date.UTC(isoYear, 0, 4 - jan4Day + 3));
  const week = 1 + Math.round((d.getTime() - week1Thu.getTime()) / (7 * 86400000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export function mondayOfIsoWeek(weekKey: string): string {
  const [y, w] = weekKey.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(y, 0, 4 - jan4Day + (w - 1) * 7));
  return monday.toISOString().slice(0, 10);
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test`
Expected: PASS（week.test.ts 2件）

- [ ] **Step 6: コミット**

```bash
git add pipeline tsconfig.json
git commit -m "feat: 型定義とISO週ユーティリティ"
```

---

### Task 3: 国会会議録APIクライアント

**Files:**
- Create: `pipeline/src/api.ts`
- Test: `pipeline/tests/api.test.ts`

API仕様: `https://kokkai.ndl.go.jp/api/meeting`（会議単位出力）。`maximumRecords` の上限は10。`recordPacking=json` でJSONを返す。レスポンスの `nextRecordPosition` が null になるまでページング。利用規約上、連続リクエストには間隔を空ける（1秒）。

- [ ] **Step 1: 失敗するテスト pipeline/tests/api.test.ts を書く**

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchMeetings, type RawMeeting } from "../src/api";

function makeRes(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

const m = (issueID: string): RawMeeting => ({
  issueID,
  session: 218,
  nameOfHouse: "衆議院",
  nameOfMeeting: "予算委員会",
  issue: "第1号",
  date: "2026-06-01",
  meetingURL: "https://kokkai.ndl.go.jp/#/detail?minId=" + issueID,
  speechRecord: [],
});

describe("fetchMeetings", () => {
  it("nextRecordPosition がなくなるまでページングして全会議を返す", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(makeRes({ numberOfRecords: 12, nextRecordPosition: 11, meetingRecord: [m("A")] }))
      .mockResolvedValueOnce(makeRes({ numberOfRecords: 12, nextRecordPosition: null, meetingRecord: [m("B")] }));
    const out: RawMeeting[] = [];
    for await (const mt of fetchMeetings("2026-06-01", "2026-06-07", fetchImpl, 0)) out.push(mt);
    expect(out.map((x) => x.issueID)).toEqual(["A", "B"]);
    expect(fetchImpl.mock.calls[0][0]).toContain("startRecord=1");
    expect(fetchImpl.mock.calls[1][0]).toContain("startRecord=11");
  });

  it("HTTPエラーで例外を投げる", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(async () => {
      for await (const _ of fetchMeetings("2026-06-01", "2026-06-07", fetchImpl, 0)) {
        /* no-op */
      }
    }).rejects.toThrow("500");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`../src/api` が存在しない）

- [ ] **Step 3: pipeline/src/api.ts を実装**

```ts
const BASE = "https://kokkai.ndl.go.jp/api/meeting";

export interface RawSpeech {
  speechID: string;
  speechOrder: number;
  speaker: string | null;
  speakerGroup: string | null;
  speakerPosition: string | null;
  speakerRole: string | null;
  speech: string;
  speechURL: string;
}

export interface RawMeeting {
  issueID: string;
  session: number;
  nameOfHouse: string;
  nameOfMeeting: string;
  issue: string;
  date: string;
  meetingURL: string;
  speechRecord: RawSpeech[];
}

interface ApiResponse {
  numberOfRecords: number;
  nextRecordPosition: number | null;
  meetingRecord?: RawMeeting[];
  message?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function* fetchMeetings(
  from: string,
  until: string,
  fetchImpl: typeof fetch = fetch,
  delayMs = 1000,
): AsyncGenerator<RawMeeting> {
  let start = 1;
  for (;;) {
    const url = `${BASE}?from=${from}&until=${until}&maximumRecords=10&startRecord=${start}&recordPacking=json`;
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
    const body = (await res.json()) as ApiResponse;
    if (body.message) throw new Error(`API message: ${body.message}`);
    for (const m of body.meetingRecord ?? []) yield m;
    if (body.nextRecordPosition == null) break;
    start = body.nextRecordPosition;
    if (delayMs > 0) await sleep(delayMs);
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（api.test.ts 2件を含む全件）

- [ ] **Step 5: コミット**

```bash
git add pipeline
git commit -m "feat: 国会会議録APIクライアント（ページング・エラー処理）"
```

---

### Task 4: 発言の正規化（ヘッダ除外・議事進行判定・文字数）

**Files:**
- Create: `pipeline/src/normalize.ts`, `pipeline/tests/fixtures/meeting.ts`
- Test: `pipeline/tests/normalize.test.ts`

ルール: `speechOrder === 0`（会議録情報ヘッダ、speaker が null）は完全除外。空白除去後50文字以下の発言（「これより会議を開きます」「異議なし」等）は `procedural: true` として機械判定し、LLMに送らず分母からも除外する。

- [ ] **Step 1: 共有フィクスチャ pipeline/tests/fixtures/meeting.ts を作成**

```ts
import type { RawMeeting } from "../../src/api";

export function makeMeeting(over: Partial<RawMeeting> = {}): RawMeeting {
  return {
    issueID: "100000000X00120260601",
    session: 218,
    nameOfHouse: "衆議院",
    nameOfMeeting: "予算委員会",
    issue: "第1号",
    date: "2026-06-01",
    meetingURL: "https://kokkai.ndl.go.jp/#/detail?minId=100000000X00120260601",
    speechRecord: [
      {
        speechID: "h0",
        speechOrder: 0,
        speaker: null,
        speakerGroup: null,
        speakerPosition: null,
        speakerRole: null,
        speech: "会議録情報 第218回国会 予算委員会 第1号",
        speechURL: "https://kokkai.ndl.go.jp/txt/100000000X00120260601/0",
      },
      {
        speechID: "s1",
        speechOrder: 1,
        speaker: "山田太郎",
        speakerGroup: "自由民主党",
        speakerPosition: "委員長",
        speakerRole: null,
        speech: "○山田委員長　これより会議を開きます。",
        speechURL: "https://kokkai.ndl.go.jp/txt/100000000X00120260601/1",
      },
      {
        speechID: "s2",
        speechOrder: 2,
        speaker: "佐藤花子",
        speakerGroup: "立憲民主党",
        speakerPosition: null,
        speakerRole: null,
        speech: "○佐藤委員　ガソリン税の暫定税率についてお尋ねします。" + "あ".repeat(100),
        speechURL: "https://kokkai.ndl.go.jp/txt/100000000X00120260601/2",
      },
      {
        speechID: "s3",
        speechOrder: 3,
        speaker: "鈴木一郎",
        speakerGroup: null,
        speakerPosition: "財務大臣",
        speakerRole: null,
        speech: "○鈴木国務大臣　お答えいたします。" + "い".repeat(200),
        speechURL: "https://kokkai.ndl.go.jp/txt/100000000X00120260601/3",
      },
    ],
    ...over,
  };
}
```

- [ ] **Step 2: 失敗するテスト pipeline/tests/normalize.test.ts を書く**

```ts
import { describe, expect, it } from "vitest";
import { countChars, normalizeMeeting } from "../src/normalize";
import { makeMeeting } from "./fixtures/meeting";

describe("countChars", () => {
  it("空白・改行を除いて数える", () => {
    expect(countChars("あい う\nえ\tお")).toBe(5);
  });
});

describe("normalizeMeeting", () => {
  const records = normalizeMeeting(makeMeeting());

  it("speechOrder=0 のヘッダを除外する", () => {
    expect(records.map((r) => r.speechId)).toEqual(["s1", "s2", "s3"]);
  });

  it("50文字以下を議事進行と判定する", () => {
    expect(records[0].procedural).toBe(true); // 委員長の開会宣言
    expect(records[1].procedural).toBe(false);
    expect(records[2].procedural).toBe(false);
  });

  it("会議メタデータと会派を引き継ぐ", () => {
    expect(records[1]).toMatchObject({
      issueId: "100000000X00120260601",
      date: "2026-06-01",
      house: "衆議院",
      meeting: "予算委員会",
      speaker: "佐藤花子",
      group: "立憲民主党",
      url: "https://kokkai.ndl.go.jp/txt/100000000X00120260601/2",
    });
    expect(records[2].group).toBeNull(); // 大臣は会派なし
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`../src/normalize` が存在しない）

- [ ] **Step 4: pipeline/src/normalize.ts を実装**

```ts
import type { RawMeeting } from "./api";
import type { SpeechRecord } from "./types";

export const PROCEDURAL_MAX_CHARS = 50;

export function countChars(text: string): number {
  return text.replace(/\s/g, "").length;
}

export function normalizeMeeting(m: RawMeeting): SpeechRecord[] {
  return m.speechRecord
    .filter((s) => s.speechOrder !== 0 && s.speaker)
    .map((s) => {
      const chars = countChars(s.speech);
      return {
        speechId: s.speechID,
        issueId: m.issueID,
        date: m.date,
        house: m.nameOfHouse,
        meeting: m.nameOfMeeting,
        speaker: s.speaker as string,
        group: s.speakerGroup,
        position: s.speakerPosition,
        chars,
        text: s.speech,
        url: s.speechURL,
        procedural: chars <= PROCEDURAL_MAX_CHARS,
      };
    });
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test`
Expected: PASS（全件）

- [ ] **Step 6: コミット**

```bash
git add pipeline
git commit -m "feat: 発言正規化（ヘッダ除外・議事進行の機械判定・文字数算出）"
```

---

### Task 5: fetch CLI（取得期間の計算と会議録キャッシュ）

**Files:**
- Create: `pipeline/src/window.ts`, `pipeline/src/fetch.ts`
- Test: `pipeline/tests/window.test.ts`

会議録は公開が数日〜数週間遅れるため、毎回「今日から `fetchWindowDays` 日前まで（ただし会期開始日より前は見ない）」を再取得し、キャッシュ済み issueID はスキップする。CLI自体は薄く保ち、期間計算のみテストする（CLIの実走確認は Task 11）。

- [ ] **Step 1: 失敗するテスト pipeline/tests/window.test.ts を書く**

```ts
import { describe, expect, it } from "vitest";
import { computeWindow } from "../src/window";

const meta = { sessionStartDate: "2026-01-26", fetchWindowDays: 45 };

describe("computeWindow", () => {
  it("今日から45日前を下限にする", () => {
    expect(computeWindow(meta, "2026-06-11")).toEqual({ from: "2026-04-27", until: "2026-06-11" });
  });

  it("会期開始日より前には遡らない", () => {
    expect(computeWindow(meta, "2026-02-01")).toEqual({ from: "2026-01-26", until: "2026-02-01" });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`../src/window` が存在しない）

- [ ] **Step 3: pipeline/src/window.ts を実装**

```ts
import type { Meta } from "./types";

export function computeWindow(
  meta: Pick<Meta, "sessionStartDate" | "fetchWindowDays">,
  today: string,
): { from: string; until: string } {
  const t = new Date(today + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() - meta.fetchWindowDays);
  const lower = t.toISOString().slice(0, 10);
  const from = lower > meta.sessionStartDate ? lower : meta.sessionStartDate;
  return { from, until: today };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（全件）

- [ ] **Step 5: pipeline/src/fetch.ts（CLI本体）を実装**

```ts
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchMeetings } from "./api";
import type { Meta } from "./types";
import { computeWindow } from "./window";

async function main() {
  const args = process.argv.slice(2);
  const meta: Meta = JSON.parse(await readFile("data/meta.json", "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  let { from, until } = computeWindow(meta, today);
  const fi = args.indexOf("--from");
  if (fi >= 0) from = args[fi + 1];
  const ui = args.indexOf("--until");
  if (ui >= 0) until = args[ui + 1];

  await mkdir("cache/raw", { recursive: true });
  let fetched = 0;
  let skipped = 0;
  for await (const m of fetchMeetings(from, until)) {
    const path = `cache/raw/${m.issueID}.json`;
    try {
      await access(path);
      skipped++;
      continue;
    } catch {
      // 未取得
    }
    await writeFile(path, JSON.stringify(m, null, 1));
    fetched++;
    console.log(`fetched: ${m.date} ${m.nameOfHouse} ${m.nameOfMeeting} (${m.issueID})`);
  }
  console.log(`done: ${fetched} new, ${skipped} cached (window ${from}..${until})`);
}

main();
```

- [ ] **Step 6: 型チェックを通す**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add pipeline
git commit -m "feat: fetch CLI（取得期間計算と会議録キャッシュ）"
```

---

### Task 6: チャンク分割と batch CLI（LLM入力生成）

**Files:**
- Create: `pipeline/src/chunk.ts`, `pipeline/src/batch.ts`
- Test: `pipeline/tests/chunk.test.ts`

長い会議はLLMのコンテキストに収まらないため、非議事進行発言を60,000文字単位のチャンクに分割し、バッチID `{issueID}-{連番}` で入力ファイル化する。議事進行発言はこの時点で `procedural` として割当ファイルに自動記入する。チャンク分割は決定的（同じ入力→同じバッチID）でなければならない。

- [ ] **Step 1: 失敗するテスト pipeline/tests/chunk.test.ts を書く**

```ts
import { describe, expect, it } from "vitest";
import { chunkSpeeches } from "../src/chunk";
import type { SpeechRecord } from "../src/types";

function speech(id: string, chars: number): SpeechRecord {
  return {
    speechId: id,
    issueId: "X",
    date: "2026-06-01",
    house: "衆議院",
    meeting: "予算委員会",
    speaker: "A",
    group: null,
    position: null,
    chars,
    text: "x".repeat(chars),
    url: "u",
    procedural: false,
  };
}

describe("chunkSpeeches", () => {
  it("上限文字数を超えるところで分割する", () => {
    const chunks = chunkSpeeches([speech("a", 30000), speech("b", 30000), speech("c", 30000)], 60000);
    expect(chunks.map((c) => c.map((s) => s.speechId))).toEqual([["a", "b"], ["c"]]);
  });

  it("単体で上限を超える発言も1チャンクとして通す", () => {
    const chunks = chunkSpeeches([speech("a", 70000)], 60000);
    expect(chunks).toHaveLength(1);
  });

  it("空入力は空配列", () => {
    expect(chunkSpeeches([], 60000)).toEqual([]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`../src/chunk` が存在しない）

- [ ] **Step 3: pipeline/src/chunk.ts を実装**

```ts
import type { SpeechRecord } from "./types";

export const CHUNK_MAX_CHARS = 60000;

export function chunkSpeeches(speeches: SpeechRecord[], maxChars = CHUNK_MAX_CHARS): SpeechRecord[][] {
  const chunks: SpeechRecord[][] = [];
  let current: SpeechRecord[] = [];
  let size = 0;
  for (const s of speeches) {
    if (current.length > 0 && size + s.chars > maxChars) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(s);
    size += s.chars;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（全件）

- [ ] **Step 5: pipeline/src/batch.ts（CLI本体）を実装**

```ts
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import type { RawMeeting } from "./api";
import { chunkSpeeches } from "./chunk";
import { normalizeMeeting } from "./normalize";
import type { AssignmentFile, BatchInput, Meta } from "./types";

async function main() {
  await mkdir("cache/llm/input", { recursive: true });
  await mkdir("cache/llm/output", { recursive: true });
  await mkdir("data/assignments", { recursive: true });
  const meta: Meta = JSON.parse(await readFile("data/meta.json", "utf8"));
  const rawFiles = (await readdir("cache/raw")).filter((f) => f.endsWith(".json"));
  const queued: string[] = [];

  for (const f of rawFiles) {
    const m: RawMeeting = JSON.parse(await readFile(`cache/raw/${f}`, "utf8"));
    const speeches = normalizeMeeting(m);
    if (speeches.length === 0) continue;

    const asgPath = `data/assignments/${m.issueID}.json`;
    if (existsSync(asgPath)) {
      const asg: AssignmentFile = JSON.parse(await readFile(asgPath, "utf8"));
      if (asg.assignments.length >= asg.expected) continue; // 分類完了済み
    } else {
      const asg: AssignmentFile = {
        issueId: m.issueID,
        expected: speeches.length,
        assignments: speeches
          .filter((s) => s.procedural)
          .map((s) => ({ speechId: s.speechId, topicId: "procedural" })),
      };
      await writeFile(asgPath, JSON.stringify(asg, null, 1));
    }

    const chunks = chunkSpeeches(speeches.filter((s) => !s.procedural));
    for (let i = 0; i < chunks.length; i++) {
      const batchId = `${m.issueID}-${String(i).padStart(2, "0")}`;
      if (meta.ingestedBatches.includes(batchId)) continue;
      const inputPath = `cache/llm/input/${batchId}.json`;
      if (!existsSync(inputPath)) {
        const input: BatchInput = {
          batchId,
          issueId: m.issueID,
          date: m.date,
          house: m.nameOfHouse,
          meeting: m.nameOfMeeting,
          speeches: chunks[i].map((s) => ({
            id: s.speechId,
            speaker: s.speaker,
            position: s.position,
            group: s.group,
            chars: s.chars,
            text: s.text,
          })),
        };
        await writeFile(inputPath, JSON.stringify(input, null, 1));
      }
      queued.push(batchId);
    }
  }

  if (queued.length === 0) {
    console.log("no pending batches");
  } else {
    console.log(`pending batches (${queued.length}):`);
    for (const b of queued) console.log("  " + b);
  }
}

main();
```

- [ ] **Step 6: 型チェックを通す**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add pipeline
git commit -m "feat: batch CLI（チャンク分割とLLM入力生成・議事進行の自動割当）"
```

---

### Task 7: ingest（LLM出力の検証・台帳更新・割当反映）

**Files:**
- Create: `pipeline/src/ingest-core.ts`, `pipeline/src/ingest.ts`
- Test: `pipeline/tests/ingest.test.ts`

LLMの出力を信用せず検証する：全発言IDが過不足なく1回ずつ割り当てられているか、topicId が台帳・特別ID（other/procedural）・新規提案 tempId のいずれかか。新規トピックは台帳と完全一致の名前があれば再利用、なければ `t{連番}` を採番。エラーがあれば一切書き込まず終了コード1（Claudeが出力を修正して再実行する）。

- [ ] **Step 1: 失敗するテスト pipeline/tests/ingest.test.ts を書く**

```ts
import { describe, expect, it } from "vitest";
import { ingestBatch } from "../src/ingest-core";
import type { BatchInput, BatchOutput, Registry } from "../src/types";

const input: BatchInput = {
  batchId: "X-00",
  issueId: "X",
  date: "2026-06-01",
  house: "衆議院",
  meeting: "予算委員会",
  speeches: [
    { id: "s2", speaker: "佐藤花子", position: null, group: "立憲民主党", chars: 120, text: "..." },
    { id: "s3", speaker: "鈴木一郎", position: "財務大臣", group: null, chars: 210, text: "..." },
  ],
};

const emptyRegistry: Registry = { nextId: 1, topics: [] };

describe("ingestBatch", () => {
  it("新規トピックを採番して割当を解決する", () => {
    const output: BatchOutput = {
      batchId: "X-00",
      assignments: [
        { speechId: "s2", topicId: "new:1" },
        { speechId: "s3", topicId: "new:1" },
      ],
      newTopics: [{ tempId: "new:1", name: "ガソリン税・暫定税率", description: "ガソリン税の暫定税率廃止を巡る議論" }],
    };
    const r = ingestBatch(emptyRegistry, input, output, "2026-06-01");
    expect(r.errors).toEqual([]);
    expect(r.registry.topics).toHaveLength(1);
    expect(r.registry.topics[0]).toMatchObject({ id: "t0001", name: "ガソリン税・暫定税率", firstSeen: "2026-06-01" });
    expect(r.registry.nextId).toBe(2);
    expect(r.assignments).toEqual([
      { speechId: "s2", topicId: "t0001" },
      { speechId: "s3", topicId: "t0001" },
    ]);
  });

  it("同名の新規提案は既存トピックに名寄せする", () => {
    const registry: Registry = {
      nextId: 2,
      topics: [{ id: "t0001", name: "ガソリン税・暫定税率", description: "既存", firstSeen: "2026-05-01" }],
    };
    const output: BatchOutput = {
      batchId: "X-00",
      assignments: [
        { speechId: "s2", topicId: "new:1" },
        { speechId: "s3", topicId: "other" },
      ],
      newTopics: [{ tempId: "new:1", name: "ガソリン税・暫定税率", description: "重複提案" }],
    };
    const r = ingestBatch(registry, input, output, "2026-06-01");
    expect(r.errors).toEqual([]);
    expect(r.registry.topics).toHaveLength(1);
    expect(r.assignments[0].topicId).toBe("t0001");
    expect(r.added).toEqual([]);
  });

  it("割当の欠落・重複・未知IDをエラーにする", () => {
    const output: BatchOutput = {
      batchId: "X-00",
      assignments: [
        { speechId: "s2", topicId: "t9999" },
        { speechId: "s2", topicId: "other" },
      ],
      newTopics: [],
    };
    const r = ingestBatch(emptyRegistry, input, output, "2026-06-01");
    expect(r.errors.join("\n")).toContain("duplicate speechId: s2");
    expect(r.errors.join("\n")).toContain("missing assignment for: s3");
    expect(r.errors.join("\n")).toContain("unknown topicId: t9999");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`../src/ingest-core` が存在しない）

- [ ] **Step 3: pipeline/src/ingest-core.ts を実装**

```ts
import type { Assignment, BatchInput, BatchOutput, Registry, Topic } from "./types";

export interface IngestResult {
  registry: Registry;
  assignments: Assignment[];
  errors: string[];
  added: Topic[];
}

export function ingestBatch(registry: Registry, input: BatchInput, output: BatchOutput, date: string): IngestResult {
  const errors: string[] = [];
  const inputIds = new Set(input.speeches.map((s) => s.id));
  const outIds = new Set<string>();
  for (const a of output.assignments) {
    if (!inputIds.has(a.speechId)) errors.push(`unknown speechId: ${a.speechId}`);
    if (outIds.has(a.speechId)) errors.push(`duplicate speechId: ${a.speechId}`);
    outIds.add(a.speechId);
  }
  for (const id of inputIds) {
    if (!outIds.has(id)) errors.push(`missing assignment for: ${id}`);
  }

  const tempMap = new Map<string, string>();
  const added: Topic[] = [];
  let nextId = registry.nextId;
  const topics = [...registry.topics];
  for (const nt of output.newTopics ?? []) {
    const existing = topics.find((t) => t.name === nt.name);
    if (existing) {
      tempMap.set(nt.tempId, existing.id);
      continue;
    }
    const id = `t${String(nextId).padStart(4, "0")}`;
    nextId++;
    const topic: Topic = { id, name: nt.name, description: nt.description, firstSeen: date };
    topics.push(topic);
    added.push(topic);
    tempMap.set(nt.tempId, id);
  }

  const valid = new Set([...topics.map((t) => t.id), "other", "procedural"]);
  const assignments: Assignment[] = [];
  for (const a of output.assignments) {
    const topicId = tempMap.get(a.topicId) ?? a.topicId;
    if (!valid.has(topicId)) {
      errors.push(`unknown topicId: ${a.topicId} (speech ${a.speechId})`);
      continue;
    }
    assignments.push({ speechId: a.speechId, topicId });
  }

  return { registry: { nextId, topics }, assignments, errors, added };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（全件）

- [ ] **Step 5: pipeline/src/ingest.ts（CLI本体）を実装**

```ts
import { readFile, writeFile } from "node:fs/promises";
import { ingestBatch } from "./ingest-core";
import type { AssignmentFile, BatchInput, BatchOutput, Meta, Registry } from "./types";

async function main() {
  const args = process.argv.slice(2);
  const bi = args.indexOf("--batch");
  if (bi < 0 || !args[bi + 1]) {
    console.error("usage: npm run ingest -- --batch <batchId>");
    process.exit(1);
  }
  const batchId = args[bi + 1];

  const meta: Meta = JSON.parse(await readFile("data/meta.json", "utf8"));
  if (meta.ingestedBatches.includes(batchId)) {
    console.error(`already ingested: ${batchId}`);
    process.exit(1);
  }
  const input: BatchInput = JSON.parse(await readFile(`cache/llm/input/${batchId}.json`, "utf8"));
  const output: BatchOutput = JSON.parse(await readFile(`cache/llm/output/${batchId}.json`, "utf8"));
  const registry: Registry = JSON.parse(await readFile("data/topics.json", "utf8"));

  const result = ingestBatch(registry, input, output, input.date);
  if (result.errors.length > 0) {
    for (const e of result.errors) console.error("ERROR: " + e);
    process.exit(1);
  }

  const asgPath = `data/assignments/${input.issueId}.json`;
  const asg: AssignmentFile = JSON.parse(await readFile(asgPath, "utf8"));
  const existing = new Set(asg.assignments.map((a) => a.speechId));
  for (const a of result.assignments) {
    if (!existing.has(a.speechId)) asg.assignments.push(a);
  }
  await writeFile(asgPath, JSON.stringify(asg, null, 1));
  await writeFile("data/topics.json", JSON.stringify(result.registry, null, 1));
  meta.ingestedBatches.push(batchId);
  await writeFile("data/meta.json", JSON.stringify(meta, null, 1));

  for (const t of result.added) console.log(`new topic: ${t.id} ${t.name}`);
  console.log(`ingested ${batchId}: ${result.assignments.length} assignments (${asg.assignments.length}/${asg.expected})`);
}

main();
```

- [ ] **Step 6: 型チェックを通す**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add pipeline
git commit -m "feat: ingest（LLM出力の検証・トピック採番・割当反映）"
```

---

### Task 8: aggregate（文字数集計・期間別・政党別・トピック詳細）

**Files:**
- Create: `pipeline/src/aggregate-core.ts`, `pipeline/src/aggregate.ts`
- Test: `pipeline/tests/aggregate.test.ts`

集計はすべて機械処理。`procedural` は分母から除外、`other` は「その他」として分母に含める。会派が null（大臣・政府参考人）は「政府・不明」に集約。期間は「会期全体」「直近30日」「各ISO週」。出力は `data/aggregates/`（サイトのクライアントが読む）と `data/topic-details/`（詳細ページのビルドが読む）。発言一覧は最新200件で打ち切り、打ち切り時は警告ログを出す。

- [ ] **Step 1: 失敗するテスト pipeline/tests/aggregate.test.ts を書く**

```ts
import { describe, expect, it } from "vitest";
import { aggregatePeriod, buildFacts, buildTopicDetail, topicNameResolver } from "../src/aggregate-core";
import type { AssignmentFile, Registry } from "../src/types";
import { makeMeeting } from "./fixtures/meeting";

const registry: Registry = {
  nextId: 2,
  topics: [{ id: "t0001", name: "ガソリン税・暫定税率", description: "説明", firstSeen: "2026-06-01" }],
};

const assignments: AssignmentFile[] = [
  {
    issueId: "100000000X00120260601",
    expected: 3,
    assignments: [
      { speechId: "s1", topicId: "procedural" },
      { speechId: "s2", topicId: "t0001" },
      { speechId: "s3", topicId: "t0001" },
    ],
  },
];

const facts = buildFacts([makeMeeting()], assignments);

describe("buildFacts", () => {
  it("procedural を除外し、会派 null を「政府・不明」にする", () => {
    expect(facts.map((f) => f.speechId)).toEqual(["s2", "s3"]);
    expect(facts[1].group).toBe("政府・不明");
    expect(facts[0].week).toBe("2026-W23");
  });
});

describe("aggregatePeriod", () => {
  const agg = aggregatePeriod(facts, { key: "session", label: "会期全体", from: "2026-01-01", until: "2026-12-31" }, topicNameResolver(registry));

  it("シェアの合計が1になる", () => {
    expect(agg.topics.reduce((s, t) => s + t.share, 0)).toBeCloseTo(1);
    expect(agg.topics[0]).toMatchObject({ id: "t0001", name: "ガソリン税・暫定税率" });
    expect(agg.totalChars).toBe(facts[0].chars + facts[1].chars);
  });

  it("会派別の内訳を持つ", () => {
    expect(Object.keys(agg.byParty).sort()).toEqual(["政府・不明", "立憲民主党"]);
    expect(agg.byParty["立憲民主党"].topics[0].share).toBeCloseTo(1);
  });

  it("週キー指定でフィルタできる", () => {
    const w = aggregatePeriod(facts, { key: "2026-W23", label: "6/1の週", week: "2026-W23" }, topicNameResolver(registry));
    expect(w.totalChars).toBe(agg.totalChars);
    const none = aggregatePeriod(facts, { key: "2026-W30", label: "x", week: "2026-W30" }, topicNameResolver(registry));
    expect(none.totalChars).toBe(0);
  });
});

describe("buildTopicDetail", () => {
  const detail = buildTopicDetail(facts, registry.topics[0]);

  it("週次推移・発言者・発言一覧を作る", () => {
    expect(detail.sessionShare).toBeCloseTo(1);
    expect(detail.weekly).toEqual([{ week: "2026-W23", chars: detail.totalChars, share: 1 }]);
    expect(detail.topSpeakers[0].chars).toBeGreaterThanOrEqual(detail.topSpeakers[1]?.chars ?? 0);
    expect(detail.speeches[0].url).toContain("kokkai.ndl.go.jp");
    expect(detail.speechesTruncated).toBe(false);
  });
});
```

注: フィクスチャの日付 2026-06-01 は月曜日で ISO週 2026-W23。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`../src/aggregate-core` が存在しない）

- [ ] **Step 3: pipeline/src/aggregate-core.ts を実装**

```ts
import type { RawMeeting } from "./api";
import { normalizeMeeting } from "./normalize";
import type { AssignmentFile, Registry, Topic } from "./types";
import { isoWeek } from "./week";

export const EXCERPT_LEN = 120;
export const MAX_SPEECHES_PER_TOPIC = 200;
export const NO_GROUP_LABEL = "政府・不明";

export interface SpeechFact {
  speechId: string;
  topicId: string;
  date: string;
  week: string;
  house: string;
  meeting: string;
  speaker: string;
  group: string;
  chars: number;
  excerpt: string;
  url: string;
}

export function buildFacts(meetings: RawMeeting[], assignmentFiles: AssignmentFile[]): SpeechFact[] {
  const topicBySpeech = new Map<string, string>();
  for (const f of assignmentFiles) {
    for (const a of f.assignments) topicBySpeech.set(a.speechId, a.topicId);
  }
  const facts: SpeechFact[] = [];
  for (const m of meetings) {
    for (const s of normalizeMeeting(m)) {
      const topicId = topicBySpeech.get(s.speechId);
      if (!topicId || topicId === "procedural") continue; // 未分類(ingest前)と議事進行は集計対象外
      facts.push({
        speechId: s.speechId,
        topicId,
        date: s.date,
        week: isoWeek(s.date),
        house: s.house,
        meeting: s.meeting,
        speaker: s.speaker,
        group: s.group ?? NO_GROUP_LABEL,
        chars: s.chars,
        excerpt: s.text.replace(/\s+/g, " ").trim().slice(0, EXCERPT_LEN),
        url: s.url,
      });
    }
  }
  return facts;
}

export interface PeriodDef {
  key: string;
  label: string;
  from?: string;
  until?: string;
  week?: string;
}

export interface TopicShare {
  id: string;
  name: string;
  chars: number;
  share: number;
}

export interface PeriodAggregate {
  key: string;
  label: string;
  totalChars: number;
  topics: TopicShare[];
  byParty: Record<string, { totalChars: number; topics: TopicShare[] }>;
}

export function topicNameResolver(registry: Registry): (id: string) => string {
  const map = new Map(registry.topics.map((t) => [t.id, t.name]));
  return (id) => (id === "other" ? "その他" : (map.get(id) ?? id));
}

function shares(facts: SpeechFact[], topicName: (id: string) => string): { totalChars: number; topics: TopicShare[] } {
  const byTopic = new Map<string, number>();
  let total = 0;
  for (const f of facts) {
    byTopic.set(f.topicId, (byTopic.get(f.topicId) ?? 0) + f.chars);
    total += f.chars;
  }
  const topics = [...byTopic.entries()]
    .map(([id, chars]) => ({ id, name: topicName(id), chars, share: total > 0 ? chars / total : 0 }))
    .sort((a, b) => b.chars - a.chars);
  return { totalChars: total, topics };
}

export function aggregatePeriod(facts: SpeechFact[], def: PeriodDef, topicName: (id: string) => string): PeriodAggregate {
  const inPeriod = facts.filter((f) =>
    def.week ? f.week === def.week : f.date >= (def.from ?? "0000-00-00") && f.date <= (def.until ?? "9999-99-99"),
  );
  const all = shares(inPeriod, topicName);
  const byParty: PeriodAggregate["byParty"] = {};
  for (const g of new Set(inPeriod.map((f) => f.group))) {
    byParty[g] = shares(
      inPeriod.filter((f) => f.group === g),
      topicName,
    );
  }
  return { key: def.key, label: def.label, totalChars: all.totalChars, topics: all.topics, byParty };
}

export interface TopicDetail {
  id: string;
  name: string;
  description: string;
  firstSeen: string;
  totalChars: number;
  sessionShare: number;
  weekly: { week: string; chars: number; share: number }[];
  topSpeakers: { speaker: string; group: string; chars: number }[];
  speeches: {
    date: string;
    house: string;
    meeting: string;
    speaker: string;
    group: string;
    chars: number;
    excerpt: string;
    url: string;
  }[];
  speechesTruncated: boolean;
}

export function buildTopicDetail(facts: SpeechFact[], topic: Topic): TopicDetail {
  const mine = facts.filter((f) => f.topicId === topic.id);
  const totalAll = facts.reduce((s, f) => s + f.chars, 0);
  const totalChars = mine.reduce((s, f) => s + f.chars, 0);

  const weeks = [...new Set(facts.map((f) => f.week))].sort();
  const weekly = weeks.map((week) => {
    const wAll = facts.filter((f) => f.week === week).reduce((s, f) => s + f.chars, 0);
    const wMine = mine.filter((f) => f.week === week).reduce((s, f) => s + f.chars, 0);
    return { week, chars: wMine, share: wAll > 0 ? wMine / wAll : 0 };
  });

  const bySpeaker = new Map<string, { speaker: string; group: string; chars: number }>();
  for (const f of mine) {
    const cur = bySpeaker.get(f.speaker) ?? { speaker: f.speaker, group: f.group, chars: 0 };
    cur.chars += f.chars;
    bySpeaker.set(f.speaker, cur);
  }
  const topSpeakers = [...bySpeaker.values()].sort((a, b) => b.chars - a.chars).slice(0, 10);

  const sorted = [...mine].sort((a, b) => b.date.localeCompare(a.date) || a.speechId.localeCompare(b.speechId));
  const speeches = sorted
    .slice(0, MAX_SPEECHES_PER_TOPIC)
    .map(({ speechId, topicId, week, ...rest }) => rest);

  return {
    id: topic.id,
    name: topic.name,
    description: topic.description,
    firstSeen: topic.firstSeen,
    totalChars,
    sessionShare: totalAll > 0 ? totalChars / totalAll : 0,
    weekly,
    topSpeakers,
    speeches,
    speechesTruncated: sorted.length > MAX_SPEECHES_PER_TOPIC,
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（全件）

- [ ] **Step 5: pipeline/src/aggregate.ts（CLI本体）を実装**

```ts
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import type { RawMeeting } from "./api";
import {
  MAX_SPEECHES_PER_TOPIC,
  aggregatePeriod,
  buildFacts,
  buildTopicDetail,
  topicNameResolver,
  type PeriodDef,
} from "./aggregate-core";
import type { AssignmentFile, Meta, Registry } from "./types";
import { mondayOfIsoWeek } from "./week";

async function main() {
  const meta: Meta = JSON.parse(await readFile("data/meta.json", "utf8"));
  const registry: Registry = JSON.parse(await readFile("data/topics.json", "utf8"));
  const asgFiles: AssignmentFile[] = [];
  for (const f of (await readdir("data/assignments")).filter((f) => f.endsWith(".json"))) {
    asgFiles.push(JSON.parse(await readFile(`data/assignments/${f}`, "utf8")));
  }

  const meetings: RawMeeting[] = [];
  for (const a of asgFiles) {
    try {
      meetings.push(JSON.parse(await readFile(`cache/raw/${a.issueId}.json`, "utf8")));
    } catch {
      console.error(
        `ERROR: cache/raw/${a.issueId}.json がありません。npm run fetch -- --from <日付> --until <日付> で再取得してください`,
      );
      process.exit(1);
    }
  }

  const facts = buildFacts(meetings, asgFiles);
  if (facts.length === 0) {
    console.error("集計対象の発言がありません。fetch → batch → 分類 → ingest を先に実行してください");
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const d30 = new Date(today + "T00:00:00Z");
  d30.setUTCDate(d30.getUTCDate() - 30);
  const weeks = [...new Set(facts.map((f) => f.week))].sort().reverse();
  const weekLabel = (w: string) => {
    const mon = mondayOfIsoWeek(w);
    return `${Number(mon.slice(5, 7))}/${Number(mon.slice(8, 10))}の週`;
  };
  const defs: PeriodDef[] = [
    { key: "session", label: "会期全体", from: meta.sessionStartDate, until: today },
    { key: "last30", label: "直近30日", from: d30.toISOString().slice(0, 10), until: today },
    ...weeks.map((w) => ({ key: w, label: weekLabel(w), week: w })),
  ];

  const name = topicNameResolver(registry);
  await rm("data/aggregates", { recursive: true, force: true });
  await mkdir("data/aggregates/periods", { recursive: true });
  for (const def of defs) {
    const agg = aggregatePeriod(facts, def, name);
    await writeFile(`data/aggregates/periods/${def.key}.json`, JSON.stringify(agg, null, 1));
  }

  const session = aggregatePeriod(facts, defs[0], name);
  const parties = Object.entries(session.byParty)
    .sort((a, b) => b[1].totalChars - a[1].totalChars)
    .map(([g]) => g);
  await writeFile(
    "data/aggregates/index.json",
    JSON.stringify(
      {
        generatedAt: today,
        sessionLabel: meta.sessionLabel,
        periods: defs.map((d) => ({ key: d.key, label: d.label })),
        parties,
      },
      null,
      1,
    ),
  );

  await rm("data/topic-details", { recursive: true, force: true });
  await mkdir("data/topic-details", { recursive: true });
  const sessionFacts = facts.filter((f) => f.date >= meta.sessionStartDate);
  let detailCount = 0;
  for (const t of registry.topics) {
    const detail = buildTopicDetail(sessionFacts, t);
    if (detail.totalChars === 0) continue;
    if (detail.speechesTruncated) {
      console.warn(`WARN: ${t.id} ${t.name}: 発言一覧を最新${MAX_SPEECHES_PER_TOPIC}件に打ち切りました`);
    }
    await writeFile(`data/topic-details/${t.id}.json`, JSON.stringify(detail, null, 1));
    detailCount++;
  }

  console.log(
    `aggregated: ${facts.length} speeches, ${detailCount} topics with data, ${defs.length} periods`,
  );
}

main();
```

- [ ] **Step 6: 型チェックを通す**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add pipeline
git commit -m "feat: aggregate（期間別・会派別の文字数集計とトピック詳細生成）"
```

---

### Task 9: merge-topics（台帳掃除＝トピック統合）

**Files:**
- Create: `pipeline/src/merge-core.ts`, `pipeline/src/merge-topics.ts`
- Test: `pipeline/tests/merge.test.ts`

月次の台帳掃除でLLMが見つけた重複（例:「ガソリン税減税」と「燃料課税見直し」）を統合する。統合マップ `{"統合元ID": "統合先ID"}` を検証し、全割当ファイルを書き換え、統合元を台帳から削除。検証エラー時は何も書き換えない。

- [ ] **Step 1: 失敗するテスト pipeline/tests/merge.test.ts を書く**

```ts
import { describe, expect, it } from "vitest";
import { applyMergeMap } from "../src/merge-core";
import type { AssignmentFile, Registry } from "../src/types";

const registry: Registry = {
  nextId: 3,
  topics: [
    { id: "t0001", name: "ガソリン税・暫定税率", description: "a", firstSeen: "2026-05-01" },
    { id: "t0002", name: "燃料課税見直し", description: "b", firstSeen: "2026-06-01" },
  ],
};

const files: AssignmentFile[] = [
  {
    issueId: "X",
    expected: 2,
    assignments: [
      { speechId: "s1", topicId: "t0002" },
      { speechId: "s2", topicId: "t0001" },
    ],
  },
];

describe("applyMergeMap", () => {
  it("割当を書き換え、統合元を台帳から削除する", () => {
    const r = applyMergeMap(registry, files, { t0002: "t0001" });
    expect(r.errors).toEqual([]);
    expect(r.registry.topics.map((t) => t.id)).toEqual(["t0001"]);
    expect(r.files[0].assignments.map((a) => a.topicId)).toEqual(["t0001", "t0001"]);
  });

  it("不正なマップを拒否する", () => {
    expect(applyMergeMap(registry, files, { t9999: "t0001" }).errors[0]).toContain("t9999");
    expect(applyMergeMap(registry, files, { t0001: "t0001" }).errors[0]).toContain("self merge");
    const chained = applyMergeMap(
      { ...registry, topics: [...registry.topics, { id: "t0003", name: "c", description: "c", firstSeen: "2026-06-01" }] },
      files,
      { t0002: "t0003", t0003: "t0001" },
    );
    expect(chained.errors.join("\n")).toContain("merge target is itself merged: t0003");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`../src/merge-core` が存在しない）

- [ ] **Step 3: pipeline/src/merge-core.ts を実装**

```ts
import type { AssignmentFile, Registry } from "./types";

export interface MergeResult {
  registry: Registry;
  files: AssignmentFile[];
  errors: string[];
}

export function applyMergeMap(
  registry: Registry,
  files: AssignmentFile[],
  map: Record<string, string>,
): MergeResult {
  const errors: string[] = [];
  const ids = new Set(registry.topics.map((t) => t.id));
  for (const [from, to] of Object.entries(map)) {
    if (!ids.has(from)) errors.push(`merge source not found: ${from}`);
    if (!ids.has(to) && to !== "other") errors.push(`merge target not found: ${to}`);
    if (from === to) errors.push(`self merge: ${from}`);
    if (map[to]) errors.push(`merge target is itself merged: ${to}`);
  }
  if (errors.length > 0) return { registry, files, errors };

  const newFiles = files.map((f) => ({
    ...f,
    assignments: f.assignments.map((a) => ({ ...a, topicId: map[a.topicId] ?? a.topicId })),
  }));
  const newRegistry: Registry = { ...registry, topics: registry.topics.filter((t) => !map[t.id]) };
  return { registry: newRegistry, files: newFiles, errors };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（全件）

- [ ] **Step 5: pipeline/src/merge-topics.ts（CLI本体）を実装**

```ts
import { readFile, readdir, writeFile } from "node:fs/promises";
import { applyMergeMap } from "./merge-core";
import type { AssignmentFile, Registry } from "./types";

async function main() {
  const args = process.argv.slice(2);
  const mi = args.indexOf("--map");
  if (mi < 0 || !args[mi + 1]) {
    console.error("usage: npm run merge-topics -- --map <mapFile.json>");
    process.exit(1);
  }
  const map: Record<string, string> = JSON.parse(await readFile(args[mi + 1], "utf8"));
  const registry: Registry = JSON.parse(await readFile("data/topics.json", "utf8"));
  const fileNames = (await readdir("data/assignments")).filter((f) => f.endsWith(".json"));
  const files: AssignmentFile[] = [];
  for (const f of fileNames) {
    files.push(JSON.parse(await readFile(`data/assignments/${f}`, "utf8")));
  }

  const r = applyMergeMap(registry, files, map);
  if (r.errors.length > 0) {
    for (const e of r.errors) console.error("ERROR: " + e);
    process.exit(1);
  }
  await writeFile("data/topics.json", JSON.stringify(r.registry, null, 1));
  for (const f of r.files) {
    await writeFile(`data/assignments/${f.issueId}.json`, JSON.stringify(f, null, 1));
  }
  console.log(`merged ${Object.keys(map).length} topics. 続けて npm run aggregate を実行してください`);
}

main();
```

- [ ] **Step 6: 型チェックを通す**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add pipeline
git commit -m "feat: merge-topics（トピック統合による台帳掃除）"
```

---

### Task 10: 週次更新スキル（LLM分類の手順書）

**Files:**
- Create: `.claude/skills/update-data/SKILL.md`

このプロジェクトの心臓部。LLM分類はAPIではなくClaude Codeセッション内で行うため、分類ルールと運用手順をプロジェクトスキルとして固定する。

- [ ] **Step 1: .claude/skills/update-data/SKILL.md を作成**

````markdown
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
````

- [ ] **Step 2: コミット**

```bash
git add .claude
git commit -m "docs: 週次更新スキル（LLM分類ルールと運用手順）"
```

---

### Task 11: ミニ実走（実データで一気通貫・名寄せ品質の早期検証）

**Files:**
- Modify: `data/meta.json`（実際の会期情報に更新）
- 生成: `data/assignments/`, `data/topics.json`, `data/aggregates/`, `data/topic-details/`

サイトを作る前に、実データでパイプライン全体を通す。これが最初のマイルストーン（DESIGN.mdの「名寄せ品質を早期に確かめる」）。

- [ ] **Step 1: 現在の会期情報を確認する**

```bash
curl -s "https://kokkai.ndl.go.jp/api/meeting_list?from=2026-05-01&until=2026-06-11&maximumRecords=5&recordPacking=json"
```

レスポンスの `session`（会期番号）と `date` を確認。続けてWebSearchで「第{session}回国会 召集日」を調べ、会期開始日を特定する。

- [ ] **Step 2: data/meta.json を実際の値に更新**

`sessionStartDate` を召集日に、`sessionLabel` を「第{session}回国会（2026年通常国会）」形式に書き換える。

- [ ] **Step 3: 数日分の会議録を取得**

```bash
npm run fetch -- --from 2026-05-25 --until 2026-05-27
```

Expected: `fetched: ...` が数件〜十数件、`done: N new, 0 cached`。0件の場合は会議録公開の遅延が原因なので、期間をさらに1〜2週間前にずらして再実行。

- [ ] **Step 4: バッチ生成**

```bash
npm run batch
```

Expected: `pending batches (N):` とバッチID一覧。`data/assignments/` に各会議のファイルができ、議事進行発言が自動割当済みであること。

- [ ] **Step 5: 小さい会議1〜2件分のバッチを分類する**

`.claude/skills/update-data/SKILL.md` の「分類ルール」に従い、Claude自身が `cache/llm/input/<batchId>.json` を読み、`cache/llm/output/<batchId>.json` を書き、各バッチ直後に:

```bash
npm run ingest -- --batch <batchId>
```

Expected: `new topic: t0001 ...` と `ingested <batchId>: N assignments (n/expected)`。検証エラーが出たら出力JSONを修正して再実行。

- [ ] **Step 6: 集計を実行**

```bash
npm run aggregate
```

Expected: `aggregated: N speeches, M topics with data, P periods`

- [ ] **Step 7: シェア合計が1になることを検証**

```bash
node -e "const a=require('./data/aggregates/periods/session.json'); console.log(a.topics.reduce((s,t)=>s+t.share,0))"
```

Expected: `1` または `0.9999...`（浮動小数点誤差の範囲）

- [ ] **Step 8: 台帳の品質を目視確認**

`data/topics.json` を開き、トピック名が「具体的な争点」粒度になっているか、明らかな重複がないかを確認。問題があれば SKILL.md の分類ルールの文言を改善してコミットに含める。

- [ ] **Step 9: コミット**

```bash
git add data .claude
git commit -m "data: ミニ実走（実会議録での一気通貫検証と初期トピック台帳）"
```

---

### Task 12: Astroサイト土台（レイアウト・このサイトについて）

**Files:**
- Create: `site/package.json`, `site/astro.config.mjs`, `site/tsconfig.json`, `site/scripts/sync-data.mjs`, `site/src/layouts/Layout.astro`, `site/src/pages/about.astro`

- [ ] **Step 1: site/package.json を作成**

```json
{
  "name": "site",
  "private": true,
  "type": "module",
  "scripts": {
    "predev": "node scripts/sync-data.mjs",
    "dev": "astro dev",
    "prebuild": "node scripts/sync-data.mjs",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "echarts": "^5.6.0"
  }
}
```

- [ ] **Step 2: 依存をインストール**

```bash
npm --prefix site install
```

- [ ] **Step 3: site/astro.config.mjs を作成**

`USERNAME` は `gh api user -q .login` で取得した実際のGitHubユーザー名に置き換える（ghが未認証なら `gh auth login` 後に実行。Task 15までに正しければよい）。

```js
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://USERNAME.github.io",
  base: "/kokkai-topics",
});
```

- [ ] **Step 4: site/tsconfig.json を作成**

```json
{
  "extends": "astro/tsconfigs/base"
}
```

- [ ] **Step 5: site/scripts/sync-data.mjs を作成**

ビルド・dev起動前に集計データを public/ へコピーする（クライアントのfetch用）。

```js
import { cp, mkdir, rm } from "node:fs/promises";

await rm("public/data", { recursive: true, force: true });
await mkdir("public/data", { recursive: true });
await cp("../data/aggregates", "public/data/aggregates", { recursive: true });
console.log("synced data/aggregates -> site/public/data/aggregates");
```

- [ ] **Step 6: site/src/layouts/Layout.astro を作成**

```astro
---
interface Props {
  title: string;
  description?: string;
}
const { title, description = "国会で議論されている争点と、その議論量の割合を可視化するサイト" } = Astro.props;
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
---

<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} | 国会トピックマップ</title>
    <meta name="description" content={description} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
  </head>
  <body>
    <header>
      <a href={`${base}/`}><strong>国会トピックマップ</strong></a>
      <nav><a href={`${base}/about/`}>このサイトについて</a></nav>
    </header>
    <main><slot /></main>
    <footer>
      <p>
        出典: <a href="https://kokkai.ndl.go.jp/">国会会議録検索システム</a>のAPIを利用しています。
        トピック分類は機械処理（LLM）によるもので、誤りを含む可能性があります。
      </p>
    </footer>
  </body>
</html>

<style is:global>
  body {
    font-family: system-ui, "Hiragino Sans", "Yu Gothic UI", sans-serif;
    margin: 0;
    color: #222;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    border-bottom: 1px solid #ddd;
  }
  header a {
    color: inherit;
    text-decoration: none;
  }
  main {
    max-width: 1000px;
    margin: 0 auto;
    padding: 16px 20px 40px;
  }
  footer {
    border-top: 1px solid #ddd;
    padding: 12px 20px;
    font-size: 12px;
    color: #666;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 14px;
  }
  th,
  td {
    border-bottom: 1px solid #eee;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
</style>
```

- [ ] **Step 7: site/src/pages/about.astro（手法解説ページ）を作成**

```astro
---
import Layout from "../layouts/Layout.astro";
---

<Layout title="このサイトについて">
  <h1>このサイトについて</h1>
  <p>
    国会トピックマップは、国会で「何が」「どのくらいの割合で」議論されているかを可視化する個人プロジェクトです。
  </p>

  <h2>データの出どころ</h2>
  <p>
    国立国会図書館の<a href="https://kokkai.ndl.go.jp/">国会会議録検索システム</a>が公開するAPIから、
    衆参両院の本会議とすべての委員会の発言テキストを取得しています。
    会議録の公開は会議の開催から数日〜数週間遅れるため、本サイトの内容はリアルタイムではありません。
  </p>

  <h2>集計方法</h2>
  <ul>
    <li>各発言を、LLM（大規模言語モデル）が「ガソリン税・暫定税率」のような具体的な争点に分類します（1発言＝1トピック）。</li>
    <li>議論量は<strong>発言の文字数</strong>（空白除去後）で測ります。会議録には発言時間が記録されないため、文字数を時間の代理指標としています。</li>
    <li>委員長の議事進行発言（開会宣言など）は集計から除外しています。</li>
    <li>どの争点にも該当しない発言は「その他」として分母に含めています。</li>
    <li>文字数の合計・割合の計算はすべてプログラムによる機械処理で、検証可能です。</li>
  </ul>

  <h2>限界と注意点</h2>
  <ul>
    <li>トピックへの分類はLLMによる自動処理であり、誤分類を含む可能性があります。</li>
    <li>大臣・政府参考人は会議録上の会派情報がないため、会派別表示では「政府・不明」に分類されます。</li>
    <li>本サイトは特定の政党・政治的立場を支持するものではありません。分類・集計の手法はすべて本ページの通り機械的に行われています。</li>
  </ul>

  <h2>原文へのリンク</h2>
  <p>
    各トピックの詳細ページから、すべての該当発言について国会会議録検索システムの原文を参照できます。
    数字の根拠は必ず一次ソースで確認できます。
  </p>
</Layout>
```

- [ ] **Step 8: ビルドが通ることを確認**

```bash
npm --prefix site run build
```

Expected: `[build] Complete!` などのビルド成功メッセージ。site/dist/ に about/index.html が生成される。

- [ ] **Step 9: コミット**

```bash
git add site
git commit -m "feat: Astroサイト土台（レイアウトと手法解説ページ）"
```

---

### Task 13: トップページ（ツリーマップ＋期間・会派フィルタ）

**Files:**
- Create: `site/src/pages/index.astro`

`data/aggregates/index.json` をビルド時に読んでセレクトボックスを生成し、期間ファイル（`periods/{key}.json`）はクライアントが fetch して描画する。タイルクリックでトピック詳細ページへ遷移（「その他」は遷移しない）。

- [ ] **Step 1: site/src/pages/index.astro を作成**

```astro
---
import Layout from "../layouts/Layout.astro";
import index from "../../../data/aggregates/index.json";
---

<Layout title="いま国会で何が議論されているか">
  <h1>いま国会で何が議論されているか</h1>
  <p>
    {index.sessionLabel}の発言量（文字数）に占める各争点の割合。面積が大きいほど多く議論されています。
    データ更新日: {index.generatedAt}
  </p>
  <div class="controls">
    <label>
      期間
      <select id="period">
        {index.periods.map((p) => <option value={p.key}>{p.label}</option>)}
      </select>
    </label>
    <label>
      会派
      <select id="party">
        <option value="all">すべて</option>
        {index.parties.map((g) => <option value={g}>{g}</option>)}
      </select>
    </label>
  </div>
  <div id="treemap"></div>
</Layout>

<style>
  .controls {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
  }
  #treemap {
    width: 100%;
    height: 600px;
  }
  @media (max-width: 600px) {
    #treemap {
      height: 420px;
    }
  }
</style>

<script>
  import * as echarts from "echarts";

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const chart = echarts.init(document.getElementById("treemap"));
  const periodSel = document.getElementById("period") as HTMLSelectElement;
  const partySel = document.getElementById("party") as HTMLSelectElement;

  async function render() {
    const res = await fetch(`${base}/data/aggregates/periods/${periodSel.value}.json`);
    const period = await res.json();
    const src =
      partySel.value === "all" ? period : (period.byParty[partySel.value] ?? { topics: [], totalChars: 0 });
    chart.setOption(
      {
        tooltip: {
          formatter: (p: any) =>
            `${p.name}<br>${(p.data.share * 100).toFixed(1)}%（${p.value.toLocaleString()}文字）`,
        },
        series: [
          {
            type: "treemap",
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: {
              show: true,
              formatter: (p: any) => `${p.name}\n${(p.data.share * 100).toFixed(1)}%`,
            },
            data: src.topics.map((t: any) => ({ name: t.name, value: t.chars, id: t.id, share: t.share })),
          },
        ],
      },
      true,
    );
  }

  chart.on("click", (p: any) => {
    if (p.data && p.data.id && p.data.id !== "other") {
      location.href = `${base}/topics/${p.data.id}/`;
    }
  });
  periodSel.addEventListener("change", render);
  partySel.addEventListener("change", render);
  addEventListener("resize", () => chart.resize());
  render();
</script>
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
npm --prefix site run build
```

Expected: ビルド成功。`site/dist/index.html` が生成される。

- [ ] **Step 3: 開発サーバーで表示確認**

```bash
npm --prefix site run dev
```

ブラウザ（またはプレビューツール）で `http://localhost:4321/kokkai-topics/` を開き、以下を確認:
- ツリーマップが描画され、Task 11 で分類したトピックのタイルが見える
- 期間セレクトの切替でタイル構成が変わる
- 会派セレクトで会派別の内訳に変わる
- タイルクリックで `/kokkai-topics/topics/t0001/` へ遷移しようとする（詳細ページは Task 14 までは404で正常）

確認後、dev サーバーを停止する。

- [ ] **Step 4: コミット**

```bash
git add site
git commit -m "feat: トップページ（ツリーマップと期間・会派フィルタ）"
```

---

### Task 14: トピック詳細ページ

**Files:**
- Create: `site/src/pages/topics/[id].astro`

`data/topic-details/*.json` からビルド時に静的生成。争点サマリー・週次推移・主な発言者・発言一覧（原文リンク付き）を表示する。

- [ ] **Step 1: site/src/pages/topics/[id].astro を作成**

```astro
---
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Layout from "../../layouts/Layout.astro";

export function getStaticPaths() {
  const dir = fileURLToPath(new URL("../../../../data/topic-details/", import.meta.url));
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const detail = JSON.parse(readFileSync(dir + f, "utf8"));
      return { params: { id: detail.id }, props: { detail } };
    });
}

const { detail } = Astro.props;
const pct = (x: number) => (x * 100).toFixed(1) + "%";
---

<Layout title={detail.name} description={detail.description}>
  <h1>{detail.name}</h1>
  <p>{detail.description}</p>
  <p>
    会期全体の議論量に占める割合: <strong>{pct(detail.sessionShare)}</strong>
    （{detail.totalChars.toLocaleString()}文字）
  </p>

  <h2>週ごとの推移（全議論に占める割合）</h2>
  <div id="trend"></div>
  <script is:inline type="application/json" id="weekly-data" set:html={JSON.stringify(detail.weekly)} />

  <h2>主な発言者</h2>
  <table>
    <thead><tr><th>発言者</th><th>会派</th><th>文字数</th></tr></thead>
    <tbody>
      {detail.topSpeakers.map((s: any) => (
        <tr>
          <td>{s.speaker}</td>
          <td>{s.group}</td>
          <td>{s.chars.toLocaleString()}</td>
        </tr>
      ))}
    </tbody>
  </table>

  <h2>発言一覧{detail.speechesTruncated && "（最新200件）"}</h2>
  <table>
    <thead><tr><th>日付</th><th>会議</th><th>発言者</th><th>内容（冒頭）</th></tr></thead>
    <tbody>
      {detail.speeches.map((s: any) => (
        <tr>
          <td>{s.date}</td>
          <td>{s.house} {s.meeting}</td>
          <td>{s.speaker}（{s.group}）</td>
          <td>
            {s.excerpt}…
            <a href={s.url} target="_blank" rel="noopener">原文</a>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</Layout>

<style>
  #trend {
    width: 100%;
    height: 300px;
  }
</style>

<script>
  import * as echarts from "echarts";

  const weekly = JSON.parse(document.getElementById("weekly-data")!.textContent!);
  const chart = echarts.init(document.getElementById("trend"));
  chart.setOption({
    xAxis: { type: "category", data: weekly.map((w: any) => w.week.slice(5)) },
    yAxis: { type: "value", axisLabel: { formatter: (v: number) => (v * 100).toFixed(0) + "%" } },
    tooltip: { trigger: "axis", valueFormatter: (v: any) => (Number(v) * 100).toFixed(1) + "%" },
    series: [{ type: "bar", data: weekly.map((w: any) => w.share) }],
  });
  addEventListener("resize", () => chart.resize());
</script>
```

- [ ] **Step 2: ビルドが通り詳細ページが生成されることを確認**

```bash
npm --prefix site run build
```

Expected: ビルド成功。`site/dist/topics/t0001/index.html` など、Task 11 で作られたトピックぶんのページが生成される。

- [ ] **Step 3: 開発サーバーで表示確認**

```bash
npm --prefix site run dev
```

`http://localhost:4321/kokkai-topics/` からタイルをクリックして詳細ページに遷移し、推移グラフ・発言者表・発言一覧と「原文」リンク（kokkai.ndl.go.jp へ飛ぶ）を確認。確認後、dev サーバーを停止する。

- [ ] **Step 4: コミット**

```bash
git add site
git commit -m "feat: トピック詳細ページ（推移・発言者・原文リンク付き発言一覧）"
```

---

### Task 15: GitHubリポジトリ作成とPagesデプロイ

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `site/astro.config.mjs`（USERNAMEの確定）

- [ ] **Step 1: .github/workflows/deploy.yml を作成**

```yaml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci --prefix site
      - run: npm run build --prefix site
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: astro.config.mjs のユーザー名を確定**

```bash
gh api user -q .login
```

出力されたユーザー名が `site/astro.config.mjs` の `site: "https://USERNAME.github.io"` と一致しているか確認し、違えば修正する。`gh` が未認証の場合は `gh auth login` を先に実行。

- [ ] **Step 3: コミット**

```bash
git add .github site
git commit -m "ci: GitHub Pagesデプロイワークフロー"
```

- [ ] **Step 4: リポジトリを作成してpush**

```bash
gh repo create kokkai-topics --public --source . --push
```

Expected: リポジトリが作成され、mainがpushされる。
注: GitHub Pages の無料利用は公開リポジトリが前提（DESIGN.md の未決事項）。非公開にしたい場合はユーザーに確認すること。

- [ ] **Step 5: GitHub Pages を有効化（ソース: GitHub Actions）**

```bash
gh api "repos/{owner}/kokkai-topics/pages" -X POST -f build_type=workflow
```

409（既に有効）なら問題なし。gh api が失敗する場合はブラウザで Settings → Pages → Source を「GitHub Actions」に設定。

- [ ] **Step 6: ワークフローを実行して完走を確認**

```bash
gh workflow run deploy
gh run watch
```

Expected: build / deploy 両ジョブが成功。

- [ ] **Step 7: 公開URLを確認**

```bash
curl -s -o /dev/null -w "%{http_code}" https://USERNAME.github.io/kokkai-topics/
```

Expected: `200`。ブラウザでも開き、ツリーマップが表示されることを確認する。

---

### Task 16: バックフィル開始（会期初めからの遡り処理・初回分）

**Files:**
- 生成: `data/` 配下の更新のみ（コード変更なし）

会期開始〜現在の全会議録の処理は数千万トークン規模のため、一度にやらずチャンクで消化する（SKILL.md「バックフィル」参照）。このタスクでは最初の1チャンクを実行して手順が回ることを確認する。残りは日次〜週次で繰り返す。

- [ ] **Step 1: 会期最初の1ヶ月分を取得**

`data/meta.json` の `sessionStartDate`（Task 11 で設定済み）を開始日として:

```bash
npm run fetch -- --from <sessionStartDate> --until <sessionStartDateの1ヶ月後>
npm run batch
```

Expected: pending batches が数十件規模で表示される。

- [ ] **Step 2: 20バッチを上限に分類→ingest を繰り返す**

`.claude/skills/update-data/SKILL.md` の手順3の通り。各バッチごとに台帳を読み直すこと。

- [ ] **Step 3: 集計・ビルド確認・コミット**

```bash
npm run aggregate
npm --prefix site run build
git add data
git commit -m "data: バックフィル（<処理した期間>分）"
git push
```

Expected: push後、Actionsが自動デプロイし、サイトのトピックが増えている。

- [ ] **Step 4: 残作業を記録**

`npm run batch` の pending 件数を確認し、残りのバックフィル範囲（期間）をユーザーに報告。以後は次の運用に移る:
- 週次: `/update-data` スキルで新着処理（安定したら Claude Code の `/schedule` で自動化を検討）
- バックフィル: 利用上限と相談しながら1日20バッチ程度を継続

---

## 完了の定義

- `npm test` が全件PASS
- 実会議録データで fetch → batch → 分類 → ingest → aggregate が一気通貫で動く
- シェア合計が各期間で1.0（浮動小数点誤差内）
- GitHub Pages 上でツリーマップ・フィルタ・詳細ページ・手法解説ページが動作
- 週次更新が `.claude/skills/update-data/SKILL.md` の手順で再現可能






