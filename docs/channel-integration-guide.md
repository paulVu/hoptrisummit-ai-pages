# Channel Integration Guide — Zalo OA + Facebook Messenger

This guide shows how to connect the HoptriSummit chatbot backend (`/api/chat`) to:
- Zalo Official Account (OA)
- Facebook Messenger (Meta Page)

---

## 1) Integration architecture

```text
User (Zalo / Messenger)
  -> Provider Webhook (Zalo/Meta)
  -> Channel Adapter (your bridge service)
  -> Hoptri chatbot API (/api/chat)
  -> Channel Adapter
  -> Send reply back to Zalo/Meta API
```

The chatbot server already provides the core AI endpoint:
- `POST /api/chat`

You need a **channel adapter** layer to:
1. verify webhook signatures
2. normalize incoming messages
3. map channel user ids to `visitorId`
4. call `/api/chat`
5. send the returned reply back to channel API

---

## 2) Common payload mapping

Normalize all channels into this internal payload:

```json
{
  "message": "raw user text",
  "visitorId": "channel:user_id",
  "conversationId": "channel:thread_or_psid"
}
```

Recommended `visitorId` format:
- Zalo: `zalo:<user_id>`
- Messenger: `fb:<psid>`

Recommended `conversationId` format:
- `zalo:<user_id>` for 1-1 chats
- `fb:<psid>` for Messenger 1-1 chats

---

## 3) Zalo OA integration

## 3.1 Prerequisites
- Zalo OA account approved
- OA app credentials:
  - App ID
  - App Secret
  - OA Access Token
- Public HTTPS endpoint for webhook

## 3.2 Webhook endpoint
Create:
- `POST /webhooks/zalo`

Handler responsibilities:
1. Validate source per Zalo docs (signature/token rules)
2. Parse incoming text message events
3. Convert to internal payload
4. Call chatbot API
5. Send reply using Zalo send-message API

## 3.3 Pseudo-code

```js
app.post('/webhooks/zalo', async (req, res) => {
  // 1) verify signature/token (per Zalo docs)
  // 2) extract user + message text
  const userId = req.body?.sender?.id;
  const text = req.body?.message?.text;
  if (!userId || !text) return res.sendStatus(200);

  const botRes = await fetch('http://localhost:3456/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: text,
      visitorId: `zalo:${userId}`,
      conversationId: `zalo:${userId}`,
    }),
  }).then(r => r.json());

  await sendZaloMessage(userId, botRes.reply);
  res.sendStatus(200);
});
```

## 3.4 Recommended message policy
- Reply within provider timeout quickly (ack 200 ASAP)
- If chatbot call is slow, queue async reply
- Keep reply text plain or markdown-lite (channel-safe)

---

## 4) Facebook Messenger integration

## 4.1 Prerequisites
- Meta App + Facebook Page
- Messenger product enabled
- Page Access Token
- Verify Token
- App Secret (for X-Hub-Signature-256 verification)

## 4.2 Webhook endpoints
Create:
- `GET /webhooks/messenger` (verification challenge)
- `POST /webhooks/messenger` (events)

## 4.3 Pseudo-code

```js
app.get('/webhooks/messenger', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhooks/messenger', async (req, res) => {
  // verify X-Hub-Signature-256 with APP_SECRET
  const events = req.body?.entry || [];

  for (const entry of events) {
    for (const e of entry.messaging || []) {
      const psid = e.sender?.id;
      const text = e.message?.text;
      if (!psid || !text) continue;

      const botRes = await fetch('http://localhost:3456/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          visitorId: `fb:${psid}`,
          conversationId: `fb:${psid}`,
        }),
      }).then(r => r.json());

      await sendMessengerText(psid, botRes.reply);
    }
  }

  res.sendStatus(200);
});
```

---

## 5) Suggested folder structure for adapters

```text
chatbot/
  adapters/
    zalo/
      webhook.js
      client.js
      verify.js
    messenger/
      webhook.js
      client.js
      verify.js
```

---

## 6) Security checklist

- Validate webhook signatures (both channels)
- Rate limit webhook endpoints
- Ignore non-text events safely
- Log channel + user id + message id
- Prevent duplicate event processing (`event_id` cache)
- Keep access tokens in `.env`, never hardcode

---

## 7) Env vars (proposed)

```bash
# Zalo
ZALO_APP_ID=
ZALO_APP_SECRET=
ZALO_OA_ACCESS_TOKEN=

# Meta Messenger
META_PAGE_ACCESS_TOKEN=
META_APP_SECRET=
META_VERIFY_TOKEN=

# Shared
BOT_API_BASE=http://localhost:3456
```

---

## 8) Rollout plan

1. Build Zalo adapter first (priority VN market)
2. Run sandbox tests with 10-20 scripted conversations
3. Add retry + dedupe + logs
4. Build Messenger adapter
5. Monitor:
   - response latency
   - failed sends
   - handover intents
   - top unresolved questions

---

If needed, next step is I can scaffold real adapter files (`adapters/zalo/*`, `adapters/messenger/*`) with runnable Express handlers.
