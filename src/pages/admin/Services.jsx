import React, { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Badge from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { 
  Plus, Pencil, Trash2, Search, Eye, CheckCircle, 
  ChevronLeft, ChevronRight, X, AlertTriangle, Calendar, User
} from 'lucide-react'

const PAGE_SIZE = 10
const emptyItem = { description: '', inventory_item_id: null, quantity: 1, unit_price: 0, total_price: 0 }
const fmt = (n) => `S$${(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`
const statusVariant = { 'In Progress': 'warning', Completed: 'success', Invoiced: 'info' }

const emptyForm = { 
  quotation_id: '', 
  customer_id: '', 
  vehicle_id: '', 
  service_date: new Date().toISOString().slice(0, 10), 
  technician: '', 
  remarks: '', 
  status: 'In Progress',
  mileage: '',
  customer_review: '',
  mechanic_review: '',
  mechanic_recommendation: '',
  service_end_date: '',
  warranty_end_date: '',
  created_by: ''
}

export default function Services() {
  const [records, setRecords]     = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('All')
  const [loading, setLoading]     = useState(true)

  const [inventoryItems, setInventoryItems] = useState([])
  const [approvedQuots, setApprovedQuots]   = useState([])
  const [customers, setCustomers]           = useState([])
  const [vehicles, setVehicles]             = useState([])

  const [showModal, setShowModal]     = useState(false)
  const [showView, setShowView]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showFinalize, setFinalize]   = useState(false)
  const [editRec, setEditRec]         = useState(null)
  const [viewRec, setViewRec]         = useState(null)
  const [deleteId, setDeleteId]       = useState(null)
  const [finalizeId, setFinalizeId]   = useState(null)

  const [form, setForm]   = useState(emptyForm)
  const [items, setItems] = useState([{ ...emptyItem }])
  const [saving, setSaving] = useState(false)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('service_records').select(
      '*, customers(*), vehicles(*), quotations(*), service_items(*)',
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
        q = q.or(`service_number.eq.${searchNum},customers.name.ilike.%${search}%`)
      } else {
        q = q.or(`customers.name.ilike.%${search}%`)
      }
    }

    q = q.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    const { data, count, error } = await q
    if (!error) { setRecords(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, page, statusFilter])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  useEffect(() => {
    supabase.from('inventory_items').select('id, item_name, selling_price, unit, quantity_in_stock').order('item_name').then(({ data }) => setInventoryItems(data || []))
    supabase.from('quotations').select('id, quotation_number, customer_id, vehicle_id, quotation_items(*), customers(name), vehicles(make,model,plate_number)').eq('status', 'Approved').then(({ data }) => setApprovedQuots(data || []))
    supabase.from('customers').select('id, name').order('name').then(({ data }) => setCustomers(data || []))
  }, [])

  const loadVehiclesForCustomer = async (custId) => {
    const { data } = await supabase.from('vehicles').select('*').eq('customer_id', custId)
    setVehicles(data || [])
  }

  const populateFromQuotation = async (quotId) => {
    // Find approved quotations
    const quot = approvedQuots.find(q => q.id === quotId)
    if (!quot) return
    setForm(p => ({ 
      ...p, 
      quotation_id: quotId, 
      customer_id: quot.customer_id, 
      vehicle_id: quot.vehicle_id 
    }))
    await loadVehiclesForCustomer(quot.customer_id)
    const mappedItems = (quot.quotation_items || []).map(i => ({ description: i.description, inventory_item_id: null, quantity: i.quantity, unit_price: i.unit_price, total_price: i.total_price }))
    setItems(mappedItems.length ? mappedItems : [{ ...emptyItem }])
  }

  const openAdd = () => {
    setEditRec(null)
    setForm(emptyForm)
    setItems([{ ...emptyItem }])
    setVehicles([])
    setShowModal(true)
  }

  const openEdit = async (r) => {
    setEditRec(r)
    setForm({ 
      quotation_id: r.quotation_id || '', 
      customer_id: r.customer_id, 
      vehicle_id: r.vehicle_id, 
      service_date: r.service_date, 
      technician: r.technician || '', 
      remarks: r.remarks || '', 
      status: r.status,
      mileage: r.mileage || '',
      customer_review: r.customer_review || '',
      mechanic_review: r.mechanic_review || '',
      mechanic_recommendation: r.mechanic_recommendation || '',
      service_end_date: r.service_end_date || '',
      warranty_end_date: r.warranty_end_date || '',
      created_by: r.created_by || ''
    })
    await loadVehiclesForCustomer(r.customer_id)
    setItems(r.service_items?.length ? r.service_items.map(i => ({ ...i })) : [{ ...emptyItem }])
    setShowModal(true)
  }

  const setField = (f, v) => {
    setForm(p => ({ ...p, [f]: v }))
    if (f === 'customer_id') {
      loadVehiclesForCustomer(v)
      setForm(p => ({ ...p, vehicle_id: '', [f]: v }))
    }
  }

  const setItemField = (i, f, v) => {
    setItems(p => p.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [f]: v }
      if (f === 'inventory_item_id') {
        const inv = inventoryItems.find(x => x.id === v)
        if (inv) { 
          updated.description = inv.item_name
          updated.unit_price = inv.selling_price
          updated.total_price = (parseFloat(updated.quantity) || 1) * inv.selling_price 
        }
      }
      updated.total_price = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0)
      return updated
    }))
  }

  const addItem    = () => setItems(p => [...p, { ...emptyItem }])
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i))

  const laborCost = items.filter(i => !i.inventory_item_id).reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0)
  const partsCost = items.filter(i => i.inventory_item_id).reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0)
  const totalCost = laborCost + partsCost

  const handleSave = async () => {
    if (!form.customer_id) return toast.error('Please link a customer')
    if (!form.vehicle_id) return toast.error('Please select a vehicle')
    setSaving(true)
    try {
      const payload = { 
        ...form, 
        labor_cost: laborCost, 
        parts_cost: partsCost, 
        total_cost: totalCost, 
        quotation_id: form.quotation_id || null,
        service_end_date: form.service_end_date || null,
        warranty_end_date: form.warranty_end_date || null
      }
      let recId = editRec?.id
      if (editRec) {
        const { error } = await supabase.from('service_records').update(payload).eq('id', editRec.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('service_records').insert(payload).select().single()
        if (error) throw error
        recId = data.id
      }
      await supabase.from('service_items').delete().eq('service_record_id', recId)
      const validItems = items.filter(i => i.description?.trim())
      if (validItems.length) {
        await supabase.from('service_items').insert(validItems.map(i => ({
          service_record_id: recId,
          inventory_item_id: i.inventory_item_id || null,
          description: i.description,
          quantity: parseFloat(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0,
          total_price: parseFloat(i.total_price) || 0,
        })))
      }
      toast.success(editRec ? 'Service record updated!' : 'Service record created!')
      setShowModal(false)
      fetchRecords()
    } catch (e) { toast.error(e.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  const handleFinalize = async () => {
    try {
      const { error } = await supabase.rpc('finalize_service', { service_id: finalizeId })
      if (error) throw error
      toast.success('Service finalized! Inventory has been deducted.')
      setFinalize(false)
      fetchRecords()
    } catch (e) { toast.error(e.message || 'Finalize failed — check stock levels') }
  }

  const handleDelete = async () => {
    const { error } = await supabase.from('service_records').delete().eq('id', deleteId)
    if (error) toast.error('Failed to delete')
    else { toast.success('Service record deleted'); fetchRecords() }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const tabs = ['All', 'In Progress', 'Completed', 'Invoiced']

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Service Records</h2>
            <p className="text-sm text-slate-500">{total} total service records</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> New Service
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-0.5">
            {tabs.map(s => <button key={s} onClick={() => { setStatus(s); setPage(0) }} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${statusFilter === s ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{s}</button>)}
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Search service # or customer…" className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5 font-semibold">Service #</th>
                  <th className="px-5 py-3.5 font-semibold">Quot #</th>
                  <th className="px-5 py-3.5 font-semibold">Customer</th>
                  <th className="px-5 py-3.5 font-semibold">Vehicle</th>
                  <th className="px-5 py-3.5 font-semibold">Date</th>
                  <th className="px-5 py-3.5 font-semibold">Mechanic</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Total</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={9} className="px-5 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>)
                : records.length === 0 ? <tr><td colSpan={9} className="py-16 text-center text-slate-400">No service records found</td></tr>
                : records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-blue-600 text-xs font-semibold">KM-{String(r.service_number||0).padStart(4,'0')}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-500 text-xs font-semibold">
                      {r.quotations ? `QUOTE-2026-${String(r.quotations.quotation_number).padStart(4,'0')}` : '—'}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{r.customers?.name||'—'}</td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">{r.vehicles ? `${r.vehicles.make} ${r.vehicles.model} (${r.vehicles.plate_number})` : '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">{r.service_date ? new Date(r.service_date).toLocaleDateString('en-PH') : '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600">{r.technician||'—'}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{fmt(r.total_cost)}</td>
                    <td className="px-5 py-3.5 text-center"><Badge variant={statusVariant[r.status]}>{r.status}</Badge></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setViewRec(r); setShowView(true) }} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg" title="View Details"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><Pencil className="w-4 h-4" /></button>
                        {r.status === 'In Progress' && (
                          <button onClick={() => { setFinalizeId(r.id); setFinalize(true) }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Finalize & Deduct Inventory"><CheckCircle className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => { setDeleteId(r.id); setShowConfirm(true) }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Page {page+1} of {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page===0} onClick={() => setPage(p=>p-1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={page>=totalPages-1} onClick={() => setPage(p=>p+1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editRec ? 'Edit Service Record' : 'New Service Record'} size="xl">
        <div className="space-y-5">
          {/* Link to quotation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Link to Approved Quotation</label>
              <select value={form.quotation_id} onChange={e => { setForm(p => ({...p, quotation_id: e.target.value})); if (e.target.value) populateFromQuotation(e.target.value) }} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">No quotation — create manually</option>
                {approvedQuots.map(q => <option key={q.id} value={q.id}>QUOTE-2026-{String(q.quotation_number||0).padStart(4,'0')} — {q.customers?.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer *</label>
              <select value={form.customer_id} onChange={e => setField('customer_id', e.target.value)} disabled={!!form.quotation_id} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50">
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Vehicle *</label>
              <select value={form.vehicle_id} onChange={e => setField('vehicle_id', e.target.value)} disabled={!form.customer_id || !!form.quotation_id} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50">
                <option value="">Select vehicle…</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.make} {v.model} — {v.plate_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Service Date</label>
              <input type="date" value={form.service_date} onChange={e => setForm(p=>({...p,service_date:e.target.value}))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mechanic/Technician</label>
              <input value={form.technician} onChange={e => setForm(p=>({...p,technician:e.target.value}))} placeholder="Mechanic name" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Current Mileage</label>
              <input value={form.mileage || ''} onChange={e => setForm(p=>({...p,mileage:e.target.value}))} placeholder="e.g. 15000KM" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Service End Date</label>
              <input type="date" value={form.service_end_date || ''} onChange={e => setForm(p=>({...p,service_end_date:e.target.value}))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Warranty End Date</label>
              <input type="date" value={form.warranty_end_date || ''} onChange={e => setForm(p=>({...p,warranty_end_date:e.target.value}))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(p=>({...p,status:e.target.value}))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option>In Progress</option>
                <option>Completed</option>
                <option>Invoiced</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer Review</label>
              <textarea value={form.customer_review || ''} onChange={e => setForm(p=>({...p,customer_review:e.target.value}))} rows={2} placeholder="Customer feedback…" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mechanic Review/Notes</label>
              <textarea value={form.mechanic_review || ''} onChange={e => setForm(p=>({...p,mechanic_review:e.target.value}))} rows={2} placeholder="Mechanic diagnostic findings…" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mechanic Recommendation</label>
              <textarea value={form.mechanic_recommendation || ''} onChange={e => setForm(p=>({...p,mechanic_recommendation:e.target.value}))} rows={2} placeholder="Future recommendations…" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Created By</label>
              <input value={form.created_by || ''} onChange={e => setForm(p=>({...p,created_by:e.target.value}))} placeholder="e.g. Jhearic" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Remarks / Remarks General</label>
              <input value={form.remarks || ''} onChange={e => setForm(p=>({...p,remarks:e.target.value}))} placeholder="General notes…" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600">Service Items & Parts Used</label>
              <button onClick={addItem} type="button" className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Line</button>
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-2 text-left font-semibold">Description</th>
                    <th className="px-3 py-2 text-left font-semibold">Inventory Item</th>
                    <th className="px-3 py-2 text-right font-semibold w-16">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold w-24">Unit Price</th>
                    <th className="px-3 py-2 text-right font-semibold w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5"><input value={item.description} onChange={e => setItemField(i,'description',e.target.value)} placeholder="Description…" className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" /></td>
                      <td className="px-2 py-1.5">
                        <select value={item.inventory_item_id||''} onChange={e => setItemField(i,'inventory_item_id',e.target.value||null)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-xs">
                          <option value="">Labor only</option>
                          {inventoryItems.map(inv => <option key={inv.id} value={inv.id}>{inv.item_name} ({inv.quantity_in_stock} {inv.unit})</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5"><input type="number" min="1" value={item.quantity} onChange={e => setItemField(i,'quantity',e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-right" /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => setItemField(i,'unit_price',e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-right" /></td>
                      <td className="px-3 py-1.5 text-right font-semibold">{fmt(item.total_price)}</td>
                      <td className="px-2 py-1.5"><button onClick={() => removeItem(i)} className="p-1 text-red-400 hover:bg-red-50 rounded"><X className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end">
              <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1 min-w-48">
                <div className="flex justify-between text-slate-600"><span>Labor:</span><span>{fmt(laborCost)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Parts:</span><span>{fmt(partsCost)}</span></div>
                <div className="flex justify-between font-bold text-slate-900 border-t pt-1"><span>Total:</span><span>{fmt(totalCost)}</span></div>
              </div>
            </div>
          </div>

          {form.status === 'Completed' && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              Completing this service will auto-deduct inventory stock for all linked parts.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50">
              {saving ? 'Saving…' : editRec ? 'Update Record' : 'Create Record'}
            </button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={showView} onClose={() => setShowView(false)} title={`Service Record: KM-${String(viewRec?.service_number||0).padStart(4,'0')}`} size="lg">
        {viewRec && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 rounded-xl p-4 text-xs">
              <div><span className="text-slate-400">Customer</span><p className="font-semibold text-slate-800 text-[13px]">{viewRec.customers?.name}</p></div>
              <div><span className="text-slate-400">Vehicle</span><p className="font-semibold text-slate-800 text-[13px]">{viewRec.vehicles?.make} {viewRec.vehicles?.model} ({viewRec.vehicles?.plate_number})</p></div>
              <div><span className="text-slate-400">Mechanic</span><p className="font-semibold text-slate-800">{viewRec.technician||'—'}</p></div>
              <div><span className="text-slate-400">Date Started</span><p className="font-semibold text-slate-800">{viewRec.service_date ? new Date(viewRec.service_date).toLocaleDateString('en-PH') : '—'}</p></div>
              
              <div><span className="text-slate-400">Mileage</span><p className="font-semibold text-slate-800">{viewRec.mileage || '—'}</p></div>
              <div><span className="text-slate-400">Service End Date</span><p className="font-semibold text-slate-800">{viewRec.service_end_date ? new Date(viewRec.service_end_date).toLocaleDateString('en-PH') : '—'}</p></div>
              <div><span className="text-slate-400">Warranty End Date</span><p className="font-semibold text-slate-800">{viewRec.warranty_end_date ? new Date(viewRec.warranty_end_date).toLocaleDateString('en-PH') : '—'}</p></div>
              <div><span className="text-slate-400">Status</span><div className="mt-0.5"><Badge variant={statusVariant[viewRec.status]}>{viewRec.status}</Badge></div></div>
              
              {viewRec.created_by && <div><span className="text-slate-400">Created By</span><p className="font-semibold text-slate-800">{viewRec.created_by}</p></div>}
              {viewRec.remarks && <div className="col-span-2"><span className="text-slate-400">Remarks</span><p className="font-semibold text-slate-800">{viewRec.remarks}</p></div>}
            </div>

            {/* Recommendations / Review notes if present */}
            {(viewRec.mechanic_recommendation || viewRec.mechanic_review || viewRec.customer_review) && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-xs space-y-2">
                {viewRec.mechanic_recommendation && (
                  <div>
                    <span className="font-semibold text-slate-700">Mechanic Recommendation:</span>
                    <p className="text-slate-600 italic mt-0.5">{viewRec.mechanic_recommendation}</p>
                  </div>
                )}
                {viewRec.mechanic_review && (
                  <div>
                    <span className="font-semibold text-slate-700">Mechanic Diagnosis/Notes:</span>
                    <p className="text-slate-600 mt-0.5">{viewRec.mechanic_review}</p>
                  </div>
                )}
                {viewRec.customer_review && (
                  <div>
                    <span className="font-semibold text-slate-700">Customer Feedback:</span>
                    <p className="text-slate-600 mt-0.5">{viewRec.customer_review}</p>
                  </div>
                )}
              </div>
            )}

            <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50"><tr className="text-slate-500"><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit Price</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {viewRec.service_items?.map((i, idx) => <tr key={idx}><td className="px-3 py-2 font-medium">{i.description}</td><td className="px-3 py-2 text-right">{i.quantity}</td><td className="px-3 py-2 text-right">{fmt(i.unit_price)}</td><td className="px-3 py-2 text-right font-semibold text-slate-800">{fmt(i.total_price)}</td></tr>)}
              </tbody>
            </table>
            <div className="flex justify-end">
              <div className="bg-slate-50 rounded-xl p-3 space-y-1 min-w-48 text-sm">
                <div className="flex justify-between text-slate-600"><span>Labor:</span><span>{fmt(viewRec.labor_cost)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Parts:</span><span>{fmt(viewRec.parts_cost)}</span></div>
                <div className="flex justify-between font-bold text-slate-900 border-t pt-1"><span>Total Paid:</span><span>{fmt(viewRec.total_cost)}</span></div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={showFinalize} onClose={() => setFinalize(false)} onConfirm={handleFinalize} title="Finalize Service" message="This will mark the service as Completed and automatically deduct all linked parts from inventory. This cannot be undone." confirmText="Finalize" confirmVariant="primary" />
      <ConfirmDialog isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={handleDelete} title="Delete Service Record" message="This will permanently delete the service record and all its items." confirmText="Delete" />
    </AdminLayout>
  )
}
