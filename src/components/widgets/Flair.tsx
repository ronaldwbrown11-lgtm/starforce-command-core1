// Paid-tier custom flair pill (#32) — rendered next to a member's name on
// profiles, story bylines, and comments. Visually distinct from the rank
// pill: gold-tinted with a lighter dot.
export function Flair({ label }: { label: string }) {
  return (
    <span
      className="uf-pill !text-[10px] !px-2 !py-0.5"
      style={{ color: "var(--uf-gold)", borderColor: "rgba(230,168,23,0.35)" }}
      title="Custom flair"
    >
      {label}
    </span>
  );
}
