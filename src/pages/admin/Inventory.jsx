import React, { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Badge from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Search, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 10
const CATEGORIES = ['Consumable', 'Spare Part', 'Tool', 'Fluid']
const emptyForm = { item_name: '', category: 'Consumable', unit: 'pcs', quantity_in_stock: 0, minimum_stock_level: 0, cost_price: 0, selling_price: 0 }
const fmt = (n) => `$${(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`

function stockVariant(qty, min) {
  if (qty <= min) return 'danger'
  if (qty <= min * 1.5) return 'warning'
  return 'success'
}

export default function Inventory() {
  const [items, setItems]       = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(0)
  const [search, setSearch]     = useState('')
  const [catFilter, setCat]     = useState('All')
  const [loading, setLoading]   = useState(true)
  const [lowCount, setLowCount] = useState(0)

  const [showModal, setShowModal]     = useState(false)
  const [showRestock, setShowRestock] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [editItem, setEditItem]       = useState(null)
  const [restockItem, setRestockItem] = useState(null)
  const [deleteId, setDeleteId]       = useState(null)
  const [form, setForm]               = useState({ ...emptyForm })
  const [restockAmt, setRestockAmt]   = useState(0)
  const [saving, setSaving]           = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('inventory_items').select('*', { count: 'exact' })
    if (catFilter !== 'All') q = q.eq('category', catFilter)
    if (search) q = q.ilike('item_name', `%${search}%`)
    q = q.order('item_name').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    const { data, count, error } = await q
    if (!error) { setItems(data || []); setTotal(count || 0) }
    // low count
    const { data: lc } = await supabase.from('inventory_items').select('id').lte('quantity_in_stock', 'minimum_stock_level')
    setLowCount(lc?.length || 0)
    setLoading(false)
  }, [search, page, catFilter])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openAdd = () => { setEditItem(null); setForm({ ...emptyForm }); setShowModal(true) }
  const openEdit = (i) => { setEditItem(i); setForm({ item_name: i.item_name, category: i.category, unit: i.unit, quantity_in_stock: i.quantity_in_stock, minimum_stock_level: i.minimum_stock_level, cost_price: i.cost_price, selling_price: i.selling_price }); setShowModal(true) }
  const openRestock = (i) => { setRestockItem(i); setRestockAmt(0); setShowRestock(true) }

  const setField = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleSave = async () => {
    if (!form.item_name.trim()) return toast.error('Item name is required')
    setSaving(true)
    try {
      const payload = { ...form, quantity_in_stock: parseFloat(form.quantity_in_stock)||0, minimum_stock_level: parseFloat(form.minimum_stock_level)||0, cost_price: parseFloat(form.cost_price)||0, selling_price: parseFloat(form.selling_price)||0, last_updated: new Date().toISOString() }
      if (editItem) {
        const { error } = await supabase.from('inventory_items').update(payload).eq('id', editItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('inventory_items').insert(payload)
        if (error) throw error
      }
      toast.success(editItem ? 'Item updated!' : 'Item added!')
      setShowModal(false)
      fetchItems()
    } catch (e) { toast.error(e.message||'Failed to save') }
    finally { setSaving(false) }
  }

  const handleRestock = async () => {
    const amt = parseFloat(restockAmt)
    if (!amt || amt <= 0) return toast.error('Enter a valid restock amount')
    const { error } = await supabase.from('inventory_items').update({ quantity_in_stock: restockItem.quantity_in_stock + amt, last_updated: new Date().toISOString() }).eq('id', restockItem.id)
    if (error) toast.error('Restock failed')
    else { toast.success(`Restocked ${amt} ${restockItem.unit} of ${restockItem.item_name}`); setShowRestock(false); fetchItems() }
  }

  const handleDelete = async () => {
    const { error } = await supabase.from('inventory_items').delete().eq('id', deleteId)
    if (error) toast.error('Failed to delete')
    else { toast.success('Item deleted'); fetchItems() }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Inventory</h2>
            <p className="text-sm text-slate-500">{total} items · {lowCount > 0 && <span className="text-red-500 font-medium">{lowCount} low stock</span>}</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>

        {lowCount > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 bg-red-50 border border-red-200 rounded-2xl text-red-800">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-sm font-medium">{lowCount} item{lowCount > 1 ? 's are' : ' is'} at or below minimum stock level!</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-0.5 flex-wrap shadow-sm">
            {['All', ...CATEGORIES].map(c => (
              <button key={c} onClick={() => { setCat(c); setPage(0) }} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${catFilter === c ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{c}</button>
            ))}
          </div>
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Search item name…" className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5 font-semibold">Item ID</th>
                  <th className="px-5 py-3.5 font-semibold">Name</th>
                  <th className="px-5 py-3.5 font-semibold">Category</th>
                  <th className="px-5 py-3.5 font-semibold">Unit</th>
                  <th className="px-5 py-3.5 font-semibold text-right">In Stock</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Min Level</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Cost</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Selling</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={10} className="px-5 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>)
                : items.length === 0 ? <tr><td colSpan={10} className="py-16 text-center text-slate-400">No inventory items found</td></tr>
                : items.map(item => (
                  <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${item.quantity_in_stock <= item.minimum_stock_level ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3.5 font-mono text-slate-400 text-xs">{item.id.slice(0, 8)}…</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{item.item_name}</td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">{item.category}</td>
                    <td className="px-5 py-3.5 text-slate-600">{item.unit}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900">{item.quantity_in_stock}</td>
                    <td className="px-5 py-3.5 text-right text-slate-500">{item.minimum_stock_level}</td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{fmt(item.cost_price)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{fmt(item.selling_price)}</td>
                    <td className="px-5 py-3.5 text-center"><Badge variant={stockVariant(item.quantity_in_stock, item.minimum_stock_level)}>{item.quantity_in_stock <= item.minimum_stock_level ? 'Low Stock' : item.quantity_in_stock <= item.minimum_stock_level * 1.5 ? 'Warning' : 'In Stock'}</Badge></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => { setDeleteId(item.id); setShowConfirm(true) }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Inventory Item' : 'Add Inventory Item'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Item Name *</label>
            <input value={form.item_name} onChange={e => setField('item_name', e.target.value)} placeholder="e.g. Engine Oil 5W-30" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
              <select value={form.category} onChange={e => setField('category', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Unit</label>
              <input value={form.unit} onChange={e => setField('unit', e.target.value)} placeholder="pcs / liters / pairs" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Quantity in Stock</label>
              <input type="number" min="0" value={form.quantity_in_stock} onChange={e => setField('quantity_in_stock', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Minimum Stock Level</label>
              <input type="number" min="0" value={form.minimum_stock_level} onChange={e => setField('minimum_stock_level', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cost Price ($)</label>
              <input type="number" min="0" step="0.01" value={form.cost_price} onChange={e => setField('cost_price', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Selling Price ($)</label>
              <input type="number" min="0" step="0.01" value={form.selling_price} onChange={e => setField('selling_price', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50">
              {saving ? 'Saving…' : editItem ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={handleDelete} title="Delete Inventory Item" message="This will permanently delete this item from inventory." confirmText="Delete" />
    </AdminLayout>
  )
}
