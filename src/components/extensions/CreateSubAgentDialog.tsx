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
import { subAgentRepo } from "@/db/repos/subAgentRepo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSubAgentDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setName(""); setIcon(""); setDescription(""); setSystemPrompt(""); setError(""); }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) { setError(t("extensions.subagentNameRequired", "Name is required")); return; }
    setSaving(true);
    setError("");
    try {
      const id = crypto.randomUUID();
      await subAgentRepo.create({
        id,
        name: name.trim(),
        description: description.trim(),
        icon: icon.trim() || undefined,
        system_prompt: systemPrompt.trim(),
        skill_names: "[]",
        tool_ids: "[]",
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
          <DialogTitle>{t("extensions.newSubAgent", "New Sub-Agent")}</DialogTitle>
          <DialogDescription className="sr-only">{t("extensions.newSubAgent", "New Sub-Agent")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div>
            <Label className="mb-1.5 text-[12px]">{t("extensions.subagentName", "Name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-agent" className="text-[13px]" />
          </div>
          <div>
            <Label className="mb-1.5 text-[12px]">{t("extensions.subagentIcon", "Icon (emoji)")}</Label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🤖" className="text-[13px]" />
          </div>
          <div>
            <Label className="mb-1.5 text-[12px]">{t("extensions.subagentDesc", "Description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("extensions.subagentDescPlaceholder", "Briefly describe what this agent does")}
              rows={3}
              className="resize-none text-[13px] leading-relaxed"
            />
          </div>
          <div>
            <Label className="mb-1.5 text-[12px]">{t("extensions.subagentSystemPrompt", "System Prompt")}</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t("extensions.subagentSystemPromptPlaceholder", "Instructions for this sub-agent...")}
              rows={8}
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
