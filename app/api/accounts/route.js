import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function cleanHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "");
}

async function getYoutubeChannel(handle) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY が設定されていません");
  }

  const clean = cleanHandle(handle);

  const url = new URL(
    "https://www.googleapis.com/youtube/v3/channels"
  );

  url.searchParams.set(
    "part",
    "snippet,contentDetails"
  );

  url.searchParams.set(
    "forHandle",
    clean
  );

  url.searchParams.set(
    "key",
    apiKey
  );

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    console.error(
      "YouTube returned non-JSON:",
      text.slice(0, 300)
    );

    throw new Error(
      "YouTubeから正しいデータを取得できませんでした"
    );
  }

  if (!response.ok) {
    console.error(
      "YouTube channel API error:",
      data
    );

    throw new Error(
      data?.error?.message ||
        "YouTubeチャンネル情報を取得できませんでした"
    );
  }

  if (!data.items?.length) {
    throw new Error(
      `@${clean} が見つかりませんでした`
    );
  }

  const channel = data.items[0];

  return {
    id: channel.id,

    title:
      channel.snippet?.title ||
      `@${clean}`,

    handle: clean,

    thumbnail:
      channel.snippet?.thumbnails?.high?.url ||
      channel.snippet?.thumbnails?.medium?.url ||
      channel.snippet?.thumbnails?.default?.url ||
      null,
  };
}

/* ========================================
   GET
======================================== */

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const {
      data,
      error,
    } = await supabase
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
    console.error(
      "accounts GET:",
      error
    );

    return NextResponse.json(
      {
        error:
          "登録アカウントを取得できませんでした",
      },
      {
        status: 500,
      }
    );
  }
}

/* ========================================
   POST
======================================== */

export async function POST(request) {
  try {
    const body = await request.json();

    const platform = String(
      body.platform || ""
    ).trim();

    const handle = cleanHandle(
      body.handle
    );

    if (!platform || !handle) {
      return NextResponse.json(
        {
          error:
            "platform と handle が必要です",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !["youtube", "x", "instagram"].includes(
        platform
      )
    ) {
      return NextResponse.json(
        {
          error:
            "対応していないSNSです",
        },
        {
          status: 400,
        }
      );
    }

    let name =
      String(body.name || "").trim() ||
      `@${handle}`;

    let externalId =
      body.external_id || null;

    let thumbnailUrl =
      body.thumbnail_url || null;

    /* ========================================
       YouTube
    ======================================== */

    if (platform === "youtube") {
      const channel =
        await getYoutubeChannel(handle);

      name = channel.title;

      externalId = channel.id;

      thumbnailUrl =
        channel.thumbnail;
    }

    /* ========================================
       Supabase
    ======================================== */

    const supabase =
      getSupabaseAdmin();

    const {
      data,
      error,
    } = await supabase
      .from("monitored_accounts")
      .upsert(
        {
          platform,
          name,
          handle,
          external_id:
            externalId,
          thumbnail_url:
            thumbnailUrl,
          enabled: true,
        },
        {
          onConflict:
            "platform,handle",
        }
      )
      .select()
      .single();

    if (error) {
      console.error(
        "Supabase account upsert:",
        error
      );

      throw error;
    }

    return NextResponse.json({
      account: data,
    });
  } catch (error) {
    console.error(
      "accounts POST:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "アカウントを登録できませんでした",
      },
      {
        status: 500,
      }
    );
  }
}

/* ========================================
   DELETE
======================================== */

export async function DELETE(request) {
  try {
    const {
      searchParams,
    } = new URL(request.url);

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

    const supabase =
      getSupabaseAdmin();

    const {
      error,
    } = await supabase
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
    console.error(
      "accounts DELETE:",
      error
    );

    return NextResponse.json(
      {
        error:
          "アカウントを削除できませんでした",
      },
      {
        status: 500,
      }
    );
  }
}
