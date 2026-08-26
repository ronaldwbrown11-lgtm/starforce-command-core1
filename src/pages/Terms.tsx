import { LegalPage } from "@/components/uf/LegalPage";

import { usePageMeta } from "@/hooks/use-page-meta";
export default function Terms() {
  usePageMeta({ title: "Terms of Service — Star Force Base 1198", description: "Terms and conditions for using Star Force Base 1198.", noindex: false });

  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      lead="The rules of engagement for Star Force Base 1198."
      updated="August 2026"
      sections={[
        {
          heading: "Acceptance",
          body: (
            <p>
              By accessing or using Star Force Base 1198 ("the service"), you
              agree to these Terms of Service. If you do not agree, do not use
              the service. We may update these terms; continued use after
              changes constitutes acceptance.
            </p>
          ),
        },
        {
          heading: "Eligibility & accounts",
          body: (
            <>
              <p>
                You must be at least 13 years old to use the service. You agree
                to provide accurate account information, keep your credentials
                secure, and maintain one account per person.
              </p>
              <p>
                Sign-in is protected by email verification codes. You are
                responsible for activity on your account and must notify us
                immediately of any unauthorized use.
              </p>
            </>
          ),
        },
        {
          heading: "Your content & submissions",
          body: (
            <>
              <p>
                You retain ownership of content you post — stories, lore,
                comments, forum threads, group posts, and uploads. By posting
                you grant us a non-exclusive license to host, display, and
                distribute that content within the service.
              </p>
              <p>
                You promise that your content is yours (or you have permission),
                does not infringe anyone's rights, and is not unlawful. Story
                and lore submissions are reviewed by operators before
                publication and may be rejected, edited, or removed for any
                reason.
              </p>
            </>
          ),
        },
        {
          heading: "Copyright & commercial use",
          body: (
            <>
              <p>
                All content published on the service — stories, lore entries,
                artwork, videos, transmissions, resources, and the Star Force
                Base 1198 branding and site design — is protected by copyright
                and remains the property of its respective authors or of the
                operators, as applicable.
              </p>
              <p>
                <strong>Commercial use of any content on this site requires
                prior written permission.</strong> This includes reproducing,
                republishing, adapting, licensing, or monetizing any story,
                artwork, or other material for commercial purposes — whether
                in print, digital products, merchandise, film, games, or any
                other medium.
              </p>
              <p>
                Personal, non-commercial use — reading, sharing links, and
                brief quotations with attribution — is welcome. For permission
                to use content commercially, contact us through the Support
                page and identify the specific material and intended use.
              </p>
              <p>
                By posting content to the service you confirm that you hold
                the rights to it and that it does not infringe the copyright
                of others. Unauthorized commercial use of site content may
                result in removal of access and legal action.
              </p>
            </>
          ),
        },
        {
          heading: "Membership & payments",
          body: (
            <>
              <p>
                Paid tiers are recurring monthly subscriptions billed through
                Stripe. Upgrades apply once payment is confirmed; downgrades
                take effect immediately and cancel any active subscription.
              </p>
              <p>
                Refunds are available within 14 days of your first charge. You
                may cancel at any time — cancellation stops future billing and
                returns you to the Free tier.
              </p>
            </>
          ),
        },
        {
          heading: "Acceptable use",
          body: (
            <p>
              You agree not to: harass, threaten, or dox other members; post
              unlawful, infringing, or explicit content; spam or manipulate
              voting, XP, or rankings; attempt to access other accounts or
              systems; or otherwise disrupt the service. Operators may remove
              content and suspend accounts that violate these rules.
            </p>
          ),
        },
        {
          heading: "Moderation & termination",
          body: (
            <p>
              We may remove content, restrict features, or suspend accounts that
              violate these terms, endanger the community, or violate the law.
              You may stop using the service at any time; we may terminate
              access for material breaches.
            </p>
          ),
        },
        {
          heading: "Disclaimers",
          body: (
            <p>
              The service is provided "as is" and "as available" without
              warranties of any kind, express or implied. We do not warrant
              that the service will be uninterrupted, error-free, or free of
              harmful components. Content on the site reflects its authors and
              not the operators.
            </p>
          ),
        },
        {
          heading: "Limitation of liability",
          body: (
            <p>
              To the maximum extent permitted by law, we are not liable for
              indirect, incidental, special, or consequential damages arising
              from your use of the service, including loss of content or data.
              Our total liability for any claim is limited to the amount you
              paid us in the three months before the claim.
            </p>
          ),
        },
        {
          heading: "Governing law",
          body: (
            <p>
              These terms are governed by the laws applicable to the
              operator's jurisdiction, without regard to conflict-of-law
              principles. Any disputes will be resolved in the appropriate
              courts of that jurisdiction.
            </p>
          ),
        },
        {
          heading: "Contact",
          body: (
            <p>
              Questions about these terms? Open a ticket via the Support page
              and our team will respond.
            </p>
          ),
        },
      ]}
    />
  );
}
