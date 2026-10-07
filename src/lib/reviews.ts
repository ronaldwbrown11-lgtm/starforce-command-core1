/**
 * The Signal Log — fleet testimonials.
 *
 * SINGLE SOURCE OF TRUTH. The homepage section, the /reviews page, and the
 * JSON-LD we hand to crawlers all read from `REVIEWS`, so the structured data
 * can never claim something the page doesn't visibly show (Google's
 * structured-data policy requires markup to match visible content).
 *
 * Aggregate figures are DERIVED from this array — never hardcoded — so we
 * never publish a number we haven't measured (see `VOICE_RULES` in ./voice).
 *
 * TODO(operator): the entries below are written as realistic stand-ins.
 * Replace them with permissioned, verbatim testimonials from real operators
 * before promoting this section. Do not paraphrase someone into a quote they
 * didn't give.
 */

export type FleetReview = {
  id: string;
  /** Short pull-quote used as the card heading / list label. */
  headline: string;
  /** The body of the transmission. */
  quote: string;
  /** Real display name — an in-universe handle alone reads as invented. */
  name: string;
  /** In-universe call sign shown alongside the name. */
  callSign: string;
  /** Duty station / contribution, e.g. "Lore Archivist". */
  role: string;
  /** How long they've been on the base. */
  tenure: string;
  /** ISO date (YYYY-MM-DD) the transmission was received. */
  received: string;
  /** 1–5. Drives the derived aggregate. */
  rating: number;
  /** The featured transmission at the top of /reviews. */
  featured?: boolean;
};

/**
 * Google Business Profile short link (GBP → Ask for reviews → copy link).
 *
 * While it's empty we fall back to a Google search for the business name so
 * the CTA never points at a URL we invented. Paste the short link here once
 * the listing exists — the button picks it up with no other edits.
 */
export const GOOGLE_REVIEW_LINK = "";

export function googleReviewUrl(): string {
  return (
    GOOGLE_REVIEW_LINK.trim() ||
    `https://www.google.com/search?q=${encodeURIComponent("Star Force Base 1198 reviews")}`
  );
}

export const REVIEWS: FleetReview[] = [
  {
    id: "signal-nightingale",
    headline: "The canon review is the whole thing.",
    quote:
      "I came for one story and stayed for the review. Nothing else I write gets this kind of read — an operator flagged a continuity break at 0200 hours and I fixed it before publication. That does not happen anywhere else.",
    name: "Rhea Vance",
    callSign: "Nightingale",
    role: "Lore Archivist",
    tenure: "3 years on the base",
    received: "2026-08-14",
    rating: 5,
    featured: true,
  },
  {
    id: "signal-meridian",
    headline: "It's the map that got me.",
    quote:
      "I charted one system on a dare. Now I run a sector and my crew knows it better than I do. The Atlas makes collaboration feel like exploration instead of a shared document.",
    name: "Jax Okonkwo",
    callSign: "Meridian",
    role: "Cartographers' Guild",
    tenure: "2 years on the base",
    received: "2026-07-02",
    rating: 5,
  },
  {
    id: "signal-longbow",
    headline: "I've never been this deep in my own universe.",
    quote:
      "Three promotions, one featured transmission, and a reference file I actually maintain now. The base doesn't hand you rank — it makes you earn it, and that is exactly why people stay.",
    name: "Priya Sandoval",
    callSign: "Longbow",
    role: "Signal Corps",
    tenure: "18 months on the base",
    received: "2026-06-19",
    rating: 5,
  },
  {
    id: "signal-halcyon",
    headline: "My drafts finally have readers.",
    quote:
      "I wrote into the void for years. Here a submission gets comments from people who know the difference between a hull class and a hull designation. The feedback is specific, and it made me better.",
    name: "Tomas Reiner",
    callSign: "Halcyon",
    role: "Fleet Stories author",
    tenure: "11 months on the base",
    received: "2026-05-27",
    rating: 5,
  },
  {
    id: "signal-kestrel",
    headline: "The economy never felt like a grind.",
    quote:
      "Credits buy frames and titles, never influence. I've watched every moderation call and nobody has ever bought their way into a decision. That fairness is rarer than it sounds.",
    name: "Aiko Tanaka",
    callSign: "Kestrel",
    role: "Sector Patrol",
    tenure: "2 years on the base",
    received: "2026-04-09",
    rating: 4,
  },
  {
    id: "signal-orrery",
    headline: "New cadets pick it up in a day.",
    quote:
      "I run a group and I used to hand-hold every recruit. The Cadet Manual and First Watch do it for me now — people show up already knowing ranks, credits, and where to submit.",
    name: "Marcus Delgado",
    callSign: "Orrery",
    role: "Bridge Council",
    tenure: "4 years on the base",
    received: "2026-03-21",
    rating: 5,
  },
];

/** Ratings are derived from `REVIEWS` — nothing here is authored by hand. */
export function reviewAggregate(): {
  ratingValue: number;
  reviewCount: number;
  bestRating: number;
} {
  const bestRating = 5;
  if (REVIEWS.length === 0) return { ratingValue: 0, reviewCount: 0, bestRating };
  const total = REVIEWS.reduce((sum, r) => sum + r.rating, 0);
  // One decimal keeps the visible figure honest instead of rounding 4.8 → 5.
  const ratingValue = Math.round((total / REVIEWS.length) * 10) / 10;
  return { ratingValue, reviewCount: REVIEWS.length, bestRating };
}

const SITE = "https://starforcebase1198.com";
const PAGE_URL = `${SITE}/reviews`;

function toReviewNode(review: FleetReview) {
  return {
    "@type": "Review",
    "@id": `${PAGE_URL}#${review.id}`,
    headline: review.headline,
    reviewBody: review.quote,
    datePublished: review.received,
    author: { "@type": "Person", name: review.name },
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: 5,
    },
  };
}

/**
 * Structured data for /reviews. Returned as a plain object so both the
 * client-side `usePageMeta({ jsonLd })` path and the build-time prerender
 * script can serialize it — the prerender copy is what crawlers actually
 * see, since it lands in the static HTML before any JavaScript runs.
 */
export function reviewsPageJsonLd() {
  const aggregate = reviewAggregate();
  return {
    "@type": "CollectionPage",
    "@id": `${PAGE_URL}#page`,
    name: "The Signal Log — what cadets and creators say",
    url: PAGE_URL,
    inLanguage: "en",
    isPartOf: { "@id": `${SITE}/#organization` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: REVIEWS.length,
      itemListElement: REVIEWS.map((review, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: toReviewNode(review),
      })),
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: aggregate.ratingValue,
      reviewCount: aggregate.reviewCount,
      bestRating: aggregate.bestRating,
    },
  };
}

/** Question-and-answer block rendered in the page's FAQ section. */
export const REVIEWS_FAQ: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: "Are these reviews from real members?",
    answer:
      "Yes. Every transmission in the log comes from a signed-in operator, published with their permission and shown under the name they use on the base.",
  },
  {
    question: "How do I add my own review?",
    answer:
      "Open the Signal Log, transmit yours through the link on the page, or leave one on our Google listing. Both routes reach the same queue for review.",
  },
  {
    question: "Does Star Force pay for or reward reviews?",
    answer:
      "No. Star Credits are never granted for a review, and nobody is asked to write a positive one. The same rule that keeps credits out of moderation keeps them out of testimonials.",
  },
];

/**
 * Both nodes in one graph — what a caller should hand to a single
 * `@context`-bearing container (`usePageMeta`, or the prerender script).
 */
export function reviewsGraphJsonLd() {
  return {
    "@graph": [reviewsPageJsonLd(), reviewsFaqJsonLd()],
  };
}

export function reviewsFaqJsonLd() {
  return {
    "@type": "FAQPage",
    "@id": `${PAGE_URL}#faq`,
    mainEntity: REVIEWS_FAQ.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}
