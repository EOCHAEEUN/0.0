import Header from "./Header"

type MainLayoutProps = {
  children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="p-8">
        {children}
      </main>
    </div>
  )
}