// density.mjs — pure helpers for wiki density checks (anti-sprawl). Zero deps.
// The head-to-head against a hand-made wiki showed Cairn's output is more diffuse: more, thinner pages.
// These power the lint's advisory (info-severity) density findings: thin pages worth merging, and pairs
// whose tag-sets overlap so heavily they're probably the same topic split in two.

// Strip the leading --- frontmatter --- block; return the body only.
export function bodyOf(text) {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('\n---', 3);
  return end === -1 ? text : text.slice(end + 4);
}

// Approximate prose word count: body minus fenced code blocks and markdown punctuation.
export function wordCount(text) {
  return bodyOf(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`[\]()|~-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

// Parse a frontmatter tags value ("[a, b]" or a joined "- a - b") into a lowercased Set.
export function tagSet(tagsStr) {
  return new Set(
    (tagsStr || '')
      .replace(/[[\]'"]/g, ' ')
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 1 && s !== '-')
  );
}

// Jaccard similarity of two sets (0..1). Empty sets ⇒ 0.
export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// pages: [{ file, words }] → the ones below minWords.
export function findThin(pages, minWords = 80) {
  return pages.filter((p) => p.words < minWords).sort((a, b) => a.words - b.words);
}

// pages: [{ file, tags:Set }] → pairs whose tag-overlap ≥ threshold (and that share ≥ minShared tags),
// sorted by score desc. Catches near-duplicate topics split across pages.
export function findOverlaps(pages, threshold = 0.6, minShared = 3) {
  const out = [];
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      let shared = 0;
      for (const t of pages[i].tags) if (pages[j].tags.has(t)) shared++;
      const score = jaccard(pages[i].tags, pages[j].tags);
      if (score >= threshold && shared >= minShared) out.push({ a: pages[i].file, b: pages[j].file, score: Number(score.toFixed(2)) });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}
