import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ad Personalize AI — Landing Page Personalizer',
  description: 'AI-powered landing page personalization. Input your ad creative and landing page URL to get a CRO-optimized, personalized landing page instantly.',
  openGraph: {
    title: 'Ad Personalize AI',
    description: 'Transform landing pages to match your ad creative with AI-powered CRO optimization.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
