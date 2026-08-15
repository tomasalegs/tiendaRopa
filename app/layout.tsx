import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import ConfigureAmplifyClientSide from '@/app/ConfigureAmplify';
import { CartProvider } from '@/context/CartContext';
import CartDrawer from '@/components/CartDrawer';

Amplify.configure(outputs, { ssr: true });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Y2K Store | Vintage & Streetwear Vault",
  description: "Tienda online de ropa vintage y estética Y2K.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ConfigureAmplifyClientSide />
        <CartProvider>
          <CartDrawer />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}

