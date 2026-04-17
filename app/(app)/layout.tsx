import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url, education_level")
    .eq("id", user.id)
    .single();

  const fullName =
    profile?.full_name || user.email?.split("@")[0] || "Student";
  const subtitle =
    profile?.education_level ||
    (user.email ? user.email : "AI Student Advisor");

  return (
    <div className="min-h-screen bg-surface">
      <TopNav userEmail={profile?.email || user.email} />
      <div className="flex min-h-[calc(100vh-72px)]">
        <Sidebar
          fullName={fullName}
          subtitle={subtitle}
          avatarUrl={profile?.avatar_url}
        />
        <main className="flex-1 md:ml-64">{children}</main>
      </div>
    </div>
  );
}
