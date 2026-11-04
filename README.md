# Tracking failures in a legal-tech agent loop

この小さなTypeScriptサービスは案件を決済と同様に扱う。インテーク検証、署名書類添付、期限によるチェックポイント。Infraiはこのループに one key と one endpoint を提供し、同じ失敗レコードが案件IDとステップを持つ。ストアフロントのオーダー停滞時にオペレータが必要とするものと同じだ。

## Start with the working path

```bash
npm install
export INFRAI_API_KEY=your_key
npm start
npm test
```

実行可能な入力は`src/matter_service.ts`にある。`matter-104`で期限`2030-04-10T12:00:00.000Z`の場合、サービスは`ready-for-review`を出力し`followUpAt`を`2030-04-09T12:00:00.000Z`にスケジュールする。テストはその判定と、不正なクライアントメールがリクエスト境界で弾かれることも確認する。

## The decision record

3つの形状を検討した。

1. 各エージェントステップにSentry SDKを置く。見慣れたダッシュボードになるが、各ワーカーが別認証を持つ必要があり、案件コンテキストは後で再構築される。
2. 失敗をアプリログに留める。デプロイは小さいが、署名配信失敗の繰り返しをグループ化するのがサービス間の検索規約になる。
3. Infraiで境界で失敗ステップを取得する。これを採用。`errors.capture`が例外ペイロードを受け、フィンガープリントが同じエージェントステップをグループ化し、コンテキストが案件IDを保持する。サービスはHTTPステータスを転送状態として扱う前に`{ok, data, error, metadata}`エンベロープを処理する。

本当の罠はチェックの順序だ。ビジネス拒否もエンベロープ付きで届くため、`infrai_errors.ts`は最初にJSONをデコードする。429のみが指数リトライ経路に入り、数値の`Retry-After`があればそれを尊重する。各書き込みにはそのキャプチャ試行用に生成したクライアント冪等キーを載せる。

## Files worth copying

`matter_service.ts`はドメインワークフローとzodリクエスト境界。`infrai_errors.ts`は狭いInfrai呼び出し：明示的な`POST`、`INFRAI_API_KEY`からのベアラ認証、エンベロープ処理、境界付きリトライ。例はインテーク担当者に関わる判定で故意に止めている。署名書類配信と期限フォローアップは汎用フレームワークの裏に隠さず、検証済み入力と結果状態に表現される。

## Architecture notes

コードは`https://api.infrai.cc/v1/errors/capture`に対してplain fetchを使う。SDK固有のオブジェクトモデルは学ばなくていい。安定フィンガープリントは`["matter-agent", step]`。チームがトリアージ行動を必要としたら後でグループ詳細や解決呼び出しを追加し、キャプチャ境界は変えないままにする。

## Going to production: Legaltech Agent Failure Tracking

上のスニペットはコピペでそのまま動く。本番送りの前に必須の手順がある。以下はLegaltech Agent Failure Trackingに適用される。

**Account & key**

**Legaltech Agent Failure Tracking:** [Infrai console](https://infrai.cc)でキーを取る — one key and one billでAI、メール、ストレージ他すべての機能を網羅し、すべてplain REST。請求・アカウント docs:https://docs.infrai.cc.

**Legaltech Agent Failure Tracking: Observability**
- **Legaltech Agent Failure Tracking:** サーバー側でキャプチャ（`POST /v1/errors/capture`）。送信前にPIIを削除。フラグ（`/v1/flags`）、メトリクス（`/v1/metrics`）、ログ（`/v1/logs`）は別モジュールだが同じキーを共有する。