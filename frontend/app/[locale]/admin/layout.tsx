export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  // QueryClientProvider je na root [locale] layoutu (components/Providers.tsx)
  return children;
}
