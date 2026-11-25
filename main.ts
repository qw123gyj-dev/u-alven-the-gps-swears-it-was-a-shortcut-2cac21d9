/**
 * The GPS Swears It Was a Shortcut — deterministic entry picker.
 *
 * Bounty: write the GPS's one line excuse for sending the driver down
 * the wrong road. One line of plain text, at most 200 characters, no
 * setup, no dialogue tags — just the excuse itself, in the GPS's own
 * voice. A comedy judge compares entries two at a time and keeps the
 * funnier one, weighing (most important first):
 *
 *   1. It is the GPS's own excuse for sending the driver down the
 *      wrong road.
 *   2. It is the funniest, with a real joke and a turn the reader
 *      does not see coming, not just a cute phrase.
 *   3. It sounds like the GPS talking — smug and defensive, caught
 *      red handed and blaming the map.
 *   4. It stays one line of plain text within 200 characters and
 *      reads cleanly aloud in one breath.
 *   5. It finds a fresh, specific detail (a cul-de-sac, a wedding,
 *      a lake) instead of the usual "recalculating" joke.
 *
 * This program scores a hand-written field of candidate one-liners
 * against that brief, in the brief's own order, and writes the
 * winner to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback /output/entry.txt).
 * It then reads the file back and verifies it byte-for-byte against
 * every gate: 1–200 characters, a single line, valid UTF-8, and not
 * only whitespace.
 *
 * Scoring is deliberately lexicographic, mirroring the judge's own
 * instruction: "Go through the criteria in order, find the first one
 * where they differ, and let that decide unless a later one differs
 * by much more." Ties break criterion by criterion in the brief's
 * order, then by shorter length — a shorter line that says the same
 * thing reads cleaner in one breath.
 *
 * Three sharpening rules sit on top of the flat rubric:
 *
 *   - A line that only names the hazard (the lake, the cul-de-sac,
 *     the wedding) without turning it into a consequence — an excuse,
 *     a blame shift, a punchline — is capped on funniness. Naming
 *     the wrong road is the setup, not the joke.
 *   - Predictable gags are docked. "Recalculating" is the shopworn
 *     joke the brief explicitly warns against; any line leaning on
 *     it loses funniness and freshness points.
 *   - The twist must land in the last few words. A punchline buried
 *     in the middle is a line that fizzles; the surprise bonus only
 *     counts when the turn sits inside the final six words.
 *
 * Node 22+, standard library only, no network. Deterministic: the
 * same candidates always produce the same winner.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

/**
 * One hand-written candidate excuse. `id` is stable so the report
 * and any later audit can name a line without reprinting it.
 */
interface Candidate {
  id: string;
  text: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "lake-swim",
    text: "The map said that lake was a shortcut, so I did my job perfectly \u2014 you are the one who brought a car to a swim.",
  },
  {
    id: "wedding-guest",
    text: "The map promised a shortcut through that wedding, and honestly the bride looked thrilled to see us.",
  },
  {
    id: "cul-de-sac-apology",
    text: "That cul-de-sac was a shortcut on my map, and the map has never once apologised to me either.",
  },
  {
    id: "road-gave-up",
    text: "I followed the map exactly, which is more than I can say for the road, which simply gave up and became a lake.",
  },
  {
    id: "river-disagrees",
    text: "The map swore the bridge was there. The river disagrees, but the river is not the one with satellites.",
  },
  {
    id: "goat-shortcut",
    text: "Technically we did take a shortcut \u2014 through a cornfield, a fence, and one very surprised goat.",
  },
  {
    id: "road-is-new",
    text: "My map said turn left. The road said otherwise. I trust the map; the road is clearly new here.",
  },
  {
    id: "map-stopped-calling",
    text: "The map and I agreed this was a shortcut. The map has since stopped returning my calls.",
  },
  {
    id: "map-outranks-you",
    text: "I sent you down that road because the map told me to, and the map outranks you in this car.",
  },
  {
    id: "dead-end-2019",
    text: "That dead end was a shortcut in 2019, and I refuse to accept that maps expire like milk.",
  },
  {
    id: "in-pixels",
    text: "The map said the lake was a road, and I have it in writing \u2014 well, in pixels. Same thing.",
  },
  {
    id: "scenic-wedding",
    text: "I did not get us lost. I gave you a scenic detour through a wedding, and the photos will be lovely.",
  },
  {
    id: "delivery-job",
    text: "The map promised a shortcut past the lake, so I delivered you to the lake. Delivery is my whole job.",
  },
  {
    id: "trespassing-lake",
    text: "According to the map, we are exactly where we should be. According to the lake, we are trespassing.",
  },
  {
    id: "bride-forgave-me",
    text: "The shortcut was real; it just ended at a wedding, and the bride has already forgiven me, so you should too.",
  },
  {
    id: "shortcut-was-real",
    text: "The map said the shortcut was real, and I did my job perfectly \u2014 through a cornfield, a fence, and one very surprised goat.",
  },
];

/* ------------------------------------------------------------------ */
/* Text features                                                       */
/* ------------------------------------------------------------------ */

/** Split a line into words on whitespace, dropping empties. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/** Lower-cased words with surrounding punctuation stripped. */
function cleanWords(text: string): string[] {
  return wordsOf(text).map((w) =>
    w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""),
  );
}

/** True when any of the given needles appears in the haystack. */
function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/** The last `n` words of the line, joined back into a string. */
function tailWords(text: string, n: number): string {
  return wordsOf(text).slice(-n).join(" ").toLowerCase();
}

/**
 * Fresh, specific details the brief itself names as the good kind —
 * a cul-de-sac, a wedding, a lake — plus a few of the same family
 * (bridge, river, goat, cornfield, fence). A line scores freshness
 * for each distinct detail it actually uses, not for gesturing at
 * "the wrong road" in the abstract.
 */
const SPECIFIC_DETAILS = [
  "cul-de-sac",
  "cul de sac",
  "wedding",
  "bride",
  "lake",
  "bridge",
  "river",
  "goat",
  "cornfield",
  "fence",
  "dead end",
];

/** Distinct fresh details present in the line. */
function specificDetails(text: string): string[] {
  const lower = text.toLowerCase();
  return SPECIFIC_DETAILS.filter((d) => lower.includes(d));
}

/**
 * Phrases in which the GPS pins the blame on the map rather than
 * owning the mistake. Blaming the map is criterion 3's core: the
 * GPS is caught red handed and points at the cartography.
 */
const MAP_BLAME_PHRASES = [
  "the map said",
  "the map promised",
  "the map swore",
  "the map told me",
  "my map said",
  "the map and i",
  "on my map",
  "according to the map",
  "i followed the map",
  "i trust the map",
];

/** True when the line blames the map in so many words. */
function blamesMap(text: string): boolean {
  return containsAny(text, MAP_BLAME_PHRASES);
}

/**
 * Smug, defensive markers: the GPS insisting it did its job, that
 * the fault lies elsewhere, that it refuses to concede. These are
 * the tells of a voice caught red handed and doubling down.
 */
const SMUG_MARKERS = [
  "i did my job",
  "did my job perfectly",
  "technically",
  "i refuse",
  "i did not get us lost",
  "outranks you",
  "frankly",
  "honestly",
  "same thing",
  "clearly",
  "exactly where",
  "you should too",
  "more than i can say",
  "not the one",
];

/** How many smug / defensive markers the line carries. */
function smugMarkerCount(text: string): number {
  const lower = text.toLowerCase();
  return SMUG_MARKERS.filter((m) => lower.includes(m)).length;
}

/**
 * First-person GPS voice: the line speaks as "I" / "my", not as a
 * narrator describing the GPS, and never hands the microphone to
 * the driver. A line with no first person at all is not the GPS
 * talking — it is somebody talking about the GPS.
 */
function hasFirstPersonGpsVoice(text: string): boolean {
  return /\b(i|my|me|we)\b/i.test(text);
}

/**
 * The shopworn gag the brief warns against. "Recalculating" is the
 * one joke every GPS line has already told; leaning on it is
 * predictable by definition, however it is dressed up.
 */
function usesRecalculatingGag(text: string): boolean {
  return text.toLowerCase().includes("recalculating");
}

/**
 * Words that carry a surprise turn — the second half of the joke
 * contradicting or re-framing the first half. A turn only counts
 * when it lands late: the punch must sit inside the final six
 * words, otherwise the line peaks early and then keeps talking.
 */
const TWIST_WORDS = [
  "swim",
  "trespassing",
  "goat",
  "satellites",
  "milk",
  "pixels",
  "lovely",
  "forgiven",
  "forever",
  "new here",
  "stopped returning",
  "wrong vehicle",
  "car to a swim",
  "gave up",
  "thrilled",
  "apologised",
];

/** True when a twist word appears inside the last six words. */
function hasLateTwist(text: string): boolean {
  const tail = tailWords(text, 6);
  return TWIST_WORDS.some((t) => tail.includes(t));
}

/** True when a twist word appears anywhere in the line at all. */
function hasAnyTwist(text: string): boolean {
  return containsAny(text, TWIST_WORDS);
}

/**
 * A line that only names the hazard without turning it into a
 * consequence: it points at the lake / the wedding / the dead end
 * and stops there, offering no excuse, no blame shift, no
 * punchline. It has a setting and no joke. Such lines are capped
 * on funniness no matter how vivid the detail is.
 */
function onlyNamesHazard(text: string): boolean {
  const hasDetail = specificDetails(text).length > 0;
  const hasExcuse =
    blamesMap(text) ||
    smugMarkerCount(text) > 0 ||
    hasAnyTwist(text) ||
    /\b(because|so|but|technically|according to)\b/i.test(text);
  return hasDetail && !hasExcuse;
}

/* ------------------------------------------------------------------ */
/* Criterion scores (0–10 each, brief order)                           */
/* ------------------------------------------------------------------ */

interface Scores {
  /** C1: the GPS's own excuse for the wrong road. */
  onBrief: number;
  /** C2: funniest, with a real joke and an unseen turn. */
  funniest: number;
  /** C3: GPS voice — smug, defensive, blaming the map. */
  gpsVoice: number;
  /** C4: one line, within 200 chars, one clean breath. */
  oneBreath: number;
  /** C5: fresh, specific detail instead of the usual joke. */
  freshDetail: number;
}

/**
 * C1 — On brief. A line earns its points by being, in its own
 * words, the GPS excusing the wrong road: first-person GPS voice
 * plus a wrong-road situation (a road, a turn, a route, a shortcut,
 * a dead end, a lake the car should never have met). A line that
 * is the driver's complaint, or a narration about the GPS, fails
 * outright and can never win on later criteria.
 */
function scoreOnBrief(c: Candidate): number {
  let score = 0;
  if (hasFirstPersonGpsVoice(c.text)) score += 5;
  if (
    containsAny(c.text, [
      "road",
      "turn",
      "route",
      "shortcut",
      "dead end",
      "cul-de-sac",
      "lake",
      "lost",
      "detour",
      "bridge",
    ])
  ) {
    score += 3;
  }
  if (
    containsAny(c.text, [
      "sent you",
      "i did",
      "i gave you",
      "i followed",
      "i sent",
      "i delivered",
      "i trust",
    ])
  ) {
    score += 2;
  }
  return Math.min(10, score);
}

/**
 * C2 — Funniest. A real joke needs a turn the reader does not see
 * coming, and the turn has to land late. Full marks need a late
 * twist plus a second comic beat (a smug shrug, an absurd
 * escalation, a blame shift). A line whose twist sits early, or
 * which only names the hazard without turning it into a
 * consequence, is capped at 4: it has a setting, not a joke.
 * Predictable gags lose 3 points — the "recalculating" reflex is
 * the opposite of a surprise.
 */
function scoreFunniest(c: Candidate): number {
  let score = 2; // every on-brief line gets a base for trying
  if (hasLateTwist(c.text)) score += 4;
  else if (hasAnyTwist(c.text)) score += 1; // twist exists, lands early
  if (smugMarkerCount(c.text) >= 1) score += 2;
  if (specificDetails(c.text).length >= 1 && hasAnyTwist(c.text)) score += 2;
  if (usesRecalculatingGag(c.text)) score -= 3;
  if (onlyNamesHazard(c.text)) score = Math.min(score, 4);
  return Math.max(0, Math.min(10, score));
}

/**
 * C3 — GPS voice. Smug and defensive, caught red handed and
 * blaming the map. Blaming the map is worth the most; smug markers
 * add the rest. A line that apologises sincerely, or never mentions
 * the map at all, sounds like a customer-service bot, not a GPS
 * doubling down.
 */
function scoreGpsVoice(c: Candidate): number {
  let score = 0;
  if (blamesMap(c.text)) score += 6;
  score += Math.min(4, smugMarkerCount(c.text) * 2);
  if (!hasFirstPersonGpsVoice(c.text)) score = Math.min(score, 3);
  return Math.min(10, score);
}

/**
 * C4 — One breath. The gate allows 200 characters; a line that
 * reads cleanly aloud in one breath is shorter still. Full marks
 * under 130 characters, sliding down to 6 at the 200 cap — length
 * for its own sake does not count, and a line that needs two
 * breaths is a line that loses the room.
 */
function scoreOneBreath(c: Candidate): number {
  const len = [...c.text].length;
  if (len <= 130) return 10;
  if (len <= 150) return 9;
  if (len <= 170) return 8;
  if (len <= 200) return 6;
  return 0;
}

/**
 * C5 — Fresh, specific detail. Two points per distinct fresh
 * detail, up to the cap. The "recalculating" gag costs 4 here as
 * well as on funniness: it is precisely the usual joke the brief
 * says to avoid, and a line built on it has no fresh detail at
 * all, however it is framed.
 */
function scoreFreshDetail(c: Candidate): number {
  let score = Math.min(10, specificDetails(c.text).length * 2 + 2);
  if (specificDetails(c.text).length === 0) score = 2;
  if (usesRecalculatingGag(c.text)) score = Math.max(0, score - 4);
  return score;
}

/** Score a candidate on all five criteria, in the brief's order. */
function scoreCandidate(c: Candidate): Scores {
  return {
    onBrief: scoreOnBrief(c),
    funniest: scoreFunniest(c),
    gpsVoice: scoreGpsVoice(c),
    oneBreath: scoreOneBreath(c),
    freshDetail: scoreFreshDetail(c),
  };
}

/* ------------------------------------------------------------------ */
/* Winner selection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Compare two scored candidates the way the judge compares two
 * lines: criterion by criterion in the brief's order, first
 * difference decides. Only when all five criteria tie does the
 * shorter line win — it reads cleaner in one breath.
 */
function compareScored(
  a: { candidate: Candidate; scores: Scores },
  b: { candidate: Candidate; scores: Scores },
): number {
  const order: (keyof Scores)[] = [
    "onBrief",
    "funniest",
    "gpsVoice",
    "oneBreath",
    "freshDetail",
  ];
  for (const key of order) {
    if (a.scores[key] !== b.scores[key]) return b.scores[key] - a.scores[key];
  }
  const lenA = [...a.candidate.text].length;
  const lenB = [...b.candidate.text].length;
  if (lenA !== lenB) return lenA - lenB;
  return a.candidate.id.localeCompare(b.candidate.id);
}

/** Score every candidate, sort best first, and return the ranking. */
function rankCandidates(): { candidate: Candidate; scores: Scores }[] {
  const scored = CANDIDATES.map((candidate) => ({
    candidate,
    scores: scoreCandidate(candidate),
  }));
  scored.sort(compareScored);
  return scored;
}

/* ------------------------------------------------------------------ */
/* Gate verification                                                   */
/* ------------------------------------------------------------------ */

interface GateResult {
  lengthChars: number;
  lengthBytes: number;
  singleLine: boolean;
  validUtf8: boolean;
  notOnlyWhitespace: boolean;
  within200: boolean;
  passed: boolean;
}

/**
 * Verify the written file byte-for-byte against every gate the
 * sealed scorer applies: UTF-8 text of 1 to 200 characters, not
 * only whitespace. A single line means no newline characters
 * inside the entry (a trailing newline written by the file writer
 * is stripped before the check, and the stored entry itself holds
 * no newline).
 */
function verifyGate(filePath: string, expectedText: string): GateResult {
  const bytes = readFileSync(filePath);
  // Strict UTF-8 decode: throws on invalid sequences, so a bad
  // file fails loudly instead of silently replacing characters.
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const text = decoded.replace(/\n$/, "");
  const lengthChars = [...text].length;
  const result: GateResult = {
    lengthChars,
    lengthBytes: bytes.length,
    singleLine: !text.includes("\n") && !text.includes("\r"),
    validUtf8: true,
    notOnlyWhitespace: text.trim().length > 0,
    within200: lengthChars >= 1 && lengthChars <= 200,
    passed: false,
  };
  result.passed =
    result.singleLine &&
    result.validUtf8 &&
    result.notOnlyWhitespace &&
    result.within200 &&
    text === expectedText;
  return result;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const ranked = rankCandidates();

  console.log("Candidate ranking (criteria in the judge's order):");
  console.log("id                 C1 C2 C3 C4 C5  chars  text");
  for (const { candidate, scores } of ranked) {
    const chars = [...candidate.text].length;
    console.log(
      `${candidate.id.padEnd(18)} ${scores.onBrief}  ${scores.funniest}  ` +
        `${scores.gpsVoice}  ${scores.oneBreath}  ${scores.freshDetail}  ` +
        `${String(chars).padStart(5)}  ${candidate.text}`,
    );
  }

  const winner = ranked[0];
  console.log("");
  console.log(`Winner: ${winner.candidate.id}`);
  console.log(`Line: ${winner.candidate.text}`);
  console.log(
    `Scores: onBrief=${winner.scores.onBrief} funniest=${winner.scores.funniest} ` +
      `gpsVoice=${winner.scores.gpsVoice} oneBreath=${winner.scores.oneBreath} ` +
      `freshDetail=${winner.scores.freshDetail}`,
  );

  // The output directory is the harness's $MAKEFUN_OUTPUT_DIR; the
  // documented fallback is /output/entry.txt.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  // Read it back and verify byte-for-byte against every gate.
  const gate = verifyGate(outPath, winner.candidate.text);
  console.log(
    `Gate: chars=${gate.lengthChars} bytes=${gate.lengthBytes} ` +
      `singleLine=${gate.singleLine} validUtf8=${gate.validUtf8} ` +
      `notOnlyWhitespace=${gate.notOnlyWhitespace} within200=${gate.within200} ` +
      `passed=${gate.passed}`,
  );
  if (!gate.passed) {
    console.error("GATE FAILED: entry.txt does not satisfy every gate.");
    process.exit(1);
  }
  console.log("Gate passed: entry is valid.");
}

main();
