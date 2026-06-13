import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const repoRoot = process.cwd();
const docsDir = path.join(repoRoot, "docs", "ai-ops");
const sourcePdfDir = path.join(docsDir, "source-pdfs");
const downloadsDir = path.join(os.homedir(), "Downloads");

const files = [
  { source: "# AGENTS.md.pdf", output: "AGENTS.md" },
  { source: "# Codex Task Template.md.pdf", output: "CODEX_TASK_TEMPLATE.md" },
  { source: "# ENGINEERING_RULES.md.pdf", output: "ENGINEERING_RULES.md" },
  { source: "# New Feature Workflow.md.pdf", output: "NEW_FEATURE_WORKFLOW.md" },
  { source: "# PROMPT_ENGINEER.md.pdf", output: "PROMPT_ENGINEER.md" },
  { source: "# SKILLS.md.pdf", output: "SKILLS.md" },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function extractStreams(buffer) {
  const pdf = buffer.toString("latin1");
  const streams = [];
  const regex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = regex.exec(pdf))) {
    const chunk = Buffer.from(match[1], "latin1");
    try {
      streams.push(zlib.inflateSync(chunk).toString("latin1"));
    } catch {
      // Ignore non-Flate streams and embedded binaries that are not text.
    }
  }

  return streams;
}

function buildCMap(streams) {
  const map = new Map();

  for (const stream of streams) {
    if (!stream.includes("begincmap")) {
      continue;
    }

    const lines = stream.split(/\r?\n/);
    let mode = null;

    for (const line of lines) {
      if (line.includes("beginbfchar")) {
        mode = "char";
        continue;
      }
      if (line.includes("beginbfrange")) {
        mode = "range";
        continue;
      }
      if (line.startsWith("endbfchar") || line.startsWith("endbfrange")) {
        mode = null;
        continue;
      }

      if (mode === "char") {
        const match = line.match(/<([0-9A-F]+)>\s+<([0-9A-F]+)>/i);
        if (!match) {
          continue;
        }
        map.set(match[1].toUpperCase(), String.fromCodePoint(parseInt(match[2], 16)));
      }

      if (mode === "range") {
        const match = line.match(/<([0-9A-F]+)>\s+<([0-9A-F]+)>\s+<([0-9A-F]+)>/i);
        if (!match) {
          continue;
        }

        const start = parseInt(match[1], 16);
        const end = parseInt(match[2], 16);
        const base = parseInt(match[3], 16);
        const width = match[1].length;

        for (let code = start; code <= end; code += 1) {
          const key = code.toString(16).toUpperCase().padStart(width, "0");
          map.set(key, String.fromCodePoint(base + (code - start)));
        }
      }
    }
  }

  return map;
}

function decodeChunk(chunk, cmap) {
  const tokens = [...chunk.matchAll(/<([0-9A-F]+)>\s*Tj/gi)];
  if (tokens.length === 0) {
    return "";
  }

  return tokens
    .map((token) => cmap.get(token[1].toUpperCase()) ?? "")
    .join("")
    .replace(/[ \t]+$/g, "");
}

function extractMarkdown(buffer) {
  const streams = extractStreams(buffer);
  const cmap = buildCMap(streams);
  const lines = [];

  for (const stream of streams) {
    if (!stream.includes("BT")) {
      continue;
    }

    const chunks = stream.split(/\nq\n/);
    for (const chunk of chunks) {
      const text = decodeChunk(chunk, cmap);
      if (!text) {
        continue;
      }
      lines.push(text);
    }
  }

  return lines
    .join("\n")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");
}

function importFile({ source, output }) {
  const sourcePath = path.join(downloadsDir, source);
  const outputPath = path.join(docsDir, output);
  const copiedPdfPath = path.join(sourcePdfDir, source);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source PDF not found: ${sourcePath}`);
  }

  const buffer = fs.readFileSync(sourcePath);
  const markdown = extractMarkdown(buffer);
  const banner = `<!-- Imported from ${source} on ${new Date().toISOString().slice(0, 10)} -->\n\n`;

  fs.copyFileSync(sourcePath, copiedPdfPath);
  fs.writeFileSync(outputPath, banner + markdown, "utf8");
}

ensureDir(docsDir);
ensureDir(sourcePdfDir);

for (const file of files) {
  importFile(file);
}

console.log(`Imported ${files.length} AI ops documents into ${docsDir}`);
