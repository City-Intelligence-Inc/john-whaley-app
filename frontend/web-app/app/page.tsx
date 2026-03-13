import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
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
  ListChecks,
} from "lucide-react";

export default async function LandingPage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-gold fill-gold/30" />
            <span className="text-lg font-semibold tracking-tight">AI Select</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            {!isSignedIn ? (
              <>
                <Link
                  href="/sign-in"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-gold-foreground hover:bg-gold/90 transition-colors"
                >
                  Get Started
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-gold-foreground hover:bg-gold/90 transition-colors"
                >
                  Open Dashboard
                </Link>
                <UserButton />
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-gold/5" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-sm text-gold">
              <Sparkles className="size-4" />
              AI-Powered Event Curation
            </div>
            <h1 className="text-5xl font-bold tracking-tight leading-[1.1] md:text-6xl">
              Turn Applications into Decisions{" "}
              <span className="bg-gradient-to-r from-gold to-amber-400 bg-clip-text text-transparent">
                — Automatically.
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Upload your applicant list, set your criteria, and let AI enrich profiles,
              categorize attendees, and recommend accepts — so you can focus on hosting,
              not screening.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-6 py-3 text-base font-medium text-gold-foreground hover:bg-gold/90 transition-colors"
              >
                Start Reviewing Free
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-base font-medium text-foreground hover:bg-secondary transition-colors"
              >
                See How It Works
              </a>
            </div>
            <div className="mt-12 flex flex-wrap items-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" />
                Pay per applicant reviewed
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" />
                Works with Luma, CSV, and more
              </div>
            </div>
          </div>

          {/* Feature cards — right side on large screens */}
          <div className="mt-16 md:absolute md:right-6 md:top-32 md:mt-0 md:w-80 space-y-3">
            {[
              { icon: Upload, label: "Import", desc: "CSV, Google Sheets, Luma" },
              { icon: Brain, label: "Match", desc: "Smart matching algorithms" },
              { icon: ListChecks, label: "Review", desc: "Intuitive judging interfaces" },
              { icon: Sparkles, label: "Select", desc: "Clear ranking dashboards" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm px-5 py-4 hover:border-gold/30 transition-colors"
              >
                <item.icon className="size-5 text-gold shrink-0" />
                <div>
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="border-y border-border/50 bg-secondary/50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "10,000+", label: "Applicants Reviewed" },
              { value: "85%", label: "Time Saved on Curation" },
              { value: "50+", label: "Events Powered" },
              { value: "3 min", label: "Avg. Review Time per 100" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-gold">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
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
                  <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                    <span className="text-xs font-bold">&times;</span>
                  </div>
                  <span className="text-muted-foreground">{problem}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-gold/20 bg-gold/5 p-8">
            <h3 className="text-xl font-semibold text-gold">
              AI Select fixes all of this
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
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-gold" />
                  <span className="text-foreground/80">{solution}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border/50 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Three steps to a curated guest list
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Go from raw applicant data to a finalized guest list in minutes, not hours.
            </p>
          </div>
          <div className="mt-16 grid md:grid-cols-3 gap-8">
            {[
              { icon: Upload, step: "Step 1", title: "Upload & Enrich", color: "text-blue-400 bg-blue-400/10", desc: "Upload a CSV from Luma or any platform. AI automatically enriches each applicant with LinkedIn data, photos, company info, and social profiles." },
              { icon: Brain, step: "Step 2", title: "AI Analysis & Categorization", color: "text-purple-400 bg-purple-400/10", desc: "Set your event capacity and selection criteria. AI categorizes applicants — distinguishing professional investors from hobbyists, ranking by relevance." },
              { icon: SlidersHorizontal, step: "Step 3", title: "Tune & Finalize", color: "text-gold bg-gold/10", desc: "Use real-time sliders to adjust the mix. See accept/reject counts update instantly. Tag, comment, and collaborate with your team. Export your final list." },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-border bg-card p-8">
                <div className={`flex size-12 items-center justify-center rounded-xl ${item.color}`}>
                  <item.icon className="size-6" />
                </div>
                <div className={`mt-1 text-xs font-bold uppercase tracking-wider ${item.color.split(" ")[0]}`}>{item.step}</div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Everything you need to curate world-class events
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Built for event organizers who care about the quality of every seat in the room.
          </p>
        </div>
        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Linkedin, title: "Profile Enrichment", description: "Auto-scrape LinkedIn, GitHub, and Instagram to fill in missing data. Add photos, bios, and company info automatically." },
            { icon: Target, title: "Smart Categorization", description: "AI distinguishes real VCs from angel dabblers. Understands title hierarchy — Partner vs. Associate vs. Analyst." },
            { icon: SlidersHorizontal, title: "Real-Time Composition Sliders", description: "Adjust your event mix after analysis. Drag sliders to see how changing thresholds affects your accept/reject counts." },
            { icon: Users, title: "Multiplayer Collaboration", description: "Multiple organizers review the same event. Tag applicants, leave comments, and make team decisions together." },
            { icon: BarChart3, title: "Capacity Management", description: "Set separate limits for virtual and in-person. Different qualification criteria for each track." },
            { icon: Shield, title: "Whitelist & Blacklist", description: "Auto-accept VIPs and auto-reject known bad actors. Your preferences carry across events." },
            { icon: Upload, title: "CSV & Luma Integration", description: "Import from Luma, Eventbrite, or any CSV. Export your curated list right back." },
            { icon: UserCheck, title: "Manual Override & Learning", description: "Correct AI decisions and it learns your preferences. The more you use it, the smarter it gets." },
            { icon: Zap, title: "Outcome-Based Pricing", description: "Pay per applicant reviewed — not monthly seats. Only pay for what you use." },
          ].map((feature) => (
            <div key={feature.title} className="group rounded-xl border border-border bg-card p-6 hover:border-gold/30 transition-all">
              <feature.icon className="size-8 text-muted-foreground group-hover:text-gold transition-colors" />
              <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-border/50 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Simple, outcome-based pricing
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              No monthly subscriptions. No per-seat fees. Pay only for the applicants you review.
            </p>
          </div>
          <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Free */}
            <div className="rounded-2xl border border-border bg-card p-8">
              <h3 className="text-lg font-semibold">Starter</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">Free</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">For trying it out</p>
              <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
                {["Up to 50 applicants", "Basic AI enrichment", "CSV upload & export", "Single user"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className="mt-8 block w-full rounded-lg border border-border py-2.5 text-center text-sm font-medium hover:bg-secondary transition-colors"
              >
                Get Started
              </Link>
            </div>
            {/* Pro */}
            <div className="rounded-2xl border-2 border-gold bg-card p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-0.5 text-xs font-medium text-gold-foreground">
                Most Popular
              </div>
              <h3 className="text-lg font-semibold">Pro</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">$0.10</span>
                <span className="text-muted-foreground text-sm"> / applicant</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">For regular event organizers</p>
              <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
                {["Unlimited applicants", "Full AI enrichment & scraping", "Composition sliders", "Luma integration", "Team collaboration (up to 5)", "Whitelist & blacklist"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-gold shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className="mt-8 block w-full rounded-lg bg-gold py-2.5 text-center text-sm font-medium text-gold-foreground hover:bg-gold/90 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
            {/* Enterprise */}
            <div className="rounded-2xl border border-border bg-card p-8">
              <h3 className="text-lg font-semibold">Enterprise</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">Custom</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">For large-scale operations</p>
              <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
                {["Everything in Pro", "Unlimited team members", "Custom AI training", "API access", "Dedicated support", "SSO & audit logs"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:hello@aiselect.app"
                className="mt-8 block w-full rounded-lg border border-border py-2.5 text-center text-sm font-medium hover:bg-secondary transition-colors"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/10 via-card to-card p-12 md:p-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Ready to curate your next event?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Join event organizers who save hours on applicant review and build
            better guest lists with AI.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-6 py-3 text-base font-medium text-gold-foreground hover:bg-gold/90 transition-colors"
            >
              Start Reviewing Free
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground">
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
      <footer className="border-t border-border/50">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-gold fill-gold/30" />
              <span className="text-sm font-semibold">AI Select</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            </div>
            <div className="text-sm text-muted-foreground">
              Built by City Intelligence
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
