import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  return runSync(request);
}

export async function POST(request) {
  return runSync(request);
}

async function runSync(request) {
  try {
    const supabase = getSupabaseAdmin();

    // ========================================
    // 1. 登録中のYouTubeチャンネルを取得
    // ========================================

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
        message: "登録中のYouTubeチャンネルはありません",
        accounts: 0,
        checkedVideos: 0,
        newVideos: 0,
        notifications: 0,
      });
    }

    // ========================================
    // 2. キーワードを取得
    // ========================================

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

    const accountResults = [];

    const origin = new URL(request.url).origin;

    // ========================================
    // 3. チャンネルごとにYouTubeを確認
    // ========================================

    for (const account of accounts) {
      try {
        const youtubeResponse = await fetch(
          `${origin}/api/youtube?handle=${encodeURIComponent(
            account.handle
          )}`,
          {
            cache: "no-store",
          }
        );

        const youtubeData = await youtubeResponse.json();

        if (!youtubeResponse.ok) {
          accountResults.push({
            account: account.name,
            ok: false,
            error:
              youtubeData?.error ||
              "YouTubeから取得できませんでした",
          });

          continue;
        }

        // 正式なチャンネル情報も更新
        const channel = youtubeData.channel;

        if (channel) {
          await supabase
            .from("monitored_accounts")
            .update({
              name: channel.title || account.name,
              external_id: channel.id || account.external_id,
              thumbnail_url:
                channel.thumbnail || account.thumbnail_url,
            })
            .eq("id", account.id);
        }

        const videos = youtubeData.videos || [];

        checkedVideos += videos.length;

        // ========================================
        // 初回同期かどうかを判定
        // ========================================

        const {
          count: existingPostCount,
          error: countError,
        } = await supabase
          .from("posts")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("account_id", account.id);

        if (countError) {
          throw countError;
        }

        const firstSync = existingPostCount === 0;

        let accountNewVideos = 0;
        let accountNotifications = 0;

        // ========================================
        // 4. 動画を1件ずつDBへ
        // ========================================

        for (const video of videos) {
          if (!video.videoId) {
            continue;
          }

          // すでに保存されているか確認
          const {
            data: existingPost,
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

          if (existingPost) {
            continue;
          }

          // 新しく発見した動画
          const {
            data: insertedPost,
            error: insertError,
          } = await supabase
            .from("posts")
            .insert({
              account_id: account.id,
              platform: "youtube",
              external_post_id: video.videoId,
              title: video.title || "",
              body: video.text || "",
              post_url: video.url || null,
              thumbnail_url: video.thumbnail || null,
              published_at: video.publishedAt || null,
            })
            .select()
            .single();

          if (insertError) {
            throw insertError;
          }

          /*
            初回同期では過去動画を20件まとめて取得するので
            全部を「新着通知」にしない。

            2回目以降に初めて発見した動画だけ
            newVideosとして扱う。
          */

          if (firstSync) {
            continue;
          }

          newVideos += 1;
          accountNewVideos += 1;

          // ========================================
          // 5. この動画に適用するキーワード
          // ========================================

          const applicableKeywords = (keywords || []).filter(
            (keyword) =>
              keyword.account_id === null ||
              keyword.account_id === account.id
          );

          if (!applicableKeywords.length) {
            continue;
          }

          const searchableText = [
            video.title || "",
            video.text || "",
            account.name || "",
            account.handle || "",
          ]
            .join(" ")
            .toLowerCase();

          // ========================================
          // 6. キーワード一致 → 通知履歴
          // ========================================

          for (const keyword of applicableKeywords) {
            const word = String(keyword.word || "").trim();

            if (!word) {
              continue;
            }

            if (!searchableText.includes(word.toLowerCase())) {
              continue;
            }

            // 同じ投稿・同じキーワードの
            // 二重通知を防ぐ
            const {
              data: existingNotification,
              error: notificationCheckError,
            } = await supabase
              .from("notifications")
              .select("id")
              .eq("post_id", insertedPost.id)
              .eq("keyword_id", keyword.id)
              .maybeSingle();

            if (notificationCheckError) {
              throw notificationCheckError;
            }

            if (existingNotification) {
              continue;
            }

            const {
              error: notificationInsertError,
            } = await supabase
              .from("notifications")
              .insert({
                post_id: insertedPost.id,
                keyword_id: keyword.id,
                message: `「${word}」を含む新着動画を見つけました`,
                is_read: false,
              });

            if (notificationInsertError) {
              throw notificationInsertError;
            }

            notificationCount += 1;
            accountNotifications += 1;
          }
        }

        accountResults.push({
          account: channel?.title || account.name,
          ok: true,
          firstSync,
          checked: videos.length,
          newVideos: accountNewVideos,
          notifications: accountNotifications,
        });
      } catch (accountError) {
        console.error(
          `sync account error: ${account.handle}`,
          accountError
        );

        accountResults.push({
          account: account.name,
          ok: false,
          error: "このチャンネルの同期に失敗しました",
        });
      }
    }

    // ========================================
    // 完了
    // ========================================

    return NextResponse.json({
      ok: true,
      accounts: accounts.length,
      checkedVideos,
      newVideos,
      notifications: notificationCount,
      results: accountResults,
    });
  } catch (error) {
    console.error("sync error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Mikkeの同期に失敗しました",
      },
      {
        status: 500,
      }
    );
  }
}
