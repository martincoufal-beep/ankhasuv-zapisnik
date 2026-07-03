import ItemForm from "@/components/ItemForm";

export const metadata = { title: "Upravit zápis" };

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Upravit zápis</h1>
      <div className="mt-6">
        <ItemForm itemId={id} />
      </div>
    </main>
  );
}
