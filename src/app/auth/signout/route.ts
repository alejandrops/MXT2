import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

async function handleSignout(request: NextRequest) {
  const authMode = process.env.AUTH_MODE === "supabase" ? "supabase" : "demo";

  if (authMode === "supabase") {
    try {
      const supabase = await createServerSupabase();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[signout] supabase signOut failed:", err);
    }
  }

  const url = new URL("/login", request.url);
  const response = NextResponse.redirect(url, 303);
  response.cookies.delete("mxt-demo-user-id");
  response.cookies.delete("mxt-demo-user");
  return response;
}

export async function POST(request: NextRequest) {
  return handleSignout(request);
}

export async function GET(request: NextRequest) {
  return handleSignout(request);
}
