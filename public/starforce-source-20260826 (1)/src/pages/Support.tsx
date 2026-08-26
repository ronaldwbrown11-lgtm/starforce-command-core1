import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import {
  SiteShell,
  PageHero,
  NeonButton,
  HoloCard,
  StatusPill,
} from "@/components/uf";
import { toast } from "sonner";

import { usePageMeta } from "@/hooks/use-page-meta";
const FAQ = [
  { q: "How do I report inappropriate content?", a: "Use the report button on the comment or post. Operators triage 24/7." },
  { q: "How do I change my membership tier?", a: "Open Membership, click Upgrade or Downgrade. Changes apply within minutes." },
  { q: "Where can I find community policies?", a: "Resources → Community Charter, Lore Style Guide, Operator Briefing Templates." },
];

const TICKET_STATUS_VARIANT: Record<string, "warning" | "info" | "default"> = {
  open: "warning",
  responded: "info",
  closed: "default",
};

export default function Support() {
  const { user } = useAuth();
  const createTicket = useMutation(api.support.createTicket);
  const myTickets = useQuery(api.support.myTickets);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setSending(true);
    try {
      await createTicket({
        email: String(formData.get("email") ?? ""),
        topic: String(formData.get("topic") ?? ""),
        message: String(formData.get("message") ?? ""),
      });
      setSent(true);
      toast.success("Ticket filed. We'll respond within one business day.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to file ticket.");
    } finally {
      setSending(false);
    }
  };
  usePageMeta({ title: "Support — Star Force Base 1198", description: "Get help with your account, report issues, or contact command staff.", noindex: false });


  return (
    <SiteShell>
      <PageHero
        eyebrow="Support Center"
        title="Open a channel. We answer."
        lead="Search the knowledge base. If you don't find it, file a ticket. We acknowledge within one business day."
        primary={{ label: "Open a ticket", href: "#contact", variant: "primary" }}
        secondary={{ label: "View Status", href: "/operator/health", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="uf-grid uf-grid--2">
          <HoloCard id="contact">
            <span className="uf-eyebrow">Contact</span>
            <h3 className="text-xl mt-2">Open a ticket</h3>
            {sent ? (
              <div className="mt-3 space-y-3">
                <p className="text-uf-green" role="status">
                  ✓ Channel opened. Our team will respond within one business day.
                </p>
                <NeonButton
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSent(false);
                  }}
                >
                  File another ticket
                </NeonButton>
              </div>
            ) : (
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={handleSubmit}
              >
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Your email
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={user?.email ?? ""}
                    placeholder="name@example.com"
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Topic
                  <select
                    name="topic"
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                  >
                    <option>Account / Membership</option>
                    <option>Story submission</option>
                    <option>Moderation / report</option>
                    <option>Bug / technical</option>
                  </select>
                </label>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Message
                  <textarea
                    name="message"
                    required
                    placeholder="Tell us what's going on…"
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] min-h-32"
                  />
                </label>
                <NeonButton type="submit" variant="primary" loading={sending}>
                  Submit ticket
                </NeonButton>
              </form>
            )}
          </HoloCard>
          <HoloCard>
            <span className="uf-eyebrow">Status</span>
            <h3 className="text-xl mt-2">Fleet status</h3>
            <ul className="text-sm space-y-2 mt-3">
              <li className="flex items-center gap-2"><StatusPill variant="success">OK</StatusPill> Core systems</li>
              <li className="flex items-center gap-2"><StatusPill variant="success">OK</StatusPill> REST API</li>
              <li className="flex items-center gap-2"><StatusPill variant="success">OK</StatusPill> Cache layer</li>
              <li className="flex items-center gap-2"><StatusPill variant="warning">Warning</StatusPill> Backups — provider integration pending</li>
            </ul>
            <h3 className="text-lg mt-6">Escalation paths</h3>
            <ul className="text-sm space-y-2 mt-2 text-uf-muted list-disc list-inside">
              <li>Community Moderator (low risk)</li>
              <li>Operator (medium risk)</li>
              <li>Senior Operator (high risk, security-relevant)</li>
            </ul>
          </HoloCard>
        </div>
      </section>
      {user && myTickets !== undefined && myTickets.length > 0 ? (
        <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
          <h2 className="text-2xl font-semibold mb-2">Your tickets</h2>
          <p className="text-uf-muted text-sm mb-6">
            Track status and read operator replies. New replies also land in
            your notification bell.
          </p>
          <div className="flex flex-col gap-3">
            {myTickets.map((t) => (
              <HoloCard key={String(t._id)}>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill
                    variant={TICKET_STATUS_VARIANT[t.status] ?? "default"}
                  >
                    {t.status}
                  </StatusPill>
                  <span className="font-semibold">{t.topic}</span>
                  <span className="text-uf-muted text-xs ml-auto">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-uf-muted mt-2 whitespace-pre-wrap">
                  {t.message}
                </p>
                {t.replies.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-uf-muted text-xs uppercase tracking-[0.16em]">
                      Operator replies ({t.replies.length})
                    </p>
                    {t.replies.map((r, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] p-3 text-sm"
                      >
                        <span className="text-uf-cyan text-xs font-semibold">
                          {r.by}
                        </span>
                        <p className="whitespace-pre-wrap mt-1">{r.body}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </HoloCard>
            ))}
          </div>
        </section>
      ) : null}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <h2 className="text-2xl font-semibold mb-6">Frequently asked</h2>
        <div className="uf-grid uf-grid--2">
          {FAQ.map((f) => (
            <HoloCard key={f.q}>
              <h3 className="text-lg font-semibold">{f.q}</h3>
              <p className="text-uf-muted text-sm mt-2">{f.a}</p>
            </HoloCard>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
