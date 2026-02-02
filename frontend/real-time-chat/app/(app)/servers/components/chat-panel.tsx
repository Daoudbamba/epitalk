import { Input } from "@/components/ui/input";

export function ChatPanel() {
  return (
    <section className="flex flex-col flex-1 p-4">
      <h2 className="font-semibold mb-4">Discussion publique</h2>

      <div className="flex-1 space-y-4 overflow-y-auto">
        <div className="border rounded p-2 w-2/3">Message utilisateur 1</div>
        <div className="border rounded p-2 w-2/3 ml-auto">
          Message utilisateur 2
        </div>
      </div>

      <div className="mt-4">
        <Input placeholder="Répondre..." />
      </div>
    </section>
  );
}
