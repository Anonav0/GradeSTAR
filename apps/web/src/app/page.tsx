export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8 space-y-16">
      {/* Hero Section */}
      <section id="overview" className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
          Distributed Systems & Sandbox Platform
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          High-Assurance Code Evaluation at Scale
        </h1>

        <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          GradeSTAR is a distributed automated assignment grader that evaluates programming
          submissions through asynchronous workers and isolated execution environments.
        </p>

        <div className="pt-4 flex flex-wrap justify-center gap-4">
          <div className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition">
            Explore Architecture
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Repository Docs
          </a>
        </div>
      </section>

      {/* Architectural Highlights */}
      <section id="architecture" className="space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Architecture Principles
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Engineered for deterministic grading, non-blocking APIs, and defense-in-depth isolation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Asynchronous Pipeline</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              API requests ingest source submissions instantly into PostgreSQL and dispatch jobs to
              durable BullMQ Redis queues, keeping endpoints fast and responsive.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Docker Sandbox Isolation
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Untrusted code runs inside ephemeral containers with dropped Linux capabilities, zero
              network access, strictly clamped CPU/memory/PIDs, and parent timeouts.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Deterministic Verdicts</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Strict classification precedence distinguishes student errors (WA, TLE, MLE, CE, RE)
              from platform anomalies (SYSTEM_ERROR), guaranteeing idempotent reporting.
            </p>
          </div>
        </div>
      </section>

      {/* System Status / Phase 1 Status */}
      <section
        id="status"
        className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 space-y-4"
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Phase 1 Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Monorepo</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Configured</span>
          </div>
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 uppercase tracking-wider block">API Core</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Operational
            </span>
          </div>
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 uppercase tracking-wider block">
              Worker Daemon
            </span>
            <span className="font-semibold text-sky-600 dark:text-sky-400">Scaffolded</span>
          </div>
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 uppercase tracking-wider block">
              Docker Sandbox
            </span>
            <span className="font-semibold text-slate-500">Planned (Phase 5)</span>
          </div>
        </div>
      </section>
    </div>
  );
}
