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

  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;

  return date.toLocaleDateString("ja-JP");
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

function dbPostToUi(post) {
  const account = post.monitored_accounts || {};

  return {
    id: post.external_post_id
      ? `youtube-${post.external_post_id}`
      : post.id,
    dbId: post.id,
    platform: post.platform || "youtube",
    user: account.name || "YouTube",
    handle: account.handle
      ? `@${account.handle.replace(/^@/, "")}`
      : "YouTube",
    time: formatRelativeTime(post.published_at),
    publishedAt: post.published_at,
    text: post.title || post.body || "タイトルなし",
    kind: "video",
    tags: ["動画"],
    image: post.thumbnail_url || null,
    url: post.post_url || null,
    channelThumbnail: account.thumbnail_url || null,
  };
}

export default function Page() {
  const [platform, setPlatform] = useState("all");
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState("home");

  const [saved, setSaved] = useState([]);
  const [memos, setMemos] = useState({});
  const [editing, setEditing] = useState(null);

  const [accounts, setAccounts] = useState([]);
  const [dbPosts, setDbPosts] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [selectedUser, setSelectedUser] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [keywordOpen, setKeywordOpen] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [keywordOnly, setKeywordOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setSaved(
        JSON.parse(localStorage.getItem("mikke-saved") || "[]")
      );

      setMemos(
        JSON.parse(localStorage.getItem("mikke-memos") || "{}")
      );
    } catch {}

    setReady(true);
  }, []);

  async function loadAccounts() {
    const response = await fetch("/api/accounts", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error || "登録チャンネルを取得できませんでした"
      );
    }

    setAccounts(data.accounts || []);

    return data.accounts || [];
  }

  async function loadPosts() {
    const response = await fetch("/api/posts", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "投稿を取得できませんでした");
    }

    setDbPosts((data.posts || []).map(dbPostToUi));
  }

  async function loadKeywords() {
    const response = await fetch("/api/keywords", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error || "キーワードを取得できませんでした"
      );
    }

    setKeywords(data.keywords || []);
  }

  async function loadNotifications() {
    const response = await fetch("/api/notifications", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "通知を取得できませんでした");
    }

    setNotifications(data.notifications || []);
  }

  async function runSync() {
    setSyncing(true);

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data?.error || "同期に失敗しました");
      }

      await Promise.all([
        loadAccounts(),
        loadPosts(),
        loadNotifications(),
      ]);
    } finally {
      setSyncing(false);
    }
  }

  async function migrateOldData(currentAccounts) {
    if (!ready) return;

    if (localStorage.getItem("mikke-supabase-migrated") === "1") {
      return;
    }

    let oldChannels = DEFAULT_YOUTUBE_CHANNELS;
    let oldKeywords = [];

    try {
      const storedChannels = JSON.parse(
        localStorage.getItem("mikke-youtube-channels") || "null"
      );

      const storedKeywords = JSON.parse(
        localStorage.getItem("mikke-keywords") || "[]"
      );

      if (Array.isArray(storedChannels) && storedChannels.length) {
        oldChannels = storedChannels;
      }

      if (Array.isArray(storedKeywords)) {
        oldKeywords = storedKeywords;
      }
    } catch {}

    const knownHandles = new Set(
      currentAccounts
        .filter((account) => account.platform === "youtube")
        .map((account) =>
          String(account.handle || "").replace(/^@/, "").toLowerCase()
        )
    );

    for (const channel of oldChannels) {
      const handle = cleanYoutubeHandle(channel.handle || "");

      if (!handle || knownHandles.has(handle.toLowerCase())) {
        continue;
      }

      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: "youtube",
          handle,
          name: channel.name || `@${handle}`,
        }),
      });

      if (response.ok) {
        knownHandles.add(handle.toLowerCase());
      }
    }

    for (const word of oldKeywords) {
      if (!String(word).trim()) continue;

      await fetch("/api/keywords", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word: String(word).trim(),
          account_id: null,
        }),
      });
    }

    localStorage.setItem("mikke-supabase-migrated", "1");
  }

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    async function start() {
      setLoading(true);
      setError("");

      try {
        const currentAccounts = await loadAccounts();

        await migrateOldData(currentAccounts);

        if (cancelled) return;

        await loadAccounts();
        await loadKeywords();

        if (cancelled) return;

        await runSync();
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "読み込みに失敗しました");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
    };
  }, [ready]);

  const allPosts = useMemo(() => {
    return [...dbPosts, ...initialPosts].sort((a, b) => {
      const aTime = new Date(a.publishedAt || 0).getTime();
      const bTime = new Date(b.publishedAt || 0).getTime();

      if (!a.publishedAt && !b.publishedAt) return 0;
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;

      return bTime - aTime;
    });
  }, [dbPosts]);

  const youtubeAccounts = useMemo(
    () => accounts.filter((account) => account.platform === "youtube"),
    [accounts]
  );

  const people = useMemo(() => {
    const map = new Map();

    allPosts.forEach((post) => {
      if (platform !== "all" && post.platform !== platform) {
        return;
      }

      if (!map.has(post.user)) {
        map.set(post.user, {
          name: post.user,
          thumbnail: post.channelThumbnail || null,
        });
      }
    });

    return Array.from(map.values());
  }, [allPosts, platform]);

  const keywordWords = useMemo(
    () => keywords.map((item) => item.word),
    [keywords]
  );

  const matchesKeyword = (post) => {
    if (!keywordWords.length) return true;

    const source = [
      post.text,
      post.user,
      post.handle,
      ...(post.tags || []),
    ]
      .join(" ")
      .toLowerCase();

    return keywordWords.some((word) =>
      source.includes(String(word).toLowerCase())
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
    keywordWords,
    searchText,
  ]);

  const savedPosts = useMemo(
    () => allPosts.filter((post) => saved.includes(post.id)),
    [allPosts, saved]
  );

  const editingPost = useMemo(
    () => allPosts.find((post) => post.id === editing),
    [allPosts, editing]
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const toggleSaved = (id) => {
    const next = saved.includes(id)
      ? saved.filter((item) => item !== id)
      : [...saved, id];

    setSaved(next);
    localStorage.setItem("mikke-saved", JSON.stringify(next));
  };

  const saveMemo = (id, value) => {
    const next = {
      ...memos,
      [id]: value,
    };

    setMemos(next);
    localStorage.setItem("mikke-memos", JSON.stringify(next));
    setEditing(null);
  };

  async function addYoutubeChannel(value) {
    const handle = cleanYoutubeHandle(value);

    if (!handle) {
      return {
        ok: false,
        message: "チャンネルURLか@ハンドルを入力してね。",
      };
    }

    if (
      youtubeAccounts.some(
        (account) =>
          String(account.handle).replace(/^@/, "").toLowerCase() ===
          handle.toLowerCase()
      )
    ) {
      return {
        ok: false,
        message: "このチャンネルはすでに追加されています。",
      };
    }

    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: "youtube",
        handle,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        message: data?.error || "追加できませんでした。",
      };
    }

    await loadAccounts();
    await runSync();

    setPlatform("youtube");
    setSelectedUser("all");

    return {
      ok: true,
    };
  }

  async function removeYoutubeChannel(id) {
    const response = await fetch(
      `/api/accounts?id=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      setError("チャンネルを削除できませんでした");
      return;
    }

    setSelectedUser("all");

    await Promise.all([
      loadAccounts(),
      loadPosts(),
      loadNotifications(),
      loadKeywords(),
    ]);
  }

  async function addKeyword(value, accountId = null) {
    const word = value.trim();

    if (!word) {
      return {
        ok: false,
        message: "キーワードを入力してね。",
      };
    }

    const response = await fetch("/api/keywords", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        word,
        account_id: accountId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        message: data?.error || "追加できませんでした。",
      };
    }

    await loadKeywords();

    return {
      ok: true,
    };
  }

  async function removeKeyword(id) {
    await fetch(`/api/keywords?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    await loadKeywords();
  }

  async function openNotification(notification) {
    if (!notification.is_read) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: notification.id,
        }),
      });

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                is_read: true,
              }
            : item
        )
      );
    }

    const url = notification.posts?.post_url;

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        all: true,
      }),
    });

    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        is_read: true,
      }))
    );
  }

  return (
    <main
      className={
        "app " +
        (page === "saved"
          ? "saved-page"
          : page === "notifications"
          ? "notification-page"
          : "")
      }
    >
      {page === "notifications" ? (
        <NotificationPage
          notifications={notifications}
          unreadCount={unreadCount}
          onOpen={openNotification}
          onReadAll={markAllRead}
        />
      ) : (
        <>
          <header>
            <div>
              <h1>Mikke</h1>
              <p>見逃したくない、あの瞬間を。</p>
            </div>

            <div className="header-icons">
              <button
                className="icon-button"
                onClick={() => setSearchOpen(true)}
              >
                <Search />
              </button>

              <button
                className="icon-button notification-button"
                onClick={() => setPage("notifications")}
              >
                <Bell />

                {unreadCount > 0 && (
                  <span className="notification-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
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
                    {item === "all"
                      ? "すべて"
                      : platformLabel[item]}
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
                  <span>キーワード一致のみ</span>

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

              {(loading || syncing) && (
                <div className="status">
                  <span className="loader" />
                  {syncing
                    ? "YouTubeの新着を確認中..."
                    : "Mikkeを読み込み中..."}
                </div>
              )}

              {error && (
                <div className="error-box">
                  <p>{error}</p>
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
                      keywordWords.length > 0 &&
                      matchesKeyword(post)
                    }
                    onStar={() => toggleSaved(post.id)}
                    onMemo={() => setEditing(post.id)}
                  />
                ))}

                {!loading && !visible.length && (
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

              <section className="feed">
                {savedPosts.length ? (
                  savedPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      saved
                      memo={memos[post.id]}
                      keywordMatch={
                        keywordWords.length > 0 &&
                        matchesKeyword(post)
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
        </>
      )}

      <BottomNav
        page={page}
        setPage={setPage}
        unreadCount={unreadCount}
        onAdd={() => setAddOpen(true)}
        onSearch={() => setSearchOpen(true)}
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
          channels={youtubeAccounts}
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
            setPage("home");
          }}
        />
      )}

      {keywordOpen && (
        <KeywordSheet
          keywords={keywords}
          accounts={youtubeAccounts}
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
          >
            <img
              src={post.image}
              alt={post.text || "投稿サムネイル"}
            />

            {post.kind === "video" && (
              <div className="play">▶</div>
            )}
          </button>
        ) : (
          <div className="thumb">
            <img src={post.image} alt="投稿サムネイル" />
          </div>
        ))}

      <div className="post-foot">
        <div className="tags">
          {(post.tags || []).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}

          {keywordMatch && (
            <span className="keyword-hit">HIT</span>
          )}
        </div>

        <div className="actions">
          <button onClick={onMemo}>
            <MessageSquare size={19} />
          </button>

          <button
            className={saved ? "starred" : ""}
            onClick={onStar}
          >
            <Star
              size={21}
              fill={saved ? "currentColor" : "none"}
            />
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

function NotificationPage({
  notifications,
  unreadCount,
  onOpen,
  onReadAll,
}) {
  return (
    <>
      <div className="notification-title">
        <div>
          <h2>通知</h2>
          <p>
            {unreadCount
              ? `未読 ${unreadCount}件`
              : "すべて確認済み"}
          </p>
        </div>

        {unreadCount > 0 && (
          <button onClick={onReadAll}>
            すべて既読
          </button>
        )}
      </div>

      <section className="notification-list">
        {notifications.map((item) => {
          const post = item.posts;
          const account = post?.monitored_accounts;

          return (
            <button
              key={item.id}
              className={
                "notification-card " +
                (!item.is_read ? "unread" : "")
              }
              onClick={() => onOpen(item)}
            >
              <div className="notification-icon">
                <Bell size={18} />
              </div>

              <div className="notification-content">
                <div className="notification-meta">
                  <b>{account?.name || "Mikke"}</b>
                  <span>
                    {formatRelativeTime(item.created_at)}
                  </span>
                </div>

                <p className="notification-message">
                  {item.message}
                </p>

                {post?.title && (
                  <p className="notification-post-title">
                    {post.title}
                  </p>
                )}

                {item.keywords?.word && (
                  <span className="notification-keyword">
                    {item.keywords.word}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {!notifications.length && (
          <div className="empty">
            <Bell />
            <h3>まだ通知はありません</h3>
            <p>
              登録したキーワードを含む
              <br />
              新着動画をMikkeが見つけると表示されます。
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function BottomNav({
  page,
  setPage,
  unreadCount,
  onAdd,
  onSearch,
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

      <button className="plus" onClick={onAdd}>
        ＋
      </button>

      <button
        className={
          "bottom-notification " +
          (page === "notifications" ? "on" : "")
        }
        onClick={() => setPage("notifications")}
      >
        <span className="nav-icon-wrap">
          <Bell />

          {unreadCount > 0 && (
            <i className="nav-badge">
              {unreadCount > 9 ? "9+" : unreadCount}
            </i>
          )}
        </span>

        <span>通知</span>
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
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;

    setSubmitting(true);
    setMessage("");

    try {
      const result = await onAdd(value);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SheetShell
      title="チャンネルを追加"
      subtitle="YouTubeチャンネルを監視します"
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

      <label className="field-label">
        チャンネルURL / @ハンドル
      </label>

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

      {message && (
        <p className="form-error">{message}</p>
      )}

      <button
        className="save"
        onClick={submit}
        disabled={submitting}
      >
        {submitting ? "追加中..." : "追加する"}
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
          <div className="manage-row" key={channel.id}>
            <div className="manage-avatar">
              {channel.thumbnail_url ? (
                <img
                  src={channel.thumbnail_url}
                  alt={channel.name}
                />
              ) : (
                <Youtube size={20} />
              )}
            </div>

            <div className="manage-info">
              <b>{channel.name}</b>
              <span>
                @{String(channel.handle).replace(/^@/, "")}
              </span>
            </div>

            <button
              className="delete-button"
              onClick={() => onDelete(channel.id)}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
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
    </SheetShell>
  );
}

function KeywordSheet({
  keywords,
  accounts,
  keywordOnly,
  onClose,
  onAdd,
  onDelete,
  onToggle,
}) {
  const [value, setValue] = useState("");
  const [accountId, setAccountId] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!value.trim()) return;

    const result = await onAdd(
      value,
      accountId || null
    );

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setValue("");
    setMessage("");
  };

  return (
    <SheetShell
      title="キーワード"
      subtitle="全体またはチャンネルごとに設定できます"
      onClose={onClose}
    >
      <label className="field-label">
        対象
      </label>

      <select
        className="text-input"
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
      >
        <option value="">すべてのチャンネル</option>

        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>

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

      {message && (
        <p className="form-error">{message}</p>
      )}

      <div className="keyword-list">
        {keywords.map((keyword) => (
          <div className="keyword-chip" key={keyword.id}>
            <span>
              {keyword.word}

              {keyword.monitored_accounts?.name && (
                <small>
                  {keyword.monitored_accounts.name}
                </small>
              )}
            </span>

            <button onClick={() => onDelete(keyword.id)}>
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
        className={
          "keyword-toggle " +
          (keywordOnly ? "on" : "")
        }
        onClick={onToggle}
        disabled={!keywords.length}
      >
        <div>
          <b>一致した投稿だけ表示</b>
          <span>登録した言葉を含む投稿に絞ります</span>
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

      <label className="field-label">
        この投稿について
      </label>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        placeholder="忘れたくないこと、あとで確認したいこと…"
      />

      <small className="counter">
        {text.length}/500
      </small>

      <button
        className="save"
        onClick={() => onSave(text)}
      >
        保存
      </button>
    </SheetShell>
  );
}
