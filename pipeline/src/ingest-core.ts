import { CATEGORIES } from "./categories";
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
    // tempId重複を許すと最初の提案が「割当ゼロの幽霊トピック」として台帳に残ってしまう
    if (tempMap.has(nt.tempId)) {
      errors.push(`duplicate tempId: ${nt.tempId}`);
      continue;
    }
    if (nt.category && !(CATEGORIES as readonly string[]).includes(nt.category)) {
      errors.push(`unknown category: ${nt.category} (topic ${nt.name})`);
      continue;
    }
    const existing = topics.find((t) => t.name === nt.name);
    if (existing) {
      tempMap.set(nt.tempId, existing.id);
      continue;
    }
    const id = `t${String(nextId).padStart(4, "0")}`;
    nextId++;
    const topic: Topic = { id, name: nt.name, description: nt.description, firstSeen: date, category: nt.category };
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
