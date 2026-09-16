import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("notifications")
      .select(`
        *,
        posts (
          id,
          title,
          body,
          post_url,
          thumbnail_url,
          published_at,
          platform,
          monitored_accounts (
            id,
            name,
            handle,
            thumbnail_url
          )
        ),
        keywords (
          id,
          word
        )
      `)
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({
      notifications: data || [],
    });
  } catch (error) {
    console.error("notifications GET:", error);

    return NextResponse.json(
      {
        error: "通知を取得できませんでした",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (body.all === true) {
      const { error } = await supabase
        .from("notifications")
        .update({
          is_read: true,
        })
        .eq("is_read", false);

      if (error) throw error;

      return NextResponse.json({
        ok: true,
      });
    }

    if (!body.id) {
      return NextResponse.json(
        {
          error: "id が必要です",
        },
        {
          status: 400,
        }
      );
    }

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .eq("id", body.id);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("notifications PATCH:", error);

    return NextResponse.json(
      {
        error: "通知を更新できませんでした",
      },
      {
        status: 500,
      }
    );
  }
}
