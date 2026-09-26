// =========================================================================
// Fleet Registry — browser-side client for the public registry API
// (fleetregistry.starforcebase1198.com).
//
// The registry serves its public reads with open CORS (`*`), so the main
// site calls it DIRECTLY from the browser: no server relay, no WAF trouble
// with datacenter egress IPs, no latency hop through Convex. Ceremony calls
// (verify/claim/assign) also run from the browser — the claim token is
// already in the browser by design, and the registry accepts Authorization
// headers cross-origin.
//
// Parsing is defensive: the registry returns string ids ("1", "7"), and
// fields may be absent or null. Anything malformed is skipped.
// =========================================================================

export const FLEET_REGISTRY_BASE = "https://fleetregistry.starforcebase1198.com";

export type RegistryVessel = {
  /** Registry vessel id as a string (e.g. "7") — stable, used in URLs. */
  id: string;
  designation: string;
  name?: string;
  shipClass?: string;
  badge?: string;
  role?: string;
};

export type RegistryPilot = {
  id: string;
  memberId: string;
  memberName: string;
  note?: string;
  assignedAt: number;
  vesselId: string;
  designation: string;
};

async function registryJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${FLEET_REGISTRY_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Registry request failed (HTTP ${res.status}).`);
  }
  return (await res.json()) as T;
}

function pickString(r: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function toId(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

/** The live ship-type list for the "choose your fighter" grid. */
export async function fetchVessels(): Promise<RegistryVessel[]> {
  const rows = await registryJson<unknown[]>(`/api/vessels`);
  if (!Array.isArray(rows)) return [];
  const out: RegistryVessel[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = toId(r._id) ?? toId(r.id);
    const designation = pickString(r, "designation");
    if (!id || !designation) continue;
    out.push({
      id,
      designation,
      name: pickString(r, "name"),
      shipClass: pickString(r, "shipClass"),
      badge: pickString(r, "badge"),
      role: pickString(r, "role"),
    });
    // NOTE: the registry's ship-type list carries class, role, and builder
    // detail; the "badge" (FLAGSHIP / CARRIER / …) is site-side vocabulary,
    // so it simply stays undefined if the registry doesn't send one.
  }
  return out;
}

/** A hull's permanent honor roll — oldest first, written once, never edited. */
export async function fetchVesselPilots(vesselId: string): Promise<RegistryPilot[]> {
  const rows = await registryJson<unknown[]>(`/api/vessels/${encodeURIComponent(vesselId)}/pilots`);
  if (!Array.isArray(rows)) return [];
  const out: RegistryPilot[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const memberName = pickString(r, "memberName");
    if (!memberName) continue;
    out.push({
      id: toId(r._id) ?? toId(r.id) ?? "",
      memberId: pickString(r, "memberId") ?? "",
      memberName,
      note: pickString(r, "note"),
      assignedAt: typeof r.assignedAt === "number" ? r.assignedAt : 0,
      vesselId: toId(r.vesselId) ?? toId(r.vessel) ?? "",
      designation: pickString(r, "designation") ?? "",
    });
  }
  return out;
}

// -------------------------------------------------------------------------
// Ceremony calls — bearer-authenticated with the claim/session token.
// The token is burned by /api/wings/claim; the session token it returns
// (10-minute TTL) authorizes /api/wings/assign.
// -------------------------------------------------------------------------

export type VerifyOutcome =
  | { state: "valid"; memberName: string; reason?: string; alreadyAssigned: boolean }
  | { state: "invalid" | "expired" | "used" }
  | { state: "error"; message: string };

export async function verifyClaimToken(token: string): Promise<VerifyOutcome> {
  let res: Response;
  try {
    res = await fetch(`${FLEET_REGISTRY_BASE}/api/wings/claim/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { state: "error", message: "The Fleet Registry is unreachable. Try again shortly." };
  }
  if (res.ok) {
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      state: "valid",
      memberName: pickString(d, "memberName") ?? "Pilot",
      reason: pickString(d, "reason"),
      alreadyAssigned: d.alreadyAssigned === true,
    };
  }
  if (res.status === 409) return { state: "used" };
  if (res.status === 401) {
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const msg = pickString(d, "error") ?? "";
    return msg.toLowerCase().includes("expired") ? { state: "expired" } : { state: "invalid" };
  }
  return { state: "error", message: `Registry request failed (HTTP ${res.status}).` };
}

export type ClaimOutcome =
  | { state: "claimed"; sessionToken: string; memberName: string; expiresInMs: number }
  | { state: "used" | "already_assigned" }
  | { state: "error", message: string };

/** Burn the claim token and start the 10-minute assignment session. */
export async function claimWingsToken(token: string): Promise<ClaimOutcome> {
  let res: Response;
  try {
    res = await fetch(`${FLEET_REGISTRY_BASE}/api/wings/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { state: "error", message: "The Fleet Registry is unreachable. Try again shortly." };
  }
  if (res.ok) {
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionToken = pickString(d, "sessionToken");
    if (!sessionToken) {
      return { state: "error", message: "Registry returned an invalid session." };
    }
    return {
      state: "claimed",
      sessionToken,
      memberName: pickString(d, "memberName") ?? "Pilot",
      expiresInMs: typeof d.expiresInMs === "number" ? d.expiresInMs : 10 * 60 * 1000,
    };
  }
  if (res.status === 409) {
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const msg = (pickString(d, "error") ?? "").toLowerCase();
    return msg.includes("assigned") ? { state: "already_assigned" } : { state: "used" };
  }
  return { state: "error", message: `Registry request failed (HTTP ${res.status}).` };
}

export type AssignOutcome =
  | {
      state: "assigned";
      assignment: { vesselId: string; designation: string; memberName: string; assignedAt: number };
    }
  | { state: "session_expired" | "already_assigned" | "unknown_vessel" }
  | { state: "error"; message: string };

/** Make the PERMANENT choice — session token from claimWingsToken, NOT the claim token. */
export async function assignFighterChoice(
  sessionToken: string,
  vesselId: string,
): Promise<AssignOutcome> {
  let res: Response;
  try {
    res = await fetch(`${FLEET_REGISTRY_BASE}/api/wings/assign`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vesselId: /^\d+$/.test(vesselId) ? Number(vesselId) : vesselId,
      }),
    });
  } catch {
    return { state: "error", message: "The Fleet Registry is unreachable. Try again shortly." };
  }
  if (res.status === 201) {
    const d = (await res.json().catch(() => ({}))) as {
      assignment?: Record<string, unknown>;
    };
    const a = d.assignment ?? {};
    return {
      state: "assigned",
      assignment: {
        vesselId: toId(a.vesselId) ?? vesselId,
        designation: pickString(a, "designation") ?? "Unknown vessel",
        memberName: pickString(a, "memberName") ?? "Pilot",
        assignedAt: typeof a.assignedAt === "number" ? a.assignedAt : Date.now(),
      },
    };
  }
  if (res.status === 401) return { state: "session_expired" };
  if (res.status === 404) return { state: "unknown_vessel" };
  if (res.status === 409) return { state: "already_assigned" };
  const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    state: "error",
    message: pickString(d, "error") ?? `Registry request failed (HTTP ${res.status}).`,
  };
}
