import { expect, it } from "vitest";
import { InMemoryRepository } from "../index.js";

it("stores immutable snapshots and rejects duplicate audit identifiers", () => {
  const repository = new InMemoryRepository<{ id: string; createdAt: string; score: number }>();
  const record = repository.create({ id: "risk-1", createdAt: "2026-08-20T12:00:00Z", score: 78 });
  record.score = 0;
  expect(repository.get("risk-1")?.score).toBe(78);
  expect(() => repository.create({ id: "risk-1", createdAt: "2026-08-20T12:00:00Z", score: 78 })).toThrow("already exists");
});