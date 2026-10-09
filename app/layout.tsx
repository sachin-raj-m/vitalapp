import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { Toaster } from 'sonner';
import { SITE_URL } from '@/lib/site';
import { ConsentPrompt } from '@/components/ConsentPrompt';

// Body and UI text.
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

// Display headings and the wordmark.
const serif = Cormorant_Garamond({
    subsets: ["latin"],
    weight: ["500", "600", "700"],
    style: ["normal", "italic"],
    variable: "--font-serif",
    display: "swap",
});

// No web mono font: `font-mono` falls back to the system monospace stack
// (see tailwind.config.js) and is reserved for PINs and codes.

const DESCRIPTION = "A free, non-commercial network that alerts nearby, eligible blood donors the moment a request goes up.";

export const metadata = {
    metadataBase: new URL(SITE_URL),
    applicationName: 'Vital',
    openGraph: {
        type: 'website',
        siteName: 'Vital',
        locale: 'en_IN',
        title: "Vital — Blood, when it's needed",
        description: DESCRIPTION,
    },
    twitter: {
        card: 'summary_large_image',
        title: "Vital — Blood, when it's needed",
        description: DESCRIPTION,
    },
    title: {
        default: "Vital — Blood, when it's needed",
        template: "%s · Vital",
    },
    description: DESCRIPTION,
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Vital",
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
    themeColor: "#FAF8F5",
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
            <body className="font-sans">
                <a
                    href="#main"
                    className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-gray-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
                >
                    Skip to content
                </a>
                <AuthProvider>
                    <div className="min-h-screen flex flex-col">
                        {children}
                        <PWAInstallPrompt />
                        <ConsentPrompt />
                        <Toaster
                            position="top-center"
                            toastOptions={{
                                classNames: {
                                    toast: '!bg-gray-900 !text-white !border-gray-800 !rounded-lg !shadow-lg !font-sans',
                                    description: '!text-gray-300',
                                },
                            }}
                        />
                    </div>
                </AuthProvider>
            </body>
        </html>
    );
}
