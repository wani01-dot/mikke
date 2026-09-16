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
        "テスト用動画を取得できませんでした"
      );
    }

    const before = {
      channel: youtube.channel.title,
      title: video.title,
      body: video.description,
    };

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

    /*
     * 本物のpostsを触らず、
     * monitored_accountsのnameだけで
     * UTF-8の往復テストをする。
     */

    const {
      data: originalAccount,
      error: originalError,
    } = await supabase
      .from("monitored_accounts")
      .select("name")
      .eq("id", account.id)
      .single();

    if (originalError) {
      throw originalError;
    }

    const testName =
      `UTF8テスト｜${youtube.channel.title}｜${video.title}`;

    const {
      error: updateError,
    } = await supabase
      .from("monitored_accounts")
      .update({
        name: testName,
      })
      .eq("id", account.id);

    if (updateError) {
      throw updateError;
    }

    const {
      data: afterAccount,
      error: afterError,
    } = await supabase
      .from("monitored_accounts")
      .select("name")
      .eq("id", account.id)
      .single();

    if (afterError) {
      throw afterError;
    }

    /*
     * テスト後に元の名前へ戻す
     */

    await supabase
      .from("monitored_accounts")
      .update({
        name: originalAccount.name,
      })
      .eq("id", account.id);

    return NextResponse.json(
      {
        youtubeBeforeSave: before,

        sentToSupabase: testName,

        readBackFromSupabase:
          afterAccount.name,

        exactMatch:
          testName === afterAccount.name,
      },
      {
        headers: {
          "Content-Type":
            "application/json; charset=utf-8",
        },
      }
    );
  } catch (error) {
    console.error("UTF8 debug:", error);

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
