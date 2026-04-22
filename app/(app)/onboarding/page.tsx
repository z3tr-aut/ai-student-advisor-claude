import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, std_id")
    .eq("id", user!.id)
    .single();

  // If already onboarded, pull existing std row to prefill
  let existing: {
    std_id: string;
    std_na: string;
    major_id: string | null;
    plan_id: string | null;
  } | null = null;
  if (profile?.std_id) {
    const { data } = await supabase
      .from("std")
      .select("std_id, std_na, major_id, plan_id")
      .eq("std_id", profile.std_id)
      .maybeSingle();
    existing = data ?? null;
  }

  const { data: majors } = await supabase
    .from("major")
    .select("major_id, major_na")
    .order("major_na");

  const { data: plans } = await supabase
    .from("plan")
    .select("plan_id, major_id, name")
    .order("plan_id");

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-10">
      <h1 className="font-headline text-display-sm text-on-surface font-bold mb-2">
        {existing ? "Your Study Plan" : "Set Up Your Study Plan"}
      </h1>
      <p className="font-body text-body-lg text-on-surface-variant mb-8">
        Link your university record so the advisor can recommend the right courses for your plan.
      </p>
      <OnboardingForm
        suggestedName={profile?.full_name ?? ""}
        existing={existing}
        majors={majors ?? []}
        plans={plans ?? []}
      />
    </div>
  );
}
