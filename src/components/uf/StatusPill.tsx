import { cn } from "@/lib/utils";

type Variant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "violet"
  | "gold"
  | "cyan";
const VARIANT_CLASS: Record<Variant, string> = {
  default: "",
  info: "uf-pill--info",
  success: "uf-pill--success",
  warning: "uf-pill--warning",
  danger: "uf-pill--danger",
  violet: "uf-pill--violet",
  gold: "uf-pill--gold",
  cyan: "uf-pill--cyan",
};

export function StatusPill({
  variant = "default",
  children,
  className,
}: {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("uf-pill", VARIANT_CLASS[variant], className)}>
      {children}
    </span>
  );
}
