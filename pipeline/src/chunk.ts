import type { SpeechRecord } from "./types";

// NOTE: CHUNK_MAX_CHARS must remain stable for already-ingested meetings.
// Changing it only affects meetings not yet fully ingested (chunk splitting is deterministic).
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
