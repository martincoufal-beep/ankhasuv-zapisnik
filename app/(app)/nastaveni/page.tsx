import SettingsClient from "@/components/settings/SettingsClient";

export const metadata = { title: "Nastavení" };

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Nastavení</h1>
      <p className="mt-1 text-sm text-muted">
        Číselníky zápisníku — výchozí sada je jen ke čtení, vlastní záznamy
        můžeš upravovat i mazat. Záloha vyexportuje celou knihovnu do JSON.
      </p>
      <div className="mt-6">
        <SettingsClient />
      </div>
    </main>
  );
}
