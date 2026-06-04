import Header from "./Header"
import Sidebar from "./Sidebar"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1">
        <Header />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}