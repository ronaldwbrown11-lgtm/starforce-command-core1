import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Coins, Check } from "lucide-react";
import { HoloCard, NeonButton } from "@/components/uf";
import { FRAME_CATALOG } from "@/lib/economy";
import { toast } from "sonner";

type FrameId = keyof typeof FRAME_CATALOG;

export function StarCreditsCard({
  credits,
  frame,
  frames,
}: {
  credits: number;
  frame?: string | null;
  frames?: string[];
}) {
  const buy = useMutation(api.economy.purchaseFrame);
  const [busy, setBusy] = useState<string | null>(null);

  async function handle(frameId: string) {
    setBusy(frameId);
    try {
      const res = await buy({ frame: frameId });
      if (res.newlyOwned) {
        toast.success(`Frame acquired — ${FRAME_CATALOG[frameId as FrameId].label} equipped.`);
      } else {
        toast.success(`Equipped ${FRAME_CATALOG[frameId as FrameId].label}.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <HoloCard>
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="uf-eyebrow">Star Credits</span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--uf-gold)]/60 bg-[rgba(230,168,23,0.08)] px-3 py-1 text-sm font-semibold"
          style={{ color: "var(--uf-gold)" }}
        >
          <Coins className="h-4 w-4" aria-hidden />
          {credits.toLocaleString()}
        </span>
      </div>
      <p className="text-uf-muted text-xs mb-4">
        Earned for published stories, approved lore, certified discoveries,
        mission reports, and comments. Spend them in the Cosmetic Lab below —
        more cosmetics arrive each cycle.
      </p>

      <span className="uf-eyebrow">Cosmetic Lab</span>
      <ul className="list-none p-0 m-0 mt-3 grid grid-cols-2 gap-3">
        {Object.entries(FRAME_CATALOG).map(([id, spec]) => {
          const owned = (frames ?? []).includes(id);
          const equipped = frame === id;
          return (
            <li
              key={id}
              className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(6,10,18,0.6)] p-3"
              aria-label={`${spec.label} — ${spec.description}`}
            >
              {/* Frame swatch */}
              <div
                aria-hidden
                className="h-9 w-9 rounded-full mx-auto"
                style={{
                  background: `conic-gradient(from 220deg, ${spec.colors[0]}, ${spec.colors[1]}, ${spec.colors[2]}, ${spec.colors[0]})`,
                  boxShadow: `0 0 12px ${spec.colors[0]}66`,
                }}
              />
              <p className="text-center text-xs font-semibold mt-2" style={{ color: spec.colors[0] }}>
                {spec.label}
              </p>
              <p className="text-center text-[10px] text-uf-muted mt-0.5 leading-snug">
                {owned ? "Owned" : `${spec.cost.toLocaleString()} credits`}
              </p>
              <div className="mt-2 flex justify-center">
                {equipped ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-semibold"
                    style={{ color: spec.colors[0] }}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden /> Equipped
                  </span>
                ) : (
                  <NeonButton
                    variant="ghost"
                    className="!px-3 !py-1 !text-xs"
                    loading={busy === id}
                    disabled={!owned && credits < spec.cost}
                    onClick={() => handle(id)}
                  >
                    {owned ? "Equip" : "Buy"}
                  </NeonButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </HoloCard>
  );
}
