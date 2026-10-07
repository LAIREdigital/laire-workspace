import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// The signed in user's profile, read once per request.
export const getMe = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!data) redirect("/login?error=no_profile");
  return data as Profile;
});

export async function requireStaff(): Promise<Profile> {
  const me = await getMe();
  if (me.role !== "staff") throw new Error("Staff only");
  return me;
}
