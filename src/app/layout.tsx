import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
// GeistMono import removed as it's not available in the geist package
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

export const metadata: Metadata = {
  title: 'Plant Identifier', // Updated Title
  description: 'Identify plants using images.', // Updated Description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Add Google AdSense verification tag */}
        <meta name="google-adsense-account" content="ca-pub-5706907294777860" />
      </head>
      {/* Apply GeistSans variable, remove GeistMono as it's unavailable */}
      <body className={`${GeistSans.variable} antialiased font-sans`}>
        {children}
        <Toaster /> {/* Add Toaster */}
      </body>
    </html>
  );
}
