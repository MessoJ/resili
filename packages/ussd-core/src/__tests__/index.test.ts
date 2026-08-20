import { expect, it } from "vitest";
import { swahiliMenu } from "../index.js";

it("provides a low-bandwidth Swahili safety menu", () => {
  expect(swahiliMenu("")).toContain("Hatari ya mafuriko");
  expect(swahiliMenu("1")).toContain("uwezekano");
});