# Daily Games Board

Shared scoreboard for a WhatsApp group that plays Wordle, Perceptle, Krillion, Maptap and Size It Up every day.
Each person pastes their share text straight from the game; the page parses it and files it under their name and the day.

- `index.html` is the whole site (the built page). GitHub Pages serves it.
- `template.html` + `parser.js` are the sources; `node build.js` writes `index.html`.
- `node test-parser.js` runs the parser against sample share texts.
- Scores live in your own Supabase project (`players` and `results` tables). The browser calls a narrow Supabase Edge Function; database credentials remain server-side and the tables deny direct browser access.

## Create an independent empty board

1. Create a new Supabase project. Do not reuse the original board's project.
2. In that project's SQL Editor, run `supabase/schema.sql` once. It creates empty `players` and `results` tables and denies direct access to public database roles.
3. Install the Supabase CLI, log in, and link this folder to the new project.
4. Set the function's allowed browser origins, for example `supabase secrets set ALLOWED_ORIGINS=http://localhost:8000,https://YOUR-USER.github.io`.
5. Deploy the API with `supabase functions deploy board`.
6. Replace `YOUR_PROJECT_REF` in `config.js` with the new Supabase project reference.
7. Run `node build.js`, then serve the folder locally or publish it with GitHub Pages.

This version intentionally has no login. The gateway validates payloads and limits the exposed operations, but anyone who can reach it can still use those operations. That matches the original trusted-group behavior. Add Supabase Auth and owner-based authorization before using it with an untrusted audience.

## Publish with GitHub Pages

The included `.github/workflows/deploy-pages.yml` builds, tests, packages, and deploys the browser files whenever `main` is pushed. In the GitHub repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.

Before the first deployment:

1. Replace `YOUR_PROJECT_REF` in `config.js` with the reference of the Supabase project hosting the `board` Edge Function.
2. Set the function's `ALLOWED_ORIGINS` to the site's origin. For a project site such as `https://YOUR-USER.github.io/YOUR-REPO/`, the origin is `https://YOUR-USER.github.io` (without the repository path).
3. Commit and push to the `main` branch. The workflow runs the parser tests before deploying and publishes only `index.html` and `config.js`.

Relative asset paths make the site work both at the account root and under a repository path. If you later use a custom domain, add that domain's origin to `ALLOWED_ORIGINS` and redeploy the Edge Function.
