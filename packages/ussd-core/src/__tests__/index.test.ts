import { describe, expect, it } from "vitest";
import { routeUssd, swahiliMenu } from "../index.js";

describe("Swahili USSD menu", () => {
  it("returns the main menu with all four options on an empty payload", () => {
    const reply = routeUssd("");
    expect(reply.kind).toBe("CON");
    expect(reply.body).toContain("Karibu resili");
    expect(reply.body).toContain("1. Hatari ya mafuriko");
    expect(reply.body).toContain("2. Ripoti tukio");
    expect(reply.body).toContain("3. Malipo yangu");
    expect(reply.body).toContain("4. Msaada");
  });

  it("returns the flood risk digest with probabilistic language on '1'", () => {
    const reply = routeUssd("1");
    expect(reply.kind).toBe("END");
    expect(reply.body).toContain("uwezekano");
    // Never asserts certainty — must not claim flooding "will" happen.
    expect(reply.body).not.toMatch(/itatokea/i);
  });

  it("attributes flood-risk information to KMD, NDMA and the county", () => {
    const reply = routeUssd("1");
    expect(reply.body).toContain("KMD");
    expect(reply.body).toContain("NDMA");
    expect(reply.body).toContain("kaunti");
  });

  it("opens the incident-report submenu on '2'", () => {
    const reply = routeUssd("2");
    expect(reply.kind).toBe("CON");
    expect(reply.body).toContain("Ripoti tukio");
    expect(reply.body).toContain("1. Mafuriko");
  });

  it.each(["2*1", "2*2", "2*3"])(
    "acknowledges an incident report on drill-down %s",
    (input) => {
      const reply = routeUssd(input);
      expect(reply.kind).toBe("END");
      expect(reply.body).toContain("Ripoti yako imepokelewa");
      expect(reply.body).toContain("kata"); // ward-level generalisation
      expect(reply.body).toContain("uongo"); // warns against false reports
    }
  );

  it("returns to the main menu on '2*0'", () => {
    expect(routeUssd("2*0").body).toContain("Karibu resili");
  });

  it("explains payout guardrails on '3'", () => {
    const reply = routeUssd("3");
    expect(reply.kind).toBe("END");
    expect(reply.body).toContain("Idhini mbili"); // two-person approval
    expect(reply.body).toContain(">= 75");
    expect(reply.body).toContain("Siku 3+");
  });

  it("returns the help/attribution notice on '4'", () => {
    const reply = routeUssd("4");
    expect(reply.kind).toBe("END");
    expect(reply.body).toContain("Hauchukui nafasi ya KMD au NDMA");
  });

  it("falls back cleanly on unknown input", () => {
    const reply = routeUssd("9*9*9");
    expect(reply.kind).toBe("END");
    expect(reply.body).toContain("Chaguo halijatambulika");
    expect(reply.body).toContain("*384*001#");
  });

  it("tolerates trailing '*' and duplicate separators from aggregators", () => {
    expect(routeUssd("2*1*").body).toContain("Ripoti yako imepokelewa");
    expect(routeUssd("2**1").body).toContain("Ripoti yako imepokelewa");
    expect(routeUssd("  2*1  ").body).toContain("Ripoti yako imepokelewa");
  });

  it("returns a system-error END for null/undefined text", () => {
    expect(routeUssd(null).kind).toBe("END");
    expect(routeUssd(undefined).body).toContain("Hitilafu");
  });

  it("swahiliMenu preserves the legacy on-wire format", () => {
    expect(swahiliMenu("")).toMatch(/^CON /);
    expect(swahiliMenu("1")).toMatch(/^END /);
    expect(swahiliMenu("")).toContain("Hatari ya mafuriko");
    expect(swahiliMenu("1")).toContain("uwezekano");
  });
});
