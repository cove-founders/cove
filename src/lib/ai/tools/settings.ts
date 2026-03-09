import { tool } from "ai";
import { z } from "zod/v4";
import { handleSettings } from "./settings-handlers";

export const settingsTool = tool({
  description: `Read and modify application settings. Categories and their keys:

- appearance: theme (light|dark|system)
- layout: leftSidebarOpen, leftSidebarWidth, chatWidth, filePanelOpen, fileTreeOpen, fileTreeWidth, filePreviewWidth, fileTreeShowHidden
- general: locale (zh|en), sendShortcut (enter|modifierEnter)
- skills: enabled (comma-separated names), dirPaths
- provider: enabled, api_key, base_url (use provider_type or provider_id to identify)
- assistant: name, model, temperature, top_p, max_tokens, frequency_penalty, presence_penalty, tools_enabled, web_search_enabled, system_instruction, trust_mode (use assistant_name to identify)

Actions:
- get: read a single key
- set: change a value
- list: show all in category
- create: create a custom provider (provider only, requires provider_name; optional: protocol, api_key, base_url)
- delete: delete a custom provider by provider_id (provider only)
- validate: test provider connection and list available models with capabilities (provider only)
- fetch_models: refresh cached model list from provider API (provider only)
- probe: detect model capabilities (tool_calling, reasoning) via lightweight API calls (provider only, requires model_id)`,
  inputSchema: z.object({
    action: z.enum(["get", "set", "list", "create", "delete", "validate", "fetch_models", "probe"]),
    category: z.enum([
      "appearance",
      "layout",
      "general",
      "skills",
      "provider",
      "assistant",
    ]),
    key: z.string().optional().describe("Setting key within the category"),
    value: z.string().optional().describe("New value (for set action)"),
    provider_type: z
      .string()
      .optional()
      .describe("Provider type identifier (for provider category)"),
    provider_id: z
      .string()
      .optional()
      .describe("Provider ID (for custom provider operations)"),
    provider_name: z
      .string()
      .optional()
      .describe("Provider display name (for create action)"),
    protocol: z
      .string()
      .optional()
      .describe("API protocol: openai, anthropic, or google (for custom providers)"),
    assistant_name: z
      .string()
      .optional()
      .describe("Assistant name (for assistant category)"),
    model_id: z
      .string()
      .optional()
      .describe("Model ID within provider (for probe action)"),
  }),
  execute: async (input) => {
    try {
      return await handleSettings(input);
    } catch (err) {
      return `Settings error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
