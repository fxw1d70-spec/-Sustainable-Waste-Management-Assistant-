import { useEffect, useState } from 'react'
import { classifyItem, fetchHistory, clearHistory, fetchHealth } from '../api.js'

const CATEGORY_STYLES = {
  'Plastic Waste': 'bg-blue-100 text-blue-800',
  'Paper Waste': 'bg-amber-100 text-amber-800',
  'Organic Waste': 'bg-green-100 text-green-800',
  'E-Waste': 'bg-purple-100 text-purple-800',
  'Hazardous Waste': 'bg-red-100 text-red-800',
  'Metal Waste': 'bg-slate-200 text-slate-800',
  'Glass Waste': 'bg-cyan-100 text-cyan-800',
  'General Waste': 'bg-slate-100 text-slate-700',
}

const HAZARD_STYLES = {
  None: 'bg-slate-100 text-slate-600',
  Low: 'bg-yellow-100 text-yellow-800',
  Medium: 'bg-orange-100 text-orange-800',
  High: 'bg-red-100 text-red-800',
}

function List({ title, items, icon }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
        <span>{icon}</span>
        {title}
      </h4>
      <ul className="space-y-1.5">
        {items.map((step, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-600">
            <span className="mt-0.5 text-brand-600">•</span>
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Scanner() {
  const [item, setItem] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [health, setHealth] = useState(null)

  async function loadHistory() {
    try {
      setHistory(await fetchHistory())
    } catch {
      /* non-fatal */
    }
  }

  useEffect(() => {
    loadHistory()
    fetchHealth().then(setHealth).catch(() => {})
  }, [])

  async function onScan(e) {
    e.preventDefault()
    const value = item.trim()
    if (!value) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await classifyItem(value)
      setResult(data)
      loadHistory()
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          'Could not reach the classification service. Is the backend running?',
      )
    } finally {
      setLoading(false)
    }
  }

  async function onClear() {
    await clearHistory()
    loadHistory()
  }

  const examples = ['Battery', 'Plastic bottle', 'Banana peel', 'Old phone', 'Paint can']

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Scanner + result */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800">Waste Scanner</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter a waste item to get an AI-powered disposal guide.
          </p>

          <form onSubmit={onScan} className="mt-4 flex gap-2">
            <input
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="e.g. battery, plastic bottle, banana peel…"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Analyzing…' : 'Scan'}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => setItem(ex)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
              >
                {ex}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="mt-6 animate-pulse space-y-3">
              <div className="h-6 w-40 rounded bg-slate-200" />
              <div className="h-4 w-full rounded bg-slate-200" />
              <div className="h-4 w-5/6 rounded bg-slate-200" />
            </div>
          )}

          {result && !loading && (
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-1 text-lg font-bold capitalize text-slate-800">
                  {result.item}
                </h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    CATEGORY_STYLES[result.category] || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {result.category}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    result.recyclable
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {result.recyclable ? '♻️ Recyclable' : 'Not recyclable'}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    HAZARD_STYLES[result.hazard_level] || HAZARD_STYLES.None
                  }`}
                >
                  Hazard: {result.hazard_level}
                </span>
              </div>

              {result.hazard_warning && (
                <div className="rounded-lg border-l-4 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <strong>⚠️ Hazard warning:</strong> {result.hazard_warning}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <List title="Disposal steps" items={result.disposal_steps} icon="🗑️" />
                <List
                  title="Recycling instructions"
                  items={result.recycling_instructions}
                  icon="♻️"
                />
                <List
                  title="Eco-friendly suggestions"
                  items={result.eco_suggestions}
                  icon="🌱"
                />
                <List
                  title="Accepted at facilities"
                  items={result.accepted_facilities?.map(
                    (f) => f.charAt(0).toUpperCase() + f.slice(1),
                  )}
                  icon="📍"
                />
              </div>

              <p className="text-xs text-slate-400">
                Guidance generated by{' '}
                {result.source === 'groq' ? 'Groq LLaMA 3.3-70B' : 'the built-in classifier'}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* History sidebar */}
      <aside>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Recent Scans</h3>
            {history.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                Clear
              </button>
            )}
          </div>
          {health && (
            <p className="mb-3 text-[11px] text-slate-400">
              AI: {health.ai_backend} · Store: {health.store_backend}
            </p>
          )}
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">No scans yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.slice(0, 12).map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="truncate text-sm capitalize text-slate-700">
                    {h.item}
                  </span>
                  <span
                    className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      CATEGORY_STYLES[h.category] || 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {h.category?.replace(' Waste', '')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
