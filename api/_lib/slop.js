import { createRequire } from "node:module";

// Vendored from soundshuman 1.0.0 (MIT, see sloplint/LICENSE). Rules are passed in as data so the
// scorer never reads a file path at runtime, which keeps Vercel's bundler from missing the JSON.
const require = createRequire(import.meta.url);
const { analyzeText } = require("./sloplint/sloplint.cjs");
const rules = require("./sloplint/slop-rules.json");

export function scoreProse(text) {
  const { score, findings } = analyzeText(text, rules);
  return { score, findings };
}

export function bannedWords() {
  const vocabulary = rules.vocabulary || {};
  return [...(vocabulary.tier1?.words || []), ...(vocabulary.tier2?.words || [])];
}
