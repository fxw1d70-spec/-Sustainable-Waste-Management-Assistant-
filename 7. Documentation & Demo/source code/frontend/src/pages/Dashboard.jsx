import { useEffect, useState } from 'react'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { fetchAnalytics } from '../api.js'

ChartJS.register(
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
)

const CATEGORY_COLORS = {
  'Plastic Waste': '#3b82f6',
  'Paper Waste': '#f59e0b',
  'Organic Waste': '#22c55e',
  'E-Waste': '#8b5cf6',
  'Hazardous Waste': '#ef4444',
  'Metal Waste': '#64748b',
  'Glass Waste': '#06b6d4',
  'General Waste': '#94a3b8',
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent || 'text-slate-800'}`}>
        {value}
      </p>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch(() =>
        setError('Could not load analytics. Is the backend running?'),
      )
  }, [])

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-slate-400">Loading analytics…</p>
  }

  const hasData = data.total > 0

  const categoryLabels = Object.keys(data.categories)
  const categoryValues = Object.values(data.categories)

  const doughnutData = {
    labels: ['Recyclable', 'Non-recyclable'],
    datasets: [
      {
        data: [data.recyclable, data.non_recyclable],
        backgroundColor: ['#10b981', '#cbd5e1'],
        borderWidth: 0,
      },
    ],
  }

  const lineData = {
    labels: data.daily.labels,
    datasets: [
      {
        label: 'Scans',
        data: data.daily.counts,
        borderColor: '#059669',
        backgroundColor: 'rgba(16,185,129,0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
      },
    ],
  }

  const barData = {
    labels: categoryLabels.map((c) => c.replace(' Waste', '')),
    datasets: [
      {
        label: 'Items',
        data: categoryValues,
        backgroundColor: categoryLabels.map(
          (c) => CATEGORY_COLORS[c] || '#94a3b8',
        ),
        borderRadius: 6,
      },
    ],
  }

  const noLegend = { plugins: { legend: { display: false } } }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800">Sustainability Dashboard</h2>
      <p className="mt-1 text-sm text-slate-500">
        Insights from your waste-scanning activity.
      </p>

      {/* Summary stats */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total items scanned" value={data.total} />
        <StatCard
          label="Recyclable items"
          value={data.recyclable}
          accent="text-brand-600"
        />
        <StatCard
          label="Recycle rate"
          value={`${data.recycle_rate}%`}
          accent="text-brand-600"
        />
        <StatCard
          label="Hazardous items"
          value={data.hazardous}
          accent="text-red-500"
        />
      </div>

      {!hasData ? (
        <div className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
          No scan data yet. Head to the Scanner and classify a few items to see
          your analytics here.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-slate-700">
              Recyclable vs Non-recyclable
            </h3>
            <Doughnut data={doughnutData} />
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-2">
            <h3 className="mb-4 font-semibold text-slate-700">
              Daily scans (last 7 days)
            </h3>
            <Line data={lineData} options={noLegend} />
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-3">
            <h3 className="mb-4 font-semibold text-slate-700">
              Waste categories
            </h3>
            <Bar data={barData} options={noLegend} />
          </div>
        </div>
      )}
    </div>
  )
}
