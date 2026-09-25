# 公開サイト

生成器のまわりにあるもの、つまりサイトのビルドと公開、共有したリンクに何が表示されるか、匿名の生成記録とその管理画面について書く。どれも詩の中身は変えない。

## ビルドと公開

```bash
npm ci
npm run build          # tsc（アプリと Functions）+ vite build → dist/
npx wrangler@4 pages deploy dist --project-name <project> --branch <production branch> --commit-hash $(git rev-parse HEAD)
```

- Cloudflare Pages に `dist/` を直接アップロードする。`dist/` には次のものが入る。
  - `index.html` と管理画面
  - `assets/`：スクリプトひとつ、スタイルシートひとつ、フォントの unicode-range ごとの断片（小さな woff2 が数百個。ページがその字を必要とするときだけ取得する）
  - `semantic/axes-1/`、`examples/`、`og/`、アイコン、`_routes.json`
- `wrangler.toml` には、プロジェクト名、出力先のディレクトリ、D1 のバインディングを書く。公開中のプロジェクトのファイルはデータベースの id を含むので、リポジトリには入れない。`wrangler.example.toml` がその雛形である。
- `public/_routes.json` は、`/s`、`/api/*`、`/admin`、`/admin/*` だけを Functions に送る。ほかのリクエストはすべて静的ファイルなので、Functions の無料枠を使い切ってもページは動き続ける。
- ページのメタデータ（タイトル、説明、カード画像、アドレス）は、`vite.config.ts` の Vite プラグインが `site.config.json` から書き込む。

## リンクプレビューとアイコン

- 共有ボタンは、詩のアドレスを `/s?title=…&reading=…&v=…` の形で渡す（文面にはタグ `#KotobaNoKatachi` を入れ、それ以外は足さない）。
- `/s` は、ページのパスのうち Function が動く唯一のものである（`public/_routes.json`）。`functions/s.ts` は `env.ASSETS` から静的な `index.html` を読み、HTMLRewriter でその head に詩を書き込む。書き込むのは次のものである。
  - `og:title` / `twitter:title`（「孤独」 — ことばのかたち）
  - `og:image` / `twitter:image`
  - `og:url`（ページが書く形のままの `/s` のアドレス）
  - `<link rel="canonical">`（詩そのもののアドレス `/?title=…`）

  リンクプレビューは、スクリプトを動かさずにこれを読める（`server/share.ts`）。`/s` は何も記録せず、生成記録には触れない。
- ブラウザで開くと、`/s` は `/?title=…` と同じ詩を描き、アドレスは `/s` のまま残す。ブラウザからアドレスをコピーしたり、ブラウザ自身の共有機能で渡したりしても、詩のカードが付くようにするためである。再読み込みすると Function がもう一度動く。
- 作例（v1、読みなし）には専用のカード `public/og/v1/<file>`（1200 × 630）があり、`tools/examples/manifest.json` で、ことばと版からカードを引く。ほかの詩には、今のところサイト共通のカード `/ogp.png?v=1` を付ける（地の上に「ことばのかたち」の紙面を置いた画像で、`tools/examples/make.mjs` が描く）。カードを変えるときはクエリ文字列も変えるので、リンクプレビューは新しいカードを取り直す。
- `/` 自体は静的ファイルのままで、head にはサイト共通のカードが入る。Functions の無料枠を使い切っても動き続ける。
- `public/examples/v1/` の作例のサムネイルは、`tools/examples/make.mjs` が公開中の生成器で描く。`CHECK=1` を付けると描き直して `tools/examples/manifest.json` と比べる。
- アイコン：`public/favicon.svg`（こ の字形。Noto Sans JP 500 から取り出したパスなので、フォントがいらない）と、そこから `tools/icons/make.mjs` が描く `favicon.ico`（16 / 32 / 48 px）と `apple-touch-icon.png`（180 px）。

## 生成記録（匿名の記録と /admin）

誰かが詩を書くと、ページは書かれたものを記録する。管理画面 `/admin/` では、書かれた紙面を新しい順に、ブラウザごと、訪問ごとに見られる。生成器には手を入れておらず、ページは記録を待たない。

### 構成

```
ブラウザ（index.html, src/main.ts）
  └─ 詩を描く ─→ src/archive/record.ts ── あとで、送りっぱなし ──→ POST /api/generations
                                                                          │ functions/api/generations.ts
                                                                          │ server/generations.ts（検証、回数制限）
                                                                          ▼
                                                              D1: kotoba-no-katachi-archive
                                                                          ▲
管理画面（admin/index.html, src/admin/*）── GET /admin/api/* ── functions/admin/_middleware.ts（セッション）
```

- Pages Functions（`functions/`）と、`DB` としてバインドした D1 データベースひとつ（`wrangler.toml` と `_routes.json` については[ビルドと公開](#ビルドと公開)を参照）。
- 共有するコード：`src/archive/svg.ts`（スナップショットの正規形、許可リスト、ハッシュ）と `src/archive/protocol.ts`（記録の項目）。ページ、サーバー、管理画面が使う。

### いつ記録するか

誰かが新しく詩を書いたときだけ記録する。

| 操作 | 記録 |
| --- | --- |
| ことばを入力して Enter（「別のことばで試す」のあとも含む） | する（`source = manual`） |
| 共有されたアドレスや作例を開く、再読み込み、戻る / 進む | しない |
| すでに紙面にあるのと同じことばを入力する | しない（新しい詩ではない） |
| 保存、共有（X・その他・コピー）、About | しない |
| `npm run dev`（Vite） | しない（何も送らない） |

作例は、それぞれのアドレスで開く既存の詩なので、記録しない。サイトが送るのは `source = manual` だけである。列の制約（0001）は `example` も許すが、それを送るものはない。

記録する呼び出しは、`src/main.ts` の `show(input, 'push', writing, 'manual')` の一か所だけである。紙面を描いたあとに `record()` を呼ぶ。`record()` はすぐに戻り、スナップショットの読み取り、ハッシュの計算、送信は、あとのタスクで行う（タイムアウトは 10 秒）。ブラウザがオフラインと言っているあいだは何も送らない。失敗はすべて黙って終わる。

### 保存するもの（migrations/0001_archive.sql）

`generations` には次の列がある。

- `id`：サーバーが作る UUID
- `created_at`：サーバーの時刻（ms）。生成記録の時刻
- `client_created_at`：ブラウザの時刻。サーバーの時刻との差が 7 日以内のときだけ残す
- `visitor_id`、`session_id`、`title`、`reading`、`source`
- `generator_version`：描いた版（`v1`、`src/archive/protocol.ts`）
- `output_hash`：正規化したスナップショットの SHA-256。サーバーで計算する

ほかのテーブルは次のとおり。

- `snapshots`：正規化した SVG を gzip したもの（中央値 ≈ 0.6 KB、最大で ≈ 3 KB）
- `visitors`、`sessions`：id ごとの最初と最後の時刻と件数
- `counters`：三つの合計と、日ごとの件数（一日の上限のため）
- `limits`（migrations/0002_limits.sql）：短い期間の許容量。接続元のアドレスごとの一日の記録数と、アドレスごと・全体での 15 分ごとの管理画面のパスワード試行数を数える。キーは、アドレス（IPv6 なら /64）と期間の HMAC（`SESSION_SECRET` で作り、16 バイトに切る）で、期間が終われば行を消す
- `admin_throttle`（0001）：読みも書きもしない

**保存しないもの**：IP アドレス、ユーザーエージェント、ヘッダ、リファラ、位置情報、画面、言語、Cookie、あらゆる種類のフィンガープリント、名前、メールアドレス、アカウント。サーバーが読むのは JSON の本文と、上の許容量のためだけに、Cloudflare が伝える接続元のアドレスである。アドレスそのものは書き込まず、その日（または 15 分）のための鍵付きの印だけを残す（ホストである Cloudflare は、リクエストのメタデータを自身のログで処理する。このデータベースにはそれを一切入れない）。

### 識別子

- **visitor_id**：`crypto.randomUUID()`。`localStorage`（`kotoba:visitor`）に保存し、初めて詩を書いたときに作る（見るだけのブラウザには何も保存しない）。人ではなく、ブラウザのプロファイルの保存領域を識別する。別のブラウザ、プライベートウィンドウ、サイトのデータを消したあとは、別の訪問者になる。`Visitor 8C21`（16 進数の先頭 4 桁）の形で表示する。
- **session_id**：`crypto.randomUUID()`。最後に詩を書いた時刻と一緒に `sessionStorage`（`kotoba:session`）に保存する。タブごとにひとつで、再読み込みしても変わらず、30 分詩を書かなければ新しくなる。
- 保存を拒否されたときは、id はページが開いているあいだだけ使う。

### スナップショット

ページの SVG を描いたときのまま保存するので、あとで何を公開しても、生成記録は人々が見たものを見せ続ける。正規形では、clip と mask の id（ページ全体での通し番号）を出現順に振り直す。これはページを新しく読み込んだときと同じ番号なので、`output_hash` は、その詩のアドレスを新しく開いたときに描かれる SVG のハッシュになる。

受け付けるのは、描画のコードが使う語彙だけでできたスナップショットである。要素は `svg defs clipPath mask rect g text` で、属性と値の形、入れ子の仕方も描画のコードと同じでなければならず、文字は `<text>` の中にしか置けない。スクリプト、イベントハンドラ、リンク、`style`、コメント、`foreignObject` など、それ以外のものがあれば、記録ごと拒否する（「きれいにして」受け付けることはしない）。管理画面はスナップショットを実行しない形で解析し、もう一度検査して、id に接頭辞を付けてから表示する。字形は同梱の Noto の字体による `<text>` で、管理画面がそのフォントを読み込む。あとのビルドでフォントを変えると、古いスナップショットも新しいフォントで描かれる。

描画のコードが新しい要素や属性を書くようになったら、同じ変更の中で `src/archive/svg.ts` の `ALLOWED` / `PARENTS` を広げること。そうしないと、その記録は拒否される。

### 悪用への対策

- 受け付けるのは、このサイトのオリジン（`Origin` が一致すること）、`application/json`、`src/archive/svg.ts` の制限（`MAX_SVG`、`SNAPSHOT_LIMITS`：大きさ、要素数、深さ、一つの `<text>` の字数、一つの数の桁数、mask の数、参照の数、mask を通して描く mask がないこと）に収まるスナップショットだけである。制限は、作品が描く紙面をもとに決めてある。`npm run verify:snapshots` は、公開タイトルと最も長い題を、公開しているすべての版で描き、ひとつでも拒否されれば失敗する。
- すべての項目を検証する。UUID、`normalizeTitle` が作るとおりの題（16 字以下、制御文字なし）、かなの読み、既知の source と generator。ハッシュはサーバーで計算し直す。
- 回数の制限（超えたら黙って捨て、204 を返す）。何かを書き込む前に、次の順で調べる。
  1. 接続元のアドレスごとに 10 分で 60 件、UTC の一日で 500 件（`dropped:address`）。ブラウザの id を変えても逃れられない。ひとつのアドレスを共有する部屋では、全員で共有する。
  2. セッションごとに 1 分で 20 件、訪問者ごとに 1 時間で 120 件（その数までしか数えない）。
  3. 全体で UTC の一日に 6,000 件（`dropped:day`）。枠はひとつの文で確保するので、同時に届いた記録がすり抜けることはない（書き込む行は ≈ 90,000）。
- 公開の読み出しはない。`/api/generations` は POST しか受け付けない。
- ブラウザから引き起こせる応答はすべて 204 である（`X-Archive: stored | refused:… | dropped:… | error`）。訪問者のコンソールには何も出ない。

### /admin

- パスワード（サーバー側だけ）：`ADMIN_PASSWORD_HASH` は PBKDF2-SHA256、10,000 回、ランダムなソルト（Workers の無料プランでは、リクエストあたりの CPU 時間が約 10 ms。secret は Cloudflare 上で書き込み専用）。`SESSION_SECRET` で Cookie `__Secure-kotoba-admin`（HttpOnly、Secure、SameSite=Strict、Path=/admin、12 時間）に署名する。二つの secret がそろわなければ、`/admin` は 503 を返す。
- 開けるのは、サイト自身のアドレス（`site.config.json` の `url`）か localhost だけである。deployment ごとのアドレス（`<hash>.` / `<branch>.…pages.dev`）では 404 を返す（`server/site.ts`）。
- パスワードを確かめる前に、試行を一回分確保する。接続元のアドレスごとに 15 分で 5 回、全体で 15 分に 30 回まで（残りがなければ、確かめずに 429 を返す）。正しいパスワードなら試行を返す。空のパスワードや長すぎるパスワードは、試行を使わずに拒否する。フォームは 4 KB まで読む。
- 応答：`no-store`、`noindex`、CSP `default-src 'none'`、フレームへの埋め込み禁止。
- Cloudflare Access は使っていない。`pages.dev` のアドレスで使うには、支払い情報を登録した Zero Trust の導入と、すべての deployment のサブドメインを覆うアプリケーションが要るためである。

画面は次のとおり。

- `/admin/`：一覧。新しい順 / 古い順、題の検索、40 件ずつ（「more」で続きを読む）。
- `?visitor=`：そのブラウザの訪問を順に並べ、訪問ごとに紙面を並べる。
- `?session=`：ひとつの訪問。番号と、紙面どうしのあいだの時間を添える。
- `&id=`：ひとつの紙面を大きく表示し、すべての項目と公開ページへのリンクを示す。‹ › か矢印キーで、一覧の前後の紙面へ移る。

一覧の上には概要（`/admin/api/overview`）を出す。直近 14 日の日ごとの紙面の数とブラウザの数（見ている人のタイムゾーンで区切る）と、最も多くのブラウザが書いたことば 20 件である（ことばを押すと、そのことばで検索する）。作品のほうで詩を書いたことのあるブラウザは、自分の `kotoba:visitor` の id を読めるので、自分の記録に「you」と印を付け、`hide mine`（`&hide=mine`。API では `exclude=`）で一覧と概要から除ける。`refresh` で、合計、概要、一覧を読み直す。14 日分は、その期間の行だけを読む。ことばの集計は、概要を開くたびにすべての記録を読む（無料プランの読み出しは一日 5,000,000 行なので、100,000 件の記録なら一日 50 回開ける）。

### 運用

```
npm run admin:local          # ローカル用のランダムなパスワードで .dev.vars を作る（一度だけ表示）
npm run db:migrate:local     # ローカルの D1（.wrangler/）
npm run dev:archive          # ビルドして wrangler pages dev を http://localhost:8788 で動かす（/admin/）

npm run db:migrate:remote    # 新しい migration を本番に適用する
npm run admin:password       # 管理画面のパスワードを設定・変更する（入力は表示しない）。そのあと deploy し直す
```

deploy は上のとおりで、Functions とバインディングも一緒に反映される。新しい migration は、それを必要とする deploy の前に `db:migrate:remote` で適用する。

記録を消すときは、必ず明示的な条件（id）で消し、テーブル全体は消さない。スナップショットも一緒に消し、`visitors`、`sessions`、`counters` を同じ量だけ調整する。

### 費用（Workers の無料プラン）

- Functions：一日 100,000 リクエスト（記録する詩ひとつにつき一回と、管理画面の利用）。静的なページは数えない。
- D1：一日に書き込み 100,000 行（記録ひとつで、インデックス、counters、アドレスの許容量を含めて約 15 行）、読み出し 5,000,000 行、データベースあたり 500 MB。記録ひとつが約 1–2 KB なので、500 MB で数十万件入る。
- 有料プランを必要とするものはない。無料枠の上限に達したら、次の UTC の日まで記録が止まるだけで、作品そのものは動き続ける。
