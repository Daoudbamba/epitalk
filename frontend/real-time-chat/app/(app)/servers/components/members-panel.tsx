export function MembersPanel() {
  return (
    <aside className="w-64 border-l p-4">
      <h3 className="text-sm font-semibold mb-4">Membres du serveur</h3>

      <ul className="space-y-2 text-sm">
        <li>🟢 User 01 (Créateur)</li>
        <li>🟢 User 02 (Admin)</li>
        <li>⚪ User 03</li>
        <li>⚪ User 04</li>
      </ul>
    </aside>
  );
}
