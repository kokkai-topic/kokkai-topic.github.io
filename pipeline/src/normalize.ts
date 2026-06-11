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
