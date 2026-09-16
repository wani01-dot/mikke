import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get("handle");

    if (!handle) {
      return NextResponse.json(
        { error: "YouTubeのハンドルが必要です" },
        { status: 400 }
      );
    }

    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "YouTube APIキーが設定されていません" },
        { status: 500 }
      );
    }

    const cleanHandle = handle.replace(/^@/, "");

    // @ハンドルからチャンネル情報を取得
    const channelUrl =
      `https://www.googleapis.com/youtube/v3/channels` +
      `?part=snippet,contentDetails` +
      `&forHandle=${encodeURIComponent(cleanHandle)}` +
      `&key=${apiKey}`;

    const channelResponse = await fetch(channelUrl, {
      next: { revalidate: 300 },
    });

    const channelData = await channelResponse.json();

    if (!channelResponse.ok) {
      return NextResponse.json(
        {
          error: "YouTubeチャンネル情報の取得に失敗しました",
          details: channelData,
        },
        { status: channelResponse.status }
      );
    }

    if (!channelData.items?.length) {
      return NextResponse.json(
        {
          error: `@${cleanHandle} が見つかりませんでした`,
        },
        { status: 404 }
      );
    }

    const channel = channelData.items[0];

    const uploadsPlaylistId =
      channel.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      return NextResponse.json(
        { error: "アップロード動画一覧を取得できませんでした" },
        { status: 404 }
      );
    }

    // チャンネルの最新動画を取得
    const playlistUrl =
      `https://www.googleapis.com/youtube/v3/playlistItems` +
      `?part=snippet,contentDetails` +
      `&playlistId=${encodeURIComponent(uploadsPlaylistId)}` +
      `&maxResults=20` +
      `&key=${apiKey}`;

    const videosResponse = await fetch(playlistUrl, {
      next: { revalidate: 300 },
    });

    const videosData = await videosResponse.json();

    if (!videosResponse.ok) {
      return NextResponse.json(
        {
          error: "YouTube動画の取得に失敗しました",
          details: videosData,
        },
        { status: videosResponse.status }
      );
    }

    const videos = (videosData.items || [])
      .map((item) => {
        const videoId =
          item.contentDetails?.videoId ||
          item.snippet?.resourceId?.videoId;

        if (!videoId) return null;

        return {
          id: `youtube-${videoId}`,
          videoId,
          platform: "youtube",

          user: channel.snippet?.title || "",
          handle: `@${cleanHandle}`,

          title: item.snippet?.title || "",
          text: item.snippet?.description || "",

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

          channelThumbnail:
            channel.snippet?.thumbnails?.high?.url ||
            channel.snippet?.thumbnails?.medium?.url ||
            channel.snippet?.thumbnails?.default?.url ||
            null,

          url: `https://www.youtube.com/watch?v=${videoId}`,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      channel: {
        id: channel.id,
        title: channel.snippet?.title || "",
        handle: `@${cleanHandle}`,
        thumbnail:
          channel.snippet?.thumbnails?.high?.url ||
          channel.snippet?.thumbnails?.medium?.url ||
          channel.snippet?.thumbnails?.default?.url ||
          null,
      },

      videos,
    });
  } catch (error) {
    console.error("YouTube API error:", error);

    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
