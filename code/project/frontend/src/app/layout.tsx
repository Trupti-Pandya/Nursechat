import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeAwareBackground } from "@/components/ui/theme-aware-background";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast-context";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NurseChat",
  description: "Your personal healthcare companion, available 24/7 to assist with medical inquiries and support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.className} overflow-hidden`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <ToastProvider>
              <ThemeAwareBackground className="min-h-screen">
                <div className="min-h-screen">
                  {children}
                  <div className="fixed bottom-3 right-3 z-40">
                    <div className="bg-amber-100/70 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 border border-amber-200/50 text-xs dark:bg-gray-800/30 dark:border-gray-700/30">
                      <span className="font-medium text-gray-800 dark:text-gray-200">made with</span>
                      <span className="text-red-500 dark:text-red-400">❤</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">by</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">Trupti Pandya</span>
                    </div>
                  </div>
                </div>
              </ThemeAwareBackground>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
