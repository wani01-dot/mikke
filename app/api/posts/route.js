import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("posts")
      .select(`
        *,
        monitored_accounts (
          id,
          name,
          handle,
          platform,
          thumbnail_url
        )
      `)
      .order("published_at", {
        ascending: false,
      })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({
      posts: data || [],
    });
  } catch (error) {
    console.error("posts GET:", error);

    return NextResponse.json(
      {
        error: "投稿を取得できませんでした",
      },
      {
        status: 500,
      }
    );
  }
}
