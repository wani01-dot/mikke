import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId が必要です" },
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

    // チャンネルの「アップロード動画」プレイリストIDを取得
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id=${encodeURIComponent(
        channelId
      )}&key=${apiKey}`,
      {
        next: { revalidate: 300 },
      }
    );

    const channelData = await channelResponse.json();

    if (!channelResponse.ok) {
      return NextResponse.json(
        {
          error: "YouTube APIでエラーが発生しました",
          details: channelData,
        },
        { status: channelResponse.status }
      );
    }

    if (!channelData.items?.length) {
      return NextResponse.json(
        { error: "YouTubeチャンネルが見つかりません" },
        { status: 404 }
      );
    }

    const channel = channelData.items[0];

    const uploadsPlaylistId =
      channel.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      return NextResponse.json(
        { error: "アップロード動画を取得できませんでした" },
        { status: 404 }
      );
    }

    // 最新動画を取得
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(
        uploadsPlaylistId
      )}&maxResults=20&key=${apiKey}`,
      {
        next: { revalidate: 300 },
      }
    );

    const videosData = await videosResponse.json();

    if (!videosResponse.ok) {
      return NextResponse.json(
        {
          error: "動画一覧の取得に失敗しました",
          details: videosData,
        },
        { status: videosResponse.status }
      );
    }

    const videos = (videosData.items || []).map((item) => {
      const videoId =
        item.contentDetails?.videoId ||
        item.snippet?.resourceId?.videoId;

      return {
        id: videoId,
        platform: "youtube",
        channelId,
        channelTitle: item.snippet?.videoOwnerChannelTitle || channel.snippet?.title,
        title: item.snippet?.title || "",
        description: item.snippet?.description || "",
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
        url: videoId
          ? `https://www.youtube.com/watch?v=${videoId}`
          : null,
      };
    });

    return NextResponse.json({
      channel: {
        id: channel.id,
        title: channel.snippet?.title || "",
        thumbnail:
          channel.snippet?.thumbnails?.high?.url ||
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
