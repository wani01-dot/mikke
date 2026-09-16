import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { getYoutubeChannelAndVideos } from "../../../lib/youtube";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const youtube =
      await getYoutubeChannelAndVideos(
        "itabasihausu",
        1
      );

    const video = youtube.videos[0];

    if (!video) {
      throw new Error(
        "YouTube動画を取得できませんでした"
      );
    }

    const {
      data: account,
      error: accountError,
    } = await supabase
      .from("monitored_accounts")
      .select("id")
      .eq("platform", "youtube")
      .eq("handle", "itabasihausu")
      .single();

    if (accountError) {
      throw accountError;
    }

    const testExternalId =
      `debug-${Date.now()}`;

    const before = {
      title: video.title,
      body: video.description,
    };

    /*
     * postsへ実際に保存
     */

    const {
      data: inserted,
      error: insertError,
    } = await supabase
      .from("posts")
      .insert({
        account_id: account.id,

        platform: "youtube",

        external_post_id:
          testExternalId,

        title:
          video.title,

        body:
          video.description,

        post_url:
          video.url,

        thumbnail_url:
          video.thumbnail,

        published_at:
          video.publishedAt,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    /*
     * DBから改めて読み直す
     */

    const {
      data: readBack,
      error: readError,
    } = await supabase
      .from("posts")
      .select(
        "id, title, body, post_url"
      )
      .eq(
        "id",
        inserted.id
      )
      .single();

    if (readError) {
      throw readError;
    }

    const titleMatch =
      before.title ===
      readBack.title;

    const bodyMatch =
      before.body ===
      readBack.body;

    /*
     * 診断データを削除
     */

    const {
      error: deleteError,
    } = await supabase
      .from("posts")
      .delete()
      .eq(
        "id",
        inserted.id
      );

    if (deleteError) {
      console.error(
        "debug cleanup:",
        deleteError
      );
    }

    return NextResponse.json(
      {
        youtubeBeforeSave: before,

        insertedToPosts: {
          title:
            inserted.title,

          body:
            inserted.body,
        },

        readBackFromPosts: {
          title:
            readBack.title,

          body:
            readBack.body,
        },

        titleMatch,

        bodyMatch,

        exactMatch:
          titleMatch &&
          bodyMatch,

        cleanup:
          !deleteError,
      },
      {
        headers: {
          "Content-Type":
            "application/json; charset=utf-8",
        },
      }
    );
  } catch (error) {
    console.error(
      "posts UTF8 debug:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error?.message ||
          "診断に失敗しました",
      },
      {
        status: 500,

        headers: {
          "Content-Type":
            "application/json; charset=utf-8",
        },
      }
    );
  }
}
