# tools — docs static-site generator

Renders the markdown under `../docs/*.md` into a polished, fully-offline static
site at **`../docs/site/`**. The generated site is committed; **you only need
this folder to _rebuild_** after editing the docs.

## View the site (no build needed)

The site is static — just open the committed output:

```bash
open ../docs/site/index.html
```

## Rebuild after editing docs

```bash
npm install        # one-time — restores marked + highlight.js (gitignored)
npm run build      # docs/*.md → docs/site/
```

Other scripts:

- `npm run open` — rebuild, then open `docs/site/index.html` in your browser.
- `npm run serve` — rebuild, then serve at <http://localhost:8000> (handy if a
  browser is fussy about `file://`).

## How it works

`build-site.mjs` parses each `.md` with **marked** (GFM), highlights code with
**highlight.js** at build time, rewrites intra-doc `.md` links → `.html`, and
wraps each page in a shared shell (sidebar nav, "on this page" TOC, dark/light
toggle, search, copy-code buttons) from `assets/style.css` + `assets/app.js`.
No CDN, no runtime markdown, no network. The `wiki/` folder is **not** touched.
