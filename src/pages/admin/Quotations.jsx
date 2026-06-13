import React, { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Badge from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { 
  Plus, Pencil, Trash2, Search, Eye, Check, X, 
  ChevronLeft, ChevronRight, Download, FileText, 
  User, Wrench, Bike, Calendar, ShieldAlert 
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PAGE_SIZE = 10
const emptyForm = { customer_id: '', vehicle_id: '', date: new Date().toISOString().slice(0, 10), status: 'Pending', remarks: '', created_by: '' }
const emptyItem = { description: '', item_type: 'service', quantity: 1, unit_price: 0, total_price: 0 }

const statusVariant = { Pending: 'warning', Approved: 'success', Rejected: 'danger', Converted: 'info' }
const fmt = (n) => `S$${(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`

export default function Quotations() {
  const [quotations, setQuotations] = useState([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(0)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('All')
  const [loading, setLoading]       = useState(true)
  const [customers, setCustomers]   = useState([])
  const [vehicles, setVehicles]     = useState([])

  const [showModal, setShowModal]     = useState(false)
  const [showView, setShowView]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [editQuot, setEditQuot]       = useState(null)
  const [viewQuot, setViewQuot]       = useState(null)
  const [deleteId, setDeleteId]       = useState(null)
  const [form, setForm]               = useState(emptyForm)
  const [items, setItems]             = useState([{ ...emptyItem }])
  const [saving, setSaving]           = useState(false)

  // Extra states for full customer record lookup (Customer 360) in the View modal
  const [customerServices, setCustomerServices] = useState([])
  const [customerQuotations, setCustomerQuotations] = useState([])
  const [selectedCustDetails, setSelectedCustDetails] = useState(null)
  const [selectedVehiclesDetails, setSelectedVehiclesDetails] = useState([])
  const [activeTab, setActiveTab] = useState('quotation')
  const [loadingHistory, setLoadingHistory] = useState(false)

  const fetchQuotations = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('quotations').select(
      '*, customers(*), vehicles(*), quotation_items(*)',
      { count: 'exact' }
    )

    let searchNum = 0
    if (search) {
      const numMatch = search.match(/\d+/)
      if (numMatch) {
        searchNum = parseInt(numMatch[0]) || 0
      } else {
        searchNum = parseInt(search) || 0
      }
    }

    if (statusFilter !== 'All') q = q.eq('status', statusFilter)
    if (search) {
      if (searchNum > 0) {
        q = q.or(`quotation_number.eq.${searchNum},customers.name.ilike.%${search}%`)
      } else {
        q = q.or(`customers.name.ilike.%${search}%`)
      }
    }

    q = q.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    const { data, count, error } = await q
    if (!error) { setQuotations(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, page, statusFilter])

  useEffect(() => { fetchQuotations() }, [fetchQuotations])

  useEffect(() => {
    supabase.from('customers').select('id, name').order('name').then(({ data }) => setCustomers(data || []))
  }, [])

  const loadVehicles = async (custId) => {
    const { data } = await supabase.from('vehicles').select('*').eq('customer_id', custId)
    setVehicles(data || [])
  }

  const openAdd = () => {
    setEditQuot(null)
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) })
    setItems([{ ...emptyItem }])
    setVehicles([])
    setShowModal(true)
  }

  const openEdit = async (q) => {
    setEditQuot(q)
    setForm({ customer_id: q.customer_id, vehicle_id: q.vehicle_id, date: q.date, status: q.status, remarks: q.remarks || '', created_by: q.created_by || '' })
    await loadVehicles(q.customer_id)
    setItems(q.quotation_items?.length ? q.quotation_items.map(i => ({ ...i })) : [{ ...emptyItem }])
    setShowModal(true)
  }

  const openView = async (q) => {
    setViewQuot(q)
    setActiveTab('quotation')
    setShowView(true)
    setLoadingHistory(true)
    try {
      // Fetch full customer details
      const { data: custData } = await supabase.from('customers').select('*').eq('id', q.customer_id).single()
      setSelectedCustDetails(custData || q.customers)

      // Fetch all customer vehicles
      const { data: vehsData } = await supabase.from('vehicles').select('*').eq('customer_id', q.customer_id)
      setSelectedVehiclesDetails(vehsData || [])

      // Fetch other customer quotations
      const { data: quotesData } = await supabase.from('quotations').select('*, vehicles(*)').eq('customer_id', q.customer_id).order('date', { ascending: false })
      setCustomerQuotations(quotesData || [])

      // Fetch customer service records
      const { data: servicesData } = await supabase.from('service_records').select('*, vehicles(*), service_items(*)').eq('customer_id', q.customer_id).order('service_date', { ascending: false })
      setCustomerServices(servicesData || [])
    } catch (e) {
      console.error('Failed to load related customer records:', e)
    } finally {
      setLoadingHistory(false)
    }
  }

  const confirmDelete = (id) => { setDeleteId(id); setShowConfirm(true) }
  const handleDelete = async () => {
    const { error } = await supabase.from('quotations').delete().eq('id', deleteId)
    if (error) toast.error('Failed to delete')
    else { toast.success('Quotation deleted'); fetchQuotations() }
  }

  const changeStatus = async (id, status) => {
    const { error } = await supabase.from('quotations').update({ status }).eq('id', id)
    if (error) toast.error('Failed to update status')
    else { 
      toast.success(`Quotation ${status.toLowerCase()}`)
      fetchQuotations()
      if (viewQuot && viewQuot.id === id) {
        setViewQuot(prev => ({ ...prev, status }))
      }
    }
  }

  const setField = (f, v) => {
    setForm(p => ({ ...p, [f]: v }))
    if (f === 'customer_id') { loadVehicles(v); setForm(p => ({ ...p, vehicle_id: '', [f]: v })) }
  }

  const setItemField = (i, f, v) => {
    setItems(p => p.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [f]: v }
      updated.total_price = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0)
      return updated
    }))
  }

  const addItem    = () => setItems(p => [...p, { ...emptyItem }])
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i))

  const laborCost = items.filter(i => i.item_type === 'service').reduce((s, i) => s + (i.total_price || 0), 0)
  const partsCost = items.filter(i => i.item_type === 'part').reduce((s, i) => s + (i.total_price || 0), 0)
  const totalCost = laborCost + partsCost

  const handleSave = async () => {
    if (!form.customer_id) return toast.error('Please select a customer')
    if (!form.vehicle_id)  return toast.error('Please select a vehicle')
    setSaving(true)
    try {
      const payload = { ...form, estimated_labor_cost: laborCost, estimated_parts_cost: partsCost, total_estimated_cost: totalCost }
      let quotId = editQuot?.id
      if (editQuot) {
        const { error } = await supabase.from('quotations').update(payload).eq('id', editQuot.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('quotations').insert(payload).select().single()
        if (error) throw error
        quotId = data.id
      }
      // Re-insert items
      await supabase.from('quotation_items').delete().eq('quotation_id', quotId)
      const validItems = items.filter(i => i.description.trim())
      if (validItems.length) {
        await supabase.from('quotation_items').insert(validItems.map(i => ({ quotation_id: quotId, item_type: i.item_type, description: i.description, quantity: parseFloat(i.quantity) || 1, unit_price: parseFloat(i.unit_price) || 0, total_price: parseFloat(i.total_price) || 0 })))
      }
      toast.success(editQuot ? 'Quotation updated!' : 'Quotation created!')
      setShowModal(false)
      fetchQuotations()
    } catch (e) { toast.error(e.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  // PDF Export logic
  const exportPDF = (q) => {
    const doc = new jsPDF()
    const quoteNo = `QUOTE-2026-${String(q.quotation_number || 0).padStart(4, '0')}`

    // Shop Details
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(37, 99, 235) // blue-600
    doc.text('AutoShop Pro', 14, 20)

    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text('123 Auto Care Street, Metro Manila', 14, 25)
    doc.text('Phone: +63 2 1234 5678 | Email: service@autoshopro.com', 14, 29)

    // Quotation Metadata (Right side)
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(30, 41, 59) // slate-800
    doc.text('QUOTATION ESTIMATE', 120, 20)

    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Quotation #: ${quoteNo}`, 120, 26)
    doc.text(`Date: ${q.date ? new Date(q.date).toLocaleDateString('en-PH') : '—'}`, 120, 31)
    doc.text(`Status: ${q.status}`, 120, 36)
    if (q.created_by) doc.text(`Created By: ${q.created_by}`, 120, 41)

    // Separator line
    doc.setLineWidth(0.5)
    doc.setDrawColor(226, 232, 240) // border slate-200
    doc.line(14, 46, 196, 46)

    // Customer & Vehicle Boxes
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('CUSTOMER DETAILS', 14, 53)
    doc.text('VEHICLE DETAILS', 110, 53)

    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(71, 85, 105)

    const cust = selectedCustDetails || q.customers || {}
    doc.text(`Name: ${cust.name || '—'}`, 14, 59)
    doc.text(`Contact: ${cust.contact_number || '—'}`, 14, 64)
    doc.text(`Email: ${cust.email || '—'}`, 14, 69)
    if (cust.social_media) doc.text(`Social Media: ${cust.social_media}`, 14, 74)
    if (cust.source) doc.text(`Source: ${cust.source}`, 14, 79)

    const veh = q.vehicles || {}
    doc.text(`Brand/Model: ${veh.make || '—'} ${veh.model || '—'}`, 110, 59)
    doc.text(`Plate Number: ${veh.plate_number || '—'}`, 110, 64)
    if (veh.cc) doc.text(`Engine CC: ${veh.cc} cc`, 110, 69)
    if (veh.size) doc.text(`Class/Size: ${veh.size}`, 110, 74)
    if (veh.vin) doc.text(`VIN: ${veh.vin}`, 110, 79)

    // Table of items
    const headers = ['Description', 'Item Type', 'Qty', 'Unit Price', 'Total']
    const rows = (q.quotation_items || []).map(i => [
      i.description,
      i.item_type === 'service' ? 'Service (Labor)' : 'Part',
      i.quantity,
      fmt(i.unit_price),
      fmt(i.total_price)
    ])

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 85,
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 35 },
        2: { cellWidth: 15, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' }
      }
    })

    const finalY = doc.lastAutoTable.finalY + 8

    // Totals Box
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(30, 41, 59)
    doc.text('Estimated Labor Cost:', 120, finalY)
    doc.text(fmt(q.estimated_labor_cost), 180, finalY, { align: 'right' })

    doc.text('Estimated Parts Cost:', 120, finalY + 5)
    doc.text(fmt(q.estimated_parts_cost), 180, finalY + 5, { align: 'right' })

    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Total Estimated Cost:', 120, finalY + 12)
    doc.text(fmt(q.total_estimated_cost), 180, finalY + 12, { align: 'right' })

    // Footer terms
    const footerY = 270
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text('Terms & Conditions:', 14, footerY - 10)
    doc.setFont('Helvetica', 'normal')
    doc.text('1. This quotation is an estimate only. Actual repairs may vary based on vehicle condition.', 14, footerY - 6)
    doc.text('2. Customers will be notified of any additional parts or labor required before work starts.', 14, footerY - 2)

    doc.save(`Quotation_${quoteNo}.pdf`)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const statusTabs = ['All', 'Pending', 'Approved', 'Rejected']

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Quotations</h2>
            <p className="text-sm text-slate-500">{total} total quotations</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> New Quotation
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-0.5">
            {statusTabs.map(s => (
              <button key={s} onClick={() => { setStatus(s); setPage(0) }} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${statusFilter === s ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{s}</button>
            ))}
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Search quote # or customer name…" className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5 font-semibold">Quot #</th>
                  <th className="px-5 py-3.5 font-semibold">Date</th>
                  <th className="px-5 py-3.5 font-semibold">Customer</th>
                  <th className="px-5 py-3.5 font-semibold">Vehicle</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Labor</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Parts</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Total</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={9} className="px-5 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>)
                ) : quotations.length === 0 ? (
                  <tr><td colSpan={9} className="py-16 text-center text-slate-400">No quotations found</td></tr>
                ) : quotations.map(q => (
                  <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-blue-600 text-xs font-semibold">QUOTE-2026-{String(q.quotation_number || 0).padStart(4, '0')}</td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">{q.date ? new Date(q.date).toLocaleDateString('en-PH') : '—'}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{q.customers?.name || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">
                      {q.vehicles ? `${q.vehicles.make} ${q.vehicles.model} (${q.vehicles.plate_number})` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{fmt(q.estimated_labor_cost)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{fmt(q.estimated_parts_cost)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{fmt(q.total_estimated_cost)}</td>
                    <td className="px-5 py-3.5 text-center"><Badge variant={statusVariant[q.status]}>{q.status}</Badge></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openView(q)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg" title="View & All Records History"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(q)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><Pencil className="w-4 h-4" /></button>
                        {q.status === 'Pending' && <>
                          <button onClick={() => changeStatus(q.id, 'Approved')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Approve"><Check className="w-4 h-4" /></button>
                          <button onClick={() => changeStatus(q.id, 'Rejected')} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Reject"><X className="w-4 h-4" /></button>
                        </>}
                        <button onClick={() => confirmDelete(q.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editQuot ? 'Edit Quotation' : 'New Quotation'} size="xl">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer *</label>
              <select value={form.customer_id} onChange={e => setField('customer_id', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Vehicle *</label>
              <select value={form.vehicle_id} onChange={e => setField('vehicle_id', e.target.value)} disabled={!form.customer_id} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50">
                <option value="">Select vehicle…</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.make} {v.model} — {v.plate_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600">Services & Parts</label>
              <button onClick={addItem} type="button" className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Line</button>
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-2 text-left font-semibold">Description</th>
                    <th className="px-3 py-2 text-left font-semibold w-24">Type</th>
                    <th className="px-3 py-2 text-right font-semibold w-16">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold w-24">Unit Price</th>
                    <th className="px-3 py-2 text-right font-semibold w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5"><input value={item.description} onChange={e => setItemField(i, 'description', e.target.value)} placeholder="Description…" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" /></td>
                      <td className="px-2 py-1.5">
                        <select value={item.item_type} onChange={e => setItemField(i, 'item_type', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                          <option value="service">Service</option>
                          <option value="part">Part</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5"><input type="number" min="1" value={item.quantity} onChange={e => setItemField(i, 'quantity', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-right" /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => setItemField(i, 'unit_price', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-right" /></td>
                      <td className="px-3 py-1.5 text-right font-semibold text-slate-700">{fmt(item.total_price)}</td>
                      <td className="px-2 py-1.5"><button onClick={() => removeItem(i)} className="p-1 text-red-400 hover:bg-red-50 rounded"><X className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end">
              <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1 min-w-48">
                <div className="flex justify-between text-slate-600"><span>Labor:</span><span className="font-medium">{fmt(laborCost)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Parts:</span><span className="font-medium">{fmt(partsCost)}</span></div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1"><span>Total:</span><span>{fmt(totalCost)}</span></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setField('status', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option>Pending</option>
                <option>Approved</option>
                <option>Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Created By</label>
              <input value={form.created_by || ''} onChange={e => setField('created_by', e.target.value)} placeholder="e.g. Nica" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Remarks</label>
              <input value={form.remarks || ''} onChange={e => setField('remarks', e.target.value)} placeholder="Remarks…" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50">
              {saving ? 'Saving…' : editQuot ? 'Update Quotation' : 'Create Quotation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* View Modal with Customer 360 Tabbed History Lookup */}
      <Modal 
        isOpen={showView} 
        onClose={() => setShowView(false)} 
        title={`Quotation Lookup: QUOTE-2026-${String(viewQuot?.quotation_number || 0).padStart(4, '0')}`} 
        size="xl"
      >
        {viewQuot && (
          <div className="space-y-4">
            {/* Tabs Selector */}
            <div className="flex border-b border-slate-200">
              <button 
                onClick={() => setActiveTab('quotation')} 
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === 'quotation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <FileText className="w-4 h-4" /> Quotation Details
              </button>
              <button 
                onClick={() => setActiveTab('customer')} 
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === 'customer' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <User className="w-4 h-4" /> Customer & Vehicles
              </button>
              <button 
                onClick={() => setActiveTab('services')} 
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === 'services' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Wrench className="w-4 h-4" /> Service History ({customerServices.length})
              </button>
              <button 
                onClick={() => setActiveTab('quotations_history')} 
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === 'quotations_history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Calendar className="w-4 h-4" /> Quotations History ({customerQuotations.length})
              </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'quotation' && (
              <div className="space-y-4 text-sm animate-fade-in">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 rounded-xl p-4">
                  <div><span className="text-xs text-slate-500">Customer Name</span><p className="font-semibold text-slate-800">{viewQuot.customers?.name}</p></div>
                  <div><span className="text-xs text-slate-500">Vehicle</span><p className="font-semibold text-slate-800">{viewQuot.vehicles?.make} {viewQuot.vehicles?.model} ({viewQuot.vehicles?.plate_number})</p></div>
                  <div><span className="text-xs text-slate-500">Date</span><p className="font-semibold text-slate-800">{new Date(viewQuot.date).toLocaleDateString('en-PH')}</p></div>
                  <div><span className="text-xs text-slate-500">Status</span><div className="mt-0.5"><Badge variant={statusVariant[viewQuot.status]}>{viewQuot.status}</Badge></div></div>
                  {viewQuot.created_by && <div><span className="text-xs text-slate-500">Created By</span><p className="font-semibold text-slate-800">{viewQuot.created_by}</p></div>}
                  {viewQuot.remarks && <div className="col-span-2"><span className="text-xs text-slate-500">Remarks</span><p className="font-semibold text-slate-800">{viewQuot.remarks}</p></div>}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50"><tr className="text-slate-500"><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit Price</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewQuot.quotation_items?.map((i, idx) => (
                        <tr key={idx}><td className="px-3 py-2 font-medium">{i.description}</td><td className="px-3 py-2 capitalize text-slate-500">{i.item_type}</td><td className="px-3 py-2 text-right">{i.quantity}</td><td className="px-3 py-2 text-right">{fmt(i.unit_price)}</td><td className="px-3 py-2 text-right font-semibold text-slate-800">{fmt(i.total_price)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-end">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => exportPDF(viewQuot)} 
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
                    >
                      <Download className="w-3.5 h-3.5" /> Save as PDF
                    </button>
                    {viewQuot.status === 'Pending' && (
                      <>
                        <button onClick={() => changeStatus(viewQuot.id, 'Approved')} className="px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all">Approve</button>
                        <button onClick={() => changeStatus(viewQuot.id, 'Rejected')} className="px-3 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all">Reject</button>
                      </>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 space-y-1 min-w-48 text-xs">
                    <div className="flex justify-between text-slate-600"><span>Labor:</span><span>{fmt(viewQuot.estimated_labor_cost)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>Parts:</span><span>{fmt(viewQuot.estimated_parts_cost)}</span></div>
                    <div className="flex justify-between font-bold text-slate-900 border-t pt-1"><span>Total Estimated:</span><span>{fmt(viewQuot.total_estimated_cost)}</span></div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'customer' && (
              <div className="space-y-4 animate-fade-in">
                {selectedCustDetails ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Profile */}
                    <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-2.5">
                      <h4 className="font-bold text-sm text-slate-800 border-b pb-1.5 flex items-center gap-1.5"><User className="w-4 h-4 text-blue-500" /> Customer Profile</h4>
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <span className="text-slate-500">Name:</span><span className="font-semibold text-slate-800">{selectedCustDetails.name}</span>
                        <span className="text-slate-500">Contact #:</span><span className="font-semibold text-slate-800">{selectedCustDetails.contact_number || '—'}</span>
                        <span className="text-slate-500">Email:</span><span className="font-semibold text-slate-800">{selectedCustDetails.email || '—'}</span>
                        <span className="text-slate-500">Social Media:</span><span className="font-semibold text-slate-800">{selectedCustDetails.social_media || '—'}</span>
                        <span className="text-slate-500">Source:</span><span className="font-semibold text-slate-800">{selectedCustDetails.source || '—'}</span>
                        <span className="text-slate-500">Created By:</span><span className="font-semibold text-slate-800">{selectedCustDetails.created_by || '—'}</span>
                        {selectedCustDetails.address && (
                          <>
                            <span className="text-slate-500">Address:</span><span className="font-semibold text-slate-800 col-span-1">{selectedCustDetails.address}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Vehicles */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5"><Bike className="w-4 h-4 text-blue-500" /> Registered Vehicles</h4>
                      {selectedVehiclesDetails.length === 0 ? (
                        <p className="text-xs text-slate-400">No vehicles registered</p>
                      ) : (
                        selectedVehiclesDetails.map((v, i) => (
                          <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1.5">
                            <div className="flex justify-between items-center border-b pb-1 mb-1">
                              <span className="font-semibold text-blue-600">{v.make} {v.model}</span>
                              <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">{v.plate_number}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-y-1">
                              {v.cc && <><span className="text-slate-500">Engine CC:</span><span className="font-semibold">{v.cc} cc</span></>}
                              {v.size && <><span className="text-slate-500">Class Size:</span><span className="font-semibold">{v.size}</span></>}
                              {v.year && <><span className="text-slate-500">Year:</span><span className="font-semibold">{v.year}</span></>}
                              {v.vin && <><span className="text-slate-500">VIN:</span><span className="font-mono">{v.vin}</span></>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">Loading customer details…</div>
                )}
              </div>
            )}

            {activeTab === 'services' && (
              <div className="space-y-3 animate-fade-in text-xs">
                {loadingHistory ? (
                  <div className="py-8 text-center text-slate-400">Loading service history…</div>
                ) : customerServices.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">No service records found for this customer.</div>
                ) : (
                  <div className="space-y-3">
                    {customerServices.map(s => (
                      <div key={s.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-sm transition-all space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-blue-600 text-sm">KM-{String(s.service_number || 0).padStart(4, '0')}</span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-600 font-semibold">{s.vehicles?.make} {s.vehicles?.model} ({s.vehicles?.plate_number})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">{s.service_date ? new Date(s.service_date).toLocaleDateString('en-PH') : '—'}</span>
                            <Badge variant={statusVariant[s.status] || 'gray'}>{s.status}</Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg">
                          {s.technician && <div><span className="text-slate-400">Mechanic: </span><span className="font-medium text-slate-700">{s.technician}</span></div>}
                          {s.mileage && <div><span className="text-slate-400">Mileage: </span><span className="font-medium text-slate-700">{s.mileage}</span></div>}
                          {s.service_end_date && <div><span className="text-slate-400">End Date: </span><span className="font-medium text-slate-700">{new Date(s.service_end_date).toLocaleDateString('en-PH')}</span></div>}
                          {s.warranty_end_date && <div><span className="text-slate-400">Warranty End: </span><span className="font-medium text-slate-700">{new Date(s.warranty_end_date).toLocaleDateString('en-PH')}</span></div>}
                          {s.mechanic_recommendation && <div className="col-span-2 sm:col-span-4 mt-1"><span className="text-slate-400 font-semibold">Recommendation: </span><span className="text-slate-700 font-semibold">{s.mechanic_recommendation}</span></div>}
                          {s.remarks && <div className="col-span-2 sm:col-span-4"><span className="text-slate-400">Remarks: </span><span className="text-slate-600">{s.remarks}</span></div>}
                        </div>

                        {/* Service Items nested list */}
                        {s.service_items?.length > 0 && (
                          <div className="border border-slate-100 rounded-lg overflow-hidden">
                            <table className="w-full text-[10px]">
                              <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                  <th className="px-3 py-1.5 text-left font-semibold">Description</th>
                                  <th className="px-3 py-1.5 text-right font-semibold w-16">Qty</th>
                                  <th className="px-3 py-1.5 text-right font-semibold w-24">Price</th>
                                  <th className="px-3 py-1.5 text-right font-semibold w-24">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {s.service_items.map((it, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-1.5 font-medium">{it.description}</td>
                                    <td className="px-3 py-1.5 text-right text-slate-500">{it.quantity}</td>
                                    <td className="px-3 py-1.5 text-right text-slate-500">{fmt(it.unit_price)}</td>
                                    <td className="px-3 py-1.5 text-right font-semibold text-slate-700">{fmt(it.total_price)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="flex justify-end text-slate-800 font-bold">
                          <span>Total Paid: {fmt(s.total_cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'quotations_history' && (
              <div className="space-y-3 animate-fade-in text-xs">
                {loadingHistory ? (
                  <div className="py-8 text-center text-slate-400">Loading history…</div>
                ) : customerQuotations.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">No other quotations found.</div>
                ) : (
                  <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b text-slate-500 font-semibold">
                        <tr>
                          <th className="px-4 py-3 text-left">Quote #</th>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Vehicle</th>
                          <th className="px-4 py-3 text-right">Total Estimated</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-600">
                        {customerQuotations.map(q => (
                          <tr key={q.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-mono text-blue-600 font-semibold">QUOTE-2026-{String(q.quotation_number || 0).padStart(4, '0')}</td>
                            <td className="px-4 py-2.5">{q.date ? new Date(q.date).toLocaleDateString('en-PH') : '—'}</td>
                            <td className="px-4 py-2.5">{q.vehicles?.make} {q.vehicles?.model} ({q.vehicles?.plate_number})</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmt(q.total_estimated_cost)}</td>
                            <td className="px-4 py-2.5 text-center"><Badge variant={statusVariant[q.status]}>{q.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={handleDelete} title="Delete Quotation" message="This will permanently delete this quotation and all its line items." confirmText="Delete" />
    </AdminLayout>
  )
}
