import { LegalPage } from "@/components/uf/LegalPage";

import { usePageMeta } from "@/hooks/use-page-meta";
export default function Privacy() {
  usePageMeta({ title: "Privacy Policy — Star Force Base 1198", description: "How Star Force Base 1198 collects, uses, and protects your data.", noindex: false });

  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      lead="How Star Force Base 1198 collects, uses, and protects your data."
      updated="August 2026"
      sections={[
        {
          heading: "Overview",
          body: (
            <p>
              This Privacy Policy explains what information Star Force Base 1198
              ("we", "us") collects when you use the site, why we collect it,
              and the choices you have. By creating an account or using the
              service you agree to the practices described here.
            </p>
          ),
        },
        {
          heading: "Information we collect",
          body: (
            <>
              <p>
                <strong>Account information</strong> — display name, email
                address (used for sign-in codes), avatar, rank, fleet, bio, and
                membership tier.
              </p>
              <p>
                <strong>Content you submit</strong> — stories, lore entries,
                comments, forum threads, group posts and messages, support
                tickets, and any files you upload.
              </p>
              <p>
                <strong>Usage information</strong> — activity, XP, per-tier
                usage counters, login history, and session records used to keep
                the service secure.
              </p>
              <p>
                <strong>Payment information</strong> — card details are handled
                entirely by our payment provider, Stripe. We store only your
                billing tier and subscription status, never card numbers.
              </p>
            </>
          ),
        },
        {
          heading: "How we use information",
          body: (
            <p>
              We use your data to operate the service: authenticating you,
              publishing and moderating content, sending notifications, billing
              memberships, protecting the platform from abuse, and improving
              the experience. We do not sell your personal data.
            </p>
          ),
        },
        {
          heading: "Sharing & third parties",
          body: (
            <>
              <p>
                We rely on a small number of processors to run the service:
                Convex (cloud database and file storage), Stripe (payments and
                subscription billing), and an email delivery provider (sign-in
                codes). Each processor is bound to handle your data only to
                provide its service to us.
              </p>
              <p>
                We may disclose information where required by law or to protect
                the safety and integrity of the platform and its members.
              </p>
            </>
          ),
        },
        {
          heading: "Storage & retention",
          body: (
            <p>
              Your data is stored on Convex cloud infrastructure. We keep
              account and content data while your account is active. When you
              delete your account, we remove your personal profile data; public
              content you authored may remain attributable where it was part of
              the community archive.
            </p>
          ),
        },
        {
          heading: "Your rights",
          body: (
            <>
              <p>
                You can access and correct most of your information directly in
                your profile and account settings. You may also request an
                export of your data or deletion of your account at any time.
              </p>
              <p>
                To exercise these rights, open a support ticket from the
                Support page and we will respond within a reasonable time.
              </p>
            </>
          ),
        },
        {
          heading: "Children",
          body: (
            <p>
              The service is not directed at children under 13. If you believe a
              child under 13 has provided us personal information, contact us
              and we will delete it.
            </p>
          ),
        },
        {
          heading: "Security",
          body: (
            <p>
              We protect accounts with encrypted sign-in codes, session
              management, and capability-gated operator access. No service is
              completely secure, but we take reasonable measures to safeguard
              your data.
            </p>
          ),
        },
        {
          heading: "Changes to this policy",
          body: (
            <p>
              We may update this policy as the service evolves. Material
              changes will be reflected by the "Last updated" date above and,
              where significant, announced in the activity feed.
            </p>
          ),
        },
        {
          heading: "Contact",
          body: (
            <p>
              Questions about this policy? Open a ticket via the Support page or
              email the address listed there, and we'll get back to you.
            </p>
          ),
        },
      ]}
    />
  );
}
