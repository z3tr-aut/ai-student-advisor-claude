"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Major = { major_id: string; major_na: string };
type Plan = { plan_id: string; major_id: string; name: string };
type Existing = {
  std_id: string;
  std_na: string;
  major_id: string | null;
  plan_id: string | null;
} | null;

export default function OnboardingForm({
  suggestedName,
  existing,
  majors,
  plans,
}: {
  suggestedName: string;
  existing: Existing;
  majors: Major[];
  plans: Plan[];
}) {
  const router = useRouter();
  const [stdId, setStdId] = useState(existing?.std_id ?? "");
  const [fullName, setFullName] = useState(existing?.std_na ?? suggestedName);
  const [majorId, setMajorId] = useState(existing?.major_id ?? majors[0]?.major_id ?? "");
  const [planId, setPlanId] = useState(existing?.plan_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plansForMajor = useMemo(
    () => plans.filter((p) => p.major_id === majorId),
    [plans, majorId]
  );

  // When major changes, clear plan if not applicable
  function onMajorChange(v: string) {
    setMajorId(v);
    if (!plans.find((p) => p.plan_id === planId && p.major_id === v)) {
      setPlanId(plans.find((p) => p.major_id === v)?.plan_id ?? "");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!stdId.trim() || !fullName.trim() || !majorId || !planId) {
      setError("Please fill in every field.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }
    const payload = {
      std_id: stdId.trim(),
      std_na: fullName.trim(),
      major_id: majorId,
      plan_id: planId,
      auth_user_id: user.id,
    };
    const { error: upErr } = await supabase.from("std").upsert(payload);
    if (upErr) {
      setError(upErr.message);
      setSaving(false);
      return;
    }
    const { error: linkErr } = await supabase
      .from("profiles")
      .update({ std_id: stdId.trim() })
      .eq("id", user.id);
    if (linkErr) {
      setError(linkErr.message);
      setSaving(false);
      return;
    }
    router.push("/advisor");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className="font-headline text-title-sm text-on-surface">University ID</span>
        <input
          type="text"
          value={stdId}
          onChange={(e) => setStdId(e.target.value)}
          placeholder="e.g. 20241234"
          className="input"
          disabled={!!existing}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-headline text-title-sm text-on-surface">Full name</span>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-headline text-title-sm text-on-surface">Major</span>
        <select
          value={majorId}
          onChange={(e) => onMajorChange(e.target.value)}
          className="input"
        >
          {majors.map((m) => (
            <option key={m.major_id} value={m.major_id}>
              {m.major_na}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-headline text-title-sm text-on-surface">Study plan (version)</span>
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="input"
        >
          <option value="">Select a plan…</option>
          {plansForMajor.map((p) => (
            <option key={p.plan_id} value={p.plan_id}>
              {p.plan_id} — {p.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="font-body text-body-sm text-red-600">{error}</p>
      )}

      <button type="submit" disabled={saving} className="btn-primary self-start">
        {saving ? "Saving…" : existing ? "Update" : "Save & continue"}
      </button>
    </form>
  );
}
