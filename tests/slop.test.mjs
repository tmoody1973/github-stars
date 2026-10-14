import test from "node:test";
import assert from "node:assert/strict";
import { scoreProse, bannedWords } from "../api/_lib/slop.js";

test("obvious AI prose scores above the gate", () => {
  const { score, findings } = scoreProse(
    "This framework is a game-changer — it seamlessly empowers developers to unlock robust, cutting-edge workflows. Additionally, it serves as a testament to innovation."
  );
  assert.ok(score > 25, `expected > 25, got ${score}`);
  assert.ok(findings.some((finding) => finding.id === "em-dash"));
});

test("plain prose scores well under the gate", () => {
  const { score } = scoreProse("The tool reads a CSV file and draws a chart. I tried it on our station logs last week.");
  assert.ok(score <= 25, `expected <= 25, got ${score}`);
});

test("banned words come from the rules file", () => {
  const words = bannedWords();
  assert.ok(words.includes("delve"));
  assert.ok(words.length > 50);
});
