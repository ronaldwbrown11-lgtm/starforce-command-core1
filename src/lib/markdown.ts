/**
 * Minimal markdown → HTML (bold, italic, headings, links, lists, paragraphs,
 * code) plus one safe raw-HTML allowance: this site's own story-embed
 * iframes. Everything else (including every other tag) stays escaped, so a
 * pasted script or arbitrary HTML can never run.
 *
 * Shared by the blog post renderer and the document viewers (DocViewer /
 * LoreDetail) so uploaded `.md` lore bibles render as formatted text instead
 * of a dead iframe.
 *
 * Why the embed allowance exists: operators paste the "Embed this story"
 * snippet from the story page into posts. The default escape pass turned it
 * into visible literal text, so embeds never rendered.
 */
export function renderMarkdown(md: string): string {
  // 1. Extract allowlisted SFB1198 story-embed iframes and stash placeholders
  //    so the escape pass below can't touch them.
  const embedTokens: string[] = [];
  const withTokens = md.replace(
    /<iframe\b([^>]*)src=["']https:\/\/starforcebase1198\.com\/embed\/story\/([A-Za-z0-9_-]+)["']([^>]*)>\s*<\/iframe>/gi,
    (_match: string, _a1: string, slug: string, _a2: string) => {
      // Rebuild the tag from validated parts only — pasted attributes like
      // onerror / srcdoc / style overrides never survive.
      const token = `\u0000EMBED${embedTokens.length}\u0000`;
      embedTokens.push(
        `<iframe src="https://starforcebase1198.com/embed/story/${slug}" width="100%" height="380" loading="lazy" title="Embedded story: ${slug}" style="border:none;border-radius:12px"></iframe>`,
      );
      return token;
    },
  );

  // 2. Escape everything that remains.
  let html = withTokens
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-uf-text mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-uf-text mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-uf-text mt-8 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-uf-text font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="text-[var(--uf-cyan)] bg-[rgba(0,229,255,0.08)] px-1.5 py-0.5 rounded text-sm">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[var(--uf-cyan)] hover:underline">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-uf-muted">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class="my-3">${m}</ul>`)
    .replace(/\n{2,}/g, '</p><p class="text-uf-muted leading-relaxed mt-4">')
    .replace(/\n/g, '<br/>');
  // 3. Unwrap paragraph wrappers around bare embed tokens so the iframe
  //    renders standalone (an <iframe> inside a <p> gets reflowed out of the
  //    paragraph by the browser). Capture the token — only the wrapper goes.
  const unwrapped = html.replace(
    /<p class="text-uf-muted[^"]*">\s*(?:<br\/>\s*)*(\u0000EMBED\d+\u0000)\s*(?:<br\/>\s*)*<\/p>/g,
    "$1",
  );
  // 4. Restore the stashed embed iframes verbatim (they're pre-validated).
  return unwrapped.replace(/\u0000EMBED(\d+)\u0000/g, (_m, i: string) => embedTokens[Number(i)] ?? "");
}
