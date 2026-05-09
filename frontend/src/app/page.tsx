import { DownloadCard } from "@/components/DownloadCard";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { PlatformPills } from "@/components/PlatformPills";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 px-5 sm:px-8 pt-8 sm:pt-16 pb-8">
        <div className="max-w-[640px] mx-auto w-full">
          <Hero />
          <DownloadCard />
          <div className="mt-8">
            <PlatformPills />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
