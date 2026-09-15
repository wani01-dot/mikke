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

const initialPosts = [
  {
    id: 1,
    platform: "x",
    user: "板橋ハウス",
    handle: "@itabasihausu",
    time: "12分前",
    text: "明日、竹内の単独ライブがあります。詳細はまたお知らせします！",
    kind: "text",
    tags: ["竹内", "単独", "ライブ"],
  },
  {
    id: 2,
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
    id: 3,
    platform: "youtube",
    user: "板橋ハウス",
    handle: "YouTube",
    time: "2時間前",
    text: "【新企画】深夜のコンビニで好きなもの買ってみた",
    kind: "video",
    tags: ["動画"],
    image:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 4,
    platform: "x",
    user: "エバース",
    handle: "@everes_official",
    time: "4時間前",
    text: "大阪ライブのお知らせ。チケット情報はこちら！",
    kind: "text",
    tags: ["大阪", "チケット", "ライブ"],
  },
  {
    id: 5,
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

export default function Page() {
  const [platform, setPlatform] = useState("all");
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState("home");
  const [saved, setSaved] = useState([]);
  const [memos, setMemos] = useState({});
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    try {
      setSaved(
        JSON.parse(localStorage.getItem("mikke-saved") || "[]")
      );
      setMemos(
        JSON.parse(localStorage.getItem("mikke-memos") || "{}")
      );
    } catch {}
  }, []);

  const toggleSaved = (id) => {
    const next = saved.includes(id)
      ? saved.filter((x) => x !== id)
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

  const visible = useMemo(() => {
    return initialPosts.filter(
      (p) =>
        (platform === "all" || p.platform === platform) &&
        (kind === "all" || p.kind === kind)
    );
  }, [platform, kind]);

  const savedPosts = initialPosts.filter((p) =>
    saved.includes(p.id)
  );

  return (
    <main className={"app " + (page === "saved" ? "saved-page" : "")}>
      <header>
        <div>
          <h1>Mikke</h1>
          <p>見逃したくない、あの瞬間を。</p>
        </div>

        <div className="header-icons">
          <Search />
          <Bell />
        </div>
      </header>

      {page === "home" ? (
        <>
          <nav className="platform-tabs">
            {["all", "x", "instagram", "youtube"].map((p) => (
              <button
                key={p}
                className={platform === p ? "active" : ""}
                onClick={() => setPlatform(p)}
              >
                {p === "all" ? "すべて" : platformLabel[p]}
              </button>
            ))}
          </nav>

          <section className="people">
            {["板橋ハウス", "エバース", "めぞん", "令和ロマン"].map(
              (name) => (
                <div className="person" key={name}>
                  <div className="avatar">{name.slice(0, 1)}</div>
                  <span>{name}</span>
                </div>
              )
            )}

            <div className="person">
              <div className="avatar add">＋</div>
              <span>追加</span>
            </div>
          </section>

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

          <section className="feed">
            {visible.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                saved={saved.includes(post.id)}
                memo={memos[post.id]}
                onStar={() => toggleSaved(post.id)}
                onMemo={() => setEditing(post.id)}
              />
            ))}
          </section>
        </>
      ) : (
        <>
          <div className="saved-title">
            <div>
              <h2>後で見る</h2>
              <p>{savedPosts.length}件保存中</p>
            </div>

            <Search />
          </div>

          <nav className="platform-tabs saved-tabs">
            {["all", "x", "instagram", "youtube"].map((p) => (
              <button
                key={p}
                className={platform === p ? "active" : ""}
                onClick={() => setPlatform(p)}
              >
                {p === "all" ? "すべて" : platformLabel[p]}
              </button>
            ))}
          </nav>

          <section className="feed">
            {savedPosts.filter(
              (p) => platform === "all" || p.platform === platform
            ).length ? (
              savedPosts
                .filter(
                  (p) =>
                    platform === "all" || p.platform === platform
                )
                .map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    saved
                    memo={memos[post.id]}
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

      <BottomNav page={page} setPage={setPage} />

      {editing && (
        <MemoSheet
          post={initialPosts.find((p) => p.id === editing)}
          value={memos[editing] || ""}
          onClose={() => setEditing(null)}
          onSave={(value) => saveMemo(editing, value)}
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

      <p className="post-text">{post.text}</p>

      {post.image && (
        <div className="thumb">
          <img src={post.image} alt="投稿サムネイル" />

          {post.kind === "video" && (
            <div className="play">▶</div>
          )}
        </div>
      )}

      <div className="post-foot">
        <div className="tags">
          {post.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
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
          {memo}
          <ChevronRight size={16} />
        </button>
      )}
    </article>
  );
}

function BottomNav({ page, setPage }) {
  return (
    <nav className="bottom">
      <button
        className={page === "home" ? "on" : ""}
        onClick={() => setPage("home")}
      >
        <Home />
        <span>ホーム</span>
      </button>

      <button>
        <Search />
        <span>検索</span>
      </button>

      <button className="plus">＋</button>

      <button>
        <Bell />
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

function MemoSheet({
  post,
  value,
  onClose,
  onSave,
}) {
  const [text, setText] = useState(value);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-top">
          <strong>メモ</strong>

          <button onClick={onClose}>
            <Close />
          </button>
        </div>

        <div className="mini">
          <div className={"platform-icon " + post.platform}>
            <PlatformMark platform={post.platform} />
          </div>

          <div>
            <b>{post.user}</b>
            <p>{post.text}</p>
          </div>
        </div>

        <label>この投稿について</label>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="忘れたくないこと、あとで確認したいこと…"
        />

        <small>{text.length}/500</small>

        <button
          className="save"
          onClick={() => onSave(text)}
        >
          保存
        </button>
      </div>
    </div>
  );
}
