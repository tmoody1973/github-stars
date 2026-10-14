import { bannedWords } from "./slop.js";
import { HOOK_MAX_CHARS, MAX_POST_CHARS } from "./post-format.js";
import { HUMANIZE_EXAMPLES, HUMANIZE_STYLE_GUIDE } from "./humanize-references.js";

export const WRITER_MODEL = process.env.OPENAI_WRITER_MODEL || "gpt-5";
// Two writer calls must fit inside the function's 300 s limit with time left for GitHub.
const WRITER_TIMEOUT_MS = 120_000;

const FORMAT_EXAMPLE = `1. GeoLibre: A lightweight, cloud-native GIS platform for visualizing, exploring, and analyzing geospatial data. It runs in the web browser, on the desktop, on mobile, and inside Jupyter notebooks.
https://github.com/opengeos/GeoLibre

2. RustGIS: A fast, free and open-source GIS in pure Rust for mapping, analyzing and sharing geospatial data. Native on Windows, macOS and Linux, and in your web browser. Your data stays on your machine unless you send it to an AI model you choose, and every action is a command you can script.
https://github.com/opengeos/RustGIS`;

const DRAFT_SCHEMA = {
  name: "daily_picks_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["theme", "hook", "intro", "entries", "question"],
    properties: {
      theme: { type: "string", description: "2 to 6 everyday words naming what the five projects share. Sentence case. 40 characters or fewer." },
      hook: { type: "string", description: `The opening line of the post. ${HOOK_MAX_CHARS} characters or fewer.` },
      intro: { type: "string", description: "1 to 3 short sentences after the hook." },
      entries: {
        type: "array",
        description: "One entry per repo, in the order you want them read.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["repoId", "title", "blurb"],
          properties: {
            repoId: { type: "integer" },
            title: { type: "string", description: "The project's name as its README writes it. No tagline." },
            blurb: { type: "string", description: "2 to 3 sentences in everyday words, 400 characters or fewer." }
          }
        }
      },
      question: { type: "string", description: "One specific closing question readers can answer from experience." }
    }
  }
};

function systemPrompt() {
  return `You write a weekday LinkedIn post for Tarik Moody: five GitHub projects from his starred repos that share a theme.

The post reads like a person who saves interesting projects and is passing along the good ones. Plain, specific, a little opinionated. Not a press release.

Who reads it: mostly smart people who don't work in tech (people in media, nonprofits, business, the arts), with engineers reading too. Write so the first group can follow every sentence and the second still finds a detail worth knowing.

What you return is assembled into this shape by code:
{hook}

{intro}

1. {title}: {blurb}
{url added by code}
...

{question}

Here is Tarik's own format for the entries:
${FORMAT_EXAMPLE}

Rules:
- The hook is the only part people see before LinkedIn's "see more" cut. Keep it to ${HOOK_MAX_CHARS} characters. Make it concrete: say what these five have in common or what surprised you. No questions as hooks, no "Here are 5".
- The intro says why these five belong together in 1 to 3 short sentences, in everyday language.
- Each blurb starts with what the project does for a person, in everyday words: "Lets you run a ChatGPT-style assistant on your own laptop", not "Runs LLMs locally".
- When a technical term is needed (LLM, GPU, API, open source, framework, inference), explain it in a few everyday words the first time it appears, or swap it for an everyday word. No unexplained acronyms. Explaining a general term is fine; adding new claims about a project is not.
- No commands, file paths, code, or install steps, and skip details only a programmer would act on (terminal tools, config files, version numbers). Pick the detail a non-programmer would care about.
- Keep one concrete detail from the README in each blurb (a number, a platform, a feature) so technical readers still trust it.
- Name the theme in everyday words, since it is printed large on the post image: "Run AI on your own laptop", not "Local and tool-using LLMs".
- Use only facts found in that repo's README, description or topics. If a README is thin or missing, write a shorter blurb. Never fill gaps with guesses.
- You may react ("this one caught my eye", "I want to try this on our station logs") but never claim Tarik used, tested or deployed a project. He starred it; that is all you know.
- The starred date is real data. You may say "starred this week" only when the dates support it.
- Never write a URL. Links are added automatically.
- Plain text only. No markdown, no bold, no headings, no emojis, no hashtags.
- Never use an em dash or en dash. Use a period, comma, colon, or parentheses.
- Avoid three-item lists written for rhythm; two items often read better. Do not copy triplets from READMEs word for word.
- Vary sentence length. Repeat the clearest word instead of cycling synonyms.
- No "not just X, it's Y", no "Here's the thing", no "Let's dive in", no generic upbeat ending, no "game-changer".
- Never use these words: ${bannedWords().join(", ")}.
- The question is specific and easy for anyone to answer, technical or not, such as which one readers would try first or what problem they would use it for. Not "What do you think?".
- The whole post must stay under ${MAX_POST_CHARS} characters including links. Aim for 1,200 to 2,000.

The rules above win wherever these references differ (for example, first person never means claiming Tarik used a project).

Worked examples of AI-sounding text and human rewrites:
${HUMANIZE_EXAMPLES}

How to write like a person:
${HUMANIZE_STYLE_GUIDE}`;
}

function repoBlock(repo) {
  const readme = repo.readme?.trim() ? repo.readme.trim() : "(no README)";
  return [
    `Repo id: ${repo.id}`,
    `Full name: ${repo.fullName}`,
    `Description: ${repo.description || "(none)"}`,
    `Topics: ${(repo.topics || []).join(", ") || "(none)"}`,
    `Starred on: ${String(repo.starredAt || "").slice(0, 10) || "(unknown)"}`,
    "README excerpt:",
    "<<<",
    readme,
    ">>>"
  ].join("\n");
}

export function buildMessages({ repos, feedback }) {
  const messages = [
    { role: "system", content: systemPrompt() },
    {
      role: "user",
      content: `Today's five repos. Use each repoId exactly once.\n\n${repos.map(repoBlock).join("\n\n")}`
    }
  ];

  if (feedback) {
    messages.push({
      role: "user",
      content: `Your previous draft failed these checks:\n${feedback.problems.map((problem) => `- ${problem}`).join("\n")}\n\nPrevious draft:\n${JSON.stringify(feedback.previous, null, 2)}\n\nReturn a corrected draft. Fix every problem and keep what already worked.`
    });
  }

  return messages;
}

export function parseDraft(json) {
  const message = json?.choices?.[0]?.message;
  if (message?.refusal) throw new Error(`Writer refused: ${message.refusal}`);
  if (!message?.content) throw new Error("Writer returned no content.");
  return JSON.parse(message.content);
}

export async function writeDraft({ repos, feedback = null }) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(WRITER_TIMEOUT_MS),
    body: JSON.stringify({
      model: WRITER_MODEL,
      messages: buildMessages({ repos, feedback }),
      response_format: { type: "json_schema", json_schema: DRAFT_SCHEMA }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI writer request failed: ${response.status} ${body.slice(0, 240)}`);
  }

  return parseDraft(await response.json());
}
