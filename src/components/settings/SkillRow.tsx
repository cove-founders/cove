import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Skill } from "@/lib/ai/skills/types";
import type { ExternalSkillWithSource } from "@/stores/skillsStore";

// ─── Section heading ────────────────────────────────────────────────
export function SectionHeading({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pb-1.5 pt-5">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {children}
      </h3>
      {action}
    </div>
  );
}

// ─── Built-in skill row (read-only) ────────────────────────────────
export function BuiltInSkillRow({
  skill,
  enabled,
  onToggle,
}: {
  skill: Skill;
  enabled: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { meta, content, resources } = skill;
  const version = meta.metadata?.version;
  const author = meta.metadata?.author;

  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {meta.emoji && <span className="text-sm">{meta.emoji}</span>}
            <span className="text-[13px] font-medium text-foreground">
              {meta.name}
            </span>
            {version && (
              <span className="text-[11px] text-muted-foreground">
                {t("skills.version", { version })}
              </span>
            )}
          </div>
          {meta.description && (
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
              {meta.description}
            </p>
          )}
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground/70">
            {author && <span>{author}</span>}
            {resources && resources.length > 0 && (
              <span>
                {t("skills.resources", { count: resources.length })}
              </span>
            )}
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} size="sm" />
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-1.5 flex cursor-pointer items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={cn(
            "size-3 transition-transform duration-150",
            expanded && "rotate-90",
          )}
          strokeWidth={1.5}
        />
        {expanded ? t("skills.hideContent") : t("skills.viewContent")}
      </button>
      {expanded && (
        <div className="mt-2 max-h-[300px] overflow-auto rounded-lg bg-background-tertiary p-3">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-foreground/80">
            {content.slice(0, 3000)}
            {content.length > 3000 && "\n\n… (truncated)"}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── External/User skill row (with edit/delete) ────────────────────
export function ExternalSkillRow({
  ext,
  enabled,
  onToggle,
  isCoveSkill,
  onEdit,
  onDelete,
}: {
  ext: ExternalSkillWithSource;
  enabled: boolean;
  onToggle: () => void;
  isCoveSkill: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { meta, content } = ext.skill;

  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {meta.emoji && <span className="text-sm">{meta.emoji}</span>}
            <span className="text-[13px] font-medium text-foreground">
              {meta.name}
            </span>
            <span className="shrink-0 rounded bg-brand/15 px-1 py-px text-[10px] font-medium capitalize text-brand">
              {ext.source}
            </span>
          </div>
          {meta.description && (
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
              {meta.description}
            </p>
          )}
          <p
            className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/60"
            title={ext.path}
          >
            {ext.path}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isCoveSkill && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background-tertiary hover:text-foreground"
                title={t("skills.editSkill")}
              >
                <Pencil className="size-3" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title={t("skills.deleteSkill")}
              >
                <Trash2 className="size-3" strokeWidth={1.5} />
              </button>
            </>
          )}
          <Switch checked={enabled} onCheckedChange={onToggle} size="sm" />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-1.5 flex cursor-pointer items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={cn(
            "size-3 transition-transform duration-150",
            expanded && "rotate-90",
          )}
          strokeWidth={1.5}
        />
        {expanded ? t("skills.hideContent") : t("skills.viewContent")}
      </button>
      {expanded && (
        <div className="mt-2 max-h-[300px] overflow-auto rounded-lg bg-background-tertiary p-3">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-foreground/80">
            {content.slice(0, 3000)}
            {content.length > 3000 && "\n\n… (truncated)"}
          </pre>
        </div>
      )}
    </div>
  );
}
