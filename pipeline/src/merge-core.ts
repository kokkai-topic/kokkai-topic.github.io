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
