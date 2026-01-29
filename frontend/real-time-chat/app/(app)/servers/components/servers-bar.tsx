import { Button } from "@/components/ui/button";

export function ServersBar() {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-2">
      <Button variant="outline">Gaming</Button>
      <Button variant="outline">Famille</Button>
      <Button variant="outline">Netflix</Button>
      <Button variant="outline">Amis</Button>

      <div className="ml-auto">
        <Button>+ Nouveau serveur</Button>
      </div>
    </div>
  );
}
