"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

type ProfileData = {
  full_name: string;
  email: string;
  bio: string;
  interests: string[];
  skills: string[];
  grades: Record<string, unknown>;
  preferred_language: "en" | "ar";
};

const INTEREST_SUGGESTIONS = [
  "Technology",
  "Biology",
  "Mathematics",
  "Design",
  "Business",
  "Psychology",
  "Engineering",
  "Literature",
  "Medicine",
  "Economics",
  "Art",
  "Music",
];

const SKILL_SUGGESTIONS = [
  "Programming",
  "Writing",
  "Public Speaking",
  "Research",
  "Data Analysis",
  "Leadership",
  "Languages",
];

export default function ProfileForm({ initial }: { initial: ProfileData }) {
  const router = useRouter();
  const { t, setLang } = useI18n();
  const [form, setForm] = useState<ProfileData>(initial);
  const [gpa, setGpa] = useState<string>(
    (initial.grades?.gpa as string | number | undefined)?.toString() ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage({ kind: "err", text: t("profile.notSignedIn") });
      setSaving(false);
      return;
    }

    const grades: Record<string, unknown> = { ...form.grades };
    if (gpa) grades.gpa = Number(gpa);
    else delete grades.gpa;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name || null,
        bio: form.bio || null,
        interests: form.interests,
        skills: form.skills,
        grades,
        preferred_language: form.preferred_language,
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      setMessage({ kind: "err", text: error.message });
    } else {
      setMessage({ kind: "ok", text: t("profile.saved") });
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      {/* Interface language */}
      <Section title={t("profile.section.language")} icon="translate">
        <LanguageToggle
          value={form.preferred_language}
          onChange={(v) => {
            setForm({ ...form, preferred_language: v });
            // Switch live (cookie + refresh) so the entire UI flips immediately.
            void setLang(v);
          }}
        />
      </Section>

      {/* Identity */}
      <Section title={t("profile.section.identity")} icon="person">
        <TextField
          label={t("profile.field.fullName")}
          value={form.full_name}
          onChange={(v) => setForm({ ...form, full_name: v })}
          placeholder={t("profile.field.fullNamePlaceholder")}
        />
        <TextField
          label={t("profile.field.email")}
          value={form.email}
          onChange={() => {}}
          disabled
        />
      </Section>

      {/* Story */}
      <Section title={t("profile.section.story")} icon="description">
        <label className="block">
          <span className="block font-body text-label-lg text-on-surface-variant mb-2">
            {t("profile.field.bio")}
          </span>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            placeholder={t("profile.field.bioPlaceholder")}
            className="w-full bg-surface-container-high text-on-surface font-body text-body-md px-4 py-3 rounded-lg outline-none focus:shadow-glow transition-all resize-none"
          />
        </label>
      </Section>

      {/* Interests */}
      <Section title={t("profile.section.interests")} icon="interests">
        <ChipEditor
          label={t("profile.field.interestsLabel")}
          values={form.interests}
          suggestions={INTEREST_SUGGESTIONS}
          onChange={(v) => setForm({ ...form, interests: v })}
          placeholder={t("profile.field.interestsPlaceholder")}
        />
      </Section>

      {/* Skills */}
      <Section title={t("profile.section.skills")} icon="bolt">
        <ChipEditor
          label={t("profile.field.skillsLabel")}
          values={form.skills}
          suggestions={SKILL_SUGGESTIONS}
          onChange={(v) => setForm({ ...form, skills: v })}
          placeholder={t("profile.field.skillsPlaceholder")}
        />
      </Section>

      {/* Grades (optional) */}
      <Section title={t("profile.section.grades")} icon="grade">
        <TextField
          label={t("profile.field.gpa")}
          value={gpa}
          onChange={setGpa}
          placeholder={t("profile.field.gpaPlaceholder")}
        />
      </Section>

      {/* Actions */}
      <div className="flex items-center gap-3 sticky bottom-4 glass-panel rounded-xl p-4 mt-2">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary disabled:opacity-60"
        >
          {saving ? t("profile.saving") : t("profile.save")}
        </button>
        {message && (
          <span
            className={`font-body text-body-sm ${
              message.kind === "ok" ? "text-tertiary" : "text-error"
            }`}
          >
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}

/* ─── building blocks ─── */

function LanguageToggle({
  value,
  onChange,
}: {
  value: "en" | "ar";
  onChange: (v: "en" | "ar") => void;
}) {
  const { t } = useI18n();
  const options: { value: "en" | "ar"; label: string; hint: string }[] = [
    { value: "en", label: "English", hint: t("profile.lang.englishHint") },
    { value: "ar", label: "العربية", hint: t("profile.lang.arabicHint") },
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="block font-body text-label-lg text-on-surface-variant">
        {t("profile.lang.sub")}
      </span>
      <div className="flex gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                "flex-1 flex flex-col items-start gap-1 px-4 py-3 rounded-lg transition-all text-left",
                active
                  ? "bg-primary/25 text-on-surface ring-1 ring-primary shadow-glow"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant",
              ].join(" ")}
              aria-pressed={active}
            >
              <span className="font-headline text-title-md">{opt.label}</span>
              <span className="text-label-md opacity-80">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface-container-high rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">{icon}</span>
        </div>
        <h2 className="font-headline text-title-lg text-on-surface font-bold">
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-body text-label-lg text-on-surface-variant mb-2">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-surface-container text-on-surface font-body text-body-md px-4 py-3 rounded-lg outline-none focus:shadow-glow transition-all disabled:opacity-60"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block font-body text-label-lg text-on-surface-variant mb-2">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-container text-on-surface font-body text-body-md px-4 py-3 rounded-lg outline-none focus:shadow-glow transition-all appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface-container">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChipEditor({
  label,
  values,
  suggestions,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  suggestions: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add(value: string) {
    const v = value.trim();
    if (!v) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
    setDraft("");
  }
  function remove(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  const unused = suggestions.filter(
    (s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div>
      <span className="block font-body text-label-lg text-on-surface-variant mb-2">
        {label}
      </span>

      {/* Active chips */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {values.map((v) => (
            <span
              key={v}
              className="flex items-center gap-1 bg-primary/20 text-primary-fixed px-3 py-1.5 rounded-lg text-label-lg font-medium"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(v)}
                aria-label={`Remove ${v}`}
                className="hover:text-on-surface transition-colors"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "16px" }}
                >
                  close
                </span>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="chat-input-shell flex items-center gap-2 pl-4 pr-2 py-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-on-surface font-body text-body-md placeholder:text-on-surface-variant/70 py-1.5"
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          className="w-8 h-8 rounded-full bg-surface-variant hover:bg-primary/30 disabled:opacity-40 flex items-center justify-center transition-all"
          aria-label="Add"
        >
          <span className="material-symbols-outlined text-primary" style={{ fontSize: "18px" }}>
            add
          </span>
        </button>
      </div>

      {/* Suggestions */}
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {unused.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="suggestion-chip"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
