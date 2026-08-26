import { useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { MapPin, Plus, Sparkles } from "lucide-react";

// Deterministic pseudo-random stars for the chart backdrop (no Math.random
// so the map is stable between renders).
function seeded(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Deterministic accent per index — same palette as the mini map widget.
const HUES = [
  { line: "rgba(0,229,255,0.55)", glow: "var(--uf-cyan)" },
  { line: "rgba(139,92,246,0.55)", glow: "var(--uf-violet)" },
  { line: "rgba(255,61,242,0.55)", glow: "var(--uf-magenta)" },
  { line: "rgba(230,168,23,0.55)", glow: "var(--uf-gold)" },
  { line: "rgba(45,255,136,0.55)", glow: "var(--uf-green)" },
  { line: "rgba(255,77,109,0.55)", glow: "var(--uf-red)" },
];

const FLEETS = [
  "Terran Reach",
  "Outer Belt",
  "Sol system-Gemini",
  "Darkspire Expanse",
  "Coreward",
];

// Anti-clutter limits.
const DRAW_CAP = 60; // only the most recent N charted systems are drawn
const CLUSTER_R = 22; // viewBox units — systems closer than this group together

type Discovery = {
  _id: string;
  title: string;
  description: string;
  x: number;
  y: number;
  sector: string | null;
  faction: string | null;
  createdAt: number;
  voteCount: number;
  myVote: boolean;
  author: { displayName: string; rank: string } | null;
};

type Cluster = { members: Discovery[]; cx: number; cy: number };

const LAYERS = [
  { key: "stars", label: "Starfield" },
  { key: "connections", label: "Connections" },
  { key: "sectors", label: "Canon sectors" },
  { key: "discoveries", label: "Member systems" },
] as const;

type LayerKey = (typeof LAYERS)[number]["key"];

export function DiscoveryMap({ height = 520 }: { height?: number }) {
  const { isAuthenticated } = useAuth();
  const sectors = useQuery(api.content.sectors);
  const discoveries = useQuery(api.discoveries.listDiscoveries);
  const missions = useQuery(api.content.listMissions, {});
  const propose = useMutation(api.discoveries.proposeDiscovery);
  const vote = useMutation(api.discoveries.voteDiscovery);

  const svgRef = useRef<SVGSVGElement>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposePos, setProposePos] = useState<{ x: number; y: number } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [detail, setDetail] = useState<Discovery | null>(null);
  const [clusterOpen, setClusterOpen] = useState<Cluster | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    stars: true,
    connections: true,
    sectors: true,
    discoveries: true,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [faction, setFaction] = useState("");
  const [missionId, setMissionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [voting, setVoting] = useState(false);

  const activeMissions = useMemo(
    () => (missions ?? []).filter((m) => m.missionStatus === "active"),
    [missions],
  );

  const loading = sectors === undefined || discoveries === undefined;

  const viewBox = useMemo(() => {
    if (!sectors || !sectors.length) return { vbX: -60, vbY: -60, vbW: 720, vbH: 440 };
    const xs = sectors.map((s) => s.x);
    const ys = sectors.map((s) => s.y);
    const pad = 80;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      vbX: minX - pad,
      vbY: minY - pad,
      vbW: Math.max(520, maxX - minX) + pad * 2,
      vbH: Math.max(340, maxY - minY) + pad * 2,
    };
  }, [sectors]);

  // Decorative starfield dots (stable across renders).
  const stars = useMemo(() => {
    const { vbX, vbY, vbW, vbH } = viewBox;
    return Array.from({ length: 70 }, (_, i) => ({
      x: vbX + seeded(i) * vbW,
      y: vbY + seeded(i * 2 + 1) * vbH,
      r: 0.6 + seeded(i * 3 + 2) * 1.4,
      o: 0.15 + seeded(i * 5 + 3) * 0.5,
    }));
  }, [viewBox]);

  // Greedy proximity clustering — systems closer than CLUSTER_R group into a
  // single node with a count, so dense regions never turn into a blob of text.
  const clusters = useMemo<Cluster[]>(() => {
    const list = (discoveries ?? []).slice(0, DRAW_CAP);
    const out: Cluster[] = [];
    for (const d of list) {
      let placed = false;
      for (const c of out) {
        if (Math.hypot(d.x - c.cx, d.y - c.cy) <= CLUSTER_R) {
          c.members.push(d);
          c.cx = c.members.reduce((s, m) => s + m.x, 0) / c.members.length;
          c.cy = c.members.reduce((s, m) => s + m.y, 0) / c.members.length;
          placed = true;
          break;
        }
      }
      if (!placed) out.push({ members: [d], cx: d.x, cy: d.y });
    }
    return out;
  }, [discoveries]);

  const total = discoveries?.length ?? 0;
  const capped = total > DRAW_CAP;

  const openProposeAt = (x: number, y: number) => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    setProposePos({ x: Math.round(x), y: Math.round(y) });
    setTitle("");
    setDescription("");
    setSector("");
    setFaction("");
    setMissionId("");
    setProposeOpen(true);
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    // Only clicks on the empty chart background reach here — node clicks
    // stop propagation first.
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    openProposeAt(p.x, p.y);
  };

  const submitProposal = async (e: FormEvent) => {
    e.preventDefault();
    if (!proposePos) return;
    if (!title.trim()) {
      toast.info("Name the system you discovered.");
      return;
    }
    setBusy(true);
    try {
      await propose({
        title: title.trim(),
        description: description.trim() || undefined,
        x: proposePos.x,
        y: proposePos.y,
        sector: sector || undefined,
        faction: faction || undefined,
        missionId: (missionId as any) || undefined,
      });
      toast.success("System proposed — the Bridge will review it.");
      setProposeOpen(false);
      setProposePos(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit the proposal.");
    } finally {
      setBusy(false);
    }
  };

  const isNew = (d: Discovery) => Date.now() - d.createdAt < 7 * 86_400_000;

  const clusterKey = (c: Cluster) => c.members.map((m) => m._id).join("|");
  const hoverKey = (c: Cluster) => (c.members.length === 1 ? c.members[0]._id : `cluster:${clusterKey(c)}`);

  if (loading) {
    return (
      <HoloCard>
        <div className="uf-skeleton" style={{ height }} />
      </HoloCard>
    );
  }

  return (
    <>
      <HoloCard>
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <span className="uf-eyebrow flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Charted space
            </span>
            <h2 className="text-xl mt-1">The Outer Rim — live survey chart</h2>
            <p className="text-uf-muted text-xs mt-1 max-w-[56ch]">
              Canon sectors are fixed; emerald nodes are systems charted by
              members. Clusters group nearby systems — click a node to read its
              survey, or click empty space to propose a discovery.
            </p>
          </div>
          <StatusPill variant="success">
            {total} member-charted
          </StatusPill>
        </header>

        <div
          className="relative overflow-hidden rounded-md"
          style={{
            background:
              "radial-gradient(closest-side at 50% 50%, rgba(0,229,255,0.08), transparent 70%), radial-gradient(closest-side at 20% 80%, rgba(139,92,246,0.06), transparent 70%), var(--uf-navy)",
            border: "1px solid var(--uf-border)",
            height,
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`${viewBox.vbX} ${viewBox.vbY} ${viewBox.vbW} ${viewBox.vbH}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full cursor-crosshair"
            role="img"
            aria-label="Interactive galaxy map. Click empty space to propose a system."
            onClick={handleSvgClick}
          >
            <title>Outer Rim survey chart</title>
            <desc>
              Interactive SVG of Star Force Base 1198 space. Canon sectors link
              to lore; member-charted systems show surveys. Click empty space
              to propose a new system.
            </desc>

            {/* Decorative starfield */}
            {layers.stars && (
              <g>
                {stars.map((s, i) => (
                  <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#bfe9ff" opacity={s.o} />
                ))}
              </g>
            )}

            {/* Connecting lines between canon sectors */}
            {layers.connections && (
              <g strokeLinecap="round">
                {(sectors ?? []).map((a, i) =>
                  (sectors ?? []).slice(i + 1).map((b, j) => {
                    const hue = HUES[(i + j) % HUES.length];
                    return (
                      <line
                        key={`${a._id}-${b._id}`}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={hue.line}
                        strokeWidth={0.8}
                      />
                    );
                  }),
                )}
              </g>
            )}

            {/* Canon sector nodes */}
            {layers.sectors && (
              <g>
                {(sectors ?? []).map((s, i) => {
                  const hue = HUES[i % HUES.length];
                  const r = Math.min(20, 6 + Math.sqrt(s.loreCount ?? 0) * 2);
                  const link = `/lore?sector=${encodeURIComponent(s.name)}`;
                  return (
                    <a
                      key={s._id}
                      href={link}
                      role="link"
                      aria-label={`Open ${s.name} lore (${s.loreCount ?? 0} entries)`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <circle cx={s.x} cy={s.y} r={r + 4} fill={hue.glow} fillOpacity={0.1} />
                      <circle cx={s.x} cy={s.y} r={r} fill={hue.glow} fillOpacity={0.25} stroke={hue.glow} strokeWidth={1.2} />
                      <circle cx={s.x} cy={s.y} r={2.5} fill={hue.glow} />
                      <text x={s.x} y={s.y + r + 12} fontSize={11} fill="var(--uf-text)" textAnchor="middle">
                        {s.name}
                      </text>
                      <text x={s.x} y={s.y + r + 24} fontSize={9} fill="var(--uf-muted)" textAnchor="middle">
                        {s.loreCount ?? 0} lore
                      </text>
                    </a>
                  );
                })}
              </g>
            )}

            {/* Member-charted discovery clusters */}
            {layers.discoveries && (
              <g>
                {clusters.map((c) => {
                  const single = c.members.length === 1;
                  const first = c.members[0];
                  const key = hoverKey(c);
                  const hovering = hoverId === key;
                  const label = single
                    ? first.title
                    : `${c.members.length} systems`;
                  return (
                    <g
                      key={key}
                      role="button"
                      tabIndex={0}
                      aria-label={label}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (single) setDetail(first);
                        else setClusterOpen(c);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          if (single) setDetail(first);
                          else setClusterOpen(c);
                        }
                      }}
                      onMouseEnter={() => setHoverId(key)}
                      onMouseLeave={() => setHoverId(null)}
                      onFocus={() => setHoverId(key)}
                      onBlur={() => setHoverId(null)}
                      style={{ cursor: "pointer" }}
                    >
                      <circle cx={c.cx} cy={c.cy} r={single ? 11 : 13} fill="rgba(80,255,160,0.12)" />
                      <circle
                        cx={c.cx}
                        cy={c.cy}
                        r={single ? 6.5 : 8}
                        fill="rgba(80,255,160,0.28)"
                        stroke="var(--uf-green)"
                        strokeWidth={1.4}
                      />
                      {/* crosshair */}
                      <line x1={c.cx - 3} y1={c.cy} x2={c.cx + 3} y2={c.cy} stroke="var(--uf-green)" strokeWidth={1} />
                      <line x1={c.cx} y1={c.cy - 3} x2={c.cx} y2={c.cy + 3} stroke="var(--uf-green)" strokeWidth={1} />
                      {!single && (
                        <text x={c.cx} y={c.cy + 3} fontSize={8} fill="var(--uf-green)" textAnchor="middle" fontWeight={700}>
                          {c.members.length}
                        </text>
                      )}
                      {/* Label only on hover/focus — keeps the chart uncluttered */}
                      {hovering && (
                        <g>
                          <rect
                            x={c.cx - 40}
                            y={c.cy - 30}
                            width={80}
                            height={16}
                            rx={4}
                            fill="rgba(5,8,22,0.85)"
                            stroke="rgba(80,255,160,0.5)"
                          />
                          <text x={c.cx} y={c.cy - 18} fontSize={9} fill="var(--uf-green)" textAnchor="middle" fontWeight={600}>
                            {label}
                          </text>
                          {single && isNew(first) && (
                            <text x={c.cx + 9} y={c.cy - 22} fontSize={7} fill="var(--uf-gold)" textAnchor="start" fontWeight={700}>
                              NEW
                            </text>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            )}
          </svg>

          {/* Floating propose hint */}
          <div className="absolute bottom-3 left-3 pointer-events-none">
            <span className="text-[10px] uppercase tracking-[0.16em] text-uf-muted bg-[rgba(5,8,22,0.7)] border border-[color:var(--uf-border)] rounded-full px-2.5 py-1">
              {isAuthenticated ? "Click empty space to chart a system" : "Sign in to chart a system"}
            </span>
          </div>
        </div>

        {/* Layer toggles + legend */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-uf-muted mr-1">Display:</span>
          {LAYERS.map((l) => (
            <button
              key={l.key}
              type="button"
              aria-pressed={layers[l.key]}
              onClick={() => setLayers((s) => ({ ...s, [l.key]: !s[l.key] }))}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                layers[l.key]
                  ? "border-[rgba(0,229,255,0.5)] bg-[rgba(0,229,255,0.1)] text-uf-text"
                  : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] text-uf-muted hover:text-uf-text"
              }`}
            >
              {l.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-uf-muted">
            {capped ? `Showing latest ${DRAW_CAP} of ${total} charted systems. ` : ""}
            Labels appear on hover.
          </span>
        </div>

        {/* How it works */}
        <div className="mt-4 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] p-4">
          <p className="uf-eyebrow">How charting works</p>
          <ol className="list-decimal list-inside text-sm text-uf-muted mt-2 space-y-1">
            <li>Click any empty region of the chart.</li>
            <li>Name the system and describe what your survey found.</li>
            <li>The Bridge reviews your proposal — approved systems are charted and award <span className="text-[var(--uf-green)]">+25 XP</span>.</li>
          </ol>
        </div>
      </HoloCard>

      {/* Propose dialog */}
      <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chart a new system</DialogTitle>
            <DialogDescription>
              Position ({proposePos?.x ?? 0}, {proposePos?.y ?? 0}) — your survey will be reviewed by the Bridge.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitProposal} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-uf-muted">System name</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                placeholder="e.g. Kestrel Run"
                className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-uf-muted">Survey notes</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={400}
                rows={3}
                placeholder="What did your survey find? Wrecks, signals, hazards, what you propose to call the region…"
                className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Nearest sector</span>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
                >
                  <option value="">None / deep space</option>
                  {(sectors ?? []).map((s) => (
                    <option key={s._id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Claiming faction</span>
                <select
                  value={faction}
                  onChange={(e) => setFaction(e.target.value)}
                  className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
                >
                  <option value="">No claim</option>
                  {FLEETS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-uf-muted">Related operation <span className="text-uf-muted/60">(optional)</span></span>
              <select
                value={missionId}
                onChange={(e) => setMissionId(e.target.value)}
                className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
              >
                <option value="">Independent survey</option>
                {activeMissions.map((m) => (
                  <option key={m._id} value={m._id}>{m.title} (+{m.xpReward ?? 0} XP)</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 mt-1">
              <NeonButton variant="ghost" type="button" onClick={() => setProposeOpen(false)}>
                Cancel
              </NeonButton>
              <NeonButton variant="primary" type="submit" loading={busy}>
                <MapPin className="h-4 w-4 mr-1.5" aria-hidden />
                Submit survey
              </NeonButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sign-in prompt */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in to chart</DialogTitle>
            <DialogDescription>
              Only fleet members can propose surveys. It takes a minute — and approved systems earn XP.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <NeonButton variant="ghost" onClick={() => setAuthOpen(false)}>Close</NeonButton>
            <Link to="/auth?returnTo=/map">
              <NeonButton variant="primary">
                <Plus className="h-4 w-4 mr-1.5" aria-hidden />
                Sign in
              </NeonButton>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discovery detail */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>
              Charted {detail ? new Date(detail.createdAt).toLocaleDateString() : ""} by{" "}
              {detail?.author?.displayName ?? "unknown"} · {detail?.author?.rank ?? "Recruit"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {detail?.sector && (
              <p className="text-sm text-uf-muted">
                Nearest sector: <span className="text-uf-text">{detail.sector}</span>
              </p>
            )}
            {detail?.faction && (
              <p className="text-sm text-uf-muted">
                Claiming faction: <span className="text-uf-text">{detail.faction}</span>
              </p>
            )}
            <p className="text-sm text-uf-text/90">{detail?.description || "No survey notes filed."}</p>
            {detail && isNew(detail) && (
              <StatusPill variant="success">Recently charted</StatusPill>
            )}
            <div className="mt-1 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                disabled={voting || !isAuthenticated}
                onClick={async () => {
                  if (!detail || voting) return;
                  setVoting(true);
                  try {
                    const res = await vote({ id: detail._id as any });
                    setDetail({
                      ...detail,
                      voteCount: detail.voteCount + (res.voted ? 1 : -1),
                      myVote: res.voted,
                    });
                    toast.success(res.voted ? "Endorsement logged." : "Endorsement withdrawn.");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Couldn't vote.");
                  } finally {
                    setVoting(false);
                  }
                }}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  detail?.myVote
                    ? "border-[rgba(0,229,255,0.6)] bg-[rgba(0,229,255,0.12)] text-uf-cyan"
                    : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] text-uf-muted hover:text-uf-text"
                }`}
              >
                {detail?.myVote ? "✦ Endorsed" : "✦ Endorse this survey"}
                <span className="ml-1.5 opacity-80">({detail?.voteCount ?? 0})</span>
              </button>
              {!isAuthenticated && (
                <Link to="/auth?returnTo=/maps" className="text-xs text-uf-cyan underline">
                  Sign in to endorse
                </Link>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cluster list */}
      <Dialog open={clusterOpen !== null} onOpenChange={(o) => !o && setClusterOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Charted systems in this region</DialogTitle>
            <DialogDescription>
              {clusterOpen?.members.length ?? 0} surveys grouped here — click one for details.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2 list-none p-0 m-0 max-h-72 overflow-y-auto">
            {(clusterOpen?.members ?? []).map((m) => (
              <li key={m._id}>
                <button
                  type="button"
                  onClick={() => {
                    setClusterOpen(null);
                    setDetail(m);
                  }}
                  className="w-full text-left rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] px-3 py-2 hover:border-[rgba(0,229,255,0.4)] transition-colors"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-uf-text">{m.title}</span>
                    <span className="text-[11px] text-uf-muted">
                      {m.author?.displayName ?? "unknown"} · {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="block text-xs text-uf-muted mt-0.5 line-clamp-1">
                    {m.description || "No survey notes filed."}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
