import { Inter } from "next/font/google"; // or local font
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "Vital Blood Donation",
    description: "Blood donation platform",
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
                        <Footer />
                    </div>
                </AuthProvider>
            </body>
        </html>
    );
}
