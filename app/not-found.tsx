import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-3xl font-bold tracking-tight">
          Tahle stránka v zápisníku není.
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          Buď byl zápis vytržen, nebo odkaz vede do prázdna.
        </p>
        <Link
          href="/"
          className="btn-accent mt-6 inline-block rounded-lg px-5 py-2.5"
        >
          Zpět do knihovny
        </Link>
      </div>
    </main>
  );
}
