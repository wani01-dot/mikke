"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Home,
  Image as ImageIcon,
  Instagram,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  Video,
  X as Close,
  Youtube,
} from "lucide-react";

const DEFAULT_YOUTUBE_CHANNELS = [
  {
    name: "板橋ハウス",
    handle: "itabasihausu",
  },
];

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
  if (platform === "youtube") return <Youtube size={20} />;
  if (platform === "instagram") return <Instagram size={20} />;
  return <span className="xmark">X</span>;
}

function formatRelativeTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}時間前`;

  const days = Math.floor(hours / 24);

  if (days < 30) return `${days}日前`;

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function cleanYoutubeHandle(value) {
  let text = value.trim();

  if (!text) return "";

  try {
    if (text.startsWith("http://") || text.startsWith("https://")) {
      const url = new URL(text);
      const match = url.pathname.match(/\/@([^/]+)/);

      if (match?.[1]) {
        return decodeURIComponent(match[1]);
      }
    }
  } catch {}

  text = text.replace(/^@/, "");

  if (text.includes("youtube.com/@")) {
    text = text.split("youtube.com/@")[1].split(/[/?#]/)[0];
  }

  return text.trim();
}

function convertYoutubeVideo(video) {
  return {
    id: video.id,
    platform: "youtube",
    user: video.user || "YouTube",
    handle: video.handle || "YouTube",
    time: formatRelativeTime(video.publishedAt),
    publishedAt: video.publishedAt,
    text: video.title || "タイトルなし",
    kind: "video",
    tags: ["動画"],
    image: video.thumbnail || null,
    url: video.url || null,
    channelThumbnail: video.channelThumbnail || null,
  };
}

export default function Page() {
  const [platform, setPlatform] = useState("all");
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState("home");

  const [saved, setSaved] = useState([]);
  const [memos, setMemos] = useState({});
  const [editing, setEditing] = useState(null);

  const [youtubeChannels, setYoutubeChannels] = useState(
    DEFAULT_YOUTUBE_CHANNELS
  );
  const [youtubePosts, setYoutubePosts] = useState([]);
  const [youtubeLoading, setYoutubeLoading] = useState(true);
  const [youtubeErrors, setYoutubeErrors] = useState([]);

  const [selectedUser, setSelectedUser] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  const [keywords, setKeywords] = useState([]);
  const [keywordOnly, setKeywordOnly] = useState(false);
  const [keywordOpen, setKeywordOpen] = useState(false);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const storedSaved = JSON.parse(
        localStorage.getItem("mikke-saved") || "[]"
      );

      const storedMemos = JSON.parse(
        localStorage.getItem("mikke-memos") || "{}"
      );

      const storedChannels = JSON.parse(
        localStorage.getItem("mikke-youtube-channels") || "null"
      );

      const storedKeywords = JSON.parse(
        localStorage.getItem("mikke-keywords") || "[]"
      );

      setSaved(storedSaved);
      setMemos(storedMemos);

      if (Array.isArray(storedChannels)) {
        setYoutubeChannels(storedChannels);
      }

      if (Array.isArray(storedKeywords)) {
        setKeywords(storedKeywords);
      }
    } catch {}

    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    localStorage.setItem(
      "mikke-youtube-channels",
      JSON.stringify(youtubeChannels)
    );
  }, [youtubeChannels, ready]);

  useEffect(() => {
    if (!ready) return;

    localStorage.setItem(
      "mikke-keywords",
      JSON.stringify(keywords)
    );
  }, [keywords, ready]);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    async function loadYoutube() {
      if (!youtubeChannels.length) {
        setYoutubePosts([]);
        setYoutubeErrors([]);
        setYoutubeLoading(false);
        return;
      }

      setYoutubeLoading(true);
      setYoutubeErrors([]);

      const results = await Promise.allSettled(
        youtubeChannels.map(async (channel) => {
          const response = await fetch(
            `/api/youtube?handle=${encodeURIComponent(channel.handle)}`,
            { cache: "no-store" }
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              `${channel.name || "チャンネル"}：${
                data?.error || "取得できませんでした"
              }`
            );
          }

          return {
            channel,
            data,
          };
        })
      );

      if (cancelled) return;

      const videos = [];
      const errors = [];
      const correctedChannels = [];

      results.forEach((result, index) => {
        const original = youtubeChannels[index];

        if (result.status === "fulfilled") {
          const { data } = result.value;

          const realName =
            data?.channel?.title ||
            original.name ||
            `@${original.handle}`;

          correctedChannels.push({
            name: realName,
            handle: original.handle,
            thumbnail: data?.channel?.thumbnail || null,
          });

          (data.videos || []).forEach((video) => {
            videos.push(convertYoutubeVideo(video));
          });
        } else {
          correctedChannels.push(original);

          errors.push(
            result.reason?.message ||
              `${original.name}を取得できませんでした`
          );
        }
      });

      videos.sort(
        (a, b) =>
          new Date(b.publishedAt || 0).getTime() -
          new Date(a.publishedAt || 0).getTime()
      );

      setYoutubePosts(videos);
      setYoutubeErrors(errors);

      const changed =
        JSON.stringify(correctedChannels) !==
        JSON.stringify(youtubeChannels);

      if (changed) {
        setYoutubeChannels(correctedChannels);
      }

      setYoutubeLoading(false);
    }

    loadYoutube();

    return () => {
      cancelled = true;
    };
  }, [youtubeChannels, ready]);

  const allPosts = useMemo(() => {
    return [...youtubePosts, ...initialPosts];
  }, [youtubePosts]);

  const people = useMemo(() => {
    const map = new Map();

    allPosts.forEach((post) => {
      if (!map.has(post.user)) {
        map.set(post.user, {
          name: post.user,
          thumbnail: post.channelThumbnail || null,
        });
      } else if (
        post.channelThumbnail &&
        !map.get(post.user).thumbnail
      ) {
        map.set(post.user, {
          name: post.user,
          thumbnail: post.channelThumbnail,
        });
      }
    });

    return Array.from(map.values());
  }, [allPosts]);

  const matchesKeyword = (post) => {
    if (!keywords.length) return true;

    const source = [
      post.text,
      post.user,
      post.handle,
      ...(post.tags || []),
    ]
      .join(" ")
      .toLowerCase();

    return keywords.some((word) =>
      source.includes(word.toLowerCase())
    );
  };

  const visible = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return allPosts.filter((post) => {
      if (platform !== "all" && post.platform !== platform) {
        return false;
      }

      if (kind !== "all" && post.kind !== kind) {
        return false;
      }

      if (selectedUser !== "all" && post.user !== selectedUser) {
        return false;
      }

      if (keywordOnly && !matchesKeyword(post)) {
        return false;
      }

      if (query) {
        const source = [
          post.user,
          post.handle,
          post.text,
          ...(post.tags || []),
        ]
          .join(" ")
          .toLowerCase();

        if (!source.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [
    allPosts,
    platform,
    kind,
    selectedUser,
    keywordOnly,
    keywords,
    searchText,
  ]);

  const savedPosts = useMemo(() => {
    return allPosts.filter((post) => saved.includes(post.id));
  }, [allPosts, saved]);

  const editingPost = useMemo(() => {
    if (!editing) return null;

    return allPosts.find((post) => post.id === editing);
  }, [allPosts, editing]);

  const toggleSaved = (id) => {
    const next = saved.includes(id)
      ? saved.filter((savedId) => savedId !== id)
      : [...saved, id];

    setSaved(next);

    localStorage.setItem(
      "mikke-saved",
      JSON.stringify(next)
    );
  };

  const saveMemo = (id, value) => {
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

  const addYoutubeChannel = (value) => {
    const handle = cleanYoutubeHandle(value);

    if (!handle) {
      return {
        ok: false,
        message: "チャンネルURLか@ハンドルを入力してね。",
      };
    }

    const exists = youtubeChannels.some(
      (channel) =>
        channel.handle.toLowerCase() === handle.toLowerCase()
    );

    if (exists) {
      return {
        ok: false,
        message: "このチャンネルはすでに追加されています。",
      };
    }

    setYoutubeChannels((current) => [
      ...current,
      {
        name: `@${handle}`,
        handle,
      },
    ]);

    setPlatform("youtube");
    setSelectedUser("all");

    return {
      ok: true,
    };
  };

  const removeYoutubeChannel = (handle) => {
    const target = youtubeChannels.find(
      (channel) => channel.handle === handle
    );

    setYoutubeChannels((current) =>
      current.filter((channel) => channel.handle !== handle)
    );

    if (target && selectedUser === target.name) {
      setSelectedUser("all");
    }
  };

  const addKeyword = (value) => {
    const word = value.trim();

    if (!word) return false;

    const exists = keywords.some(
      (item) => item.toLowerCase() === word.toLowerCase()
    );

    if (exists) return false;

    setKeywords((current) => [...current, word]);

    return true;
  };

  const removeKeyword = (word) => {
    setKeywords((current) =>
      current.filter((item) => item !== word)
    );
  };

  const goHome = () => {
    setPage("home");
  };

  return (
    <main className={"app " + (page === "saved" ? "saved-page" : "")}>
      <header>
        <div>
          <h1>Mikke</h1>
          <p>見逃したくない、あの瞬間を。</p>
        </div>

        <div className="header-icons">
          <button
            className="icon-button"
            onClick={() => setSearchOpen(true)}
            aria-label="検索"
          >
            <Search />
          </button>

          <button
            className="icon-button"
            onClick={() => setKeywordOpen(true)}
            aria-label="キーワード"
          >
            <Bell />
          </button>
        </div>
      </header>

      {page === "home" ? (
        <>
          <nav className="platform-tabs">
            {["all", "x", "instagram", "youtube"].map((item) => (
              <button
                key={item}
                className={platform === item ? "active" : ""}
                onClick={() => {
                  setPlatform(item);
                  setSelectedUser("all");
                }}
              >
                {item === "all" ? "すべて" : platformLabel[item]}
              </button>
            ))}
          </nav>

          <section className="people">
            <button
              className={
                "person person-button " +
                (selectedUser === "all" ? "selected" : "")
              }
              onClick={() => setSelectedUser("all")}
            >
              <div className="avatar avatar-all">
                <Check size={20} />
              </div>
              <span>全員</span>
            </button>

            {people.map((person) => (
              <button
                className={
                  "person person-button " +
                  (selectedUser === person.name ? "selected" : "")
                }
                key={person.name}
                onClick={() => setSelectedUser(person.name)}
              >
                <div className="avatar">
                  {person.thumbnail ? (
                    <img
                      src={person.thumbnail}
                      alt={person.name}
                    />
                  ) : (
                    person.name.slice(0, 1)
                  )}
                </div>

                <span>{person.name}</span>
              </button>
            ))}

            <button
              className="person person-button"
              onClick={() => setAddOpen(true)}
            >
              <div className="avatar add">＋</div>
              <span>追加</span>
            </button>

            <button
              className="person person-button"
              onClick={() => setManageOpen(true)}
            >
              <div className="avatar add">
                <Settings size={20} />
              </div>
              <span>管理</span>
            </button>
          </section>

          {searchText && (
            <div className="active-filter">
              <Search size={14} />
              <span>「{searchText}」で検索中</span>
              <button onClick={() => setSearchText("")}>
                <Close size={15} />
              </button>
            </div>
          )}

          {keywordOnly && (
            <div className="active-filter keyword-filter">
              <Bell size={14} />
              <span>
                キーワード一致のみ
                {keywords.length
                  ? `：${keywords.join(" / ")}`
                  : ""}
              </span>

              <button onClick={() => setKeywordOnly(false)}>
                <Close size={15} />
              </button>
            </div>
          )}

          <div className="section-row">
            <strong>新着</strong>

            <div className="kind-tabs">
              <button
                className={kind === "all" ? "active" : ""}
                onClick={() => setKind("all")}
              >
                すべて
              </button>

              <button
                className={kind === "text" ? "active" : ""}
                onClick={() => setKind("text")}
              >
                テキスト
              </button>

              <button
                className={kind === "image" ? "active" : ""}
                onClick={() => setKind("image")}
              >
                <ImageIcon size={15} />
                画像
              </button>

              <button
                className={kind === "video" ? "active" : ""}
                onClick={() => setKind("video")}
              >
                <Video size={15} />
                動画
              </button>
            </div>
          </div>

          {youtubeLoading &&
            (platform === "all" || platform === "youtube") && (
              <div className="status">
                <span className="loader" />
                YouTubeの新着を取得中...
              </div>
            )}

          {!!youtubeErrors.length &&
            (platform === "all" || platform === "youtube") && (
              <div className="error-box">
                {youtubeErrors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}

          <section className="feed">
            {visible.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                saved={saved.includes(post.id)}
                memo={memos[post.id]}
                keywordMatch={
                  keywords.length > 0 && matchesKeyword(post)
                }
                onStar={() => toggleSaved(post.id)}
                onMemo={() => setEditing(post.id)}
              />
            ))}

            {!youtubeLoading && !visible.length && (
              <div className="empty">
                <Search />
                <h3>見つかりませんでした</h3>
                <p>
                  フィルターや検索条件を変えると
                  <br />
                  見つかるかもしれません。
                </p>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="saved-title">
            <div>
              <h2>後で見る</h2>
              <p>{savedPosts.length}件保存中</p>
            </div>

            <button
              className="icon-button"
              onClick={() => setSearchOpen(true)}
            >
              <Search />
            </button>
          </div>

          <nav className="platform-tabs saved-tabs">
            {["all", "x", "instagram", "youtube"].map((item) => (
              <button
                key={item}
                className={platform === item ? "active" : ""}
                onClick={() => setPlatform(item)}
              >
                {item === "all" ? "すべて" : platformLabel[item]}
              </button>
            ))}
          </nav>

          <section className="feed">
            {savedPosts.filter(
              (post) =>
                (platform === "all" || post.platform === platform) &&
                (!searchText ||
                  [
                    post.user,
                    post.handle,
                    post.text,
                    ...(post.tags || []),
                  ]
                    .join(" ")
                    .toLowerCase()
                    .includes(searchText.toLowerCase()))
            ).length ? (
              savedPosts
                .filter(
                  (post) =>
                    (platform === "all" ||
                      post.platform === platform) &&
                    (!searchText ||
                      [
                        post.user,
                        post.handle,
                        post.text,
                        ...(post.tags || []),
                      ]
                        .join(" ")
                        .toLowerCase()
                        .includes(searchText.toLowerCase()))
                )
                .map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    saved
                    memo={memos[post.id]}
                    keywordMatch={
                      keywords.length > 0 && matchesKeyword(post)
                    }
                    onStar={() => toggleSaved(post.id)}
                    onMemo={() => setEditing(post.id)}
                  />
                ))
            ) : (
              <div className="empty">
                <Star />
                <h3>まだ何もありません</h3>
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
        onAdd={() => setAddOpen(true)}
        onSearch={() => setSearchOpen(true)}
        onKeywords={() => setKeywordOpen(true)}
      />

      {editing && editingPost && (
        <MemoSheet
          post={editingPost}
          value={memos[editing] || ""}
          onClose={() => setEditing(null)}
          onSave={(value) => saveMemo(editing, value)}
        />
      )}

      {addOpen && (
        <AddChannelSheet
          onClose={() => setAddOpen(false)}
          onAdd={addYoutubeChannel}
        />
      )}

      {manageOpen && (
        <ManageChannelsSheet
          channels={youtubeChannels}
          onClose={() => setManageOpen(false)}
          onDelete={removeYoutubeChannel}
          onAdd={() => {
            setManageOpen(false);
            setAddOpen(true);
          }}
        />
      )}

      {searchOpen && (
        <SearchSheet
          value={searchText}
          onClose={() => setSearchOpen(false)}
          onSearch={(value) => {
            setSearchText(value.trim());
            setSearchOpen(false);
            goHome();
          }}
        />
      )}

      {keywordOpen && (
        <KeywordSheet
          keywords={keywords}
          keywordOnly={keywordOnly}
          onClose={() => setKeywordOpen(false)}
          onAdd={addKeyword}
          onDelete={removeKeyword}
          onToggle={() => setKeywordOnly((current) => !current)}
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
  keywordMatch,
}) {
  const openPost = () => {
    if (!post.url) return;

    window.open(post.url, "_blank", "noopener,noreferrer");
  };

  return (
    <article className="card">
      <div className="post-head">
        <div className={"platform-icon " + post.platform}>
          <PlatformMark platform={post.platform} />
        </div>

        <div className="identity">
          <strong>{post.user}</strong>
          <span>{post.handle}</span>
        </div>

        <time>{post.time}</time>
      </div>

      {post.url ? (
        <button className="post-link" onClick={openPost}>
          <p className="post-text">{post.text}</p>
        </button>
      ) : (
        <p className="post-text">{post.text}</p>
      )}

      {post.image &&
        (post.url ? (
          <button
            className="thumb thumb-button"
            onClick={openPost}
            aria-label="投稿を開く"
          >
            <img src={post.image} alt={post.text || "投稿サムネイル"} />

            {post.kind === "video" && <div className="play">▶</div>}
          </button>
        ) : (
          <div className="thumb">
            <img src={post.image} alt="投稿サムネイル" />

            {post.kind === "video" && <div className="play">▶</div>}
          </div>
        ))}

      <div className="post-foot">
        <div className="tags">
          {(post.tags || []).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}

          {keywordMatch && <span className="keyword-hit">HIT</span>}
        </div>

        <div className="actions">
          <button onClick={onMemo} aria-label="メモ">
            <MessageSquare size={19} />
          </button>

          <button
            className={saved ? "starred" : ""}
            onClick={onStar}
            aria-label="後で見る"
          >
            <Star size={21} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      {memo && (
        <button className="memo-preview" onClick={onMemo}>
          <b>メモ</b>
          <span>{memo}</span>
          <ChevronRight size={16} />
        </button>
      )}
    </article>
  );
}

function BottomNav({
  page,
  setPage,
  onAdd,
  onSearch,
  onKeywords,
}) {
  return (
    <nav className="bottom">
      <button
        className={page === "home" ? "on" : ""}
        onClick={() => setPage("home")}
      >
        <Home />
        <span>ホーム</span>
      </button>

      <button onClick={onSearch}>
        <Search />
        <span>検索</span>
      </button>

      <button className="plus" onClick={onAdd} aria-label="追加">
        ＋
      </button>

      <button onClick={onKeywords}>
        <Bell />
        <span>キーワード</span>
      </button>

      <button
        className={page === "saved" ? "on" : ""}
        onClick={() => setPage("saved")}
      >
        <Star />
        <span>後で見る</span>
      </button>
    </nav>
  );
}

function SheetShell({ title, subtitle, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-top">
          <div>
            <strong>{title}</strong>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <button onClick={onClose}>
            <Close />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function AddChannelSheet({ onClose, onAdd }) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");

  const submit = () => {
    const result = onAdd(value);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    onClose();
  };

  return (
    <SheetShell
      title="チャンネルを追加"
      subtitle="いまはYouTubeに対応しています"
      onClose={onClose}
    >
      <div className="service-card youtube-service">
        <div className="platform-icon youtube">
          <Youtube size={20} />
        </div>

        <div>
          <b>YouTube</b>
          <p>新着動画をMikkeにまとめます。</p>
        </div>
      </div>

      <label className="field-label">チャンネルURL / @ハンドル</label>

      <input
        className="text-input"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setMessage("");
        }}
        placeholder="https://youtube.com/@xxxx"
        autoCapitalize="none"
        autoCorrect="off"
      />

      <p className="input-help">
        例：@itabasihausu またはYouTubeのチャンネルURL
      </p>

      {message && <p className="form-error">{message}</p>}

      <button className="save" onClick={submit}>
        追加する
      </button>
    </SheetShell>
  );
}

function ManageChannelsSheet({
  channels,
  onClose,
  onDelete,
  onAdd,
}) {
  return (
    <SheetShell
      title="登録チャンネル"
      subtitle={`${channels.length}件登録中`}
      onClose={onClose}
    >
      <div className="manage-list">
        {channels.map((channel) => (
          <div className="manage-row" key={channel.handle}>
            <div className="manage-avatar">
              {channel.thumbnail ? (
                <img src={channel.thumbnail} alt={channel.name} />
              ) : (
                <Youtube size={20} />
              )}
            </div>

            <div className="manage-info">
              <b>{channel.name}</b>
              <span>@{channel.handle}</span>
            </div>

            <button
              className="delete-button"
              onClick={() => onDelete(channel.handle)}
              aria-label="削除"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}

        {!channels.length && (
          <div className="sheet-empty">
            YouTubeチャンネルはまだ登録されていません。
          </div>
        )}
      </div>

      <button className="secondary-button" onClick={onAdd}>
        <Plus size={18} />
        チャンネルを追加
      </button>
    </SheetShell>
  );
}

function SearchSheet({ value, onClose, onSearch }) {
  const [text, setText] = useState(value);

  return (
    <SheetShell
      title="Mikke内を検索"
      subtitle="タイトル・名前・タグから探せます"
      onClose={onClose}
    >
      <div className="search-field">
        <Search size={19} />

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="検索ワード"
          autoFocus
        />

        {text && (
          <button onClick={() => setText("")}>
            <Close size={17} />
          </button>
        )}
      </div>

      <button className="save" onClick={() => onSearch(text)}>
        検索する
      </button>

      {value && (
        <button
          className="clear-button"
          onClick={() => onSearch("")}
        >
          検索を解除
        </button>
      )}
    </SheetShell>
  );
}

function KeywordSheet({
  keywords,
  keywordOnly,
  onClose,
  onAdd,
  onDelete,
  onToggle,
}) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");

  const submit = () => {
    if (!value.trim()) return;

    const added = onAdd(value);

    if (!added) {
      setMessage("同じキーワードがすでにあります。");
      return;
    }

    setValue("");
    setMessage("");
  };

  return (
    <SheetShell
      title="キーワード"
      subtitle="気になる言葉を登録しておけます"
      onClose={onClose}
    >
      <div className="keyword-add">
        <input
          className="text-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMessage("");
          }}
          placeholder="例：単独ライブ"
        />

        <button onClick={submit}>
          <Plus size={20} />
        </button>
      </div>

      {message && <p className="form-error">{message}</p>}

      <div className="keyword-list">
        {keywords.map((word) => (
          <div className="keyword-chip" key={word}>
            <span>{word}</span>

            <button onClick={() => onDelete(word)}>
              <Close size={14} />
            </button>
          </div>
        ))}

        {!keywords.length && (
          <p className="keyword-empty">
            まだキーワードはありません。
          </p>
        )}
      </div>

      <button
        className={"keyword-toggle " + (keywordOnly ? "on" : "")}
        onClick={onToggle}
        disabled={!keywords.length}
      >
        <div>
          <b>一致した投稿だけ表示</b>
          <span>
            登録した言葉を含む投稿に絞り込みます
          </span>
        </div>

        <div className="switch">
          <span />
        </div>
      </button>
    </SheetShell>
  );
}

function MemoSheet({
  post,
  value,
  onClose,
  onSave,
}) {
  const [text, setText] = useState(value);

  return (
    <SheetShell title="メモ" onClose={onClose}>
      <div className="mini">
        <div className={"platform-icon " + post.platform}>
          <PlatformMark platform={post.platform} />
        </div>

        <div>
          <b>{post.user}</b>
          <p>{post.text}</p>
        </div>
      </div>

      <label className="field-label">この投稿について</label>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        placeholder="忘れたくないこと、あとで確認したいこと…"
      />

      <small className="counter">{text.length}/500</small>

      <button className="save" onClick={() => onSave(text)}>
        保存
      </button>
    </SheetShell>
  );
}
