import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function readUtf8Json(response) {
  const buffer = await response.arrayBuffer();
  const text = new TextDecoder("utf-8").decode(buffer);

  try {
    return JSON.parse(text);
  } catch {
    console.error("Invalid JSON:", text.slice(0, 500));
    throw new Error("YouTubeから正しいJSONを取得できませんでした");
  }
}

async function getYoutubeVideos(handle) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY が設定されていません");
  }

  const clean = String(handle || "")
    .trim()
    .replace(/^@/, "");

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
    { cache: "no-store" }
  );

  const channelData = await readUtf8Json(channelResponse);

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
  playlistUrl.searchParams.set("maxResults", "20");
  playlistUrl.searchParams.set("key", apiKey);

  const videosResponse = await fetch(
    playlistUrl.toString(),
    { cache: "no-store" }
  );

  const videosData = await readUtf8Json(videosResponse);

  if (!videosResponse.ok) {
    throw new Error(
      videosData?.error?.message ||
        "YouTube動画を取得できませんでした"
    );
  }

  const thumbnail =
    channel.snippet?.thumbnails?.high?.url ||
    channel.snippet?.thumbnails?.medium?.url ||
    channel.snippet?.thumbnails?.default?.url ||
    null;

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

        body:
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
      title: channel.snippet?.title || `@${clean}`,
      thumbnail,
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

    const {
      data: accounts,
      error: accountsError,
    } = await supabase
      .from("monitored_accounts")
      .select("*")
      .eq("platform", "youtube")
      .eq("enabled", true);

    if (accountsError) throw accountsError;

    const {
      data: keywords,
      error: keywordsError,
    } = await supabase
      .from("keywords")
      .select("*");

    if (keywordsError) throw keywordsError;

    let checkedVideos = 0;
    let newVideos = 0;
    let updatedVideos = 0;
    let notificationCount = 0;

    const results = [];

    for (const account of accounts || []) {
      try {
        const youtube =
          await getYoutubeVideos(account.handle);

        // チャンネル名・アイコンも毎回正常データで修復
        const {
          error: accountUpdateError,
        } = await supabase
          .from("monitored_accounts")
          .update({
            name: youtube.channel.title,
            external_id: youtube.channel.id,
            thumbnail_url: youtube.channel.thumbnail,
          })
          .eq("id", account.id);

        if (accountUpdateError) {
          throw accountUpdateError;
        }

        let accountNewVideos = 0;
        let accountUpdatedVideos = 0;
        let accountNotifications = 0;

        for (const video of youtube.videos) {
          checkedVideos += 1;

          const {
            data: existing,
            error: existingError,
          } = await supabase
            .from("posts")
            .select("id")
            .eq("platform", "youtube")
            .eq("external_post_id", video.videoId)
            .maybeSingle();

          if (existingError) {
            throw existingError;
          }

          let post;

          if (existing) {
            // 既存投稿も上書き
            // これで以前の文字化けデータを修復
            const {
              data: updated,
              error: updateError,
            } = await supabase
              .from("posts")
              .update({
                account_id: account.id,
                title: video.title,
                body: video.body,
                post_url: video.url,
                thumbnail_url: video.thumbnail,
                published_at: video.publishedAt,
              })
              .eq("id", existing.id)
              .select()
              .single();

            if (updateError) {
              throw updateError;
            }

            post = updated;

            updatedVideos += 1;
            accountUpdatedVideos += 1;
          } else {
            const {
              data: inserted,
              error: insertError,
            } = await supabase
              .from("posts")
              .insert({
                account_id: account.id,
                platform: "youtube",
                external_post_id: video.videoId,
                title: video.title,
                body: video.body,
                post_url: video.url,
                thumbnail_url: video.thumbnail,
                published_at: video.publishedAt,
              })
              .select()
              .single();

            if (insertError) {
              throw insertError;
            }

            post = inserted;

            newVideos += 1;
            accountNewVideos += 1;

            // 新規動画だけキーワード通知判定
            const applicableKeywords =
              (keywords || []).filter(
                (keyword) =>
                  keyword.account_id === null ||
                  keyword.account_id === account.id
              );

            const searchable = [
              video.title,
              video.body,
              youtube.channel.title,
              account.handle,
            ]
              .join(" ")
              .toLowerCase();

            for (const keyword of applicableKeywords) {
              const word = String(
                keyword.word || ""
              ).trim();

              if (!word) continue;

              if (
                !searchable.includes(
                  word.toLowerCase()
                )
              ) {
                continue;
              }

              const {
                data: existingNotification,
                error: checkError,
              } = await supabase
                .from("notifications")
                .select("id")
                .eq("post_id", post.id)
                .eq("keyword_id", keyword.id)
                .maybeSingle();

              if (checkError) throw checkError;

              if (existingNotification) {
                continue;
              }

              const {
                error: notificationError,
              } = await supabase
                .from("notifications")
                .insert({
                  post_id: post.id,
                  keyword_id: keyword.id,
                  message:
                    `「${word}」を含む新着動画を見つけました`,
                  is_read: false,
                });

              if (notificationError) {
                throw notificationError;
              }

              notificationCount += 1;
              accountNotifications += 1;
            }
          }
        }

        results.push({
          account: youtube.channel.title,
          ok: true,
          checked: youtube.videos.length,
          newVideos: accountNewVideos,
          updatedVideos: accountUpdatedVideos,
          notifications: accountNotifications,
        });
      } catch (error) {
        console.error(
          `sync ${account.handle}:`,
          error
        );

        results.push({
          account: account.name,
          ok: false,
          error:
            error?.message ||
            "同期に失敗しました",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      accounts: accounts?.length || 0,
      checkedVideos,
      newVideos,
      updatedVideos,
      notifications: notificationCount,
      results,
    });
  } catch (error) {
    console.error("sync error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Mikkeの同期に失敗しました",
      },
      { status: 500 }
    );
  }
}
