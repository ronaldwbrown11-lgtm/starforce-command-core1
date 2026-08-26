import { useEffect } from "react";

interface PageMetaOptions {
  title: string;
  description?: string;
  image?: string | null;
  /** Canonical URL override. Defaults to current location. */
  canonical?: string;
  /** JSON-LD structured data object — injected as a <script type="application/ld+json"> tag. */
  jsonLd?: Record<string, unknown>;
  /** If true, add noindex for pages that shouldn't be indexed. */
  noindex?: boolean;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

let jsonLdScript: HTMLScriptElement | null = null;

/**
 * Sets document.title, social/meta tags, canonical URL, and optional
 * JSON-LD structured data for the current page so shared links preview
 * nicely (OG + Twitter cards) and search engines understand the content.
 */
export function usePageMeta({
  title,
  description,
  image,
  canonical,
  jsonLd,
  noindex,
}: PageMetaOptions) {
  useEffect(() => {
    document.title = title;

    const url = canonical || window.location.href;
    const siteName = "Star Force Base 1198";
    const defaultImage = "https://starforcebase1198.com/og-default.png";

    // Open Graph
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:type", jsonLd?.["@type"] === "Article" ? "article" : "website");
    upsertMeta("property", "og:site_name", siteName);
    upsertMeta("property", "og:url", url);
    if (description) upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:image", image || defaultImage);

    // Twitter Card
    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", title);
    if (description) upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image || defaultImage);

    // Standard meta
    if (description) upsertMeta("name", "description", description);

    // Canonical
    upsertLink("canonical", url);

    // Robots
    if (noindex) {
      upsertMeta("name", "robots", "noindex, nofollow");
    } else {
      upsertMeta("name", "robots", "index, follow");
    }

    // JSON-LD structured data
    if (jsonLd) {
      if (jsonLdScript) jsonLdScript.remove();
      jsonLdScript = document.createElement("script");
      jsonLdScript.type = "application/ld+json";
      jsonLdScript.textContent = JSON.stringify({
        "@context": "https://schema.org",
        ...jsonLd,
      });
      document.head.appendChild(jsonLdScript);
    }

    return () => {
      // Cleanup JSON-LD on unmount
      if (jsonLdScript) {
        jsonLdScript.remove();
        jsonLdScript = null;
      }
    };
  }, [title, description, image, canonical, jsonLd, noindex]);
}
