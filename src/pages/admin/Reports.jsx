import React, { useState, useEffect, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabase'
import { FileText, Download, Calendar, ChevronDown } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

const fmt = (n) => `$${(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH') : '—'

const TABS = [
  { key: 'services',   label: 'Service Report' },
  { key: 'revenue',    label: 'Revenue Report' },
  { key: 'stock',      label: 'Stock Report' },
  { key: 'usage',      label: 'Inventory Usage' },
  { key: 'quotations', label: 'Quotation Report' },
]

export default function Reports() {
  const [tab, setTab]           = useState('services')
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(false)
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [dateTo, setDateTo]     = useState(new Date().toISOString().slice(0, 10))
  const [statusFilter, setStatus] = useState('All')
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => { fetchData() }, [tab, dateFrom, dateTo, statusFilter])

  async function fetchData() {
    setLoading(true)
    setData([])
    try {
      if (tab === 'services') {
        let q = supabase.from('service_records').select('*, customers(name), vehicles(make,model,plate_number)').gte('service_date', dateFrom).lte('service_date', dateTo).order('service_date', { ascending: false })
        if (statusFilter !== 'All') q = q.eq('status', statusFilter)
        const { data: d } = await q
        setData(d || [])
      } else if (tab === 'revenue') {
        const { data: d } = await supabase.from('service_records').select('service_date, total_cost, labor_cost, parts_cost, status, service_number, customers(name)').gte('service_date', dateFrom).lte('service_date', dateTo).in('status', ['Completed', 'Invoiced']).order('service_date', { ascending: false })
        setData(d || [])
      } else if (tab === 'stock') {
        const { data: d } = await supabase.from('inventory_items').select('*').order('item_name')
        setData(d || [])
      } else if (tab === 'usage') {
        const { data: d } = await supabase.from('service_items').select('*, inventory_items(item_name, unit), service_records(service_date, service_number)').not('inventory_item_id', 'is', null).order('created_at', { ascending: false }).limit(200)
        setData(d || [])
      } else if (tab === 'quotations') {
        let q = supabase.from('quotations').select('*, customers(name), vehicles(make,model,plate_number)').gte('date', dateFrom).lte('date', dateTo).order('date', { ascending: false })
        if (statusFilter !== 'All') q = q.eq('status', statusFilter)
        const { data: d } = await q
        setData(d || [])
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // ── Export PDF ──────────────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    const title = TABS.find(t => t.key === tab)?.label || 'Report'
    doc.setFontSize(16)
    doc.setTextColor(37, 99, 235)
    doc.text('AutoShop Pro — ' + title, 14, 18)
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(`Generated: ${new Date().toLocaleString('en-PH')}  |  Date Range: ${dateFrom} to ${dateTo}`, 14, 25)

    const { head, body } = getTableConfig()
    autoTable(doc, { head: [head], body, startY: 30, styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [248, 250, 252] } })
    doc.save(`autoshop_${tab}_${dateFrom}_${dateTo}.pdf`)
  }

  // ── Export Excel ────────────────────────────────────
  const exportExcel = () => {
    const { head, body } = getTableConfig()
    const ws = XLSX.utils.aoa_to_sheet([head, ...body])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, TABS.find(t => t.key === tab)?.label || 'Report')
    XLSX.writeFile(wb, `autoshop_${tab}_${dateFrom}_${dateTo}.xlsx`)
  }

  const getTableConfig = () => {
    if (tab === 'services') {
      return {
        head: ['Service #', 'Customer', 'Vehicle', 'Date', 'Technician', 'Labor', 'Parts', 'Total', 'Status'],
        body: data.map(r => [`KM-${String(r.service_number||0).padStart(4,'0')}`, r.customers?.name||'—', r.vehicles ? `${r.vehicles.make} ${r.vehicles.model} (${r.vehicles.plate_number})` : '—', fmtDate(r.service_date), r.technician||'—', fmt(r.labor_cost), fmt(r.parts_cost), fmt(r.total_cost), r.status])
      }
    } else if (tab === 'revenue') {
      const total = data.reduce((s, r) => s + (r.total_cost||0), 0)
      return {
        head: ['Service #', 'Customer', 'Date', 'Labor', 'Parts', 'Total', 'Status'],
        body: [...data.map(r => [`KM-${String(r.service_number||0).padStart(4,'0')}`, r.customers?.name||'—', fmtDate(r.service_date), fmt(r.labor_cost), fmt(r.parts_cost), fmt(r.total_cost), r.status]), ['', '', 'TOTAL', '', '', fmt(total), '']]
      }
    } else if (tab === 'stock') {
      return {
        head: ['Item Name', 'Category', 'Unit', 'In Stock', 'Min Level', 'Cost Price', 'Selling Price', 'Status'],
        body: data.map(i => [i.item_name, i.category, i.unit, i.quantity_in_stock, i.minimum_stock_level, fmt(i.cost_price), fmt(i.selling_price), i.quantity_in_stock <= i.minimum_stock_level ? 'LOW STOCK' : 'OK'])
      }
    } else if (tab === 'usage') {
      return {
        head: ['Item Name', 'Qty Used', 'Unit', 'Service #', 'Service Date'],
        body: data.map(i => [i.inventory_items?.item_name||'—', i.quantity, i.inventory_items?.unit||'—', `KM-${String(i.service_records?.service_number||0).padStart(4,'0')}`, fmtDate(i.service_records?.service_date)])
      }
    } else {
      return {
        head: ['Quot #', 'Customer', 'Vehicle', 'Date', 'Labor', 'Parts', 'Total', 'Status'],
        body: data.map(q => [`QUOTE-2026-${String(q.quotation_number||0).padStart(4,'0')}`, q.customers?.name||'—', q.vehicles ? `${q.vehicles.make} ${q.vehicles.model}` : '—', fmtDate(q.date), fmt(q.estimated_labor_cost), fmt(q.estimated_parts_cost), fmt(q.total_estimated_cost), q.status])
      }
    }
  }

  const renderTable = () => {
    const { head, body } = getTableConfig()
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{head.map((h, i) => <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={head.length} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>)
            : body.length === 0 ? <tr><td colSpan={head.length} className="py-12 text-center text-slate-400">No data for selected period</td></tr>
            : body.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/50">
                {row.map((cell, j) => <td key={j} className="px-4 py-3 text-slate-700 text-xs">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const hasDateFilter = ['services', 'revenue', 'quotations'].includes(tab)
  const hasStatusFilter = ['services', 'quotations'].includes(tab)
  const statusOpts = tab === 'quotations' ? ['All', 'Pending', 'Approved', 'Rejected'] : ['All', 'In Progress', 'Completed', 'Invoiced']

  // Summary stats for revenue tab
  const totalRevenue = tab === 'revenue' ? data.reduce((s, r) => s + (r.total_cost||0), 0) : 0
  const totalLabor   = tab === 'revenue' ? data.reduce((s, r) => s + (r.labor_cost||0), 0) : 0
  const totalParts   = tab === 'revenue' ? data.reduce((s, r) => s + (r.parts_cost||0), 0) : 0
  const lowStockCount = tab === 'stock' ? data.filter(i => i.quantity_in_stock <= i.minimum_stock_level).length : 0

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reports</h2>
          <p className="text-sm text-slate-500">Generate and export business reports</p>
        </div>

        {/* Report Type Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center justify-center h-12 px-3 rounded-xl border text-sm font-semibold transition-all ${
                tab === t.key
                  ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="space-y-4">

          {/* Row 1: Date range + Export */}
          <div className="flex flex-wrap items-end gap-4">
            {hasDateFilter && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>
              </>
            )}

            {/* Export Dropdown */}
            <div className="ml-auto relative" ref={exportRef}>
              <button
                onClick={() => setExportOpen(o => !o)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-700 transition-all shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10">
                  <button
                    onClick={() => { exportPDF(); setExportOpen(false) }}
                    className="flex items-center gap-2.5 w-full px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-600 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" /> Export as PDF
                  </button>
                  <button
                    onClick={() => { exportExcel(); setExportOpen(false) }}
                    className="flex items-center gap-2.5 w-full px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" /> Export as Excel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Status filter */}
          {hasStatusFilter && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500">Status</label>
              <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 gap-0.5 w-fit">
                {statusOpts.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                      statusFilter === s
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary cards for revenue */}
        {tab === 'revenue' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-600 text-white rounded-2xl p-4"><p className="text-xs opacity-75">Total Revenue</p><p className="text-2xl font-bold mt-1">{fmt(totalRevenue)}</p></div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Labor Revenue</p><p className="text-2xl font-bold text-slate-800 mt-1">{fmt(totalLabor)}</p></div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Parts Revenue</p><p className="text-2xl font-bold text-slate-800 mt-1">{fmt(totalParts)}</p></div>
          </div>
        )}

        {tab === 'stock' && lowStockCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
            <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
            {lowStockCount} item{lowStockCount > 1 ? 's' : ''} are at or below minimum stock level
          </div>
        )}

        {/* Data table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <span className="text-sm font-semibold text-slate-800">{TABS.find(t => t.key === tab)?.label} — {data.length} records</span>
          </div>
          {renderTable()}
        </div>
      </div>
    </AdminLayout>
  )
}
