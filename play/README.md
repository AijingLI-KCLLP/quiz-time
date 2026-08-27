# QCM École .decode

React/Vite application containing JavaScript and web-administration quizzes.

## Private access

The site is protected with HTTP Basic Authentication before Vite or Vercel serves
the application, including its JavaScript and question data. Visitors need no
account: enter any username (for example `access`) and the configured password.

The password is read only from the server-side `SITE_PASSWORD` environment
variable. Never use `VITE_SITE_PASSWORD`: Vite would expose it in the browser
bundle.

### Run locally

```bash
cp .env.example .env.local
# Set a real SITE_PASSWORD in .env.local
npm install
npm run dev
```

Open [http://localhost:5174](http://localhost:5174). The browser asks for the
password before loading the QCM. `.env.local` is ignored by Git.

Vercel's environment variable is available to deployed code, not automatically
to `npm run dev`. To keep Vercel as the source of the local value after setting
it in the dashboard, pull it into the ignored local file with
`vercel env pull .env.local`.

For a phone on the same Wi-Fi network, open `http://YOUR_COMPUTER_IP:5174`.
Local HTTP is not encrypted, so use this only on a trusted network.

### Deploy on Vercel

1. Import the repository in Vercel (set the Root Directory to `play` if this is
   a subdirectory of the repository).
2. In **Project → Settings → Environment Variables**, add `SITE_PASSWORD`.
   Select Production and Preview (and Development if you use `vercel dev`).
3. Deploy.

The root [middleware.js](./middleware.js) runs before every Vercel request and
returns `401 Unauthorized` until the correct password is provided. Vercel
serves deployments over HTTPS, so the Basic Auth credentials are encrypted in
transit.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
