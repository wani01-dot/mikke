"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  Home,
  Image as ImageIcon,
  Instagram,
  MessageSquare,
  Search,
  Star,
  Video,
  X as Close,
  Youtube,
} from "lucide-react";

/*
  YouTubeで監視するチャンネル

  channelIdは不要。
  @以降のハンドルだけ登録すればOK。

  今後増やす場合：
  {
    name: "チャンネル名",
    handle: "YouTubeのハンドル",
  },
*/
const YOUTUBE_CHANNELS = [
  {
    name: "板橋ハウス",
    handle: "itabasihausu",
  },
];

/*
  現時点ではX・Instagramはダミーデータ。
  YouTubeだけ本物のAPIデータに置き換える。
*/
const initialPosts = [
  {
    id: "x-1",
    platform: "x",
    user: "板橋ハウス",
    handle: "@itabasihausu",
    time: "12分前",
    text: "明日、竹内の単独ライブがあります。詳細はまたお知らせします！",
    kind: "text",
    tags: ["竹内", "単独", "ライブ"],
  },
  {
    id: "instagram-1",
    platform: "instagram",
    user: "板橋ハウス",
    handle: "@itabasihausu",
    time: "35分前",
    text: "最高の夜でした！ 来てくれたみんなありがとう！",
    kind: "image",
    tags: ["ライブ", "写真"],
    image:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "x-2",
    platform: "x",
    user: "エバース",
    handle: "@everes_official",
    time: "4時間前",
    text: "大阪ライブのお知らせ。チケット情報はこちら！",
    kind: "text",
    tags: ["大阪", "チケット", "ライブ"],
  },
  {
    id: "instagram-2",
    platform: "instagram",
    user: "めぞん",
    handle: "@mezon_official",
    time: "5時間前",
    text: "収録終わりの一枚。今日もありがとうございました。",
    kind: "image",
    tags: ["写真"],
    image:
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80",
  },
];

const platformLabel = {
  x: "X",
  instagram: "Instagram",
  youtube: "YouTube",
};

function PlatformMark({ platform }) {
  if (platform === "youtube") {
    return <Youtube size={20} />;
  }

  if (platform === "instagram") {
    return <Instagram size={20} />;
  }

  return <span className="xmark">X</span>;
}

/*
  YouTubeの投稿日を
  「12分前」「3時間前」「2日前」
  のように表示する。
*/
function formatRelativeTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();

  const diffMilliseconds =
    now.getTime() - date.getTime();

  const diffMinutes = Math.floor(
    diffMilliseconds / 1000 / 60
  );

  if (diffMinutes < 1) {
    return "たった今";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}分前`;
  }

  const diffHours = Math.floor(
    diffMinutes / 60
  );

  if (diffHours < 24) {
    return `${diffHours}時間前`;
  }

  const diffDays = Math.floor(
    diffHours / 24
  );

  if (diffDays < 30) {
    return `${diffDays}日前`;
  }

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

/*
  APIから返ってきたYouTube動画を
  Mikkeの投稿形式に変換。
*/
function convertYoutubeVideo(video) {
  return {
    id: video.id,
    platform: "youtube",

    user:
      video.user ||
      "YouTube",

    handle:
      video.handle ||
      "YouTube",

    time:
      formatRelativeTime(
        video.publishedAt
      ),

    publishedAt:
      video.publishedAt,

    text:
      video.title ||
      "タイトルなし",

    kind: "video",

    tags: ["動画"],

    image:
      video.thumbnail ||
      null,

    url:
      video.url ||
      null,

    channelThumbnail:
      video.channelThumbnail ||
      null,
  };
}

export default function Page() {
  const [platform, setPlatform] =
    useState("all");

  const [kind, setKind] =
    useState("all");

  const [page, setPage] =
    useState("home");

  const [saved, setSaved] =
    useState([]);

  const [memos, setMemos] =
    useState({});

  const [editing, setEditing] =
    useState(null);

  const [youtubePosts, setYoutubePosts] =
    useState([]);

  const [youtubeLoading, setYoutubeLoading] =
    useState(true);

  const [youtubeError, setYoutubeError] =
    useState("");

  /*
    後で見る・メモを読み込み
  */
  useEffect(() => {
    try {
      setSaved(
        JSON.parse(
          localStorage.getItem(
            "mikke-saved"
          ) || "[]"
        )
      );

      setMemos(
        JSON.parse(
          localStorage.getItem(
            "mikke-memos"
          ) || "{}"
        )
      );
    } catch {
      // localStorageが壊れていても
      // Mikke本体はそのまま表示する
    }
  }, []);

  /*
    YouTubeの最新動画を取得
  */
  useEffect(() => {
    let cancelled = false;

    async function loadYoutube() {
      setYoutubeLoading(true);
      setYoutubeError("");

      try {
        const results =
          await Promise.all(
            YOUTUBE_CHANNELS.map(
              async (channel) => {
                const response =
                  await fetch(
                    `/api/youtube?handle=${encodeURIComponent(
                      channel.handle
                    )}`
                  );

                const data =
                  await response.json();

                if (!response.ok) {
                  throw new Error(
                    data?.error ||
                      `${channel.name}の動画取得に失敗しました`
                  );
                }

                return (
                  data.videos || []
                ).map(
                  convertYoutubeVideo
                );
              }
            )
          );

        const videos =
          results
            .flat()
            .sort(
              (a, b) =>
                new Date(
                  b.publishedAt || 0
                ).getTime() -
                new Date(
                  a.publishedAt || 0
                ).getTime()
            );

        if (!cancelled) {
          setYoutubePosts(videos);
        }
      } catch (error) {
        console.error(
          "YouTube load error:",
          error
        );

        if (!cancelled) {
          setYoutubeError(
            error?.message ||
              "YouTube動画を取得できませんでした"
          );
        }
      } finally {
        if (!cancelled) {
          setYoutubeLoading(false);
        }
      }
    }

    loadYoutube();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
    X・Instagramの仮投稿 +
    本物のYouTube投稿
  */
  const allPosts = useMemo(() => {
    return [
      ...youtubePosts,
      ...initialPosts,
    ];
  }, [youtubePosts]);

  /*
    ホーム画面のフィルター
  */
  const visible = useMemo(() => {
    return allPosts.filter(
      (post) =>
        (platform === "all" ||
          post.platform === platform) &&
        (kind === "all" ||
          post.kind === kind)
    );
  }, [
    allPosts,
    platform,
    kind,
  ]);

  /*
    後で見る
  */
  const savedPosts = useMemo(() => {
    return allPosts.filter((post) =>
      saved.includes(post.id)
    );
  }, [
    allPosts,
    saved,
  ]);

  /*
    メモ編集中の投稿
  */
  const editingPost = useMemo(() => {
    if (!editing) return null;

    return allPosts.find(
      (post) =>
        post.id === editing
    );
  }, [
    allPosts,
    editing,
  ]);

  const toggleSaved = (id) => {
    const next =
      saved.includes(id)
        ? saved.filter(
            (savedId) =>
              savedId !== id
          )
        : [
            ...saved,
            id,
          ];

    setSaved(next);

    localStorage.setItem(
      "mikke-saved",
      JSON.stringify(next)
    );
  };

  const saveMemo = (
    id,
    value
  ) => {
    const next = {
      ...memos,
      [id]: value,
    };

    setMemos(next);

    localStorage.setItem(
      "mikke-memos",
      JSON.stringify(next)
    );

    setEditing(null);
  };

  return (
    <main
      className={
        "app " +
        (page === "saved"
          ? "saved-page"
          : "")
      }
    >
      <header>
        <div>
          <h1>Mikke</h1>
          <p>
            見逃したくない、あの瞬間を。
          </p>
        </div>

        <div className="header-icons">
          <Search />
          <Bell />
        </div>
      </header>

      {page === "home" ? (
        <>
          <nav className="platform-tabs">
            {[
              "all",
              "x",
              "instagram",
              "youtube",
            ].map((item) => (
              <button
                key={item}
                className={
                  platform === item
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setPlatform(item)
                }
              >
                {item === "all"
                  ? "すべて"
                  : platformLabel[
                      item
                    ]}
              </button>
            ))}
          </nav>

          <section className="people">
            {[
              "板橋ハウス",
              "エバース",
              "めぞん",
              "令和ロマン",
            ].map((name) => (
              <div
                className="person"
                key={name}
              >
                <div className="avatar">
                  {name.slice(0, 1)}
                </div>

                <span>
                  {name}
                </span>
              </div>
            ))}

            <div className="person">
              <div className="avatar add">
                ＋
              </div>

              <span>追加</span>
            </div>
          </section>

          <div className="section-row">
            <strong>新着</strong>

            <div className="kind-tabs">
              <button
                className={
                  kind === "all"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setKind("all")
                }
              >
                すべて
              </button>

              <button
                className={
                  kind === "text"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setKind("text")
                }
              >
                テキスト
              </button>

              <button
                className={
                  kind === "image"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setKind("image")
                }
              >
                <ImageIcon
                  size={15}
                />
                画像
              </button>

              <button
                className={
                  kind === "video"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setKind("video")
                }
              >
                <Video
                  size={15}
                />
                動画
              </button>
            </div>
          </div>

          {youtubeLoading &&
            (platform === "all" ||
              platform ===
                "youtube") && (
              <div className="youtube-status">
                YouTubeの新着を取得中...
              </div>
            )}

          {youtubeError &&
            (platform === "all" ||
              platform ===
                "youtube") && (
              <div className="youtube-status youtube-error">
                {youtubeError}
              </div>
            )}

          <section className="feed">
            {visible.map(
              (post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  saved={saved.includes(
                    post.id
                  )}
                  memo={
                    memos[
                      post.id
                    ]
                  }
                  onStar={() =>
                    toggleSaved(
                      post.id
                    )
                  }
                  onMemo={() =>
                    setEditing(
                      post.id
                    )
                  }
                />
              )
            )}

            {!youtubeLoading &&
              !visible.length && (
                <div className="empty">
                  <Search />

                  <h3>
                    投稿がありません
                  </h3>

                  <p>
                    この条件に合う投稿は
                    <br />
                    まだありません。
                  </p>
                </div>
              )}
          </section>
        </>
      ) : (
        <>
          <div className="saved-title">
            <div>
              <h2>
                後で見る
              </h2>

              <p>
                {
                  savedPosts.length
                }
                件保存中
              </p>
            </div>

            <Search />
          </div>

          <nav className="platform-tabs saved-tabs">
            {[
              "all",
              "x",
              "instagram",
              "youtube",
            ].map((item) => (
              <button
                key={item}
                className={
                  platform === item
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setPlatform(item)
                }
              >
                {item === "all"
                  ? "すべて"
                  : platformLabel[
                      item
                    ]}
              </button>
            ))}
          </nav>

          <section className="feed">
            {savedPosts.filter(
              (post) =>
                platform ===
                  "all" ||
                post.platform ===
                  platform
            ).length ? (
              savedPosts
                .filter(
                  (post) =>
                    platform ===
                      "all" ||
                    post.platform ===
                      platform
                )
                .map((post) => (
                  <PostCard
                    key={
                      post.id
                    }
                    post={
                      post
                    }
                    saved
                    memo={
                      memos[
                        post.id
                      ]
                    }
                    onStar={() =>
                      toggleSaved(
                        post.id
                      )
                    }
                    onMemo={() =>
                      setEditing(
                        post.id
                      )
                    }
                  />
                ))
            ) : (
              <div className="empty">
                <Star />

                <h3>
                  まだ何もありません
                </h3>

                <p>
                  気になる投稿の☆を押すと、
                  <br />
                  ここに溜まります。
                </p>
              </div>
            )}
          </section>
        </>
      )}

      <BottomNav
        page={page}
        setPage={setPage}
      />

      {editing &&
        editingPost && (
          <MemoSheet
            post={
              editingPost
            }
            value={
              memos[
                editing
              ] || ""
            }
            onClose={() =>
              setEditing(
                null
              )
            }
            onSave={(
              value
            ) =>
              saveMemo(
                editing,
                value
              )
            }
          />
        )}
    </main>
  );
}

function PostCard({
  post,
  saved,
  onStar,
  onMemo,
  memo,
}) {
  const openPost = () => {
    if (!post.url) {
      return;
    }

    window.open(
      post.url,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <article className="card">
      <div className="post-head">
        <div
          className={
            "platform-icon " +
            post.platform
          }
        >
          <PlatformMark
            platform={
              post.platform
            }
          />
        </div>

        <div className="identity">
          <strong>
            {post.user}
          </strong>

          <span>
            {post.handle}
          </span>
        </div>

        <time>
          {post.time}
        </time>
      </div>

      {post.url ? (
        <button
          type="button"
          className="post-link"
          onClick={
            openPost
          }
        >
          <p className="post-text">
            {post.text}
          </p>
        </button>
      ) : (
        <p className="post-text">
          {post.text}
        </p>
      )}

      {post.image && (
        post.url ? (
          <button
            type="button"
            className="thumb"
            onClick={
              openPost
            }
            aria-label="YouTubeで動画を開く"
          >
            <img
              src={
                post.image
              }
              alt={
                post.text ||
                "投稿サムネイル"
              }
            />

            {post.kind ===
              "video" && (
              <div className="play">
                ▶
              </div>
            )}
          </button>
        ) : (
          <div className="thumb">
            <img
              src={
                post.image
              }
              alt="投稿サムネイル"
            />

            {post.kind ===
              "video" && (
              <div className="play">
                ▶
              </div>
            )}
          </div>
        )
      )}

      <div className="post-foot">
        <div className="tags">
          {(post.tags || []).map(
            (tag) => (
              <span
                key={
                  tag
                }
              >
                {tag}
              </span>
            )
          )}
        </div>

        <div className="actions">
          <button
            onClick={
              onMemo
            }
            aria-label="メモ"
          >
            <MessageSquare
              size={19}
            />
          </button>

          <button
            className={
              saved
                ? "starred"
                : ""
            }
            onClick={
              onStar
            }
            aria-label="後で見る"
          >
            <Star
              size={21}
              fill={
                saved
                  ? "currentColor"
                  : "none"
              }
            />
          </button>
        </div>
      </div>

      {memo && (
        <button
          className="memo-preview"
          onClick={
            onMemo
          }
        >
          <b>メモ</b>

          {memo}

          <ChevronRight
            size={16}
          />
        </button>
      )}
    </article>
  );
}

function BottomNav({
  page,
  setPage,
}) {
  return (
    <nav className="bottom">
      <button
        className={
          page === "home"
            ? "on"
            : ""
        }
        onClick={() =>
          setPage("home")
        }
      >
        <Home />
        <span>
          ホーム
        </span>
      </button>

      <button>
        <Search />
        <span>
          検索
        </span>
      </button>

      <button className="plus">
        ＋
      </button>

      <button>
        <Bell />
        <span>
          通知
        </span>
      </button>

      <button
        className={
          page === "saved"
            ? "on"
            : ""
        }
        onClick={() =>
          setPage("saved")
        }
      >
        <Star />
        <span>
          後で見る
        </span>
      </button>
    </nav>
  );
}

function MemoSheet({
  post,
  value,
  onClose,
  onSave,
}) {
  const [text, setText] =
    useState(value);

  return (
    <div
      className="overlay"
      onClick={
        onClose
      }
    >
      <div
        className="sheet"
        onClick={(
          event
        ) =>
          event.stopPropagation()
        }
      >
        <div className="sheet-top">
          <strong>
            メモ
          </strong>

          <button
            onClick={
              onClose
            }
          >
            <Close />
          </button>
        </div>

        <div className="mini">
          <div
            className={
              "platform-icon " +
              post.platform
            }
          >
            <PlatformMark
              platform={
                post.platform
              }
            />
          </div>

          <div>
            <b>
              {post.user}
            </b>

            <p>
              {post.text}
            </p>
          </div>
        </div>

        <label>
          この投稿について
        </label>

        <textarea
          value={
            text
          }
          onChange={(
            event
          ) =>
            setText(
              event.target.value
            )
          }
          maxLength={
            500
          }
          placeholder="忘れたくないこと、あとで確認したいこと…"
        />

        <small>
          {text.length}
          /500
        </small>

        <button
          className="save"
          onClick={() =>
            onSave(
              text
            )
          }
        >
          保存
        </button>
      </div>
    </div>
  );
}
