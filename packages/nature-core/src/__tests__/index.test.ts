import { expect, it } from "vitest";
import { nbsOpportunityScore } from "../index.js";

it("ranks indicative nature-based adaptation opportunities", () => {
  expect(nbsOpportunityScore({ riparianDeficit: 0.8, wetlandLossProxy: 0.7, upstreamContribution: 0.6 })).toBe(71.5);
});