import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdvisorClient from "./AdvisorClient";
import { getStudentContext } from "@/lib/advisor/select";

export default async function AdvisorPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("std_id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile?.std_id) redirect("/onboarding");

  const student = await getStudentContext(supabase, user!.id);
  if (!student) redirect("/onboarding");

  return <AdvisorClient student={student} />;
}
