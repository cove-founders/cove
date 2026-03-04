import { useTranslation } from "react-i18next";
import { useSkillsStore } from "@/stores/skillsStore";
import { listSkills } from "@/lib/ai/skills/loader";
import { ExtensionCard } from "../ExtensionCard";
import type { ExtensionBadge } from "../ExtensionCard";

export function SkillsTabContent() {
  const { t } = useTranslation();
  const externalSkills = useSkillsStore((s) => s.externalSkills);
  const enabledNames = useSkillsStore((s) => s.enabledSkillNames);
  const toggleSkillEnabled = useSkillsStore((s) => s.toggleSkillEnabled);
  const loaded = useSkillsStore((s) => s.loaded);

  const builtInSkills = listSkills();

  if (!loaded) {
    return (
      <div className="py-12 text-center text-[13px] text-muted-foreground">
        {t("skills.scanning")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Built-in skills */}
      {builtInSkills.map((skill) => (
        <ExtensionCard
          key={`builtin-${skill.name}`}
          icon={skill.emoji ?? "🛠️"}
          name={skill.name}
          description={skill.description ?? t("skills.builtIn")}
          badge="built-in"
          enabled={enabledNames.includes(skill.name)}
          onToggle={() => void toggleSkillEnabled(skill.name)}
        />
      ))}
      {/* External skills */}
      {externalSkills
        .filter((e) => e.source !== "office-bundled")
        .map((ext) => {
          const meta = ext.skill.meta;
          const badge: ExtensionBadge = ext.source === "cove" ? "public" : "personal";
          return (
            <ExtensionCard
              key={`ext-${ext.folderName}`}
              icon={meta.emoji ?? "📦"}
              name={meta.name}
              description={meta.description ?? ""}
              badge={badge}
              enabled={enabledNames.includes(meta.name)}
              onToggle={() => void toggleSkillEnabled(meta.name)}
            />
          );
        })}
    </div>
  );
}
