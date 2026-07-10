import React, { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Badge from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Search, X, ToggleLeft, ToggleRight } from 'lucide-react'

const emptyForm = { service_name: '', description: '', labor_cost: 0, is_active: true }
const emptyRequiredItem = { inventory_item_id: '', quantity_required: 1 }

export default function ServiceCatalog() {
  const [services, setServices]     = useState([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [inventoryItems, setInvItems] = useState([])

  const [showModal, setShowModal]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [editSvc, setEditSvc]         = useState(null)
  const [deleteId, setDeleteId]       = useState(null)
  const [form, setForm]               = useState({ ...emptyForm })
  const [reqItems, setReqItems]       = useState([{ ...emptyRequiredItem }])
  const [saving, setSaving]           = useState(false)

  const fetchServices = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('service_catalog').select('*, service_catalog_items(*, inventory_items(item_name, unit))')
    if (search) q = q.ilike('service_name', `%${search}%`)
    q = q.order('service_name')
    const { data, error } = await q
    if (!error) setServices(data || [])
    setLoading(false)
  }, [search])

  useEffect(() => { fetchServices() }, [fetchServices])
  useEffect(() => {
    supabase.from('inventory_items').select('id, item_name, unit').order('item_name').then(({ data }) => setInvItems(data || []))
  }, [])

  const openAdd = () => {
    setEditSvc(null); setForm({ ...emptyForm }); setReqItems([{ ...emptyRequiredItem }]); setShowModal(true)
  }
  const openEdit = (s) => {
    setEditSvc(s)
    setForm({ service_name: s.service_name, description: s.description || '', labor_cost: s.labor_cost, is_active: s.is_active })
    setReqItems(s.service_catalog_items?.length ? s.service_catalog_items.map(i => ({ inventory_item_id: i.inventory_item_id, quantity_required: i.quantity_required })) : [{ ...emptyRequiredItem }])
    setShowModal(true)
  }

  const toggleActive = async (s) => {
    const { error } = await supabase.from('service_catalog').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) toast.error('Failed to update')
    else { toast.success(`Service ${s.is_active ? 'deactivated' : 'activated'}`); fetchServices() }
  }

  const handleSave = async () => {
    if (!form.service_name.trim()) return toast.error('Service name is required')
    setSaving(true)
    try {
      const payload = { ...form, labor_cost: parseFloat(form.labor_cost) || 0 }
      let svcId = editSvc?.id
      if (editSvc) {
        const { error } = await supabase.from('service_catalog').update(payload).eq('id', editSvc.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('service_catalog').insert(payload).select().single()
        if (error) throw error
        svcId = data.id
      }
      await supabase.from('service_catalog_items').delete().eq('service_id', svcId)
      const valid = reqItems.filter(i => i.inventory_item_id)
      if (valid.length) {
        await supabase.from('service_catalog_items').insert(valid.map(i => ({ service_id: svcId, inventory_item_id: i.inventory_item_id, quantity_required: parseFloat(i.quantity_required) || 1 })))
      }
      toast.success(editSvc ? 'Service updated!' : 'Service added!')
      setShowModal(false)
      fetchServices()
    } catch (e) { toast.error(e.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    const { error } = await supabase.from('service_catalog').delete().eq('id', deleteId)
    if (error) toast.error('Failed to delete')
    else { toast.success('Service deleted'); fetchServices() }
  }

  const fmt = (n) => `$${(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Service Catalog</h2>
            <p className="text-sm text-slate-500">{services.length} services defined</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Add Service
          </button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services…" className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5 font-semibold">ID</th>
                  <th className="px-5 py-3.5 font-semibold">Service Name</th>
                  <th className="px-5 py-3.5 font-semibold">Description</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Labor Cost</th>
                  <th className="px-5 py-3.5 font-semibold">Required Parts</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>)
                : services.length === 0 ? <tr><td colSpan={7} className="py-16 text-center text-slate-400">No services defined yet</td></tr>
                : services.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate-400 text-xs">{s.id.slice(0, 8)}…</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{s.service_name}</td>
                    <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate text-xs">{s.description || '—'}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-blue-600">{fmt(s.labor_cost)}</td>
                    <td className="px-5 py-3.5">
                      {s.service_catalog_items?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.service_catalog_items.map((ci, idx) => (
                            <span key={idx} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {ci.inventory_items?.item_name} ×{ci.quantity_required}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-xs text-slate-400">None</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center"><Badge variant={s.is_active ? 'success' : 'gray'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => toggleActive(s)} className={`p-1.5 rounded-lg transition-all ${s.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`} title={s.is_active ? 'Deactivate' : 'Activate'}>
                          {s.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button onClick={() => openEdit(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => { setDeleteId(s.id); setShowConfirm(true) }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editSvc ? 'Edit Service' : 'Add Service'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Service Name *</label>
            <input value={form.service_name} onChange={e => setForm(p => ({ ...p, service_name: e.target.value }))} placeholder="e.g. Basic Oil Change" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Describe what this service includes…" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Labor Cost ($)</label>
              <input type="number" min="0" step="0.01" value={form.labor_cost} onChange={e => setForm(p => ({ ...p, labor_cost: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
              <button onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${form.is_active ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                {form.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                {form.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>

          {/* Required parts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600">Required Inventory Items</label>
              <button onClick={() => setReqItems(p => [...p, { ...emptyRequiredItem }])} type="button" className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Part</button>
            </div>
            <div className="space-y-2">
              {reqItems.map((ri, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={ri.inventory_item_id} onChange={e => setReqItems(p => p.map((x, idx) => idx === i ? { ...x, inventory_item_id: e.target.value } : x))} className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                    <option value="">Select inventory item…</option>
                    {inventoryItems.map(inv => <option key={inv.id} value={inv.id}>{inv.item_name} ({inv.unit})</option>)}
                  </select>
                  <input type="number" min="1" value={ri.quantity_required} onChange={e => setReqItems(p => p.map((x, idx) => idx === i ? { ...x, quantity_required: e.target.value } : x))} placeholder="Qty" className="w-16 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-center" />
                  <button onClick={() => setReqItems(p => p.filter((_, idx) => idx !== i))} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50">
              {saving ? 'Saving…' : editSvc ? 'Update Service' : 'Add Service'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={handleDelete} title="Delete Service" message="This will permanently delete this service from the catalog." confirmText="Delete" />
    </AdminLayout>
  )
}
