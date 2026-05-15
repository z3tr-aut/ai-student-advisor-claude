import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";
import { resolveServerLang } from "@/lib/i18n/serverLang";
import { translate } from "@/lib/i18n/dict";

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

  const lang = await resolveServerLang();
  const t = (k: string) => translate(lang, k);

  return (
    <div className="px-6 md:px-12 py-10 max-w-4xl mx-auto">
      <div className="mb-10">
        <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
          {t("profile.eyebrow")}
        </p>
        <h1 className="font-headline text-display-sm text-on-surface mb-3">
          {t("profile.heading")}
        </h1>
        <p className="font-body text-body-lg text-on-surface-variant max-w-2xl">
          {t("profile.subheading")}
        </p>
      </div>

      <ProfileForm
        initial={{
          full_name: profile?.full_name ?? "",
          email: profile?.email ?? user?.email ?? "",
          bio: profile?.bio ?? "",
          interests: profile?.interests ?? [],
          skills: profile?.skills ?? [],
          grades: profile?.grades ?? {},
          preferred_language: profile?.preferred_language === "ar" ? "ar" : "en",
        }}
      />
    </div>
  );
}
