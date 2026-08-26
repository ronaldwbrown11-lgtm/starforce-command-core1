import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "violet" | "gold" | "danger" | "ghost";

export type NeonButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
};

const VARIANT_CLASS: Record<Variant, string> = {
  default: "",
  primary: "uf-btn--primary",
  violet: "uf-btn--violet",
  gold: "uf-btn--gold",
  danger: "uf-btn--danger",
  ghost: "uf-btn--ghost",
};

export const NeonButton = React.forwardRef<HTMLButtonElement, NeonButtonProps>(
  function NeonButton(
    { className, variant = "default", loading, iconLeft, iconRight, children, disabled, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={rest.type ?? "button"}
        className={cn("uf-btn", VARIANT_CLASS[variant], className)}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? (
          <span aria-hidden="true" className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
        ) : (
          iconLeft
        )}
        <span>{children}</span>
        {iconRight}
      </button>
    );
  },
);
