import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mcpServerRepo } from "@/db/repos/mcpServerRepo";
import type { McpServer } from "@/db/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateMcpDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [type, setType] = useState<McpServer["type"]>("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [env, setEnv] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(""); setType("stdio"); setCommand(""); setArgs(""); setUrl(""); setEnv(""); setError("");
    }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) { setError(t("extensions.mcpNameRequired", "Name is required")); return; }
    if (type === "stdio" && !command.trim()) { setError(t("extensions.mcpCommandRequired", "Command is required for stdio type")); return; }
    if (type !== "stdio" && !url.trim()) { setError(t("extensions.mcpUrlRequired", "URL is required")); return; }
    setSaving(true);
    setError("");
    try {
      const id = crypto.randomUUID();
      await mcpServerRepo.create({
        id,
        name: name.trim(),
        type,
        command: type === "stdio" ? command.trim() : undefined,
        args: type === "stdio" ? args.trim() || undefined : undefined,
        url: type !== "stdio" ? url.trim() : undefined,
        env: env.trim() || undefined,
        auto_run: 0,
        long_running: 0,
        enabled: 1,
      });
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("extensions.newMcp", "New MCP Server")}</DialogTitle>
          <DialogDescription className="sr-only">{t("extensions.newMcp", "New MCP Server")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div>
            <Label className="mb-1.5 text-[12px]">{t("extensions.mcpName", "Name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-mcp-server" className="text-[13px]" />
          </div>
          <div>
            <Label className="mb-1.5 text-[12px]">{t("extensions.mcpType", "Type")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as McpServer["type"])}>
              <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">stdio</SelectItem>
                <SelectItem value="sse">SSE</SelectItem>
                <SelectItem value="streamable-http">Streamable HTTP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "stdio" ? (
            <>
              <div>
                <Label className="mb-1.5 text-[12px]">{t("extensions.mcpCommand", "Command")}</Label>
                <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" className="font-mono text-[13px]" />
              </div>
              <div>
                <Label className="mb-1.5 text-[12px]">{t("extensions.mcpArgs", "Arguments")}</Label>
                <Input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-xxx" className="font-mono text-[13px]" />
              </div>
            </>
          ) : (
            <div>
              <Label className="mb-1.5 text-[12px]">URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:3000/mcp" className="font-mono text-[13px]" />
            </div>
          )}
          <div>
            <Label className="mb-1.5 text-[12px]">{t("extensions.mcpEnv", "Environment Variables")}</Label>
            <Textarea
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              placeholder={"KEY=value\nANOTHER_KEY=value"}
              rows={3}
              className="resize-none font-mono text-[12px] leading-relaxed"
            />
          </div>
          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t("skills.cancel")}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{t("skills.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
