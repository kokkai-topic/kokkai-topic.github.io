import { cp, mkdir, rm } from "node:fs/promises";

await rm("public/data", { recursive: true, force: true });
await mkdir("public/data", { recursive: true });
await cp("../data/aggregates", "public/data/aggregates", { recursive: true });
console.log("synced data/aggregates -> site/public/data/aggregates");
