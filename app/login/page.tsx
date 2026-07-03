"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error")
      ? "Přihlašovací odkaz už neplatí nebo se nepodařilo ověřit. Pošli si nový."
      : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (error) {
      setError("Odkaz se nepodařilo odeslat. Zkontroluj adresu a zkus to znovu.");
    } else {
      setSent(true);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-line bg-card p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brass/15 text-brass">
            <Icon name="logo" size={24} />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Ankhasův zápisník
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Knihovna prožitých příběhů. Přihlas se e-mailem — pošleme ti
            odkaz, žádné heslo si pamatovat nemusíš.
          </p>

          {sent ? (
            <div className="mt-6 rounded-xl border border-line bg-panel px-4 py-3 text-sm leading-relaxed">
              <p className="font-semibold text-brass">Odkaz je na cestě.</p>
              <p className="mt-1 text-muted">
                Otevři e-mail <span className="text-ink">{email}</span> a
                klikni na přihlašovací odkaz. Můžeš pak tuhle záložku zavřít.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <label htmlFor="email" className="block text-sm font-medium text-muted">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jmeno@example.com"
                className="transition-quick w-full rounded-lg border border-line bg-panel px-3.5 py-2.5 text-ink placeholder:text-muted/60 hover:border-[#34343b] focus:border-brass/60"
              />
              <button
                type="submit"
                disabled={sending}
                className="btn-accent w-full rounded-lg px-4 py-2.5 disabled:opacity-60"
              >
                {sending ? "Posílám…" : "Poslat přihlašovací odkaz"}
              </button>
              {error && (
                <p className="text-sm leading-relaxed text-red">{error}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
