import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-gray-200">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page Not Found</h2>
        <p className="mt-2 text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link
            href="/events"
            className="rounded-lg bg-gold px-5 py-2.5 text-sm font-medium text-gold-foreground hover:bg-gold/90 transition-colors"
          >
            Go to Events
          </Link>
          <Link
            href="/"
            className="rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
