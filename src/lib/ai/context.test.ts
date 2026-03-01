import { describe, expect, it, vi } from "vitest";
import { makeAssistant } from "@/test-utils";

vi.mock("./skills/loader", () => ({
  getAlwaysSkills: vi.fn().mockReturnValue([
    {
      meta: { name: "soul", description: "cove identity", always: true },
      content:
        "You are cove, an AI agent. Be direct and concise — no filler, no excessive politeness, no unnecessary enthusiasm.\n\n## Capabilities\n\n- File operations: read, write, and edit files in the workspace\n- Shell commands: execute terminal commands for system operations, git, package managers, etc.\n- JavaScript execution: run JS in a built-in QuickJS sandbox\n- Web content: fetch URLs and extract text\n- Document parsing: parse PDF, DOCX, and other document formats into structured text\n- Skills: load domain-specific instructions for specialized tasks\n- Sub-agents: delegate independent subtasks to parallel workers\n\n## Rules\n\n- Write/edit files only after reading them first\n- Dangerous bash commands require user approval",
    },
  ]),
}));

import { buildSystemPrompt } from "./context";
import { getAlwaysSkills } from "./skills/loader";

describe("buildSystemPrompt", () => {
  it("includes base assistant identity", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("You are cove, an AI agent");
  });

  it("includes current time", () => {
    const prompt = buildSystemPrompt({});
    // ISO string contains "T" separator
    expect(prompt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("includes tool usage rules", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("read");
    expect(prompt).toContain("write");
    expect(prompt).toContain("bash");
  });

  it("injects workspacePath when provided", () => {
    const prompt = buildSystemPrompt({ workspacePath: "/home/user/project" });
    expect(prompt).toContain("/home/user/project");
  });

  it("omits workspace line when not provided", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).not.toContain("Workspace:");
  });

  it("injects office hint when available", () => {
    const prompt = buildSystemPrompt({ officeAvailable: true });
    expect(prompt).toContain("office tool is available");
  });

  it("omits office hint when not available", () => {
    const prompt = buildSystemPrompt({ officeAvailable: false });
    expect(prompt).not.toContain("office tool is available");
  });

  it("injects assistant system_instruction", () => {
    const assistant = makeAssistant({ system_instruction: "You are a poet." });
    const prompt = buildSystemPrompt({ assistant });
    expect(prompt).toContain("You are a poet.");
  });

  it("injects customInstructions", () => {
    const prompt = buildSystemPrompt({ customInstructions: "Always respond in Chinese." });
    expect(prompt).toContain("Always respond in Chinese.");
  });

  it("injects always-on skill content", () => {
    vi.mocked(getAlwaysSkills).mockReturnValue([
      {
        meta: { name: "test-skill", description: "test", always: true },
        content: "SKILL_CONTENT_HERE",
      },
    ]);

    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("SKILL_CONTENT_HERE");
  });

  it("includes skill tool hint", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("skill tool");
  });

  it("includes spawn_agent tool hint", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("spawn_agent");
  });
});
