import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { enforceRateLimit } from "../rateLimit";

/**
 * Server-side gate for OTP email sends. The Auth page calls this *before*
 * `signIn("email-otp", ...)` so spammy code requests get a clear error
 * instead of burning Resend quota.
 *
 * Note: the read-only auth config (`src/convex/auth.ts`) is owned by the
 * platform, so the send itself can't be intercepted here — this gate enforces
 * the limit on every request the app makes, and Convex Auth additionally
 * throttles failed verification attempts server-side.
 */
export const checkOtpRate = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const key = email.trim().toLowerCase();
    if (!key) throw new Error("Email is required.");
    await enforceRateLimit(
      ctx,
      "otp_send",
      key,
      3,
      15 * 60 * 1000,
      "Too many sign-in codes requested for this address. Wait 15 minutes and try again.",
    );
    return { ok: true };
  },
});
