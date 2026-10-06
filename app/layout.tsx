import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { Toaster } from 'sonner';
import { SITE_URL } from '@/lib/site';

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Instrument_Serif({
    subsets: ["latin"],
    weight: "400",
    style: ["normal", "italic"],
    variable: "--font-serif",
});

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
        <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`} suppressHydrationWarning>
            <body className="font-sans">
                <AuthProvider>
                    <div className="min-h-screen flex flex-col">
                        {children}
                        <PWAInstallPrompt />
                        <Toaster
                            position="top-center"
                            toastOptions={{
                                classNames: {
                                    toast: '!bg-gray-900 !text-gray-50 !border-gray-800 !rounded-md !font-sans',
                                    description: '!text-gray-400',
                                },
                            }}
                        />
                    </div>
                </AuthProvider>
            </body>
        </html>
    );
}
