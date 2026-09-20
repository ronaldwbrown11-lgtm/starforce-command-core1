// Generates public/downloads/starforce-growth-plan.pdf — a text-only,
// print-ready PDF of the six-month growth plan. Run:
//   bun scripts/generate-growth-plan.mjs
// Output is committed so it ships with the site; re-run when the plan changes.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUT = "public/downloads/starforce-growth-plan.pdf";

const PAGES = [
  {
    heading: "Star Force Base 1198",
    sub: "Six-Month Growth Plan — Star Credits & the Requisition Depot",
    lines: [
      "",
      "COMMAND INTENT",
      "Grow Star Credits into the economic engine of the base: every member",
      "earns through contribution, spends on identity, and returns weekly for",
      "the rotation. Real money buys credit caches; credits never buy power.",
      "",
      "PHASE SCHEDULE AT A GLANCE",
      "  Phase 1  Months 1-2   Make the economy real",
      "  Phase 2  Months 2-3   Social spending",
      "  Phase 3  Months 3-4   Recurring events drive demand",
      "  Phase 4  Months 4-5   Premium & creators",
      "  Phase 5  Month 6      Polish & scale",
      "",
      "Status legend: [SHIPPED] live on the base  -  [NEXT] scheduled  -",
      "[OPS] operator-managed, no code required.",
      "",
      "Standing rules:",
      "  1. Credits buy cosmetics, boosts, and access - never moderation",
      "     influence, story approval, or rank.",
      "  2. Every grant and spend is audit-logged.",
      "  3. Purchased caches grant exactly their face value - no surge.",
      "  4. Rotation items always return; nothing is permanently retired.",
    ],
  },
  {
    heading: "Phase 1 - Months 1-2",
    sub: "Make the economy real",
    lines: [
      "[SHIPPED] Cosmetic Lab expansion: three departments - Frames (250-500",
      "          credits), Titles (300-900, incl. two command-award-only",
      "          mission lines), Boosts (XP Surge 500, Credit Surge 750).",
      "[SHIPPED] Full-card frame rendering on Account, Profile, and the",
      "          header badge - purchases dress the whole card.",
      "[SHIPPED] Weekly rotation shelf: one frame + one title spotlighted per",
      "          ISO week, deterministic fleet-wide.",
      "[SHIPPED] Operator credit adjustment panel with audit trail.",
      "[SHIPPED] Star Credit caches in the Requisition Depot (kind: credits):",
      "          operators publish caches from the console; checkout + webhook",
      "          grant exact face value, audit-logged. Suggested: 500 @ $4.99,",
      "          1,200 @ $9.99, 2,600 @ $19.99.",
      "[NEXT]    Aspirational deep-sink item at 5,000+ credits so veterans",
      "          always have a goal.",
      "[OPS]     Configure cache prices and seasonal cosmetics in the",
      "          operator Store manager.",
    ],
  },
  {
    heading: "Phase 2 - Months 2-3",
    sub: "Social spending",
    lines: [
      "[NEXT] Credit gifting and tipping on stories and lore - authors earn",
      "       from fans; instant creator economy.",
      "[NEXT] Profile display cases: show off owned cosmetics and trophies.",
      "[NEXT] Group treasuries: pooled credits unlock group banners, titles,",
      "       and perks.",
      "[OPS]  Feature tipped authors on the front page weekly.",
    ],
  },
  {
    heading: "Phase 3 - Months 3-4",
    sub: "Recurring events drive demand",
    lines: [
      "[NEXT] Seasonal Cosmetic Pass: limited-edition frames and titles each",
      "       season; numbered editions for prestige.",
      "[NEXT] Weekly contest entry fees (credits) with merch prize pools from",
      "       the depot.",
      "[NEXT] Base-wide community goals: pooled credit contributions unlock",
      "       canon content - a new lore chapter, a sector reveal.",
      "[OPS]  Schedule contests and events from the operator console.",
    ],
  },
  {
    heading: "Phase 4 - Months 4-5",
    sub: "Premium & creators",
    lines: [
      "[NEXT] Lore rentals: 48-hour access to tier-gated archive content -",
      "       the bridge between free and paid membership.",
      "[NEXT] Creator program: members sell custom lore bibles and art",
      "       through the depot; the base takes a revenue share.",
      "[NEXT] ARG campaigns with credit bounties on solved ciphers.",
      "[OPS]  Vet creator applications; approve listings before they go live.",
    ],
  },
  {
    heading: "Phase 5 - Month 6",
    sub: "Polish & scale",
    lines: [
      "[NEXT] Credit economy dashboard in the operator console: earn/spend",
      "       charts, inflation monitoring, faucet-vs-sink balance.",
      "[NEXT] Achievement-linked cosmetics: milestone frames earned, not",
      "       bought.",
      "[NEXT] Referral rewards: credits for recruiting members who stay",
      "       active.",
      "",
      "ECONOMY HYGIENE (STANDING POLICY)",
      "  - Daily ceiling on comment earnings to prevent farming.",
      "  - One or two aspirational sinks at 5,000-10,000 credits.",
      "  - Boosts and speed are purchasable; votes, approvals, and rank are",
      "    not.",
      "  - Purchased credits are exact; earned credits can surge.",
    ],
  },
  {
    heading: "Appendix - Credit rates & catalog",
    sub: "Reference sheet",
    lines: [
      "EARNING (the faucet)",
      "  Published story          100 credits",
      "  Approved lore entry       25 credits",
      "  Certified discovery       25 credits",
      "  Mission report            10 credits",
      "  Comment                    5 credits (daily-capped)",
      "",
      "SPENDING (the sinks)",
      "  Frames:  Ion 250 - Void 350 - Terra 400 - Admiral 500",
      "  Titles:  Signal Warden 300 - Void Cartographer 450 -",
      "           Starforge Smith 450 - Keeper of the Deep Canon 900",
      "           Fleet Honor / Signal Legend: command award only",
      "  Boosts:  XP Surge 500 (2x XP, 24h) - Credit Surge 750 (2x, 24h)",
      "",
      "RANKS (XP)",
      "  Recruit 0 - Aspirant 500 - Pilot 1,500 - Commander 4,000 -",
      "  Captain 9,000 - Admiral 20,000",
      "",
      "TIER XP MULTIPLIERS",
      "  Free 1.0 - Cadet 1.25 - Officer 1.5 - Command 2.0 - Elite 2.5 -",
      "  G.I.A. Agent 3.0 (owner account: unlimited usage bypass)",
      "",
      "Issued by Command, Star Force Base 1198 - starforcebase1198.com",
      "This document ships with the base and updates with the catalog.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Minimal PDF writer — text-only, Helvetica, letter-size pages. Valid PDF
// 1.4 with correct xref offsets; opens in any viewer and prints cleanly.
// ---------------------------------------------------------------------------

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const PAGE_W = 612; // letter, points
const PAGE_H = 792;
const MARGIN = 64;
const LINE_H = 17;

const contents = PAGES.map((p) => {
  const parts = [];
  // Heading
  parts.push("BT /F2 20 Tf");
  parts.push(`1 0 0 1 ${MARGIN} ${PAGE_H - MARGIN - 8} Tm`);
  parts.push(`(${esc(p.heading)}) Tj ET`);
  // Subheading
  parts.push("BT /F1 11.5 Tf");
  parts.push(`1 0 0 1 ${MARGIN} ${PAGE_H - MARGIN - 30} Tm`);
  parts.push(`(${esc(p.sub)}) Tj ET`);
  // Rule
  parts.push("0.53 0.66 1 RG 0.8 w");
  parts.push(`${MARGIN} ${PAGE_H - MARGIN - 40} m ${PAGE_W - MARGIN} ${PAGE_H - MARGIN - 40} l S`);
  // Body lines
  parts.push("BT /F1 10.5 Tf");
  let y = PAGE_H - MARGIN - 62;
  for (const line of p.lines) {
    if (y < MARGIN + 40) break; // safety: never overflow the page
    parts.push(`1 0 0 1 ${MARGIN} ${y} Tm (${esc(line)}) Tj`);
    y -= LINE_H;
  }
  parts.push("ET");
  // Footer page number
  parts.push("BT /F1 8.5 Tf");
  parts.push(`1 0 0 1 ${MARGIN} ${MARGIN - 24} Tm`);
  return parts.join("\n");
});

const n = PAGES.length;
const kids = Array.from({ length: n }, (_, i) => `${4 + i * 2} 0 R`).join(" ");

const objects = [];
objects.push("<< /Type /Catalog /Pages 2 0 R >>");
objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
// Page objects + content streams interleave from object 4.
PAGES.forEach((p, i) => {
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 ${3 + n * 2 + 1} 0 R >> >> ` +
      `/Contents ${5 + i * 2} 0 R >>`,
  );
  objects.push(`<< /Length ${Buffer.byteLength(contents[i])} >>\nstream\n${contents[i]}\nendstream`);
});
objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xrefStart = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) {
  pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, pdf, "latin1");
console.log(`Wrote ${OUT} (${PAGES.length} pages, ${pdf.length} bytes)`);
