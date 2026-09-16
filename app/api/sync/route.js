import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { getYoutubeChannelAndVideos } from "../../../lib/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return runSync();
}

export async function POST() {
  return runSync();
}

async function runSync() {
  try {
    const supabase =
      getSupabaseAdmin();

    /*
     * 登録アカウント
     */

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

    /*
     * キーワード
     */

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
    let updatedVideos = 0;
    let notifications = 0;

    const results = [];

    for (const account of accounts || []) {
      try {
        const youtube =
          await getYoutubeChannelAndVideos(
            account.handle,
            20
          );

        /*
         * 正式なチャンネル情報で更新
         */

        const {
          error: accountError,
        } = await supabase
          .from("monitored_accounts")
          .update({
            name:
              youtube.channel.title,

            external_id:
              youtube.channel.id,

            thumbnail_url:
              youtube.channel.thumbnail,
          })
          .eq("id", account.id);

        if (accountError) {
          throw accountError;
        }

        let accountNew = 0;
        let accountUpdated = 0;
        let accountNotifications = 0;

        for (const video of youtube.videos) {
          checkedVideos += 1;

          /*
           * 動画IDはYouTube全体で一意。
           * account_idに関係なく探す。
           */

          const {
            data: existing,
            error: existingError,
          } = await supabase
            .from("posts")
            .select(
              "id, account_id"
            )
            .eq(
              "platform",
              "youtube"
            )
            .eq(
              "external_post_id",
              video.videoId
            )
            .maybeSingle();

          if (existingError) {
            throw existingError;
          }

          let post;
          let isNew = false;

          if (existing) {
            /*
             * 既存動画を正常なデータで更新
             */

            const {
              data: updated,
              error: updateError,
            } = await supabase
              .from("posts")
              .update({
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
              .eq(
                "id",
                existing.id
              )
              .select()
              .single();

            if (updateError) {
              throw updateError;
            }

            post = updated;

            updatedVideos += 1;
            accountUpdated += 1;
          } else {
            /*
             * 新規動画
             */

            const {
              data: inserted,
              error: insertError,
            } = await supabase
              .from("posts")
              .insert({
                account_id:
                  account.id,

                platform:
                  "youtube",

                external_post_id:
                  video.videoId,

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
              /*
               * 同時処理などで既に追加された場合、
               * ここで同期全体を壊さない。
               */

              if (
                insertError.code ===
                "23505"
              ) {
                continue;
              }

              throw insertError;
            }

            post = inserted;
            isNew = true;

            newVideos += 1;
            accountNew += 1;
          }

          /*
           * 通知は本当に新しい動画だけ
           */

          if (!isNew || !post) {
            continue;
          }

          const applicableKeywords =
            (keywords || []).filter(
              (keyword) =>
                keyword.account_id ===
                  null ||
                keyword.account_id ===
                  account.id
            );

          const searchable =
            [
              video.title,
              video.description,
              youtube.channel.title,
              account.handle,
            ]
              .join(" ")
              .toLowerCase();

          for (
            const keyword
            of applicableKeywords
          ) {
            const word =
              String(
                keyword.word || ""
              ).trim();

            if (!word) {
              continue;
            }

            if (
              !searchable.includes(
                word.toLowerCase()
              )
            ) {
              continue;
            }

            const {
              data:
                existingNotification,
              error:
                notificationCheckError,
            } = await supabase
              .from("notifications")
              .select("id")
              .eq(
                "post_id",
                post.id
              )
              .eq(
                "keyword_id",
                keyword.id
              )
              .maybeSingle();

            if (
              notificationCheckError
            ) {
              throw notificationCheckError;
            }

            if (
              existingNotification
            ) {
              continue;
            }

            const {
              error:
                notificationError,
            } = await supabase
              .from("notifications")
              .insert({
                post_id:
                  post.id,

                keyword_id:
                  keyword.id,

                message:
                  `「${word}」を含む新着動画を見つけました`,

                is_read:
                  false,
              });

            if (
              notificationError
            ) {
              throw notificationError;
            }

            notifications += 1;
            accountNotifications += 1;
          }
        }

        results.push({
          account:
            youtube.channel.title,

          handle:
            youtube.channel.handle,

          ok: true,

          checked:
            youtube.videos.length,

          newVideos:
            accountNew,

          updatedVideos:
            accountUpdated,

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

          handle:
            account.handle,

          ok: false,

          error:
            error?.message ||
            "同期に失敗しました",
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,

        accounts:
          accounts?.length || 0,

        checkedVideos,

        newVideos,

        updatedVideos,

        notifications,

        results,
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
      "sync:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error?.message ||
          "同期に失敗しました",
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
