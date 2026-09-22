# tools/form — measuring the form space (v3 experiment)

Development only. With the dev server running (`npx vite --port 5174`):

```
# dump every page (dev + holdout + probe, variants) under a force
FORCE='{"grammar":"auto","form":"v3"}' VARIANTS=0,1,2,3 node tools/form/cdp.mjs http://127.0.0.1:5174 out/shots tools/form/drafts.mjs > out/v3-drafts.json
# measure in node with the repository's own module
node --import ./tools/form/ts-register.mjs tools/form/measure.mts out/v3-drafts.json out/v3-profiles.json
# family table, discreteness, PCA
node tools/form/analyze.cjs out/v3-profiles.json out/v3 v3
# how far pages moved against the gaps between families, and the map
node tools/form/compare.cjs out/v2c-profiles.json out/v3-profiles.json out/compare v3
# sheets: SET=dev|holdout|probe  (pairs v2c | v3)
SET=dev OUT=out/pairs.png node tools/form/cdp.mjs http://127.0.0.1:5174 out/shots tools/form/pairs.mjs
```

`cdp.mjs` drives a headless Chrome (Windows path to chrome.exe inside).
