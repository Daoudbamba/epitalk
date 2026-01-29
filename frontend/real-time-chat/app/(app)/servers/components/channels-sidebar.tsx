export function ChannelsSidebar() {
  return (
    <aside className="w-60 border-r p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Conversations</h3>
        <ul className="space-y-1 text-sm">
          <li># Général</li>
          <li># Annonces</li>
          <li># Discussions</li>
          <li># Random</li>
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Salons audio</h3>
        <ul className="space-y-1 text-sm">
          <li>🔊 Général</li>
        </ul>
      </div>
    </aside>
  );
}
