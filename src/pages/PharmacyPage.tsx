import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  PackagePlus,
  Pill,
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react';
import type { ClientHmisState } from '../lib/api';
import { apiRequest, formatDate, formatDateTime, formatUGX } from '../lib/api';
import type { InventoryItem, Prescription } from '../types/hmis';
import { Modal } from '../components/Modal';
import { StatusTag } from '../components/StatusTag';

interface PharmacyPageProps {
  state: ClientHmisState;
  onRefresh: () => Promise<void>;
}

export const PharmacyPage: React.FC<PharmacyPageProps> = ({ state, onRefresh }) => {
  const [tab, setTab] = useState<'inventory' | 'dispense' | 'sales' | 'adjustments'>('inventory');
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [dispenseRx, setDispenseRx] = useState<Prescription | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [error, setError] = useState('');

  const [itemForm, setItemForm] = useState({
    name: '',
    code: '',
    category: 'Medicine',
    unit: 'Pack',
    purchase_price: '1000',
    selling_price: '2000',
    current_stock: '50',
    reorder_level: '10',
    expiry_date: '2027-12-31',
    therapeutic_class: '',
    active_ingredient: '',
  });

  const [adjustForm, setAdjustForm] = useState({ quantity: '10', reason: 'Restock delivery' });
  const [dispenseForm, setDispenseForm] = useState({
    inventory_item_id: state.inventory_items[0]?.id || '',
    quantity_dispensed: '1',
  });
  const [saleForm, setSaleForm] = useState({
    patient_id: '',
    inventory_item_id: state.inventory_items[0]?.id || '',
    quantity: '1',
    payment_method: 'Cash',
  });

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/inventory/items', {
      method: 'POST',
      body: JSON.stringify(itemForm),
    });
    await onRefresh();
    setNewItemOpen(false);
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    await apiRequest(`/api/inventory/items/${adjustItem.id}/adjust`, {
      method: 'POST',
      body: JSON.stringify(adjustForm),
    });
    await onRefresh();
    setAdjustItem(null);
  };

  const openDispenseModal = (rx: Prescription) => {
    setDispenseRx(rx);
    setError('');
    const matched = state.inventory_items.find((i) =>
      i.name.toLowerCase().includes(rx.drug_name.toLowerCase())
    );
    setDispenseForm({
      inventory_item_id: matched?.id || state.inventory_items[0]?.id || '',
      quantity_dispensed: String(rx.quantity || 1),
    });
  };

  const handleDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispenseRx) return;
    setError('');
    try {
      await apiRequest('/api/pharmacy/dispense', {
        method: 'POST',
        body: JSON.stringify({
          prescription_id: dispenseRx.id,
          ...dispenseForm,
        }),
      });
      await onRefresh();
      setDispenseRx(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispense failed');
    }
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/api/pharmacy/sales', {
        method: 'POST',
        body: JSON.stringify({
          ...saleForm,
          patient_id: saleForm.patient_id || null,
        }),
      });
      await onRefresh();
      setSaleOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sale failed');
    }
  };

  const lowStockCount = state.inventory_items.filter(
    (i) => i.current_stock <= i.reorder_level
  ).length;
  const pendingRxCount = state.prescriptions.filter((p) => !p.is_dispensed).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Pharmacy & Inventory</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Dispense consultation prescriptions, process walk-in sales, and control hospital stock levels.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setError('');
              setSaleOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Walk-In Sale</span>
          </button>
          <button
            type="button"
            onClick={() => setNewItemOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md whitespace-nowrap"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Add Stock Item</span>
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Catalog SKUs</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {state.inventory_items.length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {lowStockCount > 0 ? (
              <span className="text-amber-700 font-medium inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {lowStockCount} below reorder level
              </span>
            ) : (
              'All stock levels healthy'
            )}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Prescription Queue</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {pendingRxCount} pending
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {state.dispensations.length} total dispensations completed
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Walk-In Pharmacy Revenue</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1 font-mono tabular-nums">
            {formatUGX(state.pharmacy_sales.reduce((s, x) => s + Number(x.total), 0))}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Across {state.pharmacy_sales.length} counter sales
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-md w-fit">
        {[
          { id: 'inventory', label: `Inventory (${state.inventory_items.length})` },
          { id: 'dispense', label: `Prescriptions (${state.prescriptions.length})` },
          { id: 'sales', label: `Walk-In Sales (${state.pharmacy_sales.length})` },
          { id: 'adjustments', label: `Stock Audit (${state.stock_adjustments.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inventory' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Item Name & Class</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4 text-right">Selling Price</th>
                  <th className="py-2.5 px-4 text-right">Stock</th>
                  <th className="py-2.5 px-4">Expiry</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.inventory_items.map((item) => {
                  const isLow = item.current_stock <= item.reorder_level;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-slate-600">{item.code}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        {item.active_ingredient && (
                          <div className="text-[11px] text-slate-500">
                            {item.active_ingredient} · {item.therapeutic_class || item.category}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{item.category}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {formatUGX(item.selling_price)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        <span className={isLow ? 'text-rose-700 font-semibold' : 'text-slate-900'}>
                          {item.current_stock} {item.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                        {formatDate(item.expiry_date)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustItem(item);
                            setAdjustForm({ quantity: '10', reason: 'Restock' });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded whitespace-nowrap"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Adjust Stock</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'dispense' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Consultation</th>
                  <th className="py-2.5 px-4">Patient</th>
                  <th className="py-2.5 px-4">Drug & Regimen</th>
                  <th className="py-2.5 px-4 text-right">Qty</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.prescriptions.map((rx) => {
                  const cons = state.consultations.find((c) => c.id === rx.consultation_id);
                  const pat = state.patients.find((p) => p.id === cons?.patient_id);
                  return (
                    <tr key={rx.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-slate-700">{cons?.code || '—'}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown'}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{rx.drug_name}</div>
                        <div className="text-slate-500">
                          {rx.dosage} · {rx.frequency} · {rx.instructions || rx.route}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {rx.quantity || 1}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={rx.is_dispensed ? 'Completed' : 'Pending'} />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {!rx.is_dispensed && (
                          <button
                            type="button"
                            onClick={() => openDispenseModal(rx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 rounded whitespace-nowrap"
                          >
                            <Pill className="w-3.5 h-3.5" />
                            <span>Dispense</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'sales' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Item</th>
                <th className="py-2.5 px-4">Customer</th>
                <th className="py-2.5 px-4 text-right">Qty</th>
                <th className="py-2.5 px-4 text-right">Total</th>
                <th className="py-2.5 px-4">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.pharmacy_sales.map((s) => {
                const item = state.inventory_items.find((i) => i.id === s.inventory_item_id);
                const pat = state.patients.find((p) => p.id === s.patient_id);
                return (
                  <tr key={s.id}>
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                      {formatDateTime(s.sold_at)}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {item?.name || 'Item'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {pat ? `${pat.first_name} ${pat.last_name}` : 'Walk-In Customer'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{s.quantity}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium tabular-nums">
                      {formatUGX(s.total)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{s.payment_method || 'Cash'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'adjustments' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Item</th>
                <th className="py-2.5 px-4 text-right">Delta</th>
                <th className="py-2.5 px-4 text-right">Prev → New</th>
                <th className="py-2.5 px-4">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.stock_adjustments.map((a) => {
                const item = state.inventory_items.find((i) => i.id === a.inventory_item_id);
                return (
                  <tr key={a.id}>
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                      {formatDateTime(a.created_at)}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {item?.name || 'Item'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      <span className={a.quantity >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {a.quantity >= 0 ? `+${a.quantity}` : a.quantity}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {a.previous_stock} → {a.new_stock}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{a.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Stock Modal */}
      <Modal
        open={Boolean(adjustItem)}
        onClose={() => setAdjustItem(null)}
        title={adjustItem ? `Adjust Stock · ${adjustItem.name}` : 'Adjust Stock'}
        subtitle={
          adjustItem
            ? `Current balance: ${adjustItem.current_stock} ${adjustItem.unit}`
            : undefined
        }
      >
        <form onSubmit={handleAdjustStock} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Quantity Change (use negative for deductions)
            </label>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400" />
              <input
                type="number"
                required
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Reason *</label>
            <input
              required
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAdjustItem(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Apply Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* Dispense Prescription Modal */}
      <Modal
        open={Boolean(dispenseRx)}
        onClose={() => setDispenseRx(null)}
        title="Dispense Prescription"
        subtitle={dispenseRx ? `${dispenseRx.drug_name} (${dispenseRx.dosage})` : undefined}
      >
        <form onSubmit={handleDispense} className="space-y-4">
          {error && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Select Pharmacy Inventory Item / Alternative
            </label>
            <select
              value={dispenseForm.inventory_item_id}
              onChange={(e) =>
                setDispenseForm({ ...dispenseForm, inventory_item_id: e.target.value })
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {state.inventory_items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {i.current_stock} in stock ({formatUGX(i.selling_price)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Quantity to Dispense
            </label>
            <input
              type="number"
              min={1}
              required
              value={dispenseForm.quantity_dispensed}
              onChange={(e) =>
                setDispenseForm({ ...dispenseForm, quantity_dispensed: e.target.value })
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDispenseRx(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Confirm Dispense & Bill
            </button>
          </div>
        </form>
      </Modal>

      {/* Walk-In Sale Modal */}
      <Modal open={saleOpen} onClose={() => setSaleOpen(false)} title="Walk-In Pharmacy Counter Sale">
        <form onSubmit={handleCreateSale} className="space-y-4">
          {error && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Item *</label>
            <select
              value={saleForm.inventory_item_id}
              onChange={(e) => setSaleForm({ ...saleForm, inventory_item_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {state.inventory_items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {formatUGX(i.selling_price)} ({i.current_stock} avail.)
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                min={1}
                required
                value={saleForm.quantity}
                onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Payment Mode</label>
              <select
                value={saleForm.payment_method}
                onChange={(e) => setSaleForm({ ...saleForm, payment_method: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
              >
                {state.payment_modes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Patient (Optional)
            </label>
            <select
              value={saleForm.patient_id}
              onChange={(e) => setSaleForm({ ...saleForm, patient_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              <option value="">Walk-In Customer</option>
              {state.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name} ({p.code})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSaleOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Complete Sale
            </button>
          </div>
        </form>
      </Modal>

      {/* New Inventory Item Modal */}
      <Modal open={newItemOpen} onClose={() => setNewItemOpen(false)} title="Add Inventory / Pharmacy Item">
        <form onSubmit={handleCreateItem} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
              <input
                required
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Item Code</label>
              <input
                value={itemForm.code}
                onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })}
                placeholder="Auto"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select
                value={itemForm.category}
                onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="Medicine">Medicine</option>
                <option value="Medical Supply">Medical Supply</option>
                <option value="Lab Reagent">Lab Reagent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Unit</label>
              <input
                value={itemForm.unit}
                onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Purchase Price (UGX)
              </label>
              <input
                type="number"
                value={itemForm.purchase_price}
                onChange={(e) => setItemForm({ ...itemForm, purchase_price: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Selling Price (UGX) *
              </label>
              <input
                type="number"
                required
                value={itemForm.selling_price}
                onChange={(e) => setItemForm({ ...itemForm, selling_price: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Initial Stock</label>
              <input
                type="number"
                value={itemForm.current_stock}
                onChange={(e) => setItemForm({ ...itemForm, current_stock: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reorder Level</label>
              <input
                type="number"
                value={itemForm.reorder_level}
                onChange={(e) => setItemForm({ ...itemForm, reorder_level: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Active Ingredient
              </label>
              <input
                value={itemForm.active_ingredient}
                onChange={(e) => setItemForm({ ...itemForm, active_ingredient: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Expiry Date</label>
              <input
                type="date"
                value={itemForm.expiry_date}
                onChange={(e) => setItemForm({ ...itemForm, expiry_date: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setNewItemOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Add Item
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
