import React, { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { 
  Plus, Pencil, Trash2, Search, Car, Phone, 
  Mail, ChevronLeft, ChevronRight, AtSign, Hash
} from 'lucide-react'

const PAGE_SIZE = 10

const emptyCustomer = { name: '', contact_number: '', email: '', social_media: '', source: '' }
const emptyVehicle  = { make: '', model: '', year: '', plate_number: '', vin: '', cc: '', size: '' }

const BRANDS = [
  'YAMAHA', 'HONDA', 'B.M.W.', 'PIAGIO', 'SUZUKI', 'KAWASAKI', 
  'HARLEY DAVIDSON', 'SYM', 'K.T.M.', 'DUCATI', 'TRIUMPH', 'KYMCO', 
  'CFMOTO', 'BAJAJ', 'Other'
]

const SOURCES = ['Family', 'Friends', 'Instagram', 'Google', 'Other']

const SIZES = [
  'Small Bikes <= 150',
  'Lower Mid <= 400',
  'Upper Mid <= 750',
  'Big Bike <= 1000',
  'SuperBike > 1000'
]

const autoDetectSize = (ccVal) => {
  const cc = parseInt(ccVal)
  if (isNaN(cc)) return ''
  if (cc <= 150) return 'Small Bikes <= 150'
  if (cc <= 400) return 'Lower Mid <= 400'
  if (cc <= 750) return 'Upper Mid <= 750'
  if (cc <= 1000) return 'Big Bike <= 1000'
  return 'SuperBike > 1000'
}

export default function Customers() {
  const [customers, setCustomers]   = useState([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(0)
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)

  const [showModal, setShowModal]         = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)
  const [editCustomer, setEditCustomer]   = useState(null)
  const [deleteId, setDeleteId]           = useState(null)
  const [form, setForm]                   = useState(emptyCustomer)
  const [vehicles, setVehicles]           = useState([])
  const [saving, setSaving]               = useState(false)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('customers').select('*, vehicles(*)', { count: 'exact' })
    if (search) {
      q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,contact_number.ilike.%${search}%,social_media.ilike.%${search}%,source.ilike.%${search}%`)
    }
    q = q.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    const { data, count, error } = await q
    if (!error) { setCustomers(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, page])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const openAdd = () => {
    setEditCustomer(null)
    setForm(emptyCustomer)
    setVehicles([{ ...emptyVehicle }])
    setShowModal(true)
  }

  const openEdit = async (c) => {
    setEditCustomer(c)
    setForm({ 
      name: c.name, 
      contact_number: c.contact_number || '', 
      email: c.email || '', 
      social_media: c.social_media || '',
      source: c.source || '',
    })
    const { data } = await supabase.from('vehicles').select('*').eq('customer_id', c.id)
    setVehicles(data?.length ? data.map(v => ({ ...v })) : [{ ...emptyVehicle }])
    setShowModal(true)
  }

  const confirmDelete = (id) => { setDeleteId(id); setShowConfirm(true) }

  const handleDelete = async () => {
    const { error } = await supabase.from('customers').delete().eq('id', deleteId)
    if (error) toast.error('Failed to delete customer')
    else { toast.success('Customer deleted'); fetchCustomers() }
  }

  const setField = (f, v) => setForm(p => ({ ...p, [f]: v }))
  
  const setVehicleField = (i, f, v) => {
    setVehicles(p => p.map((veh, idx) => {
      if (idx !== i) return veh
      const updated = { ...veh, [f]: v }
      if (f === 'cc') updated.size = autoDetectSize(v)
      return updated
    }))
  }

  const addVehicleRow  = () => setVehicles(p => [...p, { ...emptyVehicle }])
  const removeVehicleRow = async (i, vehicleId) => {
    if (vehicleId) {
      const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId)
      if (error) return toast.error('Failed to delete vehicle')
    }
    setVehicles(p => p.filter((_, idx) => idx !== i))
  }

  // Ensure contact number starts with +65
  const handleContactChange = (val) => {
    if (!val.startsWith('+65')) {
      val = '+65' + val.replace(/^\+65/, '')
    }
    setField('contact_number', val)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Customer name is required')
    if (!form.contact_number || form.contact_number === '+65') return toast.error('Contact number is required')
    setSaving(true)
    try {
      let customerId = editCustomer?.id
      const payload = { 
        name: form.name.trim(),
        contact_number: form.contact_number,
        email: form.email || null,
        social_media: form.social_media || null,
        source: form.source || null,
      }
      
      if (editCustomer) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editCustomer.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('customers').insert(payload).select().single()
        if (error) throw error
        customerId = data.id
      }
      
      for (const v of vehicles) {
        if (!v.make && !v.model && !v.plate_number) continue
        const vData = { 
          customer_id: customerId, 
          make: v.make || null, 
          model: v.model || null, 
          year: v.year ? parseInt(v.year) : null, 
          cc: v.cc || null,
          size: v.size || null,
          plate_number: v.plate_number || null, 
          vin: v.vin || null,
        }
        if (v.id) {
          const { error } = await supabase.from('vehicles').update(vData).eq('id', v.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('vehicles').insert(vData)
          if (error) throw error
        }
      }
      toast.success(editCustomer ? 'Customer updated!' : 'Customer added!')
      setShowModal(false)
      fetchCustomers()
    } catch (e) {
      toast.error(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Customers</h2>
            <p className="text-sm text-slate-500">{total} total registered customers</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-navy-600 text-white text-sm font-semibold rounded-xl hover:bg-navy-700 transition-all shadow-sm" style={{background:'#1e3a8a'}}>
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search name, contact, social media…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5 font-semibold">Cust #</th>
                  <th className="px-5 py-3.5 font-semibold">Name</th>
                  <th className="px-5 py-3.5 font-semibold">Contact</th>
                  <th className="px-5 py-3.5 font-semibold">Social Media</th>
                  <th className="px-5 py-3.5 font-semibold">Source</th>
                  <th className="px-5 py-3.5 font-semibold">Vehicles</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-5 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>
                  ))
                ) : customers.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center text-slate-400">No customers found</td></tr>
                ) : customers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-blue-700 text-xs font-bold">CUST-{String(c.customer_number || 0).padStart(4, '0')}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{c.name}</td>
                    <td className="px-5 py-3.5 text-slate-600">{c.contact_number || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">{c.social_media ? `@${c.social_media}` : '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">
                      {c.source ? (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{c.source}</span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        {c.vehicles?.map((v, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 border border-slate-100 rounded">
                            <Car className="w-3 h-3 text-slate-400" /> {v.make} {v.model} {v.plate_number ? `(${v.plate_number})` : ''}
                          </span>
                        ))}
                        {(!c.vehicles || c.vehicles.length === 0) && <span className="text-slate-400 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => confirmDelete(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 className="w-4 h-4" /></button>
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

      {/* Add/Edit Modal — 70% screen width */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editCustomer ? 'Edit Customer' : 'Add Customer'} size="xxl">
        <div className="space-y-6">

          {/* ── Customer Info Section ── */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{background:'#1e3a8a'}}>1</span>
              Customer Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* Name — full width */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="e.g. Ahmad Hashim"
                  className="w-full px-4 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Contact Number */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Contact Number <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs font-normal text-slate-400">Singapore (+65)</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm text-slate-600 font-semibold">
                    <Phone className="w-4 h-4 mr-1.5 text-slate-400" /> +65
                  </span>
                  <input
                    value={form.contact_number.replace(/^\+65/, '')}
                    onChange={e => setField('contact_number', '+65' + e.target.value.replace(/^\+65/, ''))}
                    placeholder="XXXX XXXX"
                    className="flex-1 px-4 py-3 text-base border border-slate-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Email — optional */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email Address <span className="text-xs font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setField('email', e.target.value)}
                    placeholder="customer@email.com"
                    className="w-full pl-10 pr-4 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Social Media — optional */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Social Media <span className="text-xs font-normal text-slate-400">(optional — Instagram handle)</span>
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={form.social_media}
                    onChange={e => setField('social_media', e.target.value.replace(/^@/, ''))}
                    placeholder="username"
                    className="w-full pl-10 pr-4 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  How did they find us? <span className="text-xs font-normal text-slate-400">(Source)</span>
                </label>
                <select
                  value={form.source}
                  onChange={e => setField('source', e.target.value)}
                  className="w-full px-4 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select Source…</option>
                  {SOURCES.map(src => <option key={src} value={src}>{src}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Vehicles Section ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{background:'#1e3a8a'}}>2</span>
                Vehicles
              </h3>
              <button
                onClick={addVehicleRow}
                type="button"
                className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Vehicle
              </button>
            </div>

            <div className="space-y-4">
              {vehicles.map((v, i) => (
                <div key={i} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Vehicle {i + 1}</span>
                    {vehicles.length > 1 && (
                      <button
                        onClick={() => removeVehicleRow(i, v.id)}
                        type="button"
                        className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>

                  {/* Row 1: Plate, Brand, Model, CC */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Plate Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          value={v.plate_number}
                          onChange={e => setVehicleField(i, 'plate_number', e.target.value.toUpperCase())}
                          placeholder="e.g. FBA1234G"
                          className="w-full pl-8 pr-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white uppercase"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Brand / Make</label>
                      <select
                        value={v.make}
                        onChange={e => setVehicleField(i, 'make', e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                      >
                        <option value="">Select Brand…</option>
                        {BRANDS.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Model</label>
                      <input
                        value={v.model}
                        onChange={e => setVehicleField(i, 'model', e.target.value)}
                        placeholder="e.g. CB190R"
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Engine CC</label>
                      <input
                        value={v.cc || ''}
                        onChange={e => setVehicleField(i, 'cc', e.target.value)}
                        placeholder="e.g. 1000"
                        type="number"
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>

                  {/* Row 2: Size (auto-filled), Year */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Bike Class <span className="text-slate-400 font-normal">(auto-detected from CC)</span>
                      </label>
                      <select
                        value={v.size || ''}
                        onChange={e => setVehicleField(i, 'size', e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                      >
                        <option value="">Select class…</option>
                        {SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Year</label>
                      <input
                        value={v.year || ''}
                        onChange={e => setVehicleField(i, 'year', e.target.value)}
                        placeholder="e.g. 2024"
                        type="number"
                        min="1900" max="2100"
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setShowModal(false)} className="px-6 py-3 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50"
              style={{background:'#1e3a8a'}}
            >
              {saving ? 'Saving…' : editCustomer ? 'Update Customer' : 'Add Customer'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message="This will permanently delete the customer and all associated vehicles. This action cannot be undone."
        confirmText="Delete Customer"
      />
    </AdminLayout>
  )
}
