import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { SiteShell, PageHero, HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { ProfileEditor } from "@/components/ProfileEditor";
import PilotOnboarding from "@/components/PilotOnboarding";
import { CadetQuestPanel } from "@/components/widgets/CadetQuestPanel";
import { ServiceDossierPanel } from "@/components/widgets/ServiceDossierPanel";
import { useAuth } from "@/hooks/use-auth";
import { RankProgress } from "@/components/widgets/RankProgress";
import { StarCreditsCard } from "@/components/widgets/StarCreditsCard";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { tierLabel, tierPillVariant, type TierId } from "@/lib/tiers";
import { FRAME_CATALOG } from "@/lib/economy";
import { TierUsageWidget } from "@/components/usage/TierUsageWidget";
import { StorageManager } from "@/components/widgets/StorageManager";
import { Camera, ChevronDown, LogOut, Mail, MessageCircle, Send } from "lucide-react";

import { usePageMeta } from "@/hooks/use-page-meta";
export default function Account() {
  const { isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const claimAdmin = useMutation(api.users.devPromoteSelf);
  const setContactEmail = useMutation(api.users.setMyContactEmail);
  const setEmailPrefs = useMutation(api.users.setEmailPrefs);
  const [digestBusy, setDigestBusy] = useState(false);
  const discordStatus = useQuery(api.discordBridge.bridgeStatus);
  const linkDiscord = useMutation(api.discordBridge.linkDiscordAccount);
  const unlinkDiscord = useMutation(api.discordBridge.unlinkDiscord);
  const [discordDraft, setDiscordDraft] = useState(user?.discordUsername ?? "");
  const [discordBusy, setDiscordBusy] = useState(false);
  const digestOptedIn = !user?.emailOptOut;
  const toggleDigest = async () => {
    setDigestBusy(true);
    try {
      await setEmailPrefs({ digestOptOut: digestOptedIn });
      toast.success(
        digestOptedIn
          ? "Weekly digest paused — you can switch it back anytime."
          : "Weekly digest enabled — transmissions resume next cycle.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update your digest preference.",
      );
    } finally {
      setDigestBusy(false);
    }
  };
  const [contactDraft, setContactDraft] = useState(user?.contactEmail ?? "");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const saveContactEmail = async (value?: string) => {
    const next = (value ?? contactDraft).trim();
    setContactSaving(true);
    setContactError(null);
    try {
      await setContactEmail({ contactEmail: next || null });
      setContactDraft(next);
      toast.success(
        next ? `Message email set to ${next}.` : "Message email cleared.",
      );
    } catch (err) {
      setContactError(
        err instanceof Error ? err.message : "Couldn't save the message email.",
      );
    } finally {
      setContactSaving(false);
    }
  };
  const openPortal = useAction(api.stripe.openBillingPortal);
  const [portalBusy, setPortalBusy] = useState(false);
  const avatarUrl = useQuery(
    api.assets.coverUrl,
    user?.avatarStorageId
      ? { storageId: user.avatarStorageId as Id<"_storage"> }
      : "skip",
  );

  const [editingIdentity, setEditingIdentity] = useState(false);

  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "Recruit";
  const initials = displayName.charAt(0).toUpperCase();

  // First-run gate: brand-new members (no identity set, never onboarded)
  // get the one-screen pilot orientation instead of the full account deck.
  const needsOnboarding =
    isAuthenticated &&
    !!user &&
    !user.isAnonymous &&
    !user.onboarded &&
    !user.displayName &&
    !user.rank;
  if (needsOnboarding) {
    return <PilotOnboarding />;
  }

  const startEditIdentity = () => setEditingIdentity(true);
  usePageMeta({ title: "Account — Star Force Base 1198", description: "Manage your pilot profile, rank, and account settings.", noindex: false });


  return (
    <SiteShell>
      <PageHero
        eyebrow="Account"
        title="Your command deck."
        lead="Your identity, rank, and usage across Star Force Base 1198."
        primary={{ label: "Submit a story", href: "/submit", variant: "primary" }}
        secondary={{ label: "View activity", href: "/activity", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        {!isAuthenticated ? (
          <HoloCard>
            <p className="text-uf-muted text-sm">
              Sign in to access your account.{" "}
              <Link to="/auth" className="text-uf-cyan">Open auth</Link>.
            </p>
          </HoloCard>
        ) : (
          <div className="mb-5">
            <CadetQuestPanel />
          </div>
        )}
        {isAuthenticated && (
          <div className="uf-grid uf-grid--3">
            <HoloCard>
              <div className="flex items-center gap-3">
                <div
                  aria-hidden
                  className="relative h-16 w-16 rounded-full shrink-0 grid place-items-center overflow-hidden"
                  style={
                    user?.frame && FRAME_CATALOG[user.frame]
                      ? {
                          background: `conic-gradient(from 220deg, ${FRAME_CATALOG[user.frame].colors[0]}, ${FRAME_CATALOG[user.frame].colors[1]}, ${FRAME_CATALOG[user.frame].colors[2]}, ${FRAME_CATALOG[user.frame].colors[0]})`,
                          boxShadow: `0 0 18px ${FRAME_CATALOG[user.frame].colors[0]}66`,
                        }
                      : {
                          background:
                            "conic-gradient(from 220deg, var(--uf-cyan), var(--uf-violet), var(--uf-magenta), var(--uf-cyan))",
                          boxShadow: "0 0 18px rgba(0,229,255,0.35)",
                        }
                  }
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      style={{
                        background: "var(--uf-void)",
                        color: "var(--uf-text)",
                        width: 58,
                        height: 58,
                        borderRadius: "50%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.5rem",
                        fontWeight: 600,
                      }}
                    >
                      {initials}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl font-semibold truncate">{displayName}</h2>
                  {user?.email ? (
                    <p className="text-uf-muted text-xs truncate">{user.email}</p>
                  ) : null}
                  {user?.bio ? (
                    <p className="text-uf-muted text-xs mt-1 line-clamp-2">{user.bio}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <p className="text-uf-muted text-sm flex items-center gap-2">
                  Tier:{" "}
                  <StatusPill variant={tierPillVariant(user?.tier)}>
                    {tierLabel(user?.tier)}
                  </StatusPill>
                </p>
                {user?.rank && <StatusPill variant="info">{user.rank}</StatusPill>}
                {user?.fleet && <StatusPill variant="violet">{user.fleet}</StatusPill>}
              </div>

              {editingIdentity ? (
                <div className="mt-4">
                  <ProfileEditor
                    initial={{
                      displayName: user?.displayName,
                      rank: user?.rank,
                      fleet: user?.fleet,
                      bio: user?.bio,
                      flair: user?.flair,
                      avatarStorageId: user?.avatarStorageId,
                    }}
                    paidMember={(user?.tier ?? "free") !== "free"}
                    tier={user?.tier ?? "free"}
                    submitLabel="Save identity"
                    onSaved={() => setEditingIdentity(false)}
                    onCancel={() => setEditingIdentity(false)}
                  />
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <NeonButton variant="primary" onClick={startEditIdentity}>
                    <Camera className="h-4 w-4" aria-hidden /> Edit identity
                  </NeonButton>
                </div>
              )}

              <div className="mt-5 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] p-4">
                <p className="uf-eyebrow">Message email</p>
                <p className="text-uf-muted text-xs mt-1">
                  A secondary contact address for site correspondence. Your
                  sign-in email stays{" "}
                  <span className="text-uf-text">{user?.email}</span>.
                </p>
                <form
                  className="mt-3 flex flex-col sm:flex-row gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveContactEmail();
                  }}
                >
                  <label htmlFor="contact-email" className="sr-only">
                    Message email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={contactDraft}
                    onChange={(e) => setContactDraft(e.target.value)}
                    placeholder="message@starforcebase1198.com"
                    className="flex-1 min-w-0 rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <NeonButton
                      variant="primary"
                      type="submit"
                      loading={contactSaving}
                      disabled={contactDraft.trim() === (user?.contactEmail ?? "")}
                    >
                      Save
                    </NeonButton>
                    {user?.contactEmail ? (
                      <NeonButton
                        variant="ghost"
                        type="button"
                        loading={contactSaving}
                        onClick={() => {
                          setContactDraft("");
                          void saveContactEmail("");
                        }}
                      >
                        Clear
                      </NeonButton>
                    ) : null}
                  </div>
                </form>
                {contactError ? (
                  <p className="text-uf-red text-xs mt-2" role="alert">
                    {contactError}
                  </p>
                ) : null}
              </div>

              <NeonButton
                variant="ghost"
                loading={signingOut}
                className="mt-6"
                onClick={async () => {
                  setSigningOut(true);
                  try {
                    await signOut();
                    navigate("/");
                  } catch {
                    setSigningOut(false);
                    toast.error("Couldn't sign you out — try again.");
                  }
                }}
              >
                <LogOut className="h-4 w-4 mr-1" aria-hidden />
                Sign out
              </NeonButton>
            </HoloCard>
            <RankProgress />
            <StarCreditsCard
              credits={user?.credits ?? 0}
              frame={user?.frame}
              frames={user?.frames ?? []}
            />
            <HoloCard>
              <span className="uf-eyebrow">Quick actions</span>
              <ul className="list-none p-0 m-0 mt-3 space-y-2 text-sm">
                <li>
                  <Link to="/submit" className="text-uf-cyan flex items-center gap-2">
                    <Send className="h-4 w-4" aria-hidden /> Submit a story
                  </Link>
                </li>
                <li><Link to="/members" className="text-uf-cyan">Member directory</Link></li>
                <li><Link to="/groups" className="text-uf-cyan">My groups</Link></li>
                <li><Link to="/support" className="text-uf-cyan">Open support ticket</Link></li>
                <li><Link to="/operator" className="text-uf-cyan">Operator console</Link></li>
              </ul>
            </HoloCard>
            <HoloCard>
              <span className="uf-eyebrow flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                Fleet digest
              </span>
              <h2 className="text-lg font-semibold mt-2">Weekly canon digest</h2>
              <p className="text-uf-muted text-sm mt-1">
                A short weekly transmission: new stories, lore entries, contest
                deadlines, and scheduled operations — one email, no noise.
              </p>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] p-3">
                <div>
                  <p className="text-sm font-medium">
                    {digestOptedIn ? "Digest enabled" : "Digest paused"}
                  </p>
                  <p className="text-uf-muted text-[11px]">
                    {digestOptedIn
                      ? "You're on the weekly transmission list."
                      : "You won't receive weekly recap emails."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={digestOptedIn}
                  aria-label="Toggle weekly digest email"
                  disabled={digestBusy}
                  onClick={toggleDigest}
                  className={
                    "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 cursor-pointer " +
                    (digestOptedIn
                      ? "border-[rgba(0,229,255,0.5)] bg-[rgba(0,229,255,0.25)]"
                      : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.8)]")
                  }
                >
                <span
                  aria-hidden
                  className={
                    "inline-block h-5 w-5 rounded-full transition-transform " +
                    (digestOptedIn
                      ? "translate-x-[26px] shadow-[0_0_10px_rgba(0,229,255,0.6)]"
                      : "translate-x-0.5")
                  }
                  style={{
                    background: digestOptedIn ? "var(--uf-cyan)" : "var(--uf-muted)",
                  }}
                />
                </button>
              </div>
            </HoloCard>
            <HoloCard>
              <span className="uf-eyebrow flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                Discord bridge
              </span>
              <h2 className="text-lg font-semibold mt-2">Presence & announcements</h2>
              <p className="text-uf-muted text-sm mt-1">
                Link the Discord handle you use in the community so operators
                can verify you. Fleet announcements mirror to the Discord
                server when the bridge is configured.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill variant={discordStatus?.configured ? "success" : "default"}>
                  {discordStatus?.configured
                    ? "Announcement bridge connected"
                    : "Bridge not configured"}
                </StatusPill>
                {user?.discordVerifiedAt ? (
                  <StatusPill variant="gold">Verified on Discord</StatusPill>
                ) : user?.discordUsername ? (
                  <StatusPill variant="warning">Awaiting operator verification</StatusPill>
                ) : null}
              </div>
              <form
                className="mt-4 flex flex-col sm:flex-row gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setDiscordBusy(true);
                  try {
                    await linkDiscord({ username: discordDraft.trim() });
                    toast.success("Discord handle linked — an operator will verify it.");
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Couldn't link the handle.",
                    );
                  } finally {
                    setDiscordBusy(false);
                  }
                }}
              >
                <label htmlFor="discord-username" className="sr-only">
                  Discord username
                </label>
                <input
                  id="discord-username"
                  value={discordDraft}
                  onChange={(e) => setDiscordDraft(e.target.value)}
                  placeholder="your_discord_handle"
                  className="flex-1 min-w-0 rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
                />
                <NeonButton
                  variant="primary"
                  type="submit"
                  loading={discordBusy}
                  disabled={!discordDraft.trim() || discordDraft.trim() === (user?.discordUsername ?? "")}
                >
                  Link handle
                </NeonButton>
                {user?.discordUsername ? (
                  <NeonButton
                    variant="ghost"
                    type="button"
                    loading={discordBusy}
                    onClick={async () => {
                      setDiscordBusy(true);
                      try {
                        await unlinkDiscord();
                        setDiscordDraft("");
                        toast.success("Discord handle removed.");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Couldn't unlink.");
                      } finally {
                        setDiscordBusy(false);
                      }
                    }}
                  >
                    Unlink
                  </NeonButton>
                ) : null}
              </form>
            </HoloCard>
          </div>
        )}
        {isAuthenticated && (
          <div className="mt-6">
            <ServiceDossierPanel editable />
            <TierUsageWidget mode="self" initialTier={(user?.tier ?? "free") as TierId} />
            {(user?.tier ?? "free") !== "free" ? (
              <div className="mt-3">
                <NeonButton
                  variant="ghost"
                  loading={portalBusy}
                  onClick={async () => {
                    setPortalBusy(true);
                    try {
                      const { url } = await openPortal({
                        origin: window.location.origin,
                      });
                      window.location.href = url;
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "";
                      if (msg.includes("not configured")) {
                        toast.info(
                          "Stripe isn't configured yet — manage tiers from the Membership page.",
                        );
                      } else {
                        toast.error(msg || "Couldn't open the billing portal.");
                      }
                    } finally {
                      setPortalBusy(false);
                    }
                  }}
                >
                  Manage subscription
                </NeonButton>
              </div>
            ) : null}
            <div className="mt-4">
              <StorageManager />
            </div>
            <details
              className="mt-6 group rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] overflow-hidden"
              aria-label="Developer access"
            >
              <summary className="flex items-center justify-between gap-3 cursor-pointer px-4 py-3 select-none list-none [&::-webkit-details-marker]:hidden">
                <span className="uf-eyebrow">Developer access</span>
                <ChevronDown
                  className="h-4 w-4 text-uf-muted transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="px-4 pb-4 border-t border-[color:var(--uf-border)]">
                <p className="text-uf-muted text-sm mt-3">
                  Dev-only tooling for this deployment. The claim button promotes
                  this account to admin (role <code className="text-uf-cyan">admin</code>{" "}
                  + op role{" "}
                  <code className="text-uf-cyan">senior_operator</code>) so you can reach
                  the operator console. Disable before production.
                </p>
                <NeonButton
                  variant="gold"
                  className="mt-4"
                  onClick={async () => {
                    try {
                      await claimAdmin();
                      toast.success("Operator access granted — welcome to the bridge.");
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Failed to claim operator access.",
                      );
                    }
                  }}
                >
                  Claim operator access (dev)
                </NeonButton>
              </div>
            </details>
          </div>
        )}
      </section>
    </SiteShell>
  );
}
