export const sampleRepos = [
  { id: 1, fullName: "opengeos/GeoLibre", url: "https://github.com/opengeos/GeoLibre" },
  { id: 2, fullName: "opengeos/RustGIS", url: "https://github.com/opengeos/RustGIS" },
  { id: 3, fullName: "sparkgeo/geo-mcp-servers", url: "https://github.com/sparkgeo/geo-mcp-servers" },
  { id: 4, fullName: "marceloprates/prettymaps", url: "https://github.com/marceloprates/prettymaps" },
  { id: 5, fullName: "digitalhen/blocklight", url: "https://github.com/digitalhen/blocklight" }
];

export const sampleDraft = {
  theme: "Open-source GIS",
  hook: "Five open-source GIS projects I starred this month, and one of them is a list of MCP servers (add-ons that let AI apps work with maps).",
  intro: "Most of these run in a browser. Two of them keep your data on your own machine.",
  question: "Which of these would you open first, and what do you use for maps today?",
  entries: [
    { repoId: 1, title: "GeoLibre", blurb: "A lightweight, cloud-native GIS platform for visualizing, exploring, and analyzing geospatial data. It runs in the web browser, on the desktop, on mobile, and inside Jupyter notebooks." },
    { repoId: 2, title: "RustGIS", blurb: "A fast, free and open-source GIS in pure Rust for mapping, analyzing and sharing geospatial data. Native on Windows, macOS and Linux, and in your web browser. Your data stays on your machine unless you send it to an AI model you choose, and every action is a command you can script." },
    { repoId: 3, title: "Geospatial MCP Servers", blurb: "A curated, tracked list of Model Context Protocol (MCP) servers for geospatial, GIS, mapping, and earth-observation work: geocoding, routing, PostGIS, STAC imagery, QGIS and ArcGIS, weather, and the commercial location platforms." },
    { repoId: 4, title: "prettymaps", blurb: "Draws pretty maps from OpenStreetMap data with a small Python library. You pick a place and a style preset and it renders a poster." },
    { repoId: 5, title: "Blocklight", blurb: "Shows city blocks lit up by data. I could not tell from the README how far along it is, which is part of why it caught my eye." }
  ]
};

export function sampleEntries() {
  return sampleDraft.entries.map((entry) => ({
    ...entry,
    url: sampleRepos.find((repo) => repo.id === entry.repoId).url
  }));
}
