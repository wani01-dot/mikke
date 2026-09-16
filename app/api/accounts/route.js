import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("monitored_accounts")
      .select("*")
      .eq("enabled", true)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      accounts: data || [],
    });
  } catch (error) {
    console.error("accounts GET:", error);

    return NextResponse.json(
      {
        error: "登録アカウントを取得できませんでした",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const platform = body.platform;
    const handle = String(body.handle || "")
      .trim()
      .replace(/^@/, "");

    if (!platform || !handle) {
      return NextResponse.json(
        {
          error: "platform と handle が必要です",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !["youtube", "x", "instagram"].includes(platform)
    ) {
      return NextResponse.json(
        {
          error: "対応していないSNSです",
        },
        {
          status: 400,
        }
      );
    }

    let name =
      String(body.name || "").trim() ||
      `@${handle}`;

    let externalId = body.external_id || null;
    let thumbnailUrl = body.thumbnail_url || null;

    /*
      YouTubeの場合は、
      Mikke側で正式なチャンネル情報を取得。
    */
    if (platform === "youtube") {
      const origin = new URL(request.url).origin;

      const youtubeResponse = await fetch(
        `${origin}/api/youtube?handle=${encodeURIComponent(
          handle
        )}`,
        {
          cache: "no-store",
        }
      );

      const youtubeData =
        await youtubeResponse.json();

      if (!youtubeResponse.ok) {
        return NextResponse.json(
          {
            error:
              youtubeData?.error ||
              "YouTubeチャンネルが見つかりませんでした",
          },
          {
            status: 400,
          }
        );
      }

      name =
        youtubeData?.channel?.title ||
        name;

      externalId =
        youtubeData?.channel?.id ||
        null;

      thumbnailUrl =
        youtubeData?.channel?.thumbnail ||
        null;
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("monitored_accounts")
      .upsert(
        {
          platform,
          name,
          handle,
          external_id: externalId,
          thumbnail_url: thumbnailUrl,
          enabled: true,
        },
        {
          onConflict: "platform,handle",
        }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      account: data,
    });
  } catch (error) {
    console.error("accounts POST:", error);

    return NextResponse.json(
      {
        error: "アカウントを登録できませんでした",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } =
      new URL(request.url);

    const id =
      searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          error: "id が必要です",
        },
        {
          status: 400,
        }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("monitored_accounts")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("accounts DELETE:", error);

    return NextResponse.json(
      {
        error: "アカウントを削除できませんでした",
      },
      {
        status: 500,
      }
    );
  }
}
