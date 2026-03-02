import { describe, expect, it } from "vitest";
import { enhanceOfficeError } from "./office-errors";

describe("enhanceOfficeError", () => {
  it("matches 'unknown command' pattern", () => {
    const result = enhanceOfficeError("call", "fooBar", "unknown command: fooBar");
    expect(result).toContain("[Hint]");
    expect(result).toContain("'fooBar' not recognized");
    expect(result).toContain("Load OfficeLLM skill");
  });

  it("matches 'not found' pattern", () => {
    const result = enhanceOfficeError("call", "addSlide", "command not found");
    expect(result).toContain("'addSlide' not recognized");
  });

  it("matches 'invalid command' pattern", () => {
    const result = enhanceOfficeError("call", "xyz", "invalid command xyz");
    expect(result).toContain("'xyz' not recognized");
  });

  it("matches 'no active session' pattern", () => {
    const result = enhanceOfficeError("call", "getText", "no active session");
    expect(result).toContain("action:'open'");
    expect(result).toContain("document path first");
  });

  it("matches Chinese session error", () => {
    const result = enhanceOfficeError("call", undefined, "无活跃会话");
    expect(result).toContain("action:'open'");
  });

  it("matches 'already open' pattern", () => {
    const result = enhanceOfficeError("open", undefined, "session already active");
    expect(result).toContain("action:'close' first");
  });

  it("matches Chinese already open pattern", () => {
    const result = enhanceOfficeError("open", undefined, "已有活跃会话");
    expect(result).toContain("action:'close' first");
  });

  it("matches 'file not found' pattern", () => {
    const result = enhanceOfficeError("open", undefined, "file not found: test.docx");
    expect(result).toContain("Verify the path");
    expect(result).toContain("workspace root");
  });

  it("matches 'does not exist' pattern", () => {
    const result = enhanceOfficeError("open", undefined, "path does not exist");
    expect(result).toContain("Verify the path");
  });

  it("matches ENOENT pattern", () => {
    const result = enhanceOfficeError("open", undefined, "ENOENT: no such file");
    expect(result).toContain("Verify the path");
  });

  it("matches 'missing argument' pattern", () => {
    const result = enhanceOfficeError("call", "replace-text", "missing argument: find");
    expect(result).toContain("'replace-text'");
    expect(result).toContain("Load OfficeLLM skill");
  });

  it("matches 'required argument' pattern", () => {
    const result = enhanceOfficeError("call", "cmd", "required argument 'input' not provided");
    expect(result).toContain("'cmd'");
  });

  it("matches 'timeout' pattern", () => {
    const result = enhanceOfficeError("call", "extract-text", "command timed out after 30s");
    expect(result).toContain("timed out");
    expect(result).toContain("smaller scope");
  });

  it("matches Chinese timeout pattern", () => {
    const result = enhanceOfficeError("call", undefined, "操作超时");
    expect(result).toContain("smaller scope");
  });

  it("returns fallback hint for unrecognized errors", () => {
    const result = enhanceOfficeError("call", "cmd", "some random error");
    expect(result).toContain("[Hint]");
    expect(result).toContain("action:'status'");
    expect(result).toContain("action:'doctor'");
  });

  it("preserves original error in output", () => {
    const original = "unknown command: badCmd";
    const result = enhanceOfficeError("call", "badCmd", original);
    expect(result.startsWith(original)).toBe(true);
  });

  it("uses 'unknown' as fallback command name when command is undefined", () => {
    const result = enhanceOfficeError("call", undefined, "unknown command");
    expect(result).toContain("'unknown' not recognized");
  });
});
