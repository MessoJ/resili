import { expect, it } from "vitest";
import { initialMigrations } from "../index.js";

it("defines append-only risk and trigger audit persistence", () => {
  const sql = initialMigrations[0]?.sql ?? "";
  expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS postgis");
  expect(sql).toContain("inputs_hash text NOT NULL UNIQUE");
  expect(sql).toContain("event_hash text NOT NULL UNIQUE");
});