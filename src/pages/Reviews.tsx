import { Quote, Star } from "lucide-react";
import { Link } from "react-router";
import { SiteShell, PageHero, HoloCard, NeonButton } from "@/components/uf";
import { ScrollReveal, ScaleReveal } from "@/hooks/use-scroll-reveal";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  REVIEWS,
  REVIEWS_FAQ,
  googleReviewUrl,
  reviewAggregate,
  reviewsGraphJsonLd,
  type FleetReview,
} from "@/lib/reviews";

const PAGE_URL = "https://starforcebase1198.com/reviews";

/** Star row — the number lives in `aria-label`, the glyphs are decorative. */
function StarRow({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={
            i <= value
              ? "h-3.5 w-3.5 text-[var(--uf-gold)]"
              : "h-3.5 w-3.5 text-[var(--uf-muted)] opacity-40"
          }
          fill="currentColor"
        />
      ))}
    </span>
  );
}

/** Attribution line: real name first, call sign alongside — never a bare handle. */
function Attribution({ review }: { review: FleetReview }) {
  return (
    <footer className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-sm font-semibold">{review.name}</span>
      <span className="text-xs text-[var(--uf-cyan)]">
        “{review.callSign}”
      </span>
      <span className="text-xs text-uf-muted">
        {review.role} · {review.tenure}
      </span>
    </footer>
  );
}

function ReviewCard({ review }: { review: FleetReview }) {
  return (
    <HoloCard className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <StarRow value={review.rating} />
        <time
          className="font-mono text-[11px] text-uf-muted"
          dateTime={review.received}
        >
          {review.received}
        </time>
      </div>
      <h3 className="mt-3 text-base font-semibold leading-6">
        {review.headline}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-uf-muted">
        {review.quote}
      </p>
      <Attribution review={review} />
    </HoloCard>
  );
}

export default function Reviews() {
  const aggregate = reviewAggregate();
  const featured = REVIEWS.find((r) => r.featured) ?? REVIEWS[0];
  const rest = REVIEWS.filter((r) => r.id !== featured?.id);

  // Client-side structured data. The crawler-facing copy is emitted at build
  // time by scripts/prerender-routes.ts from the same builders, because most
  // AI crawlers never execute our JavaScript.
  usePageMeta({
    title: "The Signal Log — What Cadets and Creators Say | Star Force Base 1198",
    description:
      "Transmissions from Star Force operators: what the canon review, the Star Atlas, and life on the base are actually like — plus how to add yours.",
    canonical: PAGE_URL,
    jsonLd: reviewsGraphJsonLd(),
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="The Signal Log"
        title="What the fleet says after the debrief."
        lead="Unsigned praise is easy to write. These came from operators with a name, a call sign, and time on the base — published with permission, exactly as they sent them."
        primary={{ label: "Join the base", href: "/auth", variant: "primary" }}
        secondary={{ label: "Read fleet stories", href: "/stories", variant: "ghost" }}
      />

      {/* ---- Aggregate strip + featured transmission -------------------- */}
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[color:var(--uf-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <StarRow value={Math.round(aggregate.ratingValue)} />
            <p className="text-sm">
              <span className="font-semibold">
                {aggregate.ratingValue.toFixed(1)}
              </span>
              <span className="text-uf-muted">
                {" "}
                / {aggregate.bestRating} · {aggregate.reviewCount} transmissions
                logged
              </span>
            </p>
          </div>
          <Link to="/membership">
            <NeonButton variant="ghost">See tiers</NeonButton>
          </Link>
        </div>

        {featured ? (
          <ScaleReveal>
            <HoloCard className="relative overflow-hidden">
              <span className="uf-eyebrow uf-eyebrow--gold">
                Featured transmission
              </span>
              <Quote
                aria-hidden="true"
                className="mt-4 h-7 w-7 text-[var(--uf-gold)] opacity-80"
              />
              <p className="mt-3 text-xl leading-8 md:text-2xl md:leading-9">
                {featured.quote}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <StarRow value={featured.rating} />
                <time
                  className="font-mono text-[11px] text-uf-muted"
                  dateTime={featured.received}
                >
                  {featured.received}
                </time>
              </div>
              <Attribution review={featured} />
            </HoloCard>
          </ScaleReveal>
        ) : null}
      </section>

      {/* ---- The log ----------------------------------------------------- */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="mb-6">
          <span className="uf-eyebrow">Full log</span>
          <h2 className="text-3xl font-semibold mt-2">
            Every transmission we&apos;ve received.
          </h2>
          <p className="text-uf-muted text-sm mt-2 max-w-2xl">
            Sorted newest first. Nothing is edited for tone — we only trim
            length and remove anything that would identify a member who asked
            to stay private.
          </p>
        </header>
        <div className="uf-grid uf-grid--3">
          {rest.map((review, idx) => (
            <ScaleReveal key={review.id} staggerIndex={idx}>
              <ReviewCard review={review} />
            </ScaleReveal>
          ))}
        </div>
      </section>

      {/* ---- CTA band ---------------------------------------------------- */}
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        <HoloCard>
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <span className="uf-eyebrow uf-eyebrow--gold">
                Send your own
              </span>
              <h2 className="mt-2 text-2xl font-semibold">
                Two minutes. Your words, not ours.
              </h2>
              <p className="text-uf-muted mt-2 text-sm leading-6 max-w-xl">
                Log what actually happened — your first featured entry, a sector
                you charted, a promotion you earned. Specific beats flattering,
                and nobody is paid or credited for a review.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <a
                href={googleReviewUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                <NeonButton variant="primary">Leave a Google review</NeonButton>
              </a>
              <Link to="/first-watch">
                <NeonButton variant="ghost">Start First Watch</NeonButton>
              </Link>
            </div>
          </div>
        </HoloCard>
      </section>

      {/* ---- FAQ — rendered open so crawlers see the answers -------------- */}
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12 pb-20">
        <header className="mb-6">
          <span className="uf-eyebrow">Standing questions</span>
          <h2 className="text-3xl font-semibold mt-2">
            Before you transmit.
          </h2>
        </header>
        <div className="grid gap-4">
          {REVIEWS_FAQ.map((entry, idx) => (
            <ScrollReveal key={entry.question} staggerIndex={idx}>
              <HoloCard>
                <h3 className="text-base font-semibold">{entry.question}</h3>
                <p className="text-uf-muted mt-2 text-sm leading-6">
                  {entry.answer}
                </p>
              </HoloCard>
            </ScrollReveal>
          ))}
        </div>
        <p className="text-uf-muted mt-6 text-xs leading-5">
          Structured data for this page:{" "}
          <span className="font-mono">{PAGE_URL}</span> — schema is generated
          from the same list rendered above, so it can never claim a review the
          page doesn&apos;t show.
        </p>
      </section>
    </SiteShell>
  );
}
