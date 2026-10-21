# Taj Mahal — website

Live: https://iamtajmahal.netlify.app (Netlify site `iamtajmahal`)

## How it's built

The whole site is **one file: `index.html`**. CSS, JavaScript and every image are inside it; images are embedded as base64 `data:` URIs, so the file is about 5 MB. There's no build step and no framework.

Tip: turn soft-wrap off in your editor — the image lines are very long. Search for the comment markers below to jump around.

## Previewing

Don't open the file by double-clicking it (`file:///…`). YouTube refuses to play embeds there (**Error 153**). Serve it instead:

```bash
python3 -m http.server 8000
```

then open http://localhost:8000.

## Layout

Section order (top to bottom): hero → video ("Experience the Impact") → bio → Presence/Influence/Impact/Legacy collage → testimonials → Let's Connect → impact stats → reels → "As Seen With" → ticker → Book Taj → footer.

Desktop is approved. Mobile changes live behind `@media(max-width:768px)` and are marked with comments — search for:

| Comment | What it does |
|---|---|
| `MOBILE HERO VIDEO` | Replaces the hero photo with the YouTube video on phones (CSS + a `<script>` just before `</body>`) |
| `MOBILE BIO ORDER` | Bio copy first, portrait after |
| `MOBILE PORTRAIT SCALE` | Full-width, larger portrait |
| `MOBILE REELS` | Reel posters as 16:9 tiles, play button bottom-right |
| `MOBILE CONNECT PHONE` | Enlarged phone mockup in Let's Connect |
| `Mobile autoplay` | Testimonial carousel auto-advance (inside the `TESTIMONIAL WALL` script) |

## Known open items

- Two pre-existing JavaScript syntax errors in the console (an unescaped apostrophe in the phone-canvas script and an extra `});` in the "Elite experience layer"). They don't break the page.
- On mobile the same video plays in the hero and again in "Experience the Impact"; the first tap unmutes the lower copy.
- The Let's Connect phone screen shows only the TM logo — a real social screenshot would read better.
- The hero video is a YouTube Short, so it's cropped to hide YouTube's Like/Share overlay. An MP4 of the video would be cleaner.

## Deploying

Changes go live by deploying this folder to the Netlify site `iamtajmahal`. Please send changes back for review (pull request or draft deploy) rather than publishing straight to production.

## Backend (Vercel)

The page is still one static `index.html`. The contact form and the leads portal run as Vercel Functions in the same project:

- `api/lead.js` receives the booking form, stores it in Neon Postgres and emails it through Resend.
- `team/index.html` is the leads portal at `/team`, backed by `api/login.js` and `api/leads.js`.
- `lib/` holds the shared database and login helpers.

Set the environment variables listed in `.env.example` in the Vercel project. Locally the static page still previews with `python3 -m http.server 8000`, but the form and portal need `vercel dev` or a Vercel deployment.
