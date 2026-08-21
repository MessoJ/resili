// resili — Swahili-first USSD menu (shared reference logic).
//
// This package is the single source of truth for the Swahili USSD flow.
// It is mirrored by `services/gateway/internal/handler/ussd.go`, which
// receives Africa's Talking callbacks. Keeping the tree here means the
// menu text, drill-down structure, and climate-safety attributions can
// be reviewed, tested, and evolved in TypeScript alongside the console.
//
// Africa's Talking encodes session continuation by appending each user
// input to a `*`-separated string in the `text` field. For example:
//
//   Dial *384*001#         → text = ""
//   User presses 2         → text = "2"
//   User then presses 1    → text = "2*1"
//
// A response of `CON …` keeps the session open; `END …` closes it.
//
// Climate-safety guardrails honoured here:
//   • Never state that flooding "will" happen — always frame as
//     likelihood, and cite KMD, NDMA and the county.
//   • Never impersonate KMD/NDMA — we surface *decision-support*
//     estimates and defer to official directives.
//   • Community reports are ward-generalised and the caller is warned
//     against submitting false reports.
//   • Payouts require ≥3 days lead time, risk ≥75, and two-person
//     approval — communicated on the payout branch.

export type UssdReply = {
  /** Whether the USSD session continues (`CON`) or ends (`END`). */
  kind: "CON" | "END";
  /** Human-readable Swahili body without the leading `CON`/`END`. */
  body: string;
};

/** Convenience: render a reply the way Africa's Talking expects. */
export function renderReply(reply: UssdReply): string {
  return `${reply.kind} ${reply.body}`;
}

const HELPLINE = "*384*001#";

const MAIN_MENU: UssdReply = {
  kind: "CON",
  body:
    "Karibu resili\n" +
    "Habari za hatari ya mafuriko\n\n" +
    "1. Hatari ya mafuriko\n" +
    "2. Ripoti tukio\n" +
    "3. Malipo yangu\n" +
    "4. Msaada",
};

const FLOOD_RISK: UssdReply = {
  kind: "END",
  body:
    "Hatari ya mafuriko:\n\n" +
    "Nyando: Hatari kubwa (uwezekano 78%)\n" +
    "Budalangi: Hatari kubwa sana\n" +
    "Kano: Hatari ya wastani\n\n" +
    "Hizi ni makadirio ya usaidizi wa maamuzi.\n" +
    "Chanzo: KMD, NDMA na kaunti.",
};

const REPORT_MENU: UssdReply = {
  kind: "CON",
  body:
    "Ripoti tukio:\n" +
    "1. Mafuriko\n" +
    "2. Mvua kubwa\n" +
    "3. Barabara imezuiwa\n" +
    "0. Rudi",
};

const REPORT_ACK: UssdReply = {
  kind: "END",
  body:
    "Asante. Ripoti yako imepokelewa na itathibitishwa.\n" +
    "Eneo lako limerekodiwa kwa kiwango cha kata.\n" +
    "Usitume taarifa za uongo — kunaweza kuwa na hatua za kisheria.",
};

const PAYOUT: UssdReply = {
  kind: "END",
  body:
    "Malipo:\n\n" +
    "Malipo halisi hutumwa baada ya:\n" +
    "- Hatari kubwa (alama >= 75)\n" +
    "- Siku 3+ za onyo\n" +
    "- Idhini mbili tofauti\n\n" +
    "Hali: Hakuna malipo yanayosubiri.",
};

const HELP: UssdReply = {
  kind: "END",
  body:
    "resili ni mfumo wa usaidizi wa maamuzi\n" +
    "ya hatari ya mafuriko kwa Bonde la\n" +
    "Ziwa Victoria.\n\n" +
    "Hauchukui nafasi ya KMD au NDMA.\n" +
    "Fuata maelekezo rasmi kila wakati.",
};

const SYSTEM_ERROR: UssdReply = {
  kind: "END",
  body: "Hitilafu ya mfumo. Jaribu tena baadaye.",
};

const UNKNOWN: UssdReply = {
  kind: "END",
  body: `Chaguo halijatambulika. Piga tena ${HELPLINE}`,
};

/**
 * Route an Africa's Talking `text` payload to the appropriate reply.
 *
 * `text` is the raw `*`-separated input string from AT. Whitespace and
 * a trailing `*` (which some aggregators append) are tolerated.
 */
export function routeUssd(text: string | null | undefined): UssdReply {
  if (text === null || text === undefined) return SYSTEM_ERROR;

  // Normalise: trim whitespace, drop trailing "*", collapse duplicate "*".
  const input = text
    .trim()
    .replace(/\*+$/, "")
    .replace(/\*{2,}/g, "*");

  switch (input) {
    case "":
      return MAIN_MENU;
    case "1":
      return FLOOD_RISK;
    case "2":
      return REPORT_MENU;
    case "2*0":
      return MAIN_MENU;
    case "2*1":
    case "2*2":
    case "2*3":
      return REPORT_ACK;
    case "3":
      return PAYOUT;
    case "4":
      return HELP;
    default:
      return UNKNOWN;
  }
}

/**
 * Backwards-compatible one-shot API used by the existing test and
 * downstream callers. Returns the fully-rendered `CON …` / `END …`
 * string that Africa's Talking expects on the wire.
 */
export function swahiliMenu(input: string | null | undefined): string {
  return renderReply(routeUssd(input));
}
