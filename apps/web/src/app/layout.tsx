import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GradeSTAR — Distributed Automated Assignment Grader',
  description:
    'GradeSTAR is a distributed automated assignment grader that evaluates programming submissions through asynchronous workers and isolated execution environments.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans flex flex-col min-h-screen">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">
                GradeSTAR
              </span>
              <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300">
                Phase 1 Preview
              </span>
            </div>
            <nav className="flex items-center space-x-6 text-sm font-medium text-slate-600 dark:text-slate-300">
              <a
                href="#overview"
                className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              >
                Overview
              </a>
              <a
                href="#architecture"
                className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              >
                Architecture
              </a>
              <a
                href="#status"
                className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              >
                System Status
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-grow">{children}</main>

        <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 py-8 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4">
            GradeSTAR &copy; {new Date().getFullYear()} — Distributed Automated Assignment Grader
          </div>
        </footer>
      </body>
    </html>
  );
}
