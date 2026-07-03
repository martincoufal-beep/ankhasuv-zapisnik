import ItemForm from "@/components/ItemForm";

export const metadata = { title: "Nový zápis" };

export default function AddItemPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Nový zápis</h1>
      <p className="mt-1 text-sm text-muted">
        Stačí název a typ — zbytek můžeš doplnit kdykoli později.
      </p>
      <div className="mt-6">
        <ItemForm />
      </div>
    </main>
  );
}
