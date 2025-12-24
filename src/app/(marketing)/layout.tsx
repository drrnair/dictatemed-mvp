// src/app/(marketing)/layout.tsx
// Marketing layout - clean full-width layout without sidebar

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <main id="main-content">{children}</main>
    </div>
  );
}
