import { NextResponse } from "next/server";
import { getYoutubeChannelAndVideos } from "../../../lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } =
      new URL(request.url);

    const handle =
      searchParams.get("handle");

    if (!handle) {
      return NextResponse.json(
        {
          error:
            "YouTubeのハンドルが必要です",
        },
        {
          status: 400,
        }
      );
    }

    const data =
      await getYoutubeChannelAndVideos(
        handle,
        20
      );

    const videos =
      data.videos.map((video) => ({
        id:
          `youtube-${video.videoId}`,

        videoId:
          video.videoId,

        platform:
          "youtube",

        user:
          data.channel.title,

        handle:
          `@${data.channel.handle}`,

        title:
          video.title,

        text:
          video.description,

        publishedAt:
          video.publishedAt,

        thumbnail:
          video.thumbnail,

        channelThumbnail:
          data.channel.thumbnail,

        url:
          video.url,
      }));

    return NextResponse.json(
      {
        channel: {
          id:
            data.channel.id,

          title:
            data.channel.title,

          handle:
            `@${data.channel.handle}`,

          thumbnail:
            data.channel.thumbnail,
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
      "YouTube API:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "YouTubeを取得できませんでした",
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
