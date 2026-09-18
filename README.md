# Payuu Live Creator Support Platform V40

A modular, scalable, and high-performance Creator Support Platform for Payuu Live, designed to deliver a Streamlabs/StreamElements-tier experience without heavy framework overhead.

## Directory Structure

```text
payuu-live-platform/
├── index.html
├── overlay.html
├── style.css
├── firebase.js
├── script.js
├── README.md
├── js/
│   ├── ui.js
│   ├── theme.js
│   ├── particles.js
│   ├── animation.js
│   ├── utils.js
│   ├── auth.js
│   ├── queue.js
│   ├── voice.js
│   ├── overlay.js
│   ├── engagement-admin.js
│   ├── engagement-overlay.js
│   ├── admin.js
│   ├── settings.js
│   ├── notifications.js
│   └── export.js
└── assets/
    ├── images/
    │   ├── logo.png
    │   ├── favicon.png
    │   └── default-qr.png
    ├── icons/
    ├── sounds/
    │   └── chime.mp3
    └── fonts/
```

Engagement controls and OBS overlay renderer are included for Like, Subscribe and Share alerts.


## Security and deployment

- Realtime Database rules are maintained in `database.rules.json` and Storage rules in `storage.rules`.
- The production Firebase console must have these rules deployed; keeping a rules file in GitHub does not change the live database by itself.
- Admin authorization is enforced by Firebase rules using the signed-in Google account email and the matching `admins/<email-key>` record. The UI checks roles as a convenience; the rules are the security boundary.
- Supporter voice recordings are stored in Cloudflare R2. Only an opaque `voiceKey` is persisted in Firebase; the application plays recordings through the same-origin `/api/play-voice` endpoint instead of storing R2 bearer URLs.
- The UPI flow records a supporter-submitted payment request. It is not payment-gateway verification; an administrator must verify the payment before approval.
- `overlayQueue` uses an atomic claim transaction so multiple OBS Browser Sources do not intentionally play the same alert concurrently. Firebase transactions require read access to the transaction path.
