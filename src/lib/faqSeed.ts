// Canonical FAQ seed library — the comprehensive question set for the base.
// Used two ways:
//  1. `seedDefaults` (Operator → FAQs) inserts any missing item, idempotent
//     by category + question — it never overwrites operator edits.
//  2. `listPublished` falls back to serving the catalog read-only when the
//     table has no published rows, so the public page is never empty.
// Facts are kept in lockstep with the product: tier pricing in tiers.ts,
// rank thresholds in PilotOnboarding, ship rules in ships.ts, and the
// Stripe checkout / billing-portal flow in convex/stripe.ts.

export const FAQ_CATEGORY_KEYS = [
  "general",
  "membership",
  "content",
  "technical",
  "account",
] as const;

export type FaqCategory = (typeof FAQ_CATEGORY_KEYS)[number];

export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  general: "General",
  membership: "Membership",
  content: "Content & Submissions",
  technical: "Technical",
  account: "Account",
};

export type FaqSeed = {
  category: FaqCategory;
  question: string;
  answer: string;
};

export const FAQ_SEED: FaqSeed[] = [
  // ------------------------------------------------------------------ General
  {
    category: "general",
    question: "What is Star Force Base 1198?",
    answer:
      "The official community hub for the Ultra Force universe — a home base for reading and writing canon stories, exploring lore and the sector atlas, tracking the fleet registry, decoding Signal Vault transmissions, and serving alongside the rest of the fleet in groups, events, and missions.",
  },
  {
    category: "general",
    question: "Is Star Force Base 1198 free to join?",
    answer:
      "Yes. A free account unlocks the whole community: groups, the activity feed, missions, ship assignment, story submissions, and reading open lore. Paid tiers add creator allowances and prestige perks — they never gate the core experience.",
  },
  {
    category: "general",
    question: "Who runs the base?",
    answer:
      "A small operations team of commanders and senior operators. Every story approval, moderation action, and broadcast happens through the Operator Console, and every action is written to an audit trail — so if a decision affects your content, there's a record of it.",
  },
  {
    category: "general",
    question: "How do I join the fleet?",
    answer:
      "Choose a membership (Free is fine) and sign in with your email. You'll complete Pilot Orientation — callsign, starting rank, fleet affiliation, and your starship assignment — and then the Cadet Induction quest walks you through your first objectives at your own pace.",
  },
  {
    category: "general",
    question: "Is there an official Discord?",
    answer:
      "Yes — the fleet's Discord mirrors official announcements posted on the base, so major updates reach both channels at once. You'll find the invite link in the site footer alongside our other social channels.",
  },
  {
    category: "general",
    question: "What is the weekly canon digest?",
    answer:
      "A once-a-week email recapping newly published stories, lore, transmissions, and upcoming operations — the fastest way to stay current without watching the feed. It's sent to members with a verified email address.",
  },
  {
    category: "general",
    question: "Something isn't working. Where do I report it?",
    answer:
      "Use the Contact Support page — messages land directly in the operators' support inbox and are answered there. For content issues (a story, a comment, a member), use the report controls on the content itself so it reaches the moderation queue with context attached.",
  },

  // --------------------------------------------------------------- Membership
  {
    category: "membership",
    question: "What membership tiers are available?",
    answer:
      "Free, Cadet ($5/mo), Officer ($12/mo), Command ($19/mo), Elite ($25/mo), and G.I.A. Agent ($49/mo). Every tier is a monthly subscription handled by Stripe — the full benefit comparison lives on the Membership page.",
  },
  {
    category: "membership",
    question: "What do paid tiers actually unlock?",
    answer:
      "Prestige and creator firepower, not basic access. Paid tiers earn XP faster at every award point, unlock tier-exclusive badge lineages and profile flair, raise storage and monthly AI-generation allowances, and add priority featured placement. Command and above add clearance for restricted vault ciphers and the ability to host fleet events. Elite adds early access to story drops, JSON dossier export of your service record, and the full custom-flair workshop.",
  },
  {
    category: "membership",
    question: "How do payments work?",
    answer:
      "Checkout runs on Stripe's hosted page — your card details go straight to Stripe and never touch our servers. Subscriptions renew monthly, and the customer billing portal linked from the Membership page lets you update your card, view invoices, or cancel.",
  },
  {
    category: "membership",
    question: "How do I cancel or change my tier?",
    answer:
      "Two ways: the Downgrade / tier buttons on the Membership page, or the Stripe billing portal. Choosing a different tier moves your subscription to the new plan; downgrading takes effect immediately and reverts your account to Free.",
  },
  {
    category: "membership",
    question: "Will I lose progress if I cancel?",
    answer:
      "No. XP, rank, badges, Star Credits, ship assignment, mission logs, and published content all stay exactly as they are. Only the tier perks — multipliers, flair presets, clearance gates, and allowances — pause while you're on Free.",
  },
  {
    category: "membership",
    question: "What are XP multipliers?",
    answer:
      "Every paid tier earns XP faster — the bonus applies automatically at every award point: missions, quests, contests, ciphers, and community activity alike. The higher your tier, the larger the multiplier, and it's applied on the server so it's always counted fairly.",
  },
  {
    category: "membership",
    question: "What does Command clearance unlock?",
    answer:
      "Command, Elite, and G.I.A. members get clearance for locked Signal Vault ciphers and can propose fleet events for the public calendar (subject to operator approval). Locked ciphers render as sealed transmissions until your clearance covers them.",
  },
  {
    category: "membership",
    question: "What makes Elite different from Command?",
    answer:
      "Elite is the first-class deck: story drops reach you before general release, you can export your full service dossier as a JSON record, and the complete custom-flair workshop opens up. Command includes everything below it; Elite stacks early access and export on top.",
  },

  // ------------------------------------------------------ Content & Submissions
  {
    category: "content",
    question: "How do I submit a story?",
    answer:
      "From the Stories page, open the submission form and file your draft — title, cover, and body. It enters the Story Approval queue, and once an operator clears it, the story publishes to the fleet under your byline.",
  },
  {
    category: "content",
    question: "What happens during review?",
    answer:
      "Operators check canon fit, formatting, and content guidelines — usually within a few days. If edits are needed, your submission stays in the queue with notes; approved stories go live immediately and can be flagged for featured placement.",
  },
  {
    category: "content",
    question: "What kinds of content can I contribute?",
    answer:
      "Canon-friendly stories, lore entries for the Library, artwork, sector discoveries for the atlas, fleet reports, podcast transmissions, and contest entries. If it builds the Ultra Force universe, there's a place for it.",
  },
  {
    category: "content",
    question: "How do lore contests work?",
    answer:
      "The fleet runs member-created lore contests with a prompt, a submission window, and a voting phase. Winners earn XP, Star Credits, and featured placement — check the Contests page for the current cycle and deadlines.",
  },
  {
    category: "content",
    question: "How do ship missions work?",
    answer:
      "Once you've assigned a starship, Mission Intelligence generates themed briefings for your hull class — each with its own difficulty, rewards, and tags. Logging a completed run banks the XP and Star Credits, and your progress is tracked per ship class.",
  },
  {
    category: "content",
    question: "What is the Signal Vault?",
    answer:
      "The vault holds encrypted canon transmissions — decode a cipher to bank the XP and Star Credits inside. Signals are organized into seasonal ARG campaigns, so each season's decodings compound into the next chapter of the story.",
  },
  {
    category: "content",
    question: "Why are some vault ciphers locked?",
    answer:
      "Some transmissions are clearance-gated to Command tier and above — they render as sealed cards until your membership covers the requirement. Free and lower tiers still see the full catalog of open signals.",
  },
  {
    category: "content",
    question: "Can members host events?",
    answer:
      "Yes — Command-tier members and above can submit operations to the events calendar. Proposals appear publicly once an operator approves them, keeping the schedule canon-focused. During live operations, the Community page carries an “operation active” banner.",
  },
  {
    category: "content",
    question: "Who owns what I submit?",
    answer:
      "You do. Submitting grants the base a license to display and feature the work in the community; attribution stays with you everywhere it appears. Please don't submit others' work — the approval queue screens for it.",
  },

  // ---------------------------------------------------------------- Technical
  {
    category: "technical",
    question: "Which browsers are supported?",
    answer:
      "Any modern browser — current versions of Chrome, Edge, Firefox, and Safari on desktop and mobile. The base is a single-page app, so keep JavaScript enabled.",
  },
  {
    category: "technical",
    question: "Is there a mobile app?",
    answer:
      "There's no store app, but the site is a full PWA: in your phone's browser, choose “Add to Home Screen” and the base launches like an app, with its own icon and full-screen layout.",
  },
  {
    category: "technical",
    question: "Can I read offline?",
    answer:
      "Yes — the app caches articles as you open them (stories, lore, maps, the vault, missions, and resources). If you lose connection, anything you've already read stays available, and the app shell always loads fresh so you're never stranded on a stale version.",
  },
  {
    category: "technical",
    question: "Is the site real-time?",
    answer:
      "Live elements like the activity feed, sector chatter, and presence counters update on a short polling cadence rather than instant push — numbers may lag a few seconds behind the fleet. It keeps the base fast and battery-friendly.",
  },
  {
    category: "technical",
    question: "Why did my session end?",
    answer:
      "Sessions expire after a period of inactivity for security. Just sign in again with your email — your work is saved server-side, so nothing is lost.",
  },
  {
    category: "technical",
    question: "Emails from the base aren't arriving.",
    answer:
      "Check spam or promotions folders first and add our sender address to your contacts. Sign-in codes normally arrive within a minute; if they or the weekly digest never arrive, contact support and the operators will check the mail pipeline for your address.",
  },
  {
    category: "technical",
    question: "Is my payment information safe?",
    answer:
      "Payments run entirely through Stripe — we never see or store card numbers. The site records only your subscription tier and your Stripe customer reference, and every billing change happens on Stripe's hosted pages.",
  },
  {
    category: "technical",
    question: "The page looks broken or blank.",
    answer:
      "Hard-refresh the page (Ctrl/Cmd+Shift+R). The app ships fresh bundles on every deploy, and a stale cached script is almost always the cause. If it persists, note which page you were on and contact support.",
  },

  // ------------------------------------------------------------------ Account
  {
    category: "account",
    question: "How do I sign in?",
    answer:
      "With your email — no passwords. Enter your address on the sign-in page and we send a one-time code; enter it and you're aboard. The same flow creates your account if you're new.",
  },
  {
    category: "account",
    question: "I didn't receive my sign-in code.",
    answer:
      "Wait a full minute and request it again — codes are single-use and expire quickly. Check spam first; if two attempts both fail, contact support so operators can check the mail pipeline for your address.",
  },
  {
    category: "account",
    question: "What happens during Pilot Orientation?",
    answer:
      "Orientation is a one-time setup: choose a callsign, a starting rank, and a fleet affiliation, optionally pick a starter operation, and assign your starship through the six-step wizard. Everything is optional and editable later from your Account page.",
  },
  {
    category: "account",
    question: "What is the Cadet Induction quest?",
    answer:
      "Your guided first mission: join a group, react to a story, file a report, earn your first badge, set up your profile, and assign your starship. Completing it shows you where everything lives — and pays out XP and Star Credits along the way.",
  },
  {
    category: "account",
    question: "How do XP and ranks work?",
    answer:
      "You earn XP from quests, missions, contests, ciphers, and community activity. Ranks climb automatically: Recruit, then Aspirant at 500 XP, Pilot at 1,500, Commander at 4,000, Captain at 9,000, and Admiral at 20,000. Paid tiers climb faster via their XP multipliers.",
  },
  {
    category: "account",
    question: "What are Star Credits?",
    answer:
      "The fleet's merit currency, earned from missions, contest wins, and decoded vault ciphers. Your balance lives on your Account page next to your XP, and standings show on the leaderboard.",
  },
  {
    category: "account",
    question: "Can I change my ship later?",
    answer:
      "Anytime — open your Account page and use the ship controls to run the assignment wizard again. Switching hulls never resets progress: mission logs are tracked per ship class, so returning to a class restores exactly where you left off.",
  },
  {
    category: "account",
    question: "How do badges and flair work?",
    answer:
      "Badges are earned achievements — first flight, lore contributor, contest wins, tier promotions — and appear on your profile automatically. Flair is self-expression: free members get the standard presets, paid tiers unlock tier-flavored call-sign flair, and Elite opens the full custom workshop.",
  },
  {
    category: "account",
    question: "Can I verify my identity or delete my account?",
    answer:
      "Operators can run identity verification on request — start from Support and mention verification. To delete your account and data, contact support; you can choose whether published stories come down or stay up with your attribution.",
  },
];
