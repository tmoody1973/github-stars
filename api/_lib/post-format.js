import { scoreProse } from "./slop.js";

export const MAX_POST_CHARS = 3000;
export const HOOK_MAX_CHARS = 210;
export const MAX_SLOP_SCORE = 25;
export const MAX_TITLE_CHARS = 60;

const DASHES = /[–—]/;
const URL_PATTERN = /https?:\/\//i;
const URL_LINE = /^https?:\/\/\S+$/;
const MARKDOWN = /\*\*|__|^#{1,6}\s/m;

export function assemblePost({ hook, intro, question, entries }) {
  const list = entries.map((entry, index) => `${index + 1}. ${entry.title.trim()}: ${entry.blurb.trim()}\n${entry.url}`);
  return [hook.trim(), intro.trim(), ...list, question.trim()].join("\n\n");
}

export function checkPost({ hook, intro, question, entries, bodyText }) {
  const problems = [];
  const written = [hook, intro, question, ...entries.flatMap((entry) => [entry.title, entry.blurb])];

  if (!hook.trim()) problems.push("Hook is empty.");
  if (hook.trim().length > HOOK_MAX_CHARS) {
    problems.push(`Hook is ${hook.trim().length} characters; keep it to ${HOOK_MAX_CHARS} so it shows before "see more".`);
  }
  if (!question.trim()) problems.push("Closing question is empty.");
  entries.forEach((entry, index) => {
    if (!entry.title.trim()) problems.push(`Entry ${index + 1} has an empty title.`);
    if (entry.title.trim().length > MAX_TITLE_CHARS) problems.push(`Entry ${index + 1} title is over ${MAX_TITLE_CHARS} characters.`);
    if (!entry.blurb.trim()) problems.push(`Entry ${index + 1} has an empty blurb.`);
  });
  if (written.some((text) => URL_PATTERN.test(text))) problems.push("Remove every URL from your text; links are added automatically.");
  if (written.some((text) => MARKDOWN.test(text))) problems.push("Remove markdown formatting (** or #); LinkedIn shows it as literal symbols.");
  if (DASHES.test(bodyText)) problems.push("Replace every em dash and en dash with a period, comma, colon, or parentheses.");
  if (bodyText.length > MAX_POST_CHARS) problems.push(`Post is ${bodyText.length} characters; LinkedIn allows ${MAX_POST_CHARS}.`);

  const { score, findings } = scoreProse(proseForScoring(bodyText));
  if (score > MAX_SLOP_SCORE) {
    problems.push(`Sloplint score ${score} is above ${MAX_SLOP_SCORE}. Rewrite these: ${describeFindings(findings)}.`);
  }

  return { ok: problems.length === 0, score, problems };
}

function proseForScoring(text) {
  return text.split("\n").filter((line) => !URL_LINE.test(line.trim())).join("\n");
}

function describeFindings(findings) {
  const labels = [...new Set(findings.map((finding) => `${finding.id} ("${finding.match}")`))];
  return labels.slice(0, 10).join("; ");
}
