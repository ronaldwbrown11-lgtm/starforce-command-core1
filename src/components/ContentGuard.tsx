import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

/**
 * ContentGuard — the base's copy / download lock.
 *
 * Policy (mounted once in main.tsx so it covers every route):
 *   • Visitors and members cannot select, copy, right-click-save, drag out,
 *     print, or save-to-disk site content.
 *   • The owner (`users.role === "admin"`) is exempt everywhere — no
 *     restriction is applied at all for that account.
 *   • Operator staff keep normal copy/download inside the operator console,
 *     which carries the [data-copy-allow] zone (see OperatorShell).
 *   • Members download their OWN material only through the flows that carry
 *     [data-allow-download]. Those flows are gated server-side, which is what
 *     actually enforces the rule:
 *       - store.getFileDownloadUrl → creator-of-record, paid entitlement
 *         (Requisition Depot purchase), or store admin — nothing else.
 *       - storage.getDownloadUrl   → file.userId must equal the caller.
 *   • Artwork a member uploaded themselves downloads from FullScreenViewer,
 *     marked [data-allow-download] when asset.authorId is the viewer.
 *
 * This layer is deterrent-level, not DRM: content the browser renders can
 * still be fetched by URL by a determined user, and screenshots cannot be
 * stopped from script. The depot download rule in src/convex/store.ts is the
 * part that is actually enforced.
 */

const LOCK_CLASS = "sf-copy-locked";

/** Everything a person is legitimately allowed to type into / select in. */
const TYPEABLE =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
/** Regions where copy/download is explicitly permitted (staff console). */
const ALLOWED = "[data-copy-allow]";
/** Specific download flows that are allowed (own content / bought items). */
const ALLOW_DOWNLOAD = "[data-allow-download]";

/**
 * Extensions the browser treats as a file to save rather than a page to
 * navigate to. Any anchor pointing at one of these — with or without the
 * download attribute — is a download attempt.
 */
const FILE_EXT =
  /\.(zip|rar|7z|tar|gz|tgz|bz2|pdf|csv|tsv|json|txt|md|docx?|xlsx?|pptx?|odt|epub|rtf|png|jpe?g|gif|webp|avif|bmp|svg|ico|mp3|wav|ogg|m4a|flac|mp4|webm|mov|mkv|woff2?|ttf|otf|eot|psd|apk|dmg|iso|exe|msi|deb|rpm)$/i;

function asElement(node: EventTarget | null): Element | null {
  if (node instanceof Element) return node;
  if (node instanceof Node) return node.parentElement;
  return null;
}

function within(el: Element | null, selector: string): boolean {
  return !!el && el.closest(selector) !== null;
}

export function ContentGuard() {
  const { user } = useAuth();
  // Fail closed: while the session is still resolving — and for every visitor
  // and member — the lock is on. Only the owner's account turns it off.
  const locked = user?.role !== "admin";

  useEffect(() => {
    if (!locked) return;

    const root = document.documentElement;
    root.classList.add(LOCK_CLASS);

    let lastNoticeAt = 0;
    const notice = (message: string) => {
      const now = Date.now();
      // Repeated attempts (hammering Ctrl+S) should not queue a toast storm.
      if (now - lastNoticeAt < 2000) return;
      lastNoticeAt = now;
      toast.info(message);
    };

    // Right-click is how "Save image as" / "Copy image" / "Save link as"
    // are reached, so it goes unless you are typing or in an allowed zone.
    const onContextMenu = (event: MouseEvent) => {
      const target = asElement(event.target);
      if (within(target, TYPEABLE) || within(target, ALLOWED)) return;
      event.preventDefault();
    };

    // Belt for the braces that user-select already is: catches Ctrl/Cmd+C
    // and Edit ▸ Copy even if a selection somehow exists.
    const onCopy = (event: ClipboardEvent) => {
      const target = asElement(event.target);
      const anchor = asElement(document.getSelection()?.anchorNode ?? null);
      // Typing your own words into a field is not copying site content.
      if (within(target, TYPEABLE) || within(anchor, TYPEABLE)) return;
      if (within(target, ALLOWED) || within(anchor, ALLOWED)) return;
      event.preventDefault();
      notice("Copying is disabled on this site.");
    };

    // Dragging an image or file out of the page is a copy.
    const onDragStart = (event: DragEvent) => {
      const target = asElement(event.target);
      if (within(target, TYPEABLE) || within(target, ALLOWED)) return;
      event.preventDefault();
    };

    // Downloads: a marked anchor (own content / bought depot item) or an
    // allowed zone passes; every other anchor that is saving a file is cut.
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.defaultPrevented) return;
      const target = asElement(event.target);
      if (within(target, TYPEABLE) || within(target, ALLOWED)) return;

      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.closest(ALLOW_DOWNLOAD)) return;

      const isDownloadAttr = anchor.hasAttribute("download");
      let pointsAtFile = false;
      try {
        pointsAtFile = FILE_EXT.test(
          new URL(anchor.href, window.location.href).pathname,
        );
      } catch {
        pointsAtFile = FILE_EXT.test(anchor.getAttribute("href") ?? "");
      }
      if (!isDownloadAttr && !pointsAtFile) return;

      event.preventDefault();
      event.stopPropagation();
      notice("This file can't be downloaded from this account.");
    };

    // Ctrl/Cmd+S saves the page to disk and Ctrl/Cmd+P prints it to PDF —
    // both are ways of taking the content, so both are cut.
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key !== "s" && key !== "p") return;
      event.preventDefault();
      notice("Saving and printing are disabled on this site.");
    };

    // The File ▸ Print menu item still reaches window.print().
    const nativePrint = window.print;
    window.print = () => notice("Saving and printing are disabled on this site.");

    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCopy, true);
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCopy, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.print = nativePrint;
      root.classList.remove(LOCK_CLASS);
    };
  }, [locked]);

  return null;
}
