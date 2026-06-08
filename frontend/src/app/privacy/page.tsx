import Link from "next/link";

export default function PrivacyNoticePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link
          href="/app/profile"
          className="text-sm font-medium text-slate-600 underline-offset-4 hover:underline dark:text-slate-300"
        >
          Back to Settings
        </Link>

        <div className="mt-6 space-y-5">
          <section className="max-w-4xl mx-auto px-6 py-12">
            <div className="space-y-12">

              {/* Header */}
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                  Privacy Statement
                </h1>
                <p className="mt-3 text-sm text-slate-500">
                  Last Updated: DD Month YYYY
                </p>
              </div>

              {/* Introduction */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  1. Introduction
                </h2>

                <div className="mt-4 prose prose-slate max-w-none">
                  <p>
                    ROOMAH ("we", "our", or "us") respects your privacy and is committed
                    to protecting your personal data in accordance with the Personal Data
                    Protection Act 2010 (PDPA) of Malaysia and other applicable laws and
                    regulations.
                  </p>

                  <p>
                    This Privacy Statement explains how we collect, use, disclose, store,
                    and protect personal data when you use ROOMAH and related services.
                  </p>

                  <p>
                    By accessing or using ROOMAH, you acknowledge that you have read and
                    understood this Privacy Statement.
                  </p>
                </div>
              </section>

              {/* Information We Collect */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  2. Information We Collect
                </h2>

                <div className="mt-6 space-y-6">

                  <div>
                    <h3 className="text-lg font-medium text-slate-800">
                      Account Information
                    </h3>

                    <ul className="mt-3 list-disc pl-6 text-slate-600 space-y-1">
                      <li>Name</li>
                      <li>Email address</li>
                      <li>Login credentials</li>
                      <li>Authentication identifiers</li>
                      <li>User role and permissions</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-slate-800">
                      Customer and Lead Information
                    </h3>

                    <ul className="mt-3 list-disc pl-6 text-slate-600 space-y-1">
                      <li>Customer names</li>
                      <li>Telephone numbers</li>
                      <li>Email addresses</li>
                      <li>Budget information</li>
                      <li>Property preferences</li>
                      <li>Viewing history</li>
                      <li>Follow-up records</li>
                      <li>Communication notes</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-slate-800">
                      Property Information
                    </h3>

                    <ul className="mt-3 list-disc pl-6 text-slate-600 space-y-1">
                      <li>Property owner names</li>
                      <li>Contact details</li>
                      <li>Property addresses</li>
                      <li>Listing information</li>
                      <li>Property specifications</li>
                      <li>Property images and documents</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-slate-800">
                      Technical Information
                    </h3>

                    <ul className="mt-3 list-disc pl-6 text-slate-600 space-y-1">
                      <li>IP address</li>
                      <li>Browser information</li>
                      <li>Device information</li>
                      <li>Session data</li>
                      <li>Usage analytics</li>
                      <li>System logs</li>
                    </ul>
                  </div>

                </div>
              </section>

              {/* How We Use Data */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  3. How We Use Personal Data
                </h2>

                <p className="mt-4 text-slate-600">
                  We use personal data only for legitimate business purposes including:
                </p>

                <ul className="mt-4 list-disc pl-6 text-slate-600 space-y-2">
                  <li>Managing CRM records and customer relationships</li>
                  <li>Tracking leads and customer interactions</li>
                  <li>Scheduling property viewings</li>
                  <li>Managing property listings</li>
                  <li>Calculating commissions and performance metrics</li>
                  <li>Generating operational reports and dashboards</li>
                  <li>Improving system performance and user experience</li>
                  <li>Preventing fraud and maintaining platform security</li>
                  <li>Complying with legal and regulatory obligations</li>
                </ul>
              </section>

              {/* Legal Basis */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  4. Legal Basis for Processing
                </h2>

                <ul className="mt-4 list-disc pl-6 text-slate-600 space-y-2">
                  <li>Consent provided by the data subject</li>
                  <li>Performance of contractual obligations</li>
                  <li>Compliance with legal obligations</li>
                  <li>Legitimate business interests</li>
                </ul>
              </section>

              {/* Disclosure */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  5. Disclosure of Personal Data
                </h2>

                <p className="mt-4 text-slate-600">
                  ROOMAH does not sell personal data.
                </p>

                <p className="mt-4 text-slate-600">
                  Information may be disclosed to:
                </p>

                <ul className="mt-4 list-disc pl-6 text-slate-600 space-y-2">
                  <li>Authorised employees and agents</li>
                  <li>Property negotiators and managers</li>
                  <li>Cloud hosting and infrastructure providers</li>
                  <li>Professional advisers and auditors</li>
                  <li>Regulatory and law enforcement authorities</li>
                </ul>
              </section>

              {/* Security */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  6. Data Security
                </h2>

                <p className="mt-4 text-slate-600">
                  We implement reasonable technical and organisational safeguards to
                  protect personal data against unauthorised access, disclosure,
                  alteration, loss, destruction, or misuse.
                </p>

                <ul className="mt-4 list-disc pl-6 text-slate-600 space-y-2">
                  <li>Encrypted HTTPS connections</li>
                  <li>Role-based access control (RBAC)</li>
                  <li>Secure authentication mechanisms</li>
                  <li>Audit logging and activity tracking</li>
                  <li>Regular backups</li>
                  <li>Periodic security reviews</li>
                </ul>
              </section>

              {/* Retention */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  7. Data Retention
                </h2>

                <p className="mt-4 text-slate-600">
                  Personal data is retained only for as long as necessary to provide
                  services, comply with legal obligations, resolve disputes, and maintain
                  legitimate business records.
                </p>
              </section>

              {/* International Transfers */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  8. International Data Transfers
                </h2>

                <p className="mt-4 text-slate-600">
                  Where cloud infrastructure or service providers operate outside
                  Malaysia, personal data may be transferred internationally subject to
                  appropriate safeguards and security controls.
                </p>
              </section>

              {/* Rights */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  9. Your Rights
                </h2>

                <ul className="mt-4 list-disc pl-6 text-slate-600 space-y-2">
                  <li>Request access to your personal data</li>
                  <li>Request correction of inaccurate information</li>
                  <li>Withdraw consent where applicable</li>
                  <li>Object to certain processing activities</li>
                  <li>Request deletion where legally permitted</li>
                </ul>
              </section>

              {/* Cookies */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  10. Cookies and Analytics
                </h2>

                <p className="mt-4 text-slate-600">
                  ROOMAH may use cookies and similar technologies to maintain user
                  sessions, improve functionality, analyse performance, and enhance the
                  overall user experience.
                </p>
              </section>

              {/* Third Party Services */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  11. Third-Party Services
                </h2>

                <p className="mt-4 text-slate-600">
                  ROOMAH may integrate with authentication providers, cloud hosting
                  providers, analytics platforms, and communication tools. These services
                  operate under their own privacy policies.
                </p>
              </section>

              {/* Children */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  12. Children's Privacy
                </h2>

                <p className="mt-4 text-slate-600">
                  ROOMAH is intended for business and professional use and is not directed
                  at individuals under 18 years of age.
                </p>
              </section>

              {/* Changes */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  13. Changes to this Privacy Statement
                </h2>

                <p className="mt-4 text-slate-600">
                  We may update this Privacy Statement from time to time. Updated versions
                  will be published within the platform and become effective immediately
                  upon publication unless otherwise stated.
                </p>
              </section>

              {/* Contact */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  14. Contact Us
                </h2>

                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-6">
                  <p className="font-medium text-slate-900">
                    Data Protection Officer
                  </p>

                  <div className="mt-3 text-slate-600 space-y-1">
                    <p>Email: privacy@roomah.my</p>
                    <p>Address: [Company Registered Address]</p>
                  </div>
                </div>
              </section>

              {/* Consent */}
              <section>
                <h2 className="text-2xl font-semibold text-slate-900">
                  15. Consent
                </h2>

                <p className="mt-4 text-slate-600">
                  By accessing or using ROOMAH, you acknowledge and consent to the
                  collection, use, storage, and disclosure of personal data as described
                  in this Privacy Statement and as permitted under applicable laws.
                </p>
              </section>

            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
