import { expect, it } from "vitest";
import { toCapXml } from "../index.js";

it("emits source-attributed CAP 1.2 alert XML with uncertainty", () => {
  const xml = toCapXml({ identifier: "rezili-demo-1", sentAt: "2026-08-20T12:00:00Z", expiresAt: "2026-08-21T12:00:00Z", areaDescription: "Nyando demonstration ward", source: "https://example.test/forecast-provenance", riskScore: 78, uncertainty: "Conditions may change; this is not an official warning." });
  expect(xml).toContain('xmlns="urn:oasis:names:tc:emergency:cap:1.2"');
  expect(xml).toContain("Conditions may change");
});