import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";import {
  fetchVessels,
  verifyClaimToken,
  claimWingsToken,
  assignFighterChoice,
  type RegistryVessel,
  type VerifyOutcome,
  type ClaimOutcome,
  type AssignOutcome,
} from "@/lib/fleetRegistry";
import {
  AlertTriangle,
  Check,
  Feather,
  Loader2,
  Lock,
  Ship as ShipIcon,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// /wings — the Wings ceremony. A member arrives with a single-use claim token
// (issued by the Bridge when they genuinely earn their wings): /wings?claim=<token>
//
// Contract with the Fleet Registry (fleetregistry.starforcebase1198.com):
//   1. verify  — token checked WITHOUT consuming it
//   2. claim   — starts the 10-minute assignment session, BURNS the token
//   3. assign  — the PERMANENT member→fighter choice (no undo, by design)
// These calls run directly from the browser (the registry serves open CORS
// and authenticates with the token the member already holds); Convex only
// records the burn on the main site's own wingClaims table.
// The choice is irreversible: that permanence IS the reward.
// ---------------------------------------------------------------------------

type Stage = "gate" | "checking" | "choice" | "confirming" | "callsign" | "done";

export default function Wings() {
  usePageMeta({
    title: "Earn Your Wings — Star Force Base 1198",
    description:
      "The Wings ceremony: when the Bridge awards your wings, choose the fighter you will fly. Permanent. Personal. Earned.",
  });

  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [searchParams] = useSearchParams();
  const claimToken = searchParams.get("claim") ?? "";
  const markConsumed = useMutation(api.wings.markClaimConsumed);

  const [stage, setStage] = useState<Stage>("gate");
  const [memberName, setMemberName] = useState("");
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [alreadyAssigned, setAlreadyAssigned] = useState(false);
  const [vessels, setVessels] = useState<RegistryVessel[] | null>(null);
  const [vesselsError, setVesselsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RegistryVessel | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<
    "invalid" | "expired" | "used" | null
  >(null);
  const [finalAssignment, setFinalAssignment] = useState<{
    designation: string;
    memberName: string;
    hullNumber?: string;
    callsign?: string;
  } | null>(null);
  const [callsign, setCallsign] = useState("");
  const [hullResult, setHullResult] = useState<{ hullNumber: string; callsign: string } | null>(null);
  const claimFighter = useMutation(api.starfighters.claimMyFighter);

  // Guards so React StrictMode's double-effect can't double-fire calls.
  const verifiedRef = useRef(false);
  const claimingRef = useRef(false);

  // ---- Step 1: verify on arrival (never consumes the token) ---------------
  useEffect(() => {
    if (!claimToken || !isAuthenticated || verifiedRef.current) return;
    verifiedRef.current = true;
    setStage("checking");
    verifyClaimToken(claimToken)
      .then((res: VerifyOutcome) => {
        if (res.state === "valid") {
          setMemberName(res.memberName);
          setReason(res.reason);
          setAlreadyAssigned(res.alreadyAssigned);
          setStage("choice");
        } else if (res.state === "error") {
          setFailure(res.message);
          setStage("gate");
        } else {
          setFailure(null);
          setMemberName("");
          setVerifyState(res.state);
          setStage("gate");
        }
      })
      .catch(() => {
        setFailure("Verification failed — try again.");
        setStage("gate");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimToken, isAuthenticated]);

  // ---- Vessel roster for the choice grid (direct registry read) ----------
  useEffect(() => {
    if (stage !== "choice" || vessels || vesselsError) return;
    fetchVessels()
      .then(setVessels)
      .catch((e: unknown) =>
        setVesselsError(
          e instanceof Error ? e.message : "Could not reach the Fleet Registry.",
        ),
      );
  }, [stage, vessels, vesselsError]);

  // ---- Steps 2 + 3: burn the token, then make the permanent choice --------
  // When the registry already holds the member's assignment (e.g. claims made
  // before the fighter record existed), the local-only path skips the
  // registry calls — the type is picked again and the fighter is recorded.
  async function makeItPermanent() {
    if (!claimToken || !selected || claimingRef.current) return;
    claimingRef.current = true;
    setStage("confirming");
    setFailure(null);
    if (alreadyAssigned) {
      setFinalAssignment({
        designation: selected.designation,
        memberName: user?.displayName ?? "Pilot",
        hullNumber: "",
        callsign: "",
      });
      setStage("callsign");
      claimingRef.current = false;
      return;
    }
    try {
      let session = sessionToken;
      if (!session) {
        const claim: ClaimOutcome = await claimWingsToken(claimToken);
        if (claim.state !== "claimed") {
          if (claim.state === "used") {
            setVerifyState("used");
            setStage("gate");
          } else if (claim.state === "already_assigned") {
            setAlreadyAssigned(true);
            setStage("choice");
          } else {
            setFailure(claim.state === "error" ? claim.message : "Claim failed.");
            setStage("choice");
          }
          return;
        }
        session = claim.sessionToken;
        setSessionToken(session);
        // The token is burned registry-side — record the burn on our side.
        await markConsumed({ token: claimToken }).catch(() => undefined);
      }
      const assign: AssignOutcome = await assignFighterChoice(
        session,
        selected.id,
      );
      if (assign.state === "assigned") {
        setFinalAssignment({
          designation: assign.assignment.designation,
          memberName: assign.assignment.memberName,
          hullNumber: "",
          callsign: "",
        });
        setStage("callsign");
      } else if (assign.state === "session_expired") {
        setFailure(
          "Your assignment session expired. The original claim token is spent — ask the Bridge to reissue your wings.",
        );
        setStage("gate");
      } else if (assign.state === "already_assigned") {
        setAlreadyAssigned(true);
        setStage("choice");
      } else if (assign.state === "unknown_vessel") {
        setFailure("That fighter is no longer on the registry. Choose another.");
        setStage("choice");
        setSelected(null);
      } else {
        setFailure(assign.state === "error" ? assign.message : "Assignment failed.");
        setStage("choice");
      }
    } catch {
      setFailure("The Fleet Registry is unreachable — try again in a moment.");
      setStage("choice");
    } finally {
      claimingRef.current = false;
    }
  }

  // ---- Final step: record the personal fighter (callsign + auto hull) ----
  async function recordFighter() {
    if (!selected || !finalAssignment) return;
    setStage("confirming");
    try {
      const res = await claimFighter({
        vesselKey: selected.id,
        designation: selected.designation,
        shipClass: selected.shipClass,
        callsign,
      });
      setHullResult({ hullNumber: res.hullNumber, callsign: res.callsign });
      setStage("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record your fighter.");
      setStage("callsign");
    }
  }

  const authReturnTo = claimToken
    ? `/wings?claim=${encodeURIComponent(claimToken)}`
    : "/wings";

  // ---- Render --------------------------------------------------------------
  return (
    <SiteShell>
      <PageHero
        eyebrow="The Wings Ceremony"
        title="Earn your wings."
        lead="When the Bridge awards your wings, you choose the fighter you will fly — once, permanently, under your own name on the honor roll."
        primary={
          isAuthenticated
            ? { label: "The Wall of Honor", href: "/honor", variant: "primary" }
            : { label: "Sign in to begin", href: `/auth?returnTo=${encodeURIComponent(authReturnTo)}`, variant: "primary" }
        }
        secondary={{ label: "How honors are earned", href: "/awards#wings", variant: "ghost" }}
      />

      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12 py-10">
        {authLoading ? (
          <Centered>
            <Loader2 className="h-6 w-6 animate-spin text-uf-muted" />
          </Centered>
        ) : !isAuthenticated ? (
          <GateCard
            icon={<Lock className="h-5 w-5 text-[#ffcc00]" />}
            title="Authentication required"
            body={
              claimToken
                ? "Your claim link is safe. Sign in with the account the Bridge issued it to, and the ceremony will resume."
                : "Sign in first — claim links are issued to a specific member."
            }
            action={
              <Link
                to={`/auth?returnTo=${encodeURIComponent(authReturnTo)}`}
                className="uf-btn uf-btn--primary inline-block"
              >
                Sign in
              </Link>
            }
          />
        ) : stage === "checking" ? (
          <Centered>
            <Loader2 className="h-6 w-6 animate-spin text-[#ffcc00]" />
            <p className="mt-3 text-sm text-uf-muted">
              Verifying your claim with the Fleet Registry…
            </p>
          </Centered>
        ) : stage === "gate" ? (
          <GateStates
            verifyState={verifyState}
            failure={failure}
            hasToken={Boolean(claimToken)}
          />
        ) : alreadyAssigned ? (
          <GateCard
            icon={<Feather className="h-5 w-5 text-[#ffcc00]" />}
            title="Your wings are already on the roll"
            body={`${memberName || user?.displayName || "Pilot"}, the registry shows a permanent fighter assignment for this claim. Pick your fighter type to record it on the Wall of Honor with your own hull number and callsign.`}
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <NeonButton
                  variant="gold"
                  onClick={() => {
                    setAlreadyAssigned(true);
                    setStage("choice");
                  }}
                >
                  Record your fighter
                </NeonButton>
                <Link to="/honor" className="uf-btn uf-btn--ghost inline-block">
                  View the Wall of Honor
                </Link>
              </div>
            }
          />
        ) : stage === "callsign" && finalAssignment && selected ? (
          <CallsignStage
            designation={finalAssignment.designation}
            onConfirm={recordFighter}
            callsign={callsign}
            setCallsign={setCallsign}
          />
        ) : stage === "done" && hullResult ? (
          <SuccessCard
            designation={finalAssignment?.designation ?? ""}
            memberName={memberName || user?.displayName || "Pilot"}
            hullNumber={hullResult.hullNumber}
            callsign={hullResult.callsign}
          />
        ) : stage === "done" && finalAssignment ? (
          <SuccessCard
            designation={finalAssignment.designation}
            memberName={finalAssignment.memberName}
            hullNumber={finalAssignment.hullNumber ?? ""}
            callsign={finalAssignment.callsign ?? ""}
          />
        ) : (
          <ChoiceStage
            memberName={memberName}
            reason={reason}
            vessels={vessels}
            vesselsError={vesselsError}
            selected={selected}
            onSelect={setSelected}
            onConfirm={makeItPermanent}
            confirming={stage === "confirming"}
            onRetryVessels={() => {
              setVesselsError(null);
              setVessels(null);
            }}
          />
        )}
      </section>
    </SiteShell>
  );
}

// ===========================================================================
// Sub-screens
// ===========================================================================

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {children}
    </div>
  );
}

function GateCard({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <HoloCard className="max-w-xl mx-auto p-8 text-center" glow>
      <div className="flex justify-center mb-4">{icon}</div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-uf-muted text-sm mt-2 leading-6">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </HoloCard>
  );
}

function GateStates({
  verifyState,
  failure,
  hasToken,
}: {
  verifyState: "invalid" | "expired" | "used" | null;
  failure: string | null;
  hasToken: boolean;
}) {
  if (failure) {
    return (
      <GateCard
        icon={<AlertTriangle className="h-5 w-5 text-[#ff6666]" />}
        title="The registry could not be reached"
        body={failure}
      />
    );
  }
  if (verifyState === "used") {
    return (
      <GateCard
        icon={<Check className="h-5 w-5 text-uf-muted" />}
        title="This claim has already been used"
        body="A claim token burns the moment the choice begins. If this was your token, your wings are already written on the honor roll — the assignment is permanent and cannot be redone."
        action={
          <Link to="/honor" className="uf-btn uf-btn--ghost inline-block">
            View the assigned pilots
          </Link>
        }
      />
    );
  }
  if (verifyState === "expired") {
    return (
      <GateCard
        icon={<AlertTriangle className="h-5 w-5 text-[#ffcc00]" />}
        title="This claim has expired"
        body="Claim tokens are valid for 24 hours after issuance. Ask the Bridge to reissue your wings — eligibility is not lost, only the token."
      />
    );
  }
  if (verifyState === "invalid") {
    return (
      <GateCard
        icon={<AlertTriangle className="h-5 w-5 text-[#ff6666]" />}
        title="This claim could not be verified"
        body="The registry does not recognize this token. Check the link exactly as it was issued to you, or contact the Bridge."
      />
    );
  }
  return (
    <GateCard
      icon={<Feather className="h-5 w-5 text-[#ffcc00]" />}
      title="No claim token detected"
      body={
        hasToken
          ? "Waiting on verification…"
          : "Wings are awarded by the Bridge — never self-claimed. When you earn yours, you'll receive a personal claim link that opens this ceremony."
      }
    />
  );
}

function ChoiceStage({
  memberName,
  reason,
  vessels,
  vesselsError,
  selected,
  onSelect,
  onConfirm,
  confirming,
  onRetryVessels,
}: {
  memberName: string;
  reason?: string;
  vessels: RegistryVessel[] | null;
  vesselsError: string | null;
  selected: RegistryVessel | null;
  onSelect: (v: RegistryVessel) => void;
  onConfirm: () => void;
  confirming: boolean;
  onRetryVessels: () => void;
}) {
  return (
    <div className="space-y-8">
      <header className="text-center">
        <StatusPill variant="gold">Irreversible ceremony</StatusPill>
        <h2 className="text-3xl font-semibold mt-3 tracking-tight">
          You have earned your wings{memberName ? `, ${memberName}` : ""}.
        </h2>
        <p className="text-uf-muted mt-2 max-w-2xl mx-auto text-sm leading-6">
          Choose the fighter you will fly. <strong className="text-uf-text">This choice
          cannot be changed</strong> — your name will be written permanently on the
          ship's honor roll, visible to the entire fleet.
        </p>
        {reason ? (
          <p className="text-xs text-uf-muted mt-2">
            Awarded for: <span className="text-uf-text">{reason}</span>
          </p>
        ) : null}
      </header>

      {vesselsError ? (
        <GateCard
          icon={<AlertTriangle className="h-5 w-5 text-[#ffcc00]" />}
          title="Could not load the fighter roster"
          body={vesselsError}
          action={
            <NeonButton variant="primary" onClick={onRetryVessels}>
              Try again
            </NeonButton>
          }
        />
      ) : vessels === null ? (
        <Centered>
          <Loader2 className="h-6 w-6 animate-spin text-[#ffcc00]" />
          <p className="mt-3 text-sm text-uf-muted">Reading the registry roster…</p>
        </Centered>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vessels.map((v) => {
              const active = selected?.id === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelect(v)}
                  aria-pressed={active}
                  className={`uf-card text-left p-5 transition-all cursor-pointer ${
                    active
                      ? "ring-2 ring-[#ffcc00] shadow-[0_0_24px_rgba(255,204,0,0.25)]"
                      : "hover:ring-1 hover:ring-[rgba(255,204,0,0.4)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <ShipIcon className="h-5 w-5 text-[#00e5ff] shrink-0" />
                    {v.badge ? (
                      <span className="text-[10px] uppercase tracking-[0.16em] text-uf-muted">
                        {v.badge}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 font-semibold leading-tight">{v.designation}</h3>
                  {v.name ? (
                    <p className="text-sm text-uf-text/90 mt-0.5">{v.name}</p>
                  ) : null}
                  {v.shipClass ? (
                    <p className="text-xs text-uf-muted mt-2">{v.shipClass}</p>
                  ) : null}
                  {active ? (
                    <p className="mt-3 text-xs text-[#ffcc00] flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Selected
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>

          {selected ? (
            <HoloCard className="p-6 border-[rgba(255,204,0,0.35)]" glow>
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-5 w-5 text-[#ffcc00] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h3 className="font-semibold">
                    Confirm: {selected.designation}
                    {selected.name ? ` — ${selected.name}` : ""}
                  </h3>
                  <p className="text-sm text-uf-muted mt-1 leading-6">
                    This burns your claim token and writes your name permanently
                    to this ship's honor roll. There is no edit and no undo —
                    corrections require the operator's direct intervention.
                  </p>
                  <div className="mt-4">
                    <NeonButton
                      variant="gold"
                      onClick={onConfirm}
                      loading={confirming}
                      iconLeft={<Lock className="h-4 w-4" />}
                    >
                      Make it permanent
                    </NeonButton>
                  </div>
                </div>
              </div>
            </HoloCard>
          ) : null}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Callsign stage — the pilot names their fighter (e.g. "DARKSTAR"). The hull
// number is auto-assigned server-side the moment they confirm.
// ---------------------------------------------------------------------------

function CallsignStage({
  designation,
  callsign,
  setCallsign,
  onConfirm,
}: {
  designation: string;
  callsign: string;
  setCallsign: (v: string) => void;
  onConfirm: () => void;
}) {
  const valid = callsign.trim().length >= 2 && callsign.trim().length <= 32;
  return (
    <HoloCard className="max-w-xl mx-auto p-8 text-center border-[rgba(255,204,0,0.4)]" glow>
      <Feather className="h-8 w-8 text-[#ffcc00] mx-auto" />
      <h2 className="text-2xl font-semibold mt-4">Name your fighter.</h2>
      <p className="text-sm text-uf-muted mt-2 leading-6">
        Your assignment to the <strong className="text-uf-text">{designation}</strong> is
        recorded. The hull number is auto-assigned — the callsign is yours to
        choose. It will appear on the Wall of Honor and your dossier.
      </p>
      <input
        value={callsign}
        onChange={(e) => setCallsign(e.target.value.toUpperCase())}
        maxLength={32}
        placeholder="e.g. DARKSTAR"
        aria-label="Fighter callsign"
        className="uf-input w-full max-w-sm mx-auto mt-5 text-center font-mono tracking-[0.2em]"
      />
      <div className="mt-5">
        <NeonButton
          variant="gold"
          disabled={!valid}
          onClick={onConfirm}
          iconLeft={<Lock className="h-4 w-4" />}
        >
          Record my fighter
        </NeonButton>
      </div>
    </HoloCard>
  );
}

function SuccessCard({
  designation,
  memberName,
  hullNumber,
  callsign,
}: {
  designation: string;
  memberName: string;
  hullNumber?: string;
  callsign?: string;
}) {
  return (
    <HoloCard className="max-w-xl mx-auto p-10 text-center border-[rgba(255,204,0,0.45)]" glow>
      <Feather className="h-10 w-10 text-[#ffcc00] mx-auto" />
      <h2 className="text-2xl font-semibold mt-4">Your wings are earned.</h2>
      <p className="mt-3 text-uf-text leading-7">
        <strong>{memberName}</strong> flies the <strong>{designation}</strong>
        {callsign ? (
          <>
            {" "}
            — <span className="font-mono tracking-[0.14em] text-[#ffcc00]">{callsign}</span>
          </>
        ) : null}
        .
      </p>
      {hullNumber ? (
        <p className="font-mono text-sm text-uf-muted mt-2 tracking-[0.14em]">
          HULL {hullNumber}
        </p>
      ) : null}
      <p className="text-sm text-uf-muted mt-3 leading-6">
        The assignment is permanent. Your fighter is recorded on the Wall of
        Honor and your member dossier — for as long as the fleet keeps records.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/honor" className="uf-btn uf-btn--primary inline-block">
          See the Wall of Honor
        </Link>
        <Link to="/awards" className="uf-btn uf-btn--ghost inline-block">
          Your other honors
        </Link>
      </div>
    </HoloCard>
  );
}
