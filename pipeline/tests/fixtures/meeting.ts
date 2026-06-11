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
