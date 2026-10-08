import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <Header />
            <main id="main" tabIndex={-1} className="flex-grow">
                {children}
            </main>
            <Footer />
        </>
    );
}
