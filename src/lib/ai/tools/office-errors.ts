/**
 * Error enhancement for office tool — pattern-matches raw error strings
 * and appends actionable recovery hints for the LLM agent.
 */

interface ErrorPattern {
  test: RegExp;
  hint: (command?: string) => string;
}

const patterns: ErrorPattern[] = [
  {
    test: /no active session|无活跃会话|no session/i,
    hint: () =>
      "No active session. Call office tool with action:'open' and a document path first.",
  },
  {
    test: /already open|已有活跃会话|session already/i,
    hint: () =>
      "Session already active. Call action:'close' first, then action:'open' the new document.",
  },
  {
    test: /file not found|does not exist|no such file|ENOENT/i,
    hint: () =>
      "File not found. Verify the path is correct and relative to workspace root.",
  },
  {
    test: /unknown command|command not found|invalid command|unrecognized command/i,
    hint: (cmd) =>
      `Command '${cmd ?? "unknown"}' not recognized. Load OfficeLLM skill first via the skill tool to get correct command names.`,
  },
  {
    test: /missing argument|required.*argument|missing required/i,
    hint: (cmd) =>
      `Missing required argument for '${cmd ?? "command"}'. Load OfficeLLM skill to check correct parameters.`,
  },
  {
    test: /timeout|timed out|超时/i,
    hint: () =>
      "Command timed out. Try a smaller scope or check document size.",
  },
];

const fallbackHint =
  "Call action:'status' to check session state, or action:'doctor' to verify dependencies.";

/**
 * Wraps a raw error string with a recovery hint based on pattern matching.
 * Returns the original error followed by a `[Hint]` line.
 */
export function enhanceOfficeError(
  _action: string,
  command: string | undefined,
  error: string,
): string {
  for (const { test, hint } of patterns) {
    if (test.test(error)) {
      return `${error}\n[Hint] ${hint(command)}`;
    }
  }
  return `${error}\n[Hint] ${fallbackHint}`;
}
