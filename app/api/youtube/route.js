import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function readUtf8Json(response) {
  const buffer = await response.arrayBuffer();

  const text = new TextDecoder("utf-8").decode(buffer);

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(
      "JSON parse error:",
      text.slice(0, 500)
    );

    throw error;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const handle = searchParams.get("handle");

    if (!handle) {
      return NextResponse.json(
        {
          error: "YouTubeのハンドルが必要です",
        },
        {
          status: 400,
        }
      );
    }

    const apiKey =
      process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "YouTube APIキーが設定されていません",
        },
        {
          status: 500,
        }
      );
    }

    const cleanHandle = handle
      .trim()
      .replace(/^@/, "");

    /* ==============================
       チャンネル取得
    ============================== */

    const channelUrl = new URL(
      "https://www.googleapis.com/youtube/v3/channels"
    );

    channelUrl.searchParams.set(
      "part",
      "snippet,contentDetails"
    );

    channelUrl.searchParams.set(
      "forHandle",
      cleanHandle
    );

    channelUrl.searchParams.set(
      "key",
      apiKey
    );

    const channelResponse =
      await fetch(
        channelUrl.toString(),
        {
          cache: "no-store",
        }
      );

    const channelData =
      await readUtf8Json(
        channelResponse
      );

    if (!channelResponse.ok) {
      console.error(
        "YouTube channel error:",
        channelData
      );

      return NextResponse.json(
        {
          error:
            channelData?.error?.message ||
            "YouTubeチャンネル情報の取得に失敗しました",
        },
        {
          status:
            channelResponse.status,
        }
      );
    }

    if (!channelData.items?.length) {
      return NextResponse.json(
        {
          error:
            `@${cleanHandle} が見つかりませんでした`,
        },
        {
          status: 404,
        }
      );
    }

    const channel =
      channelData.items[0];

    const uploadsPlaylistId =
      channel.contentDetails
        ?.relatedPlaylists
        ?.uploads;

    if (!uploadsPlaylistId) {
      return NextResponse.json(
        {
          error:
            "アップロード動画一覧を取得できませんでした",
        },
        {
          status: 404,
        }
      );
    }

    /* ==============================
       動画取得
    ============================== */

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

    const videosResponse =
      await fetch(
        playlistUrl.toString(),
        {
          cache: "no-store",
        }
      );

    const videosData =
      await readUtf8Json(
        videosResponse
      );

    if (!videosResponse.ok) {
      console.error(
        "YouTube videos error:",
        videosData
      );

      return NextResponse.json(
        {
          error:
            videosData?.error?.message ||
            "YouTube動画の取得に失敗しました",
        },
        {
          status:
            videosResponse.status,
        }
      );
    }

    const channelThumbnail =
      channel.snippet
        ?.thumbnails
        ?.high?.url ||
      channel.snippet
        ?.thumbnails
        ?.medium?.url ||
      channel.snippet
        ?.thumbnails
        ?.default?.url ||
      null;

    const videos =
      (videosData.items || [])
        .map((item) => {
          const videoId =
            item.contentDetails
              ?.videoId ||
            item.snippet
              ?.resourceId
              ?.videoId;

          if (!videoId) {
            return null;
          }

          return {
            id:
              `youtube-${videoId}`,

            videoId,

            platform:
              "youtube",

            user:
              channel.snippet
                ?.title || "",

            handle:
              `@${cleanHandle}`,

            title:
              item.snippet
                ?.title || "",

            text:
              item.snippet
                ?.description || "",

            publishedAt:
              item.contentDetails
                ?.videoPublishedAt ||
              item.snippet
                ?.publishedAt ||
              null,

            thumbnail:
              item.snippet
                ?.thumbnails
                ?.maxres?.url ||
              item.snippet
                ?.thumbnails
                ?.standard?.url ||
              item.snippet
                ?.thumbnails
                ?.high?.url ||
              item.snippet
                ?.thumbnails
                ?.medium?.url ||
              item.snippet
                ?.thumbnails
                ?.default?.url ||
              null,

            channelThumbnail,

            url:
              `https://www.youtube.com/watch?v=${videoId}`,
          };
        })
        .filter(Boolean);

    return NextResponse.json(
      {
        channel: {
          id:
            channel.id,

          title:
            channel.snippet
              ?.title || "",

          handle:
            `@${cleanHandle}`,

          thumbnail:
            channelThumbnail,
        },

        videos,
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
      "YouTube API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "サーバーエラーが発生しました",
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
