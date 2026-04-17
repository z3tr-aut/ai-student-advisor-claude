"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ProfileData = {
  full_name: string;
  email: string;
  education_level: string;
  bio: string;
  interests: string[];
  skills: string[];
  preferred_countries: string[];
  grades: Record<string, unknown>;
};

const EDUCATION_LEVELS = [
  { value: "", label: "Select…" },
  { value: "high_school", label: "High school" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "graduate", label: "Graduate" },
  { value: "postgraduate", label: "Postgraduate" },
  { value: "gap_year", label: "Gap year" },
];

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

const COUNTRY_SUGGESTIONS = [
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "Netherlands",
  "Australia",
  "Japan",
  "Singapore",
  "France",
  "UAE",
  "Jordan",
];

export default function ProfileForm({ initial }: { initial: ProfileData }) {
  const router = useRouter();
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
      setMessage({ kind: "err", text: "Not signed in." });
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
        education_level: form.education_level || null,
        bio: form.bio || null,
        interests: form.interests,
        skills: form.skills,
        preferred_countries: form.preferred_countries,
        grades,
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      setMessage({ kind: "err", text: error.message });
    } else {
      setMessage({ kind: "ok", text: "Profile saved." });
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      {/* Identity */}
      <Section title="Identity" icon="person">
        <TextField
          label="Full name"
          value={form.full_name}
          onChange={(v) => setForm({ ...form, full_name: v })}
          placeholder="Alex Miller"
        />
        <TextField
          label="Email"
          value={form.email}
          onChange={() => {}}
          disabled
        />
        <SelectField
          label="Education level"
          value={form.education_level}
          onChange={(v) => setForm({ ...form, education_level: v })}
          options={EDUCATION_LEVELS}
        />
      </Section>

      {/* Story */}
      <Section title="A bit about you" icon="description">
        <label className="block">
          <span className="block font-body text-label-lg text-on-surface-variant mb-2">
            Short bio
          </span>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            placeholder="e.g. Curious about AI, love hiking, looking for a balance between tech and design…"
            className="w-full bg-surface-container-high text-on-surface font-body text-body-md px-4 py-3 rounded-lg outline-none focus:shadow-glow transition-all resize-none"
          />
        </label>
      </Section>

      {/* Interests */}
      <Section title="Interests" icon="interests">
        <ChipEditor
          label="What excites you academically?"
          values={form.interests}
          suggestions={INTEREST_SUGGESTIONS}
          onChange={(v) => setForm({ ...form, interests: v })}
          placeholder="Add an interest and press Enter"
        />
      </Section>

      {/* Skills */}
      <Section title="Skills" icon="bolt">
        <ChipEditor
          label="Skills you already have"
          values={form.skills}
          suggestions={SKILL_SUGGESTIONS}
          onChange={(v) => setForm({ ...form, skills: v })}
          placeholder="Add a skill and press Enter"
        />
      </Section>

      {/* Countries */}
      <Section title="Preferred countries" icon="public">
        <ChipEditor
          label="Where would you like to study?"
          values={form.preferred_countries}
          suggestions={COUNTRY_SUGGESTIONS}
          onChange={(v) => setForm({ ...form, preferred_countries: v })}
          placeholder="Add a country and press Enter"
        />
      </Section>

      {/* Grades (optional) */}
      <Section title="Academic record (optional)" icon="grade">
        <TextField
          label="Current GPA (out of 4.0)"
          value={gpa}
          onChange={setGpa}
          placeholder="e.g. 3.7"
        />
      </Section>

      {/* Actions */}
      <div className="flex items-center gap-3 sticky bottom-4 glass-panel rounded-xl p-4 mt-2">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
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
