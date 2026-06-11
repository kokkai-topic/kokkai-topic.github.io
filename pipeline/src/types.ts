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
  category?: string; // categories.ts の CATEGORIES のいずれか。未設定は「その他」扱い
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
  category?: string; // categories.ts の CATEGORIES のいずれか
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
