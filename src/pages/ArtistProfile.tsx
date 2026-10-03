import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  SiteShell,
  PageHero,
  HoloCard,
  NeonButton,
  StatusPill,
} from "@/components/uf";
import {
  AssetGrid,
  type VisualAssetDoc,
} from "@/components/visuals/AssetGrid";
import { FullScreenViewer } from "@/components/visuals/FullScreenViewer";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Camera, Pencil, Save, Users } from "lucide-react";

// =========================================================================
// Artist Profiles — /artists (roster) and /artists/:id (profile).
// Portfolio gallery, featured works, canon contributions, social links,
// commission availability, and a self-service profile editor.
//
// FUTURE FEATURE — DO NOT IMPLEMENT IN THIS BUILD:
//   collaborative galleries and shared portfolio workspaces.
// =========================================================================

export default function ArtistProfile() {
  const { id } = useParams<{ id: string }>();
  usePageMeta({
    title: id
      ? "Artist Profile — Star Force Base 1198"
      : "Fleet Artists — Star Force Base 1198",
    description:
      "Artist profiles, portfolios, and canon visual contributions of the Ultra Force.",
  });

  const { isAuthenticated, user } = useAuth();
  const roster = useQuery(api.visuals.listArtists, id ? "skip" : {});
  const profile = useQuery(
    api.visuals.artistProfile,
    id ? { userId: id as Id<"users"> } : "skip",
  );
  const myProfile = useQuery(api.visuals.myArtistProfile, {});
  const upsert = useMutation(api.visuals.upsertArtistProfile);

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<VisualAssetDoc | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    mediums: "",
    commission: false,
    photoAssetId: "",
    links: [
      { label: "", url: "" },
      { label: "", url: "" },
      { label: "", url: "" },
    ],
  });
  // Asset picker for the profile photo (my own artwork only).
  const myAssets = useQuery(
    api.visuals.listAssets,
    isAuthenticated && editing ? { mine: true } : "skip",
  );

  useEffect(() => {
    if (!myProfile) return;
    const links = [...myProfile.socialLinks];
    while (links.length < 3) links.push({ label: "", url: "" });
    setForm({
      displayName: myProfile.displayName,
      bio: myProfile.bio ?? "",
      mediums: myProfile.mediums ?? "",
      commission: myProfile.commissionAvailable,
      photoAssetId: myProfile.photoAssetId ?? "",
      links: links.slice(0, 3).map((l) => ({ label: l.label, url: l.url })),
    });
  }, [myProfile]);

  async function saveProfile() {
    if (!form.displayName.trim()) {
      toast.error("A display name is required.");
      return;
    }
    setBusy(true);
    try {
      await upsert({
        displayName: form.displayName.trim(),
        bio: form.bio || undefined,
        mediums: form.mediums || undefined,
        commissionAvailable: form.commission,
        photoAssetId: form.photoAssetId
          ? (form.photoAssetId as Id<"visualAssets">)
          : undefined,
        socialLinks: form.links.filter((l) => l.url.trim()),
      });
      toast.success("Artist profile saved.");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const editor = (
    <HoloCard className="sf-glass">
      <div className="flex items-center gap-2 mb-3">
        <Pencil className="h-4 w-4 text-uf-cyan" aria-hidden />
        <h2 className="sf-head text-lg font-semibold">Edit your profile</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Profile photo
          <select
            value={form.photoAssetId}
            onChange={(e) =>
              setForm((f) => ({ ...f, photoAssetId: e.target.value }))
            }
            className="sf-select w-full rounded-md px-3 py-2 text-sm"
          >
            <option value="">— none —</option>
            {(myAssets ?? []).map((a) => (
              <option key={a._id} value={a._id}>
                {a.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Display name *
          <input
            value={form.displayName}
            onChange={(e) =>
              setForm((f) => ({ ...f, displayName: e.target.value }))
            }
            maxLength={60}
            className="sf-input w-full rounded-md px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Mediums
          <input
            value={form.mediums}
            onChange={(e) => setForm((f) => ({ ...f, mediums: e.target.value }))}
            maxLength={200}
            placeholder="Digital, ink, painting…"
            className="sf-input w-full rounded-md px-3 py-2 text-sm"
          />
        </label>
        <label className="sm:col-span-2 text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Bio
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            rows={3}
            maxLength={1200}
            className="sf-input w-full rounded-md px-3 py-2 text-sm"
          />
        </label>
        {form.links.map((l, i) => (
          <div key={i} className="contents">
            <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
              Link {i + 1} label
              <input
                value={l.label}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    links: f.links.map((x, idx) =>
                      idx === i ? { ...x, label: e.target.value } : x,
                    ),
                  }))
                }
                maxLength={40}
                placeholder="Portfolio"
                className="sf-input w-full rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
              URL
              <input
                value={l.url}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    links: f.links.map((x, idx) =>
                      idx === i ? { ...x, url: e.target.value } : x,
                    ),
                  }))
                }
                maxLength={300}
                placeholder="https://…"
                className="sf-input w-full rounded-md px-3 py-2 text-sm"
              />
            </label>
          </div>
        ))}
        <label className="sm:col-span-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] sf-label">
          <input
            type="checkbox"
            checked={form.commission}
            onChange={(e) =>
              setForm((f) => ({ ...f, commission: e.target.checked }))
            }
            className="h-4 w-4 accent-[color:var(--uf-gold)]"
          />
          Available for commissions
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <NeonButton
          variant="gold"
          onClick={() => void saveProfile()}
          loading={busy}
          disabled={busy}
        >
          <Save className="h-4 w-4" aria-hidden /> Save profile
        </NeonButton>
        <NeonButton variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </NeonButton>
      </div>
    </HoloCard>
  );

  // ---------------------------------------------------------------------
  // Roster — /artists
  // ---------------------------------------------------------------------
  if (!id) {
    return (
      <SiteShell>
        <PageHero
          eyebrow="Visual creation"
          title="Fleet Artists"
          lead="Every artist carrying a portfolio in the canon — credits, commissions, and canon contributions."
          primary={
            isAuthenticated
              ? {
                  label: myProfile ? "Edit my profile" : "Create artist profile",
                  href: "#edit",
                  variant: "primary",
                }
              : { label: "Sign in to join", href: "/auth?returnTo=/artists", variant: "primary" }
          }
          secondary={{ label: "Canon Image Library", href: "/canon-images", variant: "ghost" }}
        />
        <section
          className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12"
          id="edit"
        >
          {isAuthenticated && editing ? <div className="mb-8">{editor}</div> : null}
          {roster === undefined ? (
            <div className="uf-grid uf-grid--3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="uf-skeleton" style={{ height: 180 }} />
              ))}
            </div>
          ) : roster.length === 0 ? (
            <div className="uf-empty">
              No artist profiles yet —{" "}
              {isAuthenticated ? (
                <button
                  type="button"
                  className="text-uf-cyan underline"
                  onClick={() => setEditing(true)}
                >
                  create the first one
                </button>
              ) : (
                <Link to="/auth?returnTo=/artists" className="text-uf-cyan underline">
                  sign in to create one
                </Link>
              )}
              .
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roster.map((a) => (
                <Link
                  key={a.userId}
                  to={`/artists/${a.userId}`}
                  className="sf-panel-in rounded-[14px] p-[3px] transition-transform hover:-translate-y-0.5"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255,244,200,0.45) 0%, rgba(255,255,255,0) 35%, rgba(90,60,10,0.28) 100%)",
                    backgroundSize: "100% 100%",
                  }}
                >
                  <div className="sf-glass rounded-[11px] p-4 flex items-center gap-3">
                    {a.photoUrl ? (
                      <img
                        src={a.photoUrl}
                        alt=""
                        className="h-14 w-14 rounded-md object-cover border border-[rgba(230,168,23,0.45)]"
                      />
                    ) : (
                      <span className="h-14 w-14 rounded-md grid place-items-center border border-[color:var(--uf-border)] bg-[rgba(2,11,26,0.5)]">
                        <Users className="h-6 w-6 text-uf-cyan" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{a.displayName}</p>
                      <p className="text-uf-muted text-xs">
                        {a.approvedCount} canon piece
                        {a.approvedCount === 1 ? "" : "s"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {a.commissionAvailable ? (
                          <StatusPill variant="success">commissions open</StatusPill>
                        ) : null}
                        {a.mediums ? (
                          <StatusPill variant="info">{a.mediums}</StatusPill>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {/* FUTURE FEATURE — DO NOT IMPLEMENT IN THIS BUILD: collaborative galleries */}
        </section>
      </SiteShell>
    );
  }

  // ---------------------------------------------------------------------
  // Profile — /artists/:id
  // ---------------------------------------------------------------------
  const data = profile;
  const isOwn = !!user && user._id === id;

  return (
    <SiteShell>
      <PageHero
        eyebrow="Artist profile"
        title={data?.displayName ?? "Loading artist…"}
        lead={
          data?.profile?.bio ??
          "Portfolio, credits, and canon contributions."
        }
        primary={
          isOwn
            ? {
                label: editing ? "Close editor" : "Edit profile",
                href: "#edit",
                variant: "primary",
              }
            : { label: "All artists", href: "/artists", variant: "primary" }
        }
        secondary={{ label: "Canon Image Library", href: "/canon-images", variant: "ghost" }}
      />

      <section
        className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12"
        id="edit"
      >
        {/* Gold-plate profile header */}
        <div className="rounded-[16px] p-[3px] mb-8"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(255,244,200,0.5) 0%, rgba(255,255,255,0) 35%, rgba(90,60,10,0.3) 100%)",
            backgroundSize: "100% 100%",
          }}
        >
          <HoloCard className="sf-glass">
            <div className="flex flex-wrap items-center gap-5">
              {data?.profile?.photoUrl ? (
                <img
                  src={data.profile.photoUrl}
                  alt=""
                  className="h-24 w-24 rounded-lg object-cover border border-[rgba(0,200,255,0.4)] shadow-[0_0_18px_rgba(0,200,255,0.25)]"
                />
              ) : (
                <span className="h-24 w-24 rounded-lg grid place-items-center border border-[color:var(--uf-border)] bg-[rgba(2,11,26,0.5)]">
                  <Camera className="h-9 w-9 text-uf-cyan" aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="sf-head text-2xl font-semibold">
                    {data?.displayName ?? "—"}
                  </h2>
                  {data?.commissionAvailable ? (
                    <StatusPill variant="success">commissions open</StatusPill>
                  ) : (
                    <StatusPill variant="default">commissions closed</StatusPill>
                  )}
                </div>
                {data?.profile?.mediums ? (
                  <p className="text-uf-muted text-sm mt-1">
                    Mediums: {data.profile.mediums}
                  </p>
                ) : null}
                <p className="text-uf-gold sf-deck text-sm mt-1 uppercase tracking-[0.14em]">
                  {data?.approvedCount ?? 0} canon contribution
                  {(data?.approvedCount ?? 0) === 1 ? "" : "s"}
                </p>
                {(data?.socialLinks?.length ?? 0) > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data!.socialLinks.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="uf-btn uf-btn--goldline text-xs"
                      >
                        {l.label || "Link"}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </HoloCard>
        </div>

        {isOwn && editing ? <div className="mb-8">{editor}</div> : null}

        <header className="mb-4">
          <span className="uf-eyebrow uf-eyebrow--gold sf-pulse-soft">
            Portfolio · featured works
          </span>
          <h2 className="sf-head text-2xl font-semibold mt-1">
            {data === undefined
              ? "Loading portfolio…"
              : `${data.assets.length} piece${data.assets.length === 1 ? "" : "s"} on file`}
          </h2>
        </header>

        {data === undefined ? (
          <div className="uf-grid uf-grid--3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 200 }} />
            ))}
          </div>
        ) : (
          <AssetGrid
            assets={data.assets as VisualAssetDoc[]}
            onOpen={setViewer}
            empty="No artwork on file yet — upload through the Visual Forge."
          />
        )}

        <FullScreenViewer asset={viewer} onClose={() => setViewer(null)} />
      </section>
    </SiteShell>
  );
}
