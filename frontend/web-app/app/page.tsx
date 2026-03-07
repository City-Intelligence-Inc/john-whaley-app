import Link from "next/link";
import {
  Users,
  Brain,
  Upload,
  Sparkles,
  CheckCircle2,
  BarChart3,
  Linkedin,
  SlidersHorizontal,
  Shield,
  Zap,
  ArrowRight,
  UserCheck,
  Clock,
  Target,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#1e293b] text-white text-sm font-bold">
              ER
            </div>
            <span className="text-lg font-semibold">Event Review</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
          </nav>
          <Link
            href="/dashboard"
            className="rounded-lg bg-[#1e293b] px-4 py-2 text-sm font-medium text-white hover:bg-[#334155] transition-colors"
          >
            Open Dashboard
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50" />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm text-blue-700">
              <Sparkles className="size-4" />
              AI-Powered Event Curation
            </div>
            <h1 className="text-5xl font-bold tracking-tight leading-[1.1] md:text-6xl">
              Stop reviewing applicants manually.{" "}
              <span className="text-[#3b82f6]">Let AI curate your perfect guest list.</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-2xl">
              Upload your applicant list, set your criteria, and let AI enrich profiles,
              categorize attendees, and recommend accepts — so you can focus on hosting,
              not screening.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1e293b] px-6 py-3 text-base font-medium text-white hover:bg-[#334155] transition-colors"
              >
                Start Reviewing Free
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                See How It Works
              </a>
            </div>
            <div className="mt-12 flex items-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-500" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-500" />
                Pay per applicant reviewed
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-500" />
                Works with Luma, CSV, and more
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="border-y bg-gray-50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-[#1e293b]">10,000+</div>
              <div className="mt-1 text-sm text-gray-500">Applicants Reviewed</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#1e293b]">85%</div>
              <div className="mt-1 text-sm text-gray-500">Time Saved on Curation</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#1e293b]">50+</div>
              <div className="mt-1 text-sm text-gray-500">Events Powered</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#1e293b]">3 min</div>
              <div className="mt-1 text-sm text-gray-500">Avg. Review Time per 100</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Event curation is broken
            </h2>
            <div className="mt-8 space-y-4">
              {[
                "Manually reviewing hundreds of applicants takes hours",
                "LinkedIn profiles are outdated or missing key context",
                "Investor titles are misleading — an 'Associate' is entry-level, not a decision maker",
                "No way to balance event composition in real-time",
                "Multiple organizers can't collaborate on the same guest list",
              ].map((problem) => (
                <div key={problem} className="flex items-start gap-3">
                  <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500">
                    <span className="text-xs font-bold">&times;</span>
                  </div>
                  <span className="text-gray-600">{problem}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-gradient-to-br from-green-50 to-emerald-50 p-8">
            <h3 className="text-xl font-semibold text-green-800">
              Event Review fixes all of this
            </h3>
            <div className="mt-6 space-y-4">
              {[
                "AI enriches every profile with real data — photos, titles, company, social links",
                "Smart categorization distinguishes real investors from dabblers",
                "VC hierarchy taxonomy: Partner > Principal > Associate > Analyst",
                "Post-analysis sliders let you adjust composition in real-time",
                "Multiplayer mode: your whole team reviews and tags together",
              ].map((solution) => (
                <div key={solution} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
                  <span className="text-gray-700">{solution}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-gray-50 border-y">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Three steps to a curated guest list
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl mx-auto">
              Go from raw applicant data to a finalized guest list in minutes, not hours.
            </p>
          </div>
          <div className="mt-16 grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative rounded-2xl border bg-white p-8">
              <div className="flex size-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Upload className="size-6" />
              </div>
              <div className="mt-1 text-xs font-bold text-blue-600 uppercase tracking-wider">Step 1</div>
              <h3 className="mt-4 text-lg font-semibold">Upload & Enrich</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Upload a CSV from Luma or any platform. AI automatically enriches each
                applicant with LinkedIn data, photos, company info, and social profiles.
                Review and correct any errors to improve future accuracy.
              </p>
            </div>
            {/* Step 2 */}
            <div className="relative rounded-2xl border bg-white p-8">
              <div className="flex size-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                <Brain className="size-6" />
              </div>
              <div className="mt-1 text-xs font-bold text-purple-600 uppercase tracking-wider">Step 2</div>
              <h3 className="mt-4 text-lg font-semibold">AI Analysis & Categorization</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Set your event capacity (virtual + in-person) and selection criteria.
                AI categorizes applicants — distinguishing professional investors from
                hobbyists, ranking by relevance, and recommending accepts.
              </p>
            </div>
            {/* Step 3 */}
            <div className="relative rounded-2xl border bg-white p-8">
              <div className="flex size-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
                <SlidersHorizontal className="size-6" />
              </div>
              <div className="mt-1 text-xs font-bold text-green-600 uppercase tracking-wider">Step 3</div>
              <h3 className="mt-4 text-lg font-semibold">Tune & Finalize</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Use real-time sliders to adjust the mix — more founders? fewer students?
                See accept/reject counts update instantly. Tag, comment, and collaborate
                with your team. Export your final list back to Luma.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Everything you need to curate world-class events
          </h2>
          <p className="mt-4 text-gray-600 max-w-xl mx-auto">
            Built for event organizers who care about the quality of every seat in the room.
          </p>
        </div>
        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: Linkedin,
              title: "Profile Enrichment",
              description: "Auto-scrape LinkedIn, GitHub, and Instagram to fill in missing data. Add photos, bios, and company info automatically.",
              color: "blue",
            },
            {
              icon: Target,
              title: "Smart Categorization",
              description: "AI distinguishes real VCs from angel dabblers. Understands title hierarchy — Partner vs. Associate vs. Analyst.",
              color: "purple",
            },
            {
              icon: SlidersHorizontal,
              title: "Real-Time Composition Sliders",
              description: "Adjust your event mix after analysis. Drag sliders to see how changing thresholds affects your accept/reject counts.",
              color: "green",
            },
            {
              icon: Users,
              title: "Multiplayer Collaboration",
              description: "Multiple organizers review the same event. Tag applicants, leave comments, and make team decisions together.",
              color: "orange",
            },
            {
              icon: BarChart3,
              title: "Capacity Management",
              description: "Set separate limits for virtual and in-person. Different qualification criteria for each track. Never over-accept again.",
              color: "red",
            },
            {
              icon: Shield,
              title: "Whitelist & Blacklist",
              description: "Auto-accept VIPs and auto-reject known bad actors. Your preferences carry across events.",
              color: "slate",
            },
            {
              icon: Upload,
              title: "CSV & Luma Integration",
              description: "Import from Luma, Eventbrite, or any CSV. Export your curated list right back. No copy-pasting required.",
              color: "teal",
            },
            {
              icon: UserCheck,
              title: "Manual Override & Learning",
              description: "Correct AI decisions and it learns your preferences. The more you use it, the smarter it gets for your events.",
              color: "indigo",
            },
            {
              icon: Zap,
              title: "Outcome-Based Pricing",
              description: "Pay per applicant reviewed — not monthly seats. Only pay for what you use. No recurring fees eating your margins.",
              color: "amber",
            },
          ].map((feature) => (
            <div key={feature.title} className="group rounded-xl border p-6 hover:shadow-md transition-shadow">
              <feature.icon className="size-8 text-gray-400 group-hover:text-gray-600 transition-colors" />
              <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y bg-gray-50">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Simple, outcome-based pricing
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl mx-auto">
              No monthly subscriptions. No per-seat fees. Pay only for the applicants you review.
            </p>
          </div>
          <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Free */}
            <div className="rounded-2xl border bg-white p-8">
              <h3 className="text-lg font-semibold">Starter</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">Free</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">For trying it out</p>
              <ul className="mt-8 space-y-3 text-sm text-gray-600">
                {[
                  "Up to 50 applicants",
                  "Basic AI enrichment",
                  "CSV upload & export",
                  "Single user",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className="mt-8 block w-full rounded-lg border border-gray-300 py-2.5 text-center text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Get Started
              </Link>
            </div>
            {/* Pro */}
            <div className="rounded-2xl border-2 border-[#1e293b] bg-white p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#1e293b] px-3 py-0.5 text-xs font-medium text-white">
                Most Popular
              </div>
              <h3 className="text-lg font-semibold">Pro</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">$0.10</span>
                <span className="text-gray-500 text-sm"> / applicant</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">For regular event organizers</p>
              <ul className="mt-8 space-y-3 text-sm text-gray-600">
                {[
                  "Unlimited applicants",
                  "Full AI enrichment & scraping",
                  "Composition sliders",
                  "Luma integration",
                  "Team collaboration (up to 5)",
                  "Whitelist & blacklist",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className="mt-8 block w-full rounded-lg bg-[#1e293b] py-2.5 text-center text-sm font-medium text-white hover:bg-[#334155] transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
            {/* Enterprise */}
            <div className="rounded-2xl border bg-white p-8">
              <h3 className="text-lg font-semibold">Enterprise</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">Custom</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">For large-scale operations</p>
              <ul className="mt-8 space-y-3 text-sm text-gray-600">
                {[
                  "Everything in Pro",
                  "Unlimited team members",
                  "Custom AI training",
                  "API access",
                  "Dedicated support",
                  "SSO & audit logs",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:hello@eventreview.ai"
                className="mt-8 block w-full rounded-lg border border-gray-300 py-2.5 text-center text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="rounded-2xl bg-[#1e293b] p-12 md:p-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Ready to curate your next event?
          </h2>
          <p className="mt-4 text-lg text-white/70 max-w-xl mx-auto">
            Join event organizers who save hours on applicant review and build
            better guest lists with AI.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-medium text-[#1e293b] hover:bg-gray-100 transition-colors"
            >
              Start Reviewing Free
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-white/50">
            <div className="flex items-center gap-2">
              <Clock className="size-4" />
              Set up in under 2 minutes
            </div>
            <div className="flex items-center gap-2">
              <Shield className="size-4" />
              Your data stays private
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#1e293b] text-white text-xs font-bold">
                ER
              </div>
              <span className="text-sm font-semibold">Event Review</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-gray-500">
              <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
              <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How It Works</a>
            </div>
            <div className="text-sm text-gray-400">
              Built by Stardrop
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
