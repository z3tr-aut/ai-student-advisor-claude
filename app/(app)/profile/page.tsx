import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  return (
    <div className="px-6 md:px-12 py-10 max-w-4xl mx-auto">
      <div className="mb-10">
        <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
          YOUR PROFILE
        </p>
        <h1 className="font-headline text-display-sm text-on-surface mb-3">
          Tell me who you are
        </h1>
        <p className="font-body text-body-lg text-on-surface-variant max-w-2xl">
          The more I know about your interests and goals, the sharper my
          recommendations become. You can update any field at any time.
        </p>
      </div>

      <ProfileForm
        initial={{
          full_name: profile?.full_name ?? "",
          email: profile?.email ?? user?.email ?? "",
          education_level: profile?.education_level ?? "",
          bio: profile?.bio ?? "",
          interests: profile?.interests ?? [],
          skills: profile?.skills ?? [],
          preferred_countries: profile?.preferred_countries ?? [],
          grades: profile?.grades ?? {},
        }}
      />
    </div>
  );
}
