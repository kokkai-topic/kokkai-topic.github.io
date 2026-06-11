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
