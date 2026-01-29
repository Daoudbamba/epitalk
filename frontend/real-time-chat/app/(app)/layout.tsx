import type { ReactNode } from "react"

export default function AppLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="h-screen w-screen flex">
      {/* Sidebar serveurs */}
      <aside className="w-16 bg-muted border-r flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Servers</span>
      </aside>

      {/* Sidebar channels */}
      <aside className="w-60 bg-background border-r flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Channels</span>
      </aside>

      {/* Contenu dynamique */}
      <main className="flex-1 flex items-center justify-center">
        {children}
      </main>
    </div>
  )
}
