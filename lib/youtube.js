function cleanYoutubeHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "");
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    console.error(
      "YouTube JSON parse error:",
      error
    );

    throw new Error(
      "YouTubeから正しいデータを取得できませんでした"
    );
  }
}

export async function getYoutubeChannelAndVideos(
  handle,
  maxResults = 20
) {
  const apiKey =
    process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "YOUTUBE_API_KEY が設定されていません"
    );
  }

  const cleanHandle =
    cleanYoutubeHandle(handle);

  if (!cleanHandle) {
    throw new Error(
      "YouTubeのハンドルが必要です"
    );
  }

  /*
   * チャンネル情報を取得
   */

  const channelUrl =
    new URL(
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
    await readJson(
      channelResponse
    );

  if (!channelResponse.ok) {
    console.error(
      "YouTube channel API:",
      channelData
    );

    throw new Error(
      channelData?.error?.message ||
        "YouTubeチャンネル情報を取得できませんでした"
    );
  }

  if (!channelData.items?.length) {
    throw new Error(
      `@${cleanHandle} が見つかりませんでした`
    );
  }

  const channel =
    channelData.items[0];

  const uploadsPlaylistId =
    channel.contentDetails
      ?.relatedPlaylists
      ?.uploads;

  if (!uploadsPlaylistId) {
    throw new Error(
      "アップロード動画一覧を取得できませんでした"
    );
  }

  /*
   * 最新動画を取得
   */

  const playlistUrl =
    new URL(
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
    String(maxResults)
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
    await readJson(
      videosResponse
    );

  if (!videosResponse.ok) {
    console.error(
      "YouTube playlist API:",
      videosData
    );

    throw new Error(
      videosData?.error?.message ||
        "YouTube動画を取得できませんでした"
    );
  }

  /*
   * チャンネルアイコン
   */

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

  /*
   * 動画データをMikke用に整形
   */

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

        const title =
          item.snippet
            ?.title ?? "";

        const description =
          item.snippet
            ?.description ?? "";

        const publishedAt =
          item.contentDetails
            ?.videoPublishedAt ||
          item.snippet
            ?.publishedAt ||
          null;

        const thumbnail =
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
          null;

        return {
          videoId,
          title,
          description,
          publishedAt,
          thumbnail,

          url:
            `https://www.youtube.com/watch?v=${videoId}`,
        };
      })
      .filter(Boolean);

  return {
    channel: {
      id:
        channel.id,

      title:
        channel.snippet
          ?.title ||
        `@${cleanHandle}`,

      handle:
        cleanHandle,

      thumbnail:
        channelThumbnail,
    },

    videos,
  };
}
