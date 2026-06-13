import React, { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Users, FileText, Wrench, TrendingUp, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Package, CheckCircle, Clock
} from 'lucide-react'
import Badge from '@/components/ui/Badge'

const fmt = (n) => `S$${(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const COLORS = ['#2563eb', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4']

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue') ? fmt(p.value) : p.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

const PieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3">
        <p className="text-sm font-semibold text-slate-700">{payload[0].name}</p>
        <p className="text-sm text-blue-600">{fmt(payload[0].value)}</p>
        <p className="text-xs text-slate-400">{payload[0].payload.percent}%</p>
      </div>
    )
  }
  return null
}

const RADIAN = Math.PI / 180
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold" fontSize={12}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ── Stat Card ──────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, trend }) {
  const colorMap = {
    maroon: { bg: 'bg-rose-50',   icon: 'bg-rose-900',    text: 'text-rose-900' },
    navy:   { bg: 'bg-slate-100', icon: 'bg-slate-900',   text: 'text-slate-900' },
    forest: { bg: 'bg-emerald-50',icon: 'bg-emerald-900', text: 'text-emerald-900' },
    gray:   { bg: 'bg-gray-100',  icon: 'bg-gray-700',    text: 'text-gray-700' },
    black:  { bg: 'bg-stone-100', icon: 'bg-black',       text: 'text-black' },
  }
  const c = colorMap[color] || colorMap.navy
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 ${c.icon} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-bold ${trend >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="text-[22px] font-bold text-slate-900 tracking-tight">{value}</div>
        <div className="text-sm font-medium text-slate-500 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

// ── Section Card ───────────────────────────────────────
function SectionCard({ title, children, action }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({ customers: 0, quotations: 0, services: 0, revenue: 0, pending: 0, approved: 0, lowStock: 0 })
  const [monthlyRevenue, setMonthlyRevenue] = useState([])
  const [salesBreakdown, setSalesBreakdown] = useState([])
  const [serviceStatus, setServiceStatus] = useState([])
  const [inventoryData, setInventoryData] = useState([])
  const [lowStockItems, setLowStockItems] = useState([])
  const [recentServices, setRecentServices] = useState([])
  const [topServices, setTopServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    try {
      // Parallel fetches
      const [custRes, quotRes, svcRes, invRes] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact' }),
        supabase.from('quotations').select('id, status', { count: 'exact' }),
        supabase.from('service_records').select('id, status, labor_cost, parts_cost, total_cost, service_date, technician, customers(name)').order('service_date', { ascending: false }),
        supabase.from('inventory_items').select('*'),
      ])

      const customers = custRes.count || 0
      const quotations = quotRes.count || 0
      const quotData = quotRes.data || []
      const approved = quotData.filter(q => q.status === 'Approved').length
      const pending  = quotData.filter(q => q.status === 'Pending').length

      const svcData = svcRes.data || []
      const completed = svcData.filter(s => ['Completed', 'Invoiced'].includes(s.status))
      const revenue = completed.reduce((sum, s) => sum + (s.total_cost || 0), 0)
      const totalLabor = completed.reduce((sum, s) => sum + (s.labor_cost || 0), 0)
      const totalParts = completed.reduce((sum, s) => sum + (s.parts_cost || 0), 0)

      // Service status breakdown
      const statusCounts = svcData.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1
        return acc
      }, {})
      setServiceStatus([
        { name: 'In Progress', value: statusCounts['In Progress'] || 0, color: '#f59e0b' },
        { name: 'Completed',   value: statusCounts['Completed']   || 0, color: '#10b981' },
        { name: 'Invoiced',    value: statusCounts['Invoiced']    || 0, color: '#2563eb' },
      ])

      // Monthly revenue (last 6 months)
      const now = new Date()
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
        return {
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          label: d.toLocaleDateString('en-PH', { month: 'short' }),
          revenue: 0, services: 0,
        }
      })
      svcData.filter(s => ['Completed', 'Invoiced'].includes(s.status)).forEach(s => {
        const key = s.service_date?.slice(0, 7)
        const m = months.find(m => m.key === key)
        if (m) { m.revenue += s.total_cost || 0; m.services++ }
      })
      setMonthlyRevenue(months)

      // Sales breakdown pie
      const totalSales = totalLabor + totalParts
      setSalesBreakdown([
        { name: 'Labor Revenue',  value: totalLabor, percent: totalSales ? Math.round(totalLabor / totalSales * 100) : 0 },
        { name: 'Parts Revenue',  value: totalParts, percent: totalSales ? Math.round(totalParts / totalSales * 100) : 0 },
      ])

      // Inventory
      const invData = invRes.data || []
      const lowStock = invData.filter(i => i.quantity_in_stock <= i.minimum_stock_level)
      setLowStockItems(lowStock)
      setInventoryData(
        invData
          .sort((a, b) => a.quantity_in_stock - b.quantity_in_stock)
          .slice(0, 8)
          .map(i => ({
            name: i.item_name.length > 30 ? i.item_name.slice(0, 30) + '…' : i.item_name,
            stock: i.quantity_in_stock,
            min: i.minimum_stock_level,
            fill: '#1e3a8a', // Dark blue theme
          }))
      )

      // Recent services
      setRecentServices(svcData.slice(0, 8))

      // Top services by revenue
      const svcMap = {}
      svcData.forEach(s => {
        const key = s.technician || 'Unknown'
        if (!svcMap[key]) svcMap[key] = { name: key, revenue: 0, count: 0 }
        svcMap[key].revenue += s.total_cost || 0
        svcMap[key].count++
      })
      setTopServices(Object.values(svcMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5))

      setStats({ customers, quotations, services: svcData.length, revenue, pending, approved, lowStock: lowStock.length })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const statusBadge = (s) => {
    const map = { 'In Progress': 'warning', Completed: 'success', Invoiced: 'info' }
    return <Badge variant={map[s] || 'gray'}>{s}</Badge>
  }

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Revenue"        value={fmt(stats.revenue)}    icon={TrendingUp} color="forest" trend={12} />
          <StatCard label="Total Customers"      value={stats.customers}        icon={Users}      color="navy"   />
          <StatCard label="Services Completed"   value={stats.services}         icon={Wrench}     color="maroon" />
          <StatCard label="Pending Quotations"   value={stats.pending}          icon={Clock}      color="gray"   />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Monthly Revenue Area Chart */}
          <div className="lg:col-span-2">
            <SectionCard title="Revenue Overview — Last 6 Months">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `S$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: '#2563eb', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>

          {/* Sales Breakdown Pie */}
          <SectionCard title="% of Sales Breakdown">
            {salesBreakdown[0]?.value || salesBreakdown[1]?.value ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={salesBreakdown} cx="50%" cy="50%" outerRadius={70} dataKey="value" labelLine={false} label={renderCustomLabel}>
                      {salesBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-1">
                  {salesBreakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                        <span className="text-slate-600">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-slate-800">{item.percent}%</span>
                        <span className="text-xs text-slate-400 ml-2">{fmt(item.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No revenue data yet</div>
            )}
          </SectionCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Inventory Stock Bar Chart */}
          <div className="lg:col-span-2">
            <SectionCard title="Inventory Stock Levels"
              action={<Link to="/admin/inventory" className="text-xs text-blue-600 font-medium hover:underline">Manage →</Link>}
            >
              {inventoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={inventoryData} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: '#334155' }} 
                      axisLine={false} 
                      tickLine={false} 
                      width={180}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-4 py-3">
                              <p className="text-xs font-bold text-slate-700 mb-1.5">{payload[0].payload.name}</p>
                              <div className="flex flex-col gap-1">
                                <p className="text-xs text-slate-600 flex items-center justify-between gap-4">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1e3a8a' }} />
                                    In Stock
                                  </span>
                                  <span className="font-semibold text-slate-900">{payload[0].payload.stock}</span>
                                </p>
                                <p className="text-xs text-slate-600 flex items-center justify-between gap-4">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#93c5fd' }} />
                                    Min Level
                                  </span>
                                  <span className="font-semibold text-slate-900">{payload[0].payload.min}</span>
                                </p>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="stock" name="In Stock" fill="#1e3a8a" radius={[0, 4, 4, 0]} maxBarSize={20} />
                    <Bar dataKey="min" name="Min Level" fill="#93c5fd" radius={[0, 4, 4, 0]} maxBarSize={6} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No inventory data yet</div>
              )}
            </SectionCard>
          </div>

          {/* Service Status Donut */}
          <SectionCard title="Service Status">
            {serviceStatus.some(s => s.value > 0) ? (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={serviceStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" labelLine={false} label={renderCustomLabel}>
                      {serviceStatus.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v + ' records', n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-1">
                  {serviceStatus.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                        <span className="text-slate-600">{item.name}</span>
                      </div>
                      <span className="font-semibold text-slate-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No service data yet</div>
            )}
          </SectionCard>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recent Transactions */}
          <div className="lg:col-span-2">
            <SectionCard
              title="Recent Services"
              action={<Link to="/admin/services" className="text-xs text-blue-600 font-medium hover:underline">View all →</Link>}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="pb-2 font-medium">Service #</th>
                      <th className="pb-2 font-medium">Customer</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                      <th className="pb-2 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentServices.length === 0 ? (
                      <tr><td colSpan={5} className="py-8 text-center text-slate-400">No service records yet</td></tr>
                    ) : recentServices.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 font-mono text-blue-600 text-xs">KM-{String(s.service_number || 0).padStart(4, '0')}</td>
                        <td className="py-2.5 text-slate-700">{s.customers?.name || '—'}</td>
                        <td className="py-2.5 text-slate-500 text-xs">{s.service_date ? new Date(s.service_date).toLocaleDateString('en-PH') : '—'}</td>
                        <td className="py-2.5 text-right font-semibold text-slate-800">{fmt(s.total_cost)}</td>
                        <td className="py-2.5 text-center">{statusBadge(s.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* Top Technicians */}
          <div className="space-y-5">
            <SectionCard title="Top Technicians">
              {topServices.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-sm">No data yet</div>
              ) : (
                <div className="space-y-3">
                  {topServices.map((tech, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {tech.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{tech.name}</p>
                        <p className="text-xs text-slate-400">{tech.count} service{tech.count > 1 ? 's' : ''}</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{fmt(tech.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
