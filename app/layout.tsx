import { Inter } from "next/font/google"; // or local font
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { Toaster } from 'sonner';

export const metadata = {
    title: "Vital Blood Donation",
    description: "Blood donation platform",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "VitalApp",
    },
    formatDetection: {
        telephone: false,
    },
    icons: {
        icon: '/icon.png',
        shortcut: '/favicon.ico',
        apple: '/icons/icon-192x192.png',
    },
};

export const viewport = {
    themeColor: "#ef4444",
    width: "device-width",
    initialScale: 1,
    minimumScale: 1,
    viewportFit: "cover",
    userScalable: false,
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <AuthProvider>
                    <div className="min-h-screen flex flex-col">
                        <Header />
                        <main className="flex-grow container mx-auto px-4 py-8">
                            {children}
                        </main>
                        <PWAInstallPrompt />
                        <Footer />
                        <Toaster />
                    </div>
                </AuthProvider>
            </body>
        </html>
    );
}
