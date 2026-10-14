export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const PAD = 96;
const CONTENT_WIDTH = CARD_WIDTH - PAD * 2;
const COLORS = {
  background: "#161b22",
  title: "#f8fafd",
  accent: "#0076ed",
  accentSoft: "#d8edff",
  soft: "#949ca7",
  rule: "#a7b2c1"
};
const FONTS = ['700 92px "Space Grotesk"', '600 44px "Inter"', '500 30px "Inter"', '500 30px "JetBrains Mono"'];
const TITLE_SIZES = [92, 80, 68];

export async function drawCard(canvas, post) {
  await Promise.all(FONTS.map((font) => document.fonts.load(font)));
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = COLORS.accentSoft;
  ctx.font = '500 30px "JetBrains Mono"';
  ctx.fillText(`DAILY PICKS · ${eyebrowDate(post.date)}`, PAD, 150);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(PAD, 182, 120, 8);

  const { lines, size } = fitTitle(ctx, post.theme);
  ctx.fillStyle = COLORS.title;
  ctx.font = `700 ${size}px "Space Grotesk"`;
  let y = 300;
  for (const line of lines) {
    ctx.fillText(line, PAD, y);
    y += Math.round(size * 1.08);
  }

  y += 56;
  post.entries.forEach((entry, index) => {
    ctx.fillStyle = COLORS.accent;
    ctx.font = '500 34px "JetBrains Mono"';
    ctx.fillText(String(index + 1).padStart(2, "0"), PAD, y);
    ctx.fillStyle = COLORS.title;
    ctx.font = '600 44px "Inter"';
    ctx.fillText(truncate(ctx, entry.title, CONTENT_WIDTH - 90), PAD + 90, y);
    y += 88;
  });

  ctx.fillStyle = COLORS.rule;
  ctx.fillRect(PAD, 1150, CONTENT_WIDTH, 2);
  ctx.fillStyle = COLORS.soft;
  ctx.font = '500 30px "Inter"';
  ctx.fillText("5 GitHub projects worth a look", PAD, 1214);
  ctx.font = '500 26px "JetBrains Mono"';
  ctx.fillText("github-stars-self.vercel.app/blog", PAD, 1256);
}

function fitTitle(ctx, text) {
  for (const size of TITLE_SIZES) {
    ctx.font = `700 ${size}px "Space Grotesk"`;
    const lines = wrap(ctx, text, CONTENT_WIDTH);
    if (lines.length <= 3) return { lines, size };
  }
  const size = TITLE_SIZES.at(-1);
  ctx.font = `700 ${size}px "Space Grotesk"`;
  return { lines: wrap(ctx, text, CONTENT_WIDTH).slice(0, 4), size };
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.map((item) => truncate(ctx, item, maxWidth));
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function eyebrowDate(iso) {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}
