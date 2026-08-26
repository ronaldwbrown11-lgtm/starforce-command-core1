import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatusPill } from "../uf/StatusPill";

export function OnlineUsers() {
  const data = useQuery(api.social.onlineCount);
  const count = data?.count ?? 0;
  return (
    <section aria-label="Online users" className="uf-panel p-4 inline-flex items-center gap-3">
      <StatusPill variant="success">Online</StatusPill>
      <span className="text-2xl font-semibold">{count}</span>
      <span className="text-uf-muted text-sm">
        {count === 1 ? "operator active" : "operators active"}
      </span>
    </section>
  );
}
