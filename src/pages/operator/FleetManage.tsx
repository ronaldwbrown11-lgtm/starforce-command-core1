import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Ship, Database } from "lucide-react";

const BADGES = ["CARRIER", "DREADNAUGHT", "DESTROYER", "BATTLESHIP", "FLAGSHIP", "TRANSPORT", "ESCORT", "SUPPRESSION", "DRONE", "STEALTH", "MEDICAL", "INDUSTRIAL", "STRIKE", "INTERCEPTOR", "FIGHTER", "CORVETTE", "FRIGATE"];

const EMPTY = { designation: "", name: "", badge: "ACTIVE", shipClass: "", registry: "", role: "", crew: "", armament: "", notes: "", hullLength: "", hullWidth: "", decks: "", weight: "", acceleration: "" };

export default function FleetManage() {
  const vessels = useQuery(api.vessels.listAll);
  const upsert = useMutation(api.vessels.upsert);
  const remove = useMutation(api.vessels.remove);
  const seedVessels = useMutation(api.vessels.seed);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  function startEdit(v?: any) {
    if (v) {
      setForm({ designation: v.designation, name: v.name, badge: v.badge, shipClass: v.shipClass ?? "", registry: v.registry ?? "", role: v.role, crew: v.crew ?? "", armament: v.armament ?? "", notes: v.notes ?? "", hullLength: v.hullLength ?? "", hullWidth: v.hullWidth ?? "", decks: v.decks ?? "", weight: v.weight ?? "", acceleration: v.acceleration ?? "" });
      setEditing(v);
    } else {
      setForm(EMPTY);
      setEditing(null);
    }
  }

  async function save() {
    if (!form.designation.trim() || !form.name.trim() || !form.role.trim()) { toast.error("Designation, name, and role are required."); return; }
    setBusy(true);
    try {
      await upsert({ id: editing?._id, ...form } as any);
      toast.success(editing ? "Vessel updated." : "Vessel added.");
      setEditing(null);
    } catch (e: any) { toast.error(e.message ?? "Save failed."); }
    finally { setBusy(false); }
  }

  async function del(id: any) {
    if (!window.confirm("Remove this vessel from the registry?")) return;
    try { await remove({ id }); toast.success("Removed."); } catch (e: any) { toast.error(e.message); }
  }

  const filtered = useMemo(() => {
    const all = vessels ?? [];
    if (!filter) return all;
    const q = filter.toLowerCase();
    return all.filter((v) => v.designation.toLowerCase().includes(q) || v.name.toLowerCase().includes(q) || v.badge.toLowerCase().includes(q) || (v.shipClass ?? "").toLowerCase().includes(q));
  }, [vessels, filter]);

  function field(label: string, key: string, opts?: { placeholder?: string; required?: boolean }) {
    return (
      <label className="block text-xs uppercase tracking-widest text-uf-muted">
        {label}{opts?.required ? " *" : ""}
        <input value={(form as any)[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value } as any)} placeholder={opts?.placeholder} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm" />
      </label>
    );
  }

  return (
    <OperatorShell>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <span className="uf-eyebrow">Operator Console</span>
          <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3"><Ship className="h-6 w-6 text-uf-cyan" />Fleet Registry</h1>
          <p className="text-uf-muted text-sm mt-1">Manage the Star Force vessel database shown on the public registry page.</p>
        </div>
        <div className="flex gap-2">
          <NeonButton variant="ghost" onClick={async () => {
            if (!window.confirm("Seed the 45 canonical Star Force vessels? Existing vessels are skipped.")) return;
            try {
              const res = await seedVessels({ vessels: VESSEL_SEED as any });
              toast.success(`Seeded ${res.created} vessels (${res.skipped} already existed).`);
            } catch (e: any) { toast.error(e.message); }
          }}><Database className="h-4 w-4 mr-1" />Seed vessels</NeonButton>
          <NeonButton variant="primary" onClick={() => startEdit()}><Plus className="h-4 w-4 mr-1" />Add vessel</NeonButton>
        </div>
      </header>

      {editing !== null || false ? (
        <HoloCard className="mb-6">
          <h2 className="text-lg font-semibold mb-4">{editing?._id ? "Edit vessel" : "New vessel"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("Designation", "designation", { required: true, placeholder: "OMEGA MAJESTY" })}
            {field("Name", "name", { required: true, placeholder: "Omega Majesty" })}
            <label className="block text-xs uppercase tracking-widest text-uf-muted">
              Badge *
              <select value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm">
                {BADGES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            {field("Ship Class", "shipClass", { placeholder: "Omega-Class Super Battleship" })}
            {field("Registry", "registry", { placeholder: "SFSBT 8005" })}
            {field("Role", "role", { required: true, placeholder: "Strategic fleet flagship" })}
            {field("Crew", "crew", { placeholder: "5,000 CREW" })}
            {field("Hull Length (m)", "hullLength", { placeholder: "1400" })}
            {field("Hull Width (m)", "hullWidth", { placeholder: "500" })}
            {field("Decks", "decks", { placeholder: "40" })}
            {field("Weight", "weight", { placeholder: "450,000 TONNES" })}
            {field("Acceleration", "acceleration", { placeholder: "WARP ONE POINT TWO" })}
          </div>
          <div className="mt-3">
            {field("Armament", "armament", { placeholder: "2× QUANTUM SINGULARITY PROJECTORS; ..." })}
          </div>
          <div className="mt-3">
            {field("Notes", "notes", { placeholder: "Operational notes" })}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <NeonButton variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</NeonButton>
            <NeonButton variant="primary" onClick={save} loading={busy}>{editing?._id ? "Update" : "Add"}</NeonButton>
          </div>
        </HoloCard>
      ) : null}

      <div className="mb-4">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by designation, name, class…" className="w-full max-w-md rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm" />
      </div>

      {vessels === undefined ? <div className="uf-skeleton" style={{ height: 200 }} /> : filtered.length === 0 ? (
        <HoloCard><div className="uf-empty">No vessels in the registry. Add one or click "Seed vessels" to import the canonical fleet.</div></HoloCard>
      ) : (
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {filtered.map((v) => (
            <li key={v._id} className="flex flex-wrap items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-4 py-3 bg-[rgba(5,8,22,0.4)]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{v.name}</span>
                  <span className="text-xs text-uf-muted font-mono">{v.designation}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-uf-muted">
                  <StatusPill variant="info">{v.badge}</StatusPill>
                  {v.shipClass ? <span>{v.shipClass}</span> : null}
                  {v.registry ? <span className="font-mono">{v.registry}</span> : null}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <NeonButton variant="ghost" onClick={() => startEdit(v)}><Pencil className="h-4 w-4" /></NeonButton>
                <NeonButton variant="ghost" onClick={() => del(v._id)}><Trash2 className="h-4 w-4 text-uf-red" /></NeonButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </OperatorShell>
  );
}

// Canonical vessel seed data extracted from the original fleet registry
const VESSEL_SEED = [
  {"designation":"F5000-A","name":"SAGITTARIUS STANDARD","badge":"FIGHTER","role":"Multi-role deep-strike fighter","crew":"1 PILOT","armament":"4× PLASMA REPEATERS; 15× ANTIMATTER MICRO-MINES","notes":"Baseline production model"},
  {"designation":"F5000-B","name":"CENTAUR","badge":"FIGHTER","role":"Advanced combat trainer","crew":"2 (TANDEM SEATING)","armament":"2× PLASMA REPEATERS (REDUCED)","notes":"Extended cockpit; dual neural link"},
  {"designation":"F5000-C","name":"WHISPER","badge":"STEALTH","role":"EW / SIGINT / Fleet jammer","crew":"1 PILOT","armament":"2× PLASMA REPEATERS; ENHANCED ECM","notes":"Triple-array SIGINT pods; 12 ghost decoys"},
  {"designation":"F5000-S","name":"SPECTRE","badge":"STEALTH","role":"Deep-space stealth recon","crew":"1 PILOT","armament":"2× PHOTON NEEDLE GUNS","notes":"Full-spectrum stealth coating; zero-emission mode"},
  {"designation":"F5100","name":"SAGITTARIUS II","badge":"FIGHTER","role":"Advanced multi-role combat; superior sensor lock","crew":"1 PILOT","armament":"4× PULSE CANNONS; 2× MICRO PLASMA LANCES; 2× PHOTON NEEDLE GUNS","notes":"Successor airframe — SF FTR 7007"},
  {"designation":"P19","name":"WEREWOLF","badge":"INTERCEPTOR","role":"Extreme speed interception; anti-fighter superiority","crew":"1 PILOT","armament":"4× LIGHTNING ARC EMITTERS; 2× PULSE CANNONS; 2× PHOTON NEEDLE GUNS","notes":"Electro-skip vectoring; 90° in 0.02 km"},
  {"designation":"P20","name":"WEREWOLF II","badge":"INTERCEPTOR","role":"Advanced interception; fleet screen penetration","crew":"1 PILOT","armament":"6× LIGHTNING ARC EMITTERS; 2× PULSE CANNONS","notes":"Upgraded reactor; 40% faster acceleration"},
  {"designation":"GV8","name":"MUSTANG","badge":"STRIKE","role":"Ground-attack / close air support","crew":"1 PILOT","armament":"2× PLASMA REPEATERS; 8× ANTIMATTER DUMB BOMBS","notes":"Low-altitude nap-of-earth specialist"},
  {"designation":"GV9","name":"MUSTANG II","badge":"STRIKE","role":"Advanced ground-attack; VTOL capable","crew":"1 PILOT","armament":"4× PLASMA REPEATERS; 12× GUIDED ANTIMATTER MUNITIONS","notes":"Vertical lift fans; hover-mode strafing"},
  {"designation":"ORION","name":"ORION","badge":"CORVETTE","role":"Scout / light patrol corvette","crew":"4 CREW","armament":"2× PULSE CANNONS; 4× POINT-DEFENSE LASERS","notes":"Fast patrol; long-range sensor suite"},
  {"designation":"ORION MKII","name":"ORION MKII","badge":"CORVETTE","role":"Enhanced scout; electronic warfare suite","crew":"4 CREW","armament":"2× PULSE CANNONS; 6× POINT-DEFENSE LASERS; ECM POD","notes":"Extended range; 72-hour patrol endurance"},
  {"designation":"TR 10","name":"STELLAR BAT","badge":"CORVETTE","role":"Rapid-response interceptor corvette","crew":"6 CREW","armament":"4× PULSE CANNONS; 2× TORPEDO TUBES","notes":"Warp-capable sprint interceptor"},
  {"designation":"KX 19","name":"MATRIX","badge":"ESCORT","role":"Anti-submarine / anti-stealth escort","crew":"12 CREW","armament":"4× DEPTH CHARGE LAUNCHERS; 2× PULSE CANNONS","notes":"Tachyon pulse detection array"},
  {"designation":"F 5100 SAGITTARIUS II","name":"SAGITTARIUS II ADV","badge":"FIGHTER","role":"Advanced multi-role with AI copilot","crew":"1 PILOT + AI","armament":"4× PULSE CANNONS; 4× MICRO PLASMA LANCES","notes":"Neural-link AI copilot integration"},
  {"designation":"P 20 WEREWOLF II","name":"WEREWOLF II ADV","badge":"INTERCEPTOR","role":"Fleet-defense interceptor with missile lock","crew":"1 PILOT","armament":"6× LIGHTNING ARC EMITTERS; 4× AIR-TO-AIR MISSILES","notes":"Multi-target tracking; 6 simultaneous locks"},
  {"designation":"GV 9 MUSTANG II","name":"MUSTANG II ADV","badge":"STRIKE","role":"Heavy ground-attack with guided payload","crew":"1 PILOT","armament":"4× PLASMA REPEATERS; 16× GUIDED MUNITIONS","notes":"Terrain-following radar; auto-targeting"},
  {"designation":"STRYKER PRIDE","name":"STRYKER PRIDE","badge":"CARRIER","shipClass":"Stryker-Class Warp Carrier","role":"Long-range mobile deployment platform and carrier","registry":"SFCRP 8001","crew":"2,400 CREW & PILOTS; 120 FIGHTERS","armament":"8× TACHYON ARRAY BATTERIES; 12× POINT-DEFENSE PULSE CANNONS; 4× GRAVITON PULSE TORPEDO LAUNCHERS","notes":"LONG-RANGE FLEET DEPLOYMENT; WING COORDINATION & MOBILE REARMING","hullLength":"850","hullWidth":"320","decks":"24","weight":"120,000 TONNES","acceleration":"WARP TWO USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"GOLIATH PRIME","name":"GOLIATH PRIME","badge":"DREADNAUGHT","shipClass":"Titan-Class Dreadnaught","role":"Heavy capital combatant and line breaker","registry":"SFDRD 8002","crew":"3,500 CREW","armament":"2× ANTIMATTER SIEGE CANNONS; 16× HEAVY TACHYON PROJECTORS; 24× POINT-DEFENSE PULSE CANNONS; 8× GRAVITON PULSE TORPEDO LAUNCHERS","notes":"CAPITAL LINE BREAKING; PLANETARY BOMBARDMENT; SUSTAINED COMBAT","hullLength":"1100","hullWidth":"400","decks":"32","weight":"280,000 TONNES","acceleration":"WARP ONE POINT FIVE USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"SHADOW LANCER","name":"SHADOW LANCER","badge":"DESTROYER","shipClass":"Lancer-Class Interstellar Destroyer","role":"Medium-heavy offensive escort and anti-capital ship combatant","registry":"SFDST 8003","crew":"450 CREW","armament":"6× NEUTRON BEAM EMITTERS; 8× PULSE CANNONS; 4× GRAVITON PULSE TORPEDO LAUNCHERS","notes":"FAST ESCORT; ANTI-CAPITAL STRIKE; INTERDICTION","hullLength":"450","hullWidth":"160","decks":"12","weight":"45,000 TONNES","acceleration":"WARP TWO POINT FIVE USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"VANGUARD SOVEREIGN","name":"VANGUARD SOVEREIGN","badge":"BATTLESHIP","shipClass":"Vanguard-Class Battleship","role":"Core fleet engagement and primary artillery platform","registry":"SFBAT 8004","crew":"1,800 CREW","armament":"1× SPINAL ANTIMATTER SIEGE CANNON; 12× TACHYON ARRAY BATTERIES; 16× PULSE CANNONS; 6× GRAVITON PULSE TORPEDO LAUNCHERS","notes":"CORE FLEET ENGAGEMENT; PRIMARY ARTILLERY BOMBARDMENT","hullLength":"900","hullWidth":"300","decks":"20","weight":"180,000 TONNES","acceleration":"WARP ONE POINT EIGHT USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"OMEGA MAJESTY","name":"OMEGA MAJESTY","badge":"FLAGSHIP","shipClass":"Omega-Class Super Battleship","role":"Strategic fleet flagship and supreme heavy firepower asset","registry":"SFSBT 8005","crew":"5,000 CREW","armament":"2× QUANTUM SINGULARITY PROJECTORS; 20× HEAVY TACHYON PROJECTORS; 32× POINT-DEFENSE PULSE CANNONS; 12× GRAVITON PULSE TORPEDO LAUNCHERS","notes":"SUPREME FIREPOWER; FLEET FLAGSHIP OPERATIONS; STRATEGIC DOMINANCE","hullLength":"1400","hullWidth":"500","decks":"40","weight":"450,000 TONNES","acceleration":"WARP ONE POINT TWO USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"IRON HAWK","name":"IRON HAWK","badge":"TRANSPORT","shipClass":"Atlas-Class Assault Transport","role":"Planetary invasion and troop/equipment delivery vessel","registry":"SFTRN 8006","crew":"300 CREW; 1,500 TROOPS","armament":"4× PULSE CANNONS; 6× POINT-DEFENSE LASERS","notes":"PLANETARY INVASION; TROOP DEPLOYMENT; HEAVY EQUIPMENT CARGO","hullLength":"500","hullWidth":"200","decks":"16","weight":"60,000 TONNES","acceleration":"WARP ONE POINT FIVE USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"SENTINEL DAWN","name":"SENTINEL DAWN","badge":"ESCORT","shipClass":"Sentinel-Class Frigate","role":"Fleet screen escort and anti-missile defense platform","registry":"SFESC 8007","crew":"200 CREW","armament":"8× POINT-DEFENSE LASERS; 4× PULSE CANNONS; 2× COUNTERMEASURE LAUNCHERS","notes":"FLEET SCREEN; ANTI-MISSILE DEFENSE; EARLY WARNING","hullLength":"300","hullWidth":"100","decks":"8","weight":"25,000 TONNES","acceleration":"WARP THREE USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"BONE CRUSHER","name":"BONE CRUSHER","badge":"SUPPRESSION","shipClass":"Enforcer-Class Suppression Cruiser","role":"Insurgency suppression and orbital denial","registry":"SFSUP 8008","crew":"600 CREW","armament":"6× HEAVY PLASMA BATTERIES; 8× PULSE CANNONS; 4× GRAVITON PULSE TORPEDO LAUNCHERS","notes":"INSURGENCY SUPPRESSION; ORBITAL DENIAL; FORCE PROJECTION","hullLength":"550","hullWidth":"180","decks":"14","weight":"70,000 TONNES","acceleration":"WARP TWO USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"OVERMIND","name":"OVERMIND","badge":"DRONE","shipClass":"Overmind-Class Drone Control Vessel","role":"Autonomous drone swarm command and control","registry":"SFDRV 8009","crew":"80 CREW; 200 DRONES","armament":"DRONE SWARM DIRECTIVE; 4× POINT-DEFENSE LASERS","notes":"DRONE SWARM COORDINATION; AUTONOMOUS COMBAT; REMOTE OPERATIONS","hullLength":"600","hullWidth":"250","decks":"18","weight":"90,000 TONNES","acceleration":"WARP ONE POINT EIGHT USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"PHANTOM SPECTRE","name":"PHANTOM SPECTRE","badge":"STEALTH","shipClass":"Spectre-Class Ghost Ship","role":"Covert operations and deep penetration recon","registry":"SFSTH 8010","crew":"30 CREW","armament":"2× COVERT PLASMA LANCES; ELECTRONIC WARFARE SUITE","notes":"FULL SPECTRUM STEALTH; COVERT OPERATIONS; DEEP PENETRATION RECON","hullLength":"280","hullWidth":"90","decks":"6","weight":"15,000 TONNES","acceleration":"WARP THREE USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"ASCLEPIUS","name":"ASCLEPIUS","badge":"MEDICAL","shipClass":"Asclepius-Class Medical Ark","role":"Fleet hospital and mass casualty evacuation","registry":"SFMED 8011","crew":"500 CREW; 200 MEDICAL STAFF; 1,000 BEDS","armament":"4× POINT-DEFENSE LASERS","notes":"FLEET HOSPITAL; MASS CASUALTY EVACUATION; PLAGUE RESPONSE","hullLength":"700","hullWidth":"280","decks":"22","weight":"100,000 TONNES","acceleration":"WARP TWO USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"HEPHAESTUS","name":"HEPHAESTUS","badge":"INDUSTRIAL","shipClass":"Hephaestus-Class Mobile Repair Dock","role":"Field maintenance, repair, and resupply for the fleet","registry":"SFIND 8012","crew":"800 CREW; 400 ENGINEERS","armament":"6× POINT-DEFENSE LASERS","notes":"MOBILE REPAIR DOCK; FIELD MAINTENANCE; FLEET RESUPPLY","hullLength":"900","hullWidth":"350","decks":"26","weight":"150,000 TONNES","acceleration":"WARP ONE POINT FIVE USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"MK Σ31 ASTRAL RAZOR","name":"ASTRAL RAZOR","badge":"FIGHTER","role":"High-speed dogfighter with plasma blades","crew":"1 PILOT","armament":"2× PLASMA REPEATERS; 2× PLASMA BLADE MOUNTS","notes":"MELEE-CAPABLE FIGHTER; PLASMA BLADE RAMMING"},
  {"designation":"MK Ω21 VOID HOWLER","name":"VOID HOWLER","badge":"INTERCEPTOR","role":"Sonic-disruption interceptor","crew":"1 PILOT","armament":"4× SONIC DISRUPTORS; 2× PULSE CANNONS","notes":"SONIC WARFARE CAPABLE; PILOT DISRUPTION FIELD"},
  {"designation":"MK Φ32 SOLAR SPUR","name":"SOLAR SPUR","badge":"STRIKE","role":"Solar-sail-powered strike craft","crew":"1 PILOT","armament":"2× CONCENTRATED SOLAR BEAMS; 4× ANTIMATTER MISSILES","notes":"SOLAR SAIL PROPULSION; AMBUSH TACTICS"},
  {"designation":"MK Ψ24 SHADOW VELOCITY","name":"SHADOW VELOCITY","badge":"STEALTH","role":"Cloaked assassin craft","crew":"1 PILOT","armament":"2× PHOTON NEEDLE GUNS; CLOAKING DEVICE","notes":"ACTIVE CLOAKING; ASSASSINATION MISSIONS"},
  {"designation":"MK Σ51 COSMIC TALON","name":"COSMIC TALON","badge":"FIGHTER","role":"Heavy assault fighter","crew":"1 PILOT","armament":"4× PULSE CANNONS; 2× GRAVITON CLAWS","notes":"BOARDING CAPABLE; GRAVITON CLAW SYSTEM"},
  {"designation":"MK Ω62 PHANTOM SINGULARITY","name":"PHANTOM SINGULARITY","badge":"DREADNAUGHT","shipClass":"Phantom-Class Singular Dreadnaught","role":"Reality-warping capital ship","registry":"SFPHN 8013","crew":"4,000 CREW","armament":"2× SINGULARITY PROJECTORS; 24× HEAVY TACHYON PROJECTORS","notes":"REALITY WARPING; SPACETIME DISTORTION; OMEGA THREAT LEVEL","hullLength":"1200","hullWidth":"450","decks":"36","weight":"400,000 TONNES","acceleration":"WARP ONE POINT TWO USING SINGULARITY DRIVE"},
  {"designation":"MK Φ41 STARLANCE PRIME","name":"STARLANCE PRIME","badge":"DESTROYER","shipClass":"Starlance-Class Precision Destroyer","role":"Long-range precision strike destroyer","registry":"SFSTL 8014","crew":"350 CREW","armament":"1× SPINAL NEUTRON LANCE; 8× PULSE CANNONS; 4× TORPEDO TUBES","notes":"PRECISION STRIKE; LONG-RANGE ENGAGEMENT; SPINAL NEUTRON LANCE","hullLength":"400","hullWidth":"140","decks":"10","weight":"35,000 TONNES","acceleration":"WARP THREE USING TACHYON WAVE MICROMANIPULATION"},
  {"designation":"MK Ψ23 NIGHTFANG VELOCITOR","name":"NIGHTFANG VELOCITOR","badge":"INTERCEPTOR","role":"Ultra-fast night interceptor","crew":"1 PILOT","armament":"4× ION FLARE EMITTERS; 2× PLASMA REPEATERS","notes":"NIGHT COMBAT SPECIALIST; ION FLARE BLINDING"},
  {"designation":"MK Σ33 NOVA STRIDER","name":"NOVA STRIDER","badge":"FIGHTER","role":"Explosive-burst assault fighter","crew":"1 PILOT","armament":"2× NOVA CHARGE LAUNCHERS; 4× PLASMA REPEATERS","notes":"NOVA CHARGE PROXIMITY DETONATION; SHOCKWAVE ASSAULT"},
];
