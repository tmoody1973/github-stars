import { drawCard } from "./card.js";

const list = document.querySelector("#posts");
const status = document.querySelector("#posts-status");
const template = document.querySelector("#post-template");
const GITHUB_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;

loadPosts();

async function loadPosts() {
  try {
    const response = await fetch("/api/posts");
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.error || `request failed (${response.status})`);
    if (!json.posts.length) {
      status.textContent = "No posts yet. The first one lands on the next weekday morning.";
      return;
    }
    status.hidden = true;
    json.posts.forEach((post) => list.append(renderPost(post)));
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } catch (error) {
    status.textContent = `Couldn't load posts: ${error.message}`;
    status.classList.add("is-error");
  }
}

function renderPost(post) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.id = post.date;
  node.querySelector("[data-field=date]").textContent = formatDate(post.date);
  node.querySelector("[data-field=theme]").textContent = post.theme;
  node.querySelector("[data-field=body]").append(renderBody(post.bodyText));

  const canvas = node.querySelector("canvas");
  canvas.setAttribute("aria-label", `Title card: ${post.theme}, ${post.entries.map((entry) => entry.title).join(", ")}`);
  drawCard(canvas, post).catch((error) => console.error("card failed", error));

  node.querySelector("[data-action=copy]").addEventListener("click", (event) => copyPost(event.currentTarget, post.bodyText));
  node.querySelector("[data-action=download]").addEventListener("click", () => downloadCard(canvas, post.date));
  return node;
}

function renderBody(text) {
  const fragment = document.createDocumentFragment();
  text.split("\n\n").forEach((block) => {
    const paragraph = document.createElement("p");
    block.split("\n").forEach((line, index) => {
      if (index) paragraph.append(document.createElement("br"));
      const trimmed = line.trim();
      if (GITHUB_URL.test(trimmed)) {
        const link = document.createElement("a");
        link.href = trimmed;
        link.textContent = trimmed;
        link.rel = "noreferrer";
        link.target = "_blank";
        paragraph.append(link);
      } else {
        paragraph.append(line);
      }
    });
    fragment.append(paragraph);
  });
  return fragment;
}

async function copyPost(button, text) {
  try {
    await navigator.clipboard.writeText(text);
    flash(button, "Copied");
  } catch {
    flash(button, "Copy failed, select the text instead");
  }
}

function flash(button, label) {
  button.dataset.label ||= button.textContent;
  button.textContent = label;
  setTimeout(() => { button.textContent = button.dataset.label; }, 2000);
}

function downloadCard(canvas, date) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-picks-${date}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

function formatDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
