// ─── Frontmatter helpers ────────────────────────────────────────────

export interface SkillFields {
  name: string;
  emoji: string;
  description: string;
  instructions: string;
  /** Frontmatter lines not recognised as known fields — preserved on round-trip */
  extraFrontmatter: string[];
}

/** Unescape a YAML inline scalar value (double-quoted or single-quoted or bare). */
function unquoteYaml(raw: string): string {
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replace(/''/g, "'");
  }
  return raw;
}

/** Serialize a string as a YAML inline scalar, quoting when needed. */
export function yamlInlineString(str: string): string {
  const needsQuote =
    str === "" ||
    /[:#\[\]{}&*!,|>'"`?\n\r]/.test(str) ||
    /^\s/.test(str);
  if (!needsQuote) return str;
  const escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
  return `"${escaped}"`;
}

const KNOWN_FRONTMATTER_KEYS = new Set(["name", "emoji", "description"]);

export function parseSkillFields(content: string): SkillFields {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { name: "", emoji: "", description: "", instructions: content, extraFrontmatter: [] };
  }
  const block = match[1]!;
  const body = match[2]!.trim();

  const get = (key: string): string => {
    const m = block.match(new RegExp(`^${key}\\s*:\\s*(.+)$`, "m"));
    return m ? unquoteYaml(m[1]!.trim()) : "";
  };

  const extra: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    const keyMatch = line.match(/^([\w-]+)\s*:/);
    if (keyMatch && KNOWN_FRONTMATTER_KEYS.has(keyMatch[1]!)) continue;
    if (line.trim()) extra.push(line);
  }

  return {
    name: get("name"),
    emoji: get("emoji"),
    description: get("description"),
    instructions: body,
    extraFrontmatter: extra,
  };
}

export function buildSkillMd({ name, emoji, description, instructions, extraFrontmatter }: SkillFields): string {
  const lines = ["---", `name: ${name}`];
  if (emoji.trim()) lines.push(`emoji: ${emoji.trim()}`);
  lines.push(`description: ${yamlInlineString(description)}`);
  if (extraFrontmatter.length > 0) lines.push(...extraFrontmatter);
  lines.push("---", "", instructions);
  return lines.join("\n");
}
