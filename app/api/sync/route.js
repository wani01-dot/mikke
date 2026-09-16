import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cleanHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "");
}

async function getYoutubeVideos(handle) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY が設定されていません");
  }

  const clean = cleanHandle(handle);

  // チャンネル取得
  const channelUrl = new URL(
    "https://www.googleapis.com/youtube/v3/channels"
  );

  channelUrl.searchParams.set(
    "part",
    "snippet,contentDetails"
  );
  channelUrl.searchParams.set("forHandle", clean);
  channelUrl.searchParams.set("key", apiKey);

  const channelResponse = await fetch(
    channelUrl.toString(),
    {
      cache: "no-store",
    }
  );

  const channelData = await channelResponse.json();

  if (!channelResponse.ok) {
    throw new Error(
      channelData?.error?.message ||
        "YouTubeチャンネルを取得できませんでした"
    );
  }

  if (!channelData.items?.length) {
    throw new Error(`@${clean} が見つかりませんでした`);
  }

  const channel = channelData.items[0];

  const uploadsPlaylistId =
    channel.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    throw new Error(
      "アップロード動画一覧を取得できませんでした"
    );
  }

  // 最新動画取得
  const playlistUrl = new URL(
    "https://www.googleapis.com/youtube/v3/playlistItems"
  );

  playlistUrl.searchParams.set(
    "part",
    "snippet,contentDetails"
  );
  playlistUrl.searchParams.set(
    "playlistId",
    uploadsPlaylistId
  );
  playlistUrl.searchParams.set(
    "maxResults",
    "20"
  );
  playlistUrl.searchParams.set(
    "key",
    apiKey
  );

  const videosResponse = await fetch(
    playlistUrl.toString(),
    {
      cache: "no-store",
    }
  );

  const videosData = await videosResponse.json();

  if (!videosResponse.ok) {
    throw new Error(
      videosData?.error?.message ||
        "YouTube動画を取得できませんでした"
    );
  }

  const videos = (videosData.items || [])
    .map((item) => {
      const videoId =
        item.contentDetails?.videoId ||
        item.snippet?.resourceId?.videoId;

      if (!videoId) return null;

      return {
        videoId,

        title:
          item.snippet?.title || "",

        text:
          item.snippet?.description || "",

        publishedAt:
          item.contentDetails?.videoPublishedAt ||
          item.snippet?.publishedAt ||
          null,

        thumbnail:
          item.snippet?.thumbnails?.maxres?.url ||
          item.snippet?.thumbnails?.standard?.url ||
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          null,

        url:
          `https://www.youtube.com/watch?v=${videoId}`,
      };
    })
    .filter(Boolean);

  return {
    channel: {
      id: channel.id,

      title:
        channel.snippet?.title ||
        `@${clean}`,

      thumbnail:
        channel.snippet?.thumbnails?.high?.url ||
        channel.snippet?.thumbnails?.medium?.url ||
        channel.snippet?.thumbnails?.default?.url ||
        null,
    },

    videos,
  };
}

export async function GET() {
  return runSync();
}

export async function POST() {
  return runSync();
}

async function runSync() {
  try {
    const supabase = getSupabaseAdmin();

    // 登録チャンネル
    const {
      data: accounts,
      error: accountsError,
    } = await supabase
      .from("monitored_accounts")
      .select("*")
      .eq("platform", "youtube")
      .eq("enabled", true);

    if (accountsError) {
      throw accountsError;
    }

    if (!accounts?.length) {
      return NextResponse.json({
        ok: true,
        accounts: 0,
        checkedVideos: 0,
        newVideos: 0,
        notifications: 0,
        results: [],
      });
    }

    // キーワード
    const {
      data: keywords,
      error: keywordsError,
    } = await supabase
      .from("keywords")
      .select("*");

    if (keywordsError) {
      throw keywordsError;
    }

    let checkedVideos = 0;
    let newVideos = 0;
    let notificationCount = 0;

    const results = [];

    for (const account of accounts) {
      try {
        const youtube =
          await getYoutubeVideos(account.handle);

        // 正式な名前・アイコンを更新
        await supabase
          .from("monitored_accounts")
          .update({
            name: youtube.channel.title,
            external_id: youtube.channel.id,
            thumbnail_url:
              youtube.channel.thumbnail,
          })
          .eq("id", account.id);

        const videos = youtube.videos || [];

        checkedVideos += videos.length;

        // このチャンネルに既存投稿があるか
        const {
          count,
          error: countError,
        } = await supabase
          .from("posts")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("account_id", account.id);

        if (countError) {
          throw countError;
        }

        const firstSync = count === 0;

        let accountNewVideos = 0;
        let accountNotifications = 0;

        for (const video of videos) {
          // 既存チェック
          const {
            data: existing,
            error: existingError,
          } = await supabase
            .from("posts")
            .select("id")
            .eq("platform", "youtube")
            .eq(
              "external_post_id",
              video.videoId
            )
            .maybeSingle();

          if (existingError) {
            throw existingError;
          }

          if (existing) {
            continue;
          }

          // DB保存
          const {
            data: inserted,
            error: insertError,
          } = await supabase
            .from("posts")
            .insert({
              account_id: account.id,
              platform: "youtube",
              external_post_id:
                video.videoId,
              title:
                video.title || "",
              body:
                video.text || "",
              post_url:
                video.url || null,
              thumbnail_url:
                video.thumbnail || null,
              published_at:
                video.publishedAt || null,
            })
            .select()
            .single();

          if (insertError) {
            throw insertError;
          }

          // 初回同期は過去20件を新着扱いしない
          if (firstSync) {
            continue;
          }

          newVideos += 1;
          accountNewVideos += 1;

          const applicableKeywords =
            (keywords || []).filter(
              (keyword) =>
                keyword.account_id === null ||
                keyword.account_id === account.id
            );

          const searchableText = [
            video.title || "",
            video.text || "",
            youtube.channel.title || "",
            account.handle || "",
          ]
            .join(" ")
            .toLowerCase();

          for (const keyword of applicableKeywords) {
            const word =
              String(keyword.word || "").trim();

            if (!word) continue;

            if (
              !searchableText.includes(
                word.toLowerCase()
              )
            ) {
              continue;
            }

            // 二重通知チェック
            const {
              data: existingNotification,
              error: notificationCheckError,
            } = await supabase
              .from("notifications")
              .select("id")
              .eq(
                "post_id",
                inserted.id
              )
              .eq(
                "keyword_id",
                keyword.id
              )
              .maybeSingle();

            if (notificationCheckError) {
              throw notificationCheckError;
            }

            if (existingNotification) {
              continue;
            }

            const {
              error: notificationError,
            } = await supabase
              .from("notifications")
              .insert({
                post_id:
                  inserted.id,

                keyword_id:
                  keyword.id,

                message:
                  `「${word}」を含む新着動画を見つけました`,

                is_read:
                  false,
              });

            if (notificationError) {
              throw notificationError;
            }

            notificationCount += 1;
            accountNotifications += 1;
          }
        }

        results.push({
          account:
            youtube.channel.title,

          ok: true,

          firstSync,

          checked:
            videos.length,

          newVideos:
            accountNewVideos,

          notifications:
            accountNotifications,
        });
      } catch (error) {
        console.error(
          `sync ${account.handle}:`,
          error
        );

        results.push({
          account:
            account.name,

          ok: false,

          error:
            error?.message ||
            "同期に失敗しました",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      accounts:
        accounts.length,
      checkedVideos,
      newVideos,
      notifications:
        notificationCount,
      results,
    });
  } catch (error) {
    console.error(
      "sync error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Mikkeの同期に失敗しました",
      },
      {
        status: 500,
      }
    );
  }
}
