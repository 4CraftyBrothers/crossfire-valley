# Store assets

Generated, not hand-made. Regenerate after UI changes:

```bash
npx vite --port 5173 --strictPort      # in another terminal
cd /tmp && npm init -y && npm i playwright   # anywhere outside this repo
node <repo>/scripts/store-screenshots.mjs <repo>/store/screenshots
```

The script drives the dev server with Microsoft Edge (`channel: 'msedge'`,
present on every Windows 11 machine; swap for `chromium` elsewhere) and
writes:

| File | Size | Use |
|---|---|---|
| `01`–`04`, `07` | 1290×2796 | iPhone 6.7" / Play phone screenshots |
| `05-landscape` | 2796×1290 | landscape phone |
| `06-tablet` | 2048×2732 | iPad 12.9" / Play tablet |
| `feature-graphic-1024x500` | 1024×500 | Play feature graphic |

Screenshots use a seeded save (13 missions done, medals) so the campaign
list looks lived-in; nothing in them is faked beyond that.
