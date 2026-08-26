import { Link, NavLink, useLocation } from "react-router";
import { useState } from "react";
import { Activity, BookOpen, BookOpenText, ClipboardCheck, FileCheck2, GaugeCircle, History, IdCard, LayoutDashboard, LifeBuoy, ListChecks, Map as MapIcon, MapPin, Megaphone, Ship, Menu, Palette, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteShell, ParallaxBackground } from "@/components/uf";
import { FleetStatus } from "@/components/widgets/FleetStatus";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const NAV = [
  { label: "Dashboard", href: "/operator", icon: LayoutDashboard, exact: true },
  { label: "Featured Content", href: "/operator/featured", icon: Sparkles },
  { label: "Moderation", href: "/operator/moderation", icon: ShieldCheck },
  { label: "Field Reports", href: "/operator/reports", icon: ClipboardCheck },
  { label: "Story Approval", href: "/operator/stories", icon: FileCheck2 },
  { label: "Content Desk", href: "/operator/content", icon: BookOpen },
  { label: "Lore Library", href: "/operator/lore-library", icon: BookOpenText },
  { label: "Sector Map", href: "/operator/sector-map", icon: MapIcon },
  { label: "Discoveries", href: "/operator/discoveries", icon: MapPin },
  { label: "Appearance", href: "/operator/appearance", icon: Palette },
  { label: "Team Roster", href: "/operator/team", icon: Users },
  { label: "Fleet Registry", href: "/operator/fleet", icon: Ship },
  { label: "Blog Posts", href: "/operator/blog", icon: BookOpen },
  { label: "FAQs", href: "/operator/faqs", icon: ListChecks },
  { label: "Broadcasts", href: "/operator/broadcasts", icon: Megaphone },
  { label: "Support Inbox", href: "/operator/support", icon: LifeBuoy },
  { label: "Users", href: "/operator/users", icon: Users },
  { label: "Analytics", href: "/operator/analytics", icon: GaugeCircle },
  { label: "Health", href: "/operator/health", icon: Activity },
  { label: "Sessions", href: "/operator/sessions", icon: IdCard },
  { label: "Login Logs", href: "/operator/logins", icon: ListChecks },
  { label: "Identity", href: "/operator/identity", icon: IdCard },
  { label: "Audit", href: "/operator/audit", icon: History },
  { label: "Reference Desk", href: "/operator/references", icon: ListChecks },
];

export function OperatorShell({ children }: { children: React.ReactNode }) {
  return <SiteShell hideNav><div className="relative"><ParallaxBackground palette="sapphire" intensity="low" /><div className="uf-opc relative z-10"><OperatorRail /><main className="uf-opc__main min-w-0 overflow-x-hidden" id="uf-main">{children}</main><aside className="uf-opc__notif hidden xl:block" aria-label="Operator notifications"><h2 className="uf-eyebrow mb-3">Right rail</h2><FleetStatus compact={false} /></aside></div></div></SiteShell>;
}

function OperatorRail() {
  const [open, setOpen] = useState(false);
  const health = useQuery(api.operator.systemHealth);
  const location = useLocation();
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) { setPrevPath(location.pathname); setOpen(false); }

  return <><header className="uf-opc__status" role="region" aria-label="Operator console status bar"><button type="button" className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--uf-border)]" aria-label={open ? "Close rail" : "Open rail"} aria-expanded={open} aria-controls="uf-opc-rail" onClick={() => setOpen((v) => !v)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button><span className="uf-eyebrow">Ultra Force Console</span><span className="ml-auto text-uf-muted text-xs uppercase tracking-[0.16em]">Fleet: {health?.overall ?? "syncing…"}</span></header><nav id="uf-opc-rail" aria-label="Operator rail" className={cn("uf-opc__rail min-w-0 max-h-[calc(100vh-7rem)] overflow-y-auto overflow-x-hidden", "lg:block", open ? "block fixed inset-y-12 left-0 right-auto z-50" : "hidden")}><div className="lg:hidden flex justify-end mb-3"><button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--uf-border)]" aria-label="Close rail" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div><ul className="flex flex-col gap-1 list-none p-0 m-0">{NAV.map((item) => <li key={item.href} className="min-w-0"><NavLink to={item.href} end={item.exact} className={({ isActive }) => cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm min-w-0", isActive ? "bg-[rgba(0,229,255,0.10)] text-uf-text shadow-[var(--uf-glow-cyan)]" : "text-uf-muted hover:bg-[rgba(0,229,255,0.06)]")}><item.icon className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{item.label}</span></NavLink></li>)}</ul><hr className="border-[color:var(--uf-border)] my-4" /><p className="text-xs text-uf-muted">Operator console. Every action is capability-gated and audit-logged.</p><Link to="/" className="uf-btn uf-btn--ghost mt-3 w-full">Back to public site</Link></nav></>;
}
