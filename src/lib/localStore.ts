import type {
  AuditLog,
  HmisDatabase,
  Invoice,
  InvoiceItem,
  UserRole,
} from '../types/hmis';
import { createSeedDatabase } from './seedData';

const STORAGE_KEY = 'maches_hms_db_v1';

let memDb: HmisDatabase | null = null;

function uid(prefix = ''): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${raw.slice(0, 8)}` : raw;
}

export function getLocalDb(): HmisDatabase {
  if (memDb) return memDb;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      memDb = JSON.parse(raw) as HmisDatabase;
      return memDb;
    }
  } catch {
    // ignore storage parse failures
  }
  memDb = createSeedDatabase();
  saveLocalDb(memDb);
  return memDb;
}

export function saveLocalDb(db: HmisDatabase): void {
  memDb = db;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore quota errors
  }
}

export function exportDatabaseBackup(): string {
  const db = getLocalDb();
  return JSON.stringify(db, null, 2);
}

export function importDatabaseBackup(jsonText: string): void {
  const parsed = JSON.parse(jsonText) as HmisDatabase;
  if (!parsed || !Array.isArray(parsed.patients) || !Array.isArray(parsed.users)) {
    throw new Error('Invalid MachesHMS backup JSON file.');
  }
  saveLocalDb(parsed);
}

export function resetLocalDatabase(): void {
  const seed = createSeedDatabase();
  saveLocalDb(seed);
}

function addAudit(
  db: HmisDatabase,
  entity_type: string,
  entity_id: string,
  action: string,
  changes: Record<string, unknown>,
  performed_by = 'Administrator'
) {
  const entry: AuditLog = {
    id: uid('aud'),
    entity_type,
    entity_id,
    action,
    changes,
    performed_by,
    created_at: new Date().toISOString(),
  };
  db.audit_logs.unshift(entry);
  if (db.audit_logs.length > 200) db.audit_logs.length = 200;
}

function addNotification(
  db: HmisDatabase,
  title: string,
  message: string,
  link: string,
  category: string
) {
  db.notifications.unshift({
    id: uid('notif'),
    title,
    message,
    link,
    category,
    is_read: false,
    created_at: new Date().toISOString(),
  });
}

function ensureOpenInvoice(
  db: HmisDatabase,
  patientId: string,
  consultationId: string | null
): Invoice {
  if (consultationId) {
    const existing = db.invoices.find(
      (i) => i.consultation_id === consultationId && i.status !== 'Void'
    );
    if (existing) return existing;
  }
  const now = new Date();
  const due = new Date(now.getTime() + 14 * 86400000);
  const inv: Invoice = {
    id: uid('inv'),
    patient_id: patientId,
    consultation_id: consultationId,
    invoice_number: `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${uid().slice(0, 8)}`,
    issued_at: now.toISOString(),
    due_date: due.toISOString().slice(0, 10),
    subtotal: 0,
    discount: 0,
    tax: 0,
    total_amount: 0,
    amount_paid: 0,
    status: 'Unpaid',
    payment_method: null,
    insurance_provider: null,
    insurance_policy_number: null,
    created_at: now.toISOString(),
  };
  db.invoices.unshift(inv);
  return inv;
}

function recalcInvoice(db: HmisDatabase, invoiceId: string) {
  const inv = db.invoices.find((i) => i.id === invoiceId);
  if (!inv) return;
  const items = db.invoice_items.filter((it) => it.invoice_id === invoiceId);
  const subtotal = items.reduce((sum, it) => sum + Number(it.total_price), 0);
  inv.subtotal = subtotal;
  inv.total_amount = Math.max(0, subtotal - Number(inv.discount) + Number(inv.tax));
  if (inv.status !== 'Void') {
    if (inv.amount_paid >= inv.total_amount && inv.total_amount > 0) {
      inv.status = 'Paid';
    } else if (inv.amount_paid > 0 && inv.amount_paid < inv.total_amount) {
      inv.status = 'PartiallyPaid';
    } else if (inv.total_amount === 0) {
      inv.status = 'Paid';
    } else {
      inv.status = 'Unpaid';
    }
  }
}

export async function dispatchLocalApi<T>(url: string, options?: RequestInit): Promise<T> {
  const db = getLocalDb();
  const method = (options?.method || 'GET').toUpperCase();
  const body = options?.body ? JSON.parse(String(options.body)) : {};

  // State snapshot
  if (url === '/api/state' && method === 'GET') {
    const safeUsers = db.users.map(({ password: _p, ...u }) => u);
    return { ...db, users: safeUsers } as unknown as T;
  }

  // Auth
  if (url === '/api/auth/login' && method === 'POST') {
    const found = db.users.find(
      (u) => u.username.toLowerCase() === String(body.username || '').trim().toLowerCase()
    );
    if (!found || !found.is_active) {
      throw new Error('Invalid credentials or inactive account.');
    }
    if (body.password && found.password !== body.password) {
      throw new Error('Invalid password.');
    }
    found.last_login = new Date().toISOString();
    addAudit(db, 'User', found.id, 'LOGIN', { username: found.username }, found.full_name);
    saveLocalDb(db);
    const { password: _p, ...safe } = found;
    return { user: safe } as unknown as T;
  }

  if (url === '/api/users/profile' && method === 'POST') {
    const u = db.users.find((x) => x.id === body.userId);
    if (!u) throw new Error('User not found');
    if (body.full_name) u.full_name = body.full_name;
    if (body.email !== undefined) u.email = body.email;
    if (body.phone !== undefined) u.phone = body.phone;
    if (body.newPassword) u.password = body.newPassword;
    saveLocalDb(db);
    const { password: _p, ...safe } = u;
    return { user: safe } as unknown as T;
  }

  // Notifications
  if (url === '/api/notifications/mark-read' && method === 'POST') {
    if (body.notification_id === 'all') {
      db.notifications.forEach((n) => {
        n.is_read = true;
      });
    } else {
      const n = db.notifications.find((x) => x.id === body.notification_id);
      if (n) n.is_read = true;
    }
    saveLocalDb(db);
    return { ok: true } as unknown as T;
  }

  if (url === '/api/notifications/clear-read' && method === 'DELETE') {
    db.notifications = db.notifications.filter((n) => !n.is_read);
    saveLocalDb(db);
    return { ok: true } as unknown as T;
  }

  // Patients
  if (url === '/api/patients' && method === 'POST') {
    const code = String(Math.floor(26000000 + Math.random() * 999999));
    const patient = {
      id: uid('pat'),
      code,
      first_name: String(body.first_name || '').trim(),
      last_name: String(body.last_name || '').trim(),
      date_of_birth: body.date_of_birth || '1995-01-01',
      gender: body.gender || 'Female',
      phone: body.phone || '',
      email: body.email || '',
      address: body.address || '',
      emergency_contact: body.emergency_contact || '',
      created_at: new Date().toISOString(),
    };
    db.patients.unshift(patient);
    addAudit(db, 'Patient', patient.id, 'CREATE', { code: patient.code });
    saveLocalDb(db);
    return patient as unknown as T;
  }

  if (url.startsWith('/api/patients/') && method === 'PUT') {
    const id = url.replace('/api/patients/', '');
    const p = db.patients.find((x) => x.id === id);
    if (!p) throw new Error('Patient not found');
    Object.assign(p, body, { id: p.id, code: p.code });
    addAudit(db, 'Patient', p.id, 'UPDATE', { name: `${p.first_name} ${p.last_name}` });
    saveLocalDb(db);
    return p as unknown as T;
  }

  if (url.startsWith('/api/patients/') && method === 'DELETE') {
    const id = url.replace('/api/patients/', '');
    db.patients = db.patients.filter((x) => x.id !== id);
    addAudit(db, 'Patient', id, 'DELETE', {});
    saveLocalDb(db);
    return { ok: true } as unknown as T;
  }

  // Vitals
  if (url === '/api/vitals' && method === 'POST') {
    const w = body.weight ? Number(body.weight) : null;
    const h = body.height ? Number(body.height) : null;
    const bmi = w && h && h > 0 ? Number((w / ((h / 100) * (h / 100))).toFixed(2)) : null;
    const vitals = {
      id: uid('vit'),
      patient_id: body.patient_id,
      recorded_at: new Date().toISOString(),
      blood_pressure_systolic: body.blood_pressure_systolic ? Number(body.blood_pressure_systolic) : null,
      blood_pressure_diastolic: body.blood_pressure_diastolic ? Number(body.blood_pressure_diastolic) : null,
      temperature: body.temperature ? Number(body.temperature) : null,
      pulse: body.pulse ? Number(body.pulse) : null,
      respiratory_rate: body.respiratory_rate ? Number(body.respiratory_rate) : null,
      weight: w,
      height: h,
      spo2: body.spo2 ? Number(body.spo2) : null,
      bmi,
      notes: body.notes || '',
      recorded_by: body.recorded_by || null,
    };
    db.triage_vitals.unshift(vitals);
    addAudit(db, 'TriageVitals', vitals.id, 'RECORD', { patient_id: vitals.patient_id, bmi });
    saveLocalDb(db);
    return vitals as unknown as T;
  }

  // Consultations
  if (url === '/api/consultations' && method === 'POST') {
    const now = new Date();
    const start = body.scheduled_start || now.toISOString();
    const end = body.scheduled_end || new Date(new Date(start).getTime() + 30 * 60000).toISOString();
    const cons = {
      id: uid('cons'),
      code: `CONS-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      patient_id: body.patient_id,
      doctor_id: body.doctor_id,
      consultation_type: body.consultation_type || 'OPD',
      scheduled_start: start,
      scheduled_end: end,
      chief_complaint: body.chief_complaint || null,
      history_of_presenting_illness: body.history_of_presenting_illness || null,
      past_medical_history: body.past_medical_history || null,
      examination_findings: body.examination_findings || null,
      diagnosis_codes: Array.isArray(body.diagnosis_codes) ? body.diagnosis_codes : [],
      diagnosis_text: body.diagnosis_text || null,
      status: body.status || 'Scheduled',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    db.consultations.unshift(cons);
    const pat = db.patients.find((p) => p.id === body.patient_id);
    addNotification(
      db,
      'New Consultation Scheduled',
      `${cons.code} for ${pat ? `${pat.first_name} ${pat.last_name}` : 'Patient'} (${cons.consultation_type})`,
      'consultations',
      'Clinical'
    );
    addAudit(db, 'Consultation', cons.id, 'CREATE', { code: cons.code });
    saveLocalDb(db);
    return cons as unknown as T;
  }

  if (/^\/api\/consultations\/[^/]+\/prescriptions$/.test(url) && method === 'POST') {
    const id = url.split('/')[3];
    const c = db.consultations.find((x) => x.id === id);
    if (!c) throw new Error('Consultation not found');
    const rx = {
      id: uid('rx'),
      consultation_id: c.id,
      drug_name: body.drug_name,
      dosage: body.dosage || '',
      route: body.route || 'Oral',
      frequency: body.frequency || '',
      duration_days: body.duration_days ? Number(body.duration_days) : null,
      quantity: body.quantity ? Number(body.quantity) : 1,
      instructions: body.instructions || '',
      is_dispensed: false,
      created_at: new Date().toISOString(),
    };
    db.prescriptions.unshift(rx);
    addNotification(
      db,
      'New Prescription Queue',
      `${rx.drug_name} (${rx.quantity ?? 1}) prescribed in ${c.code}.`,
      'pharmacy',
      'Pharmacy'
    );
    saveLocalDb(db);
    return rx as unknown as T;
  }

  if (url.startsWith('/api/consultations/') && method === 'PUT') {
    const id = url.replace('/api/consultations/', '');
    const c = db.consultations.find((x) => x.id === id);
    if (!c) throw new Error('Consultation not found');
    const prevStatus = c.status;
    Object.assign(c, body, { updated_at: new Date().toISOString() });
    if (c.status === 'Completed' && prevStatus !== 'Completed') {
      const doc = db.doctors.find((d) => d.id === c.doctor_id);
      const docUser = db.users.find((u) => u.id === doc?.user_id);
      const fee = doc?.consultation_fee ?? 10000;
      const alreadyBilled = db.invoice_items.some(
        (it) => it.reference_type === 'consultation' && it.reference_id === c.id
      );
      if (!alreadyBilled) {
        const inv = ensureOpenInvoice(db, c.patient_id, c.id);
        db.invoice_items.push({
          id: uid('item'),
          invoice_id: inv.id,
          description: `Consultation fee (${docUser ? `Dr. ${docUser.full_name}` : c.code})`,
          quantity: 1,
          unit_price: fee,
          total_price: fee,
          reference_type: 'consultation',
          reference_id: c.id,
          created_at: new Date().toISOString(),
        });
        recalcInvoice(db, inv.id);
      }
    }
    addAudit(db, 'Consultation', c.id, 'UPDATE', { status: c.status });
    saveLocalDb(db);
    return c as unknown as T;
  }

  // Lab
  if (url === '/api/lab/tests' && method === 'POST') {
    const t = {
      id: uid('labt'),
      name: body.name,
      normal_range: body.normal_range || null,
      price: Number(body.price || 0),
    };
    db.lab_tests.push(t);
    saveLocalDb(db);
    return t as unknown as T;
  }

  if (url.startsWith('/api/lab/tests/') && method === 'PUT') {
    const id = url.replace('/api/lab/tests/', '');
    const t = db.lab_tests.find((x) => x.id === id);
    if (!t) throw new Error('Lab test not found');
    Object.assign(t, body, { price: Number(body.price ?? t.price) });
    saveLocalDb(db);
    return t as unknown as T;
  }

  if (url.startsWith('/api/lab/tests/') && method === 'DELETE') {
    const id = url.replace('/api/lab/tests/', '');
    db.lab_tests = db.lab_tests.filter((x) => x.id !== id);
    saveLocalDb(db);
    return { ok: true } as unknown as T;
  }

  if (url === '/api/lab/orders' && method === 'POST') {
    const test = db.lab_tests.find((t) => t.id === body.test_id);
    const pat = db.patients.find((p) => p.id === body.patient_id);
    const order = {
      id: uid('labo'),
      consultation_id: body.consultation_id || null,
      patient_id: body.patient_id,
      test_id: body.test_id,
      status: 'Pending' as const,
      result_notes: null,
      ordered_at: new Date().toISOString(),
      collected_at: null,
      verified_at: null,
      verified_by: null,
      sample_id: null,
    };
    db.lab_orders.unshift(order);
    if (test) {
      const inv = ensureOpenInvoice(db, body.patient_id, body.consultation_id || null);
      db.invoice_items.push({
        id: uid('item'),
        invoice_id: inv.id,
        description: `Lab: ${test.name}`,
        quantity: 1,
        unit_price: test.price,
        total_price: test.price,
        reference_type: 'lab',
        reference_id: order.id,
        created_at: new Date().toISOString(),
      });
      recalcInvoice(db, inv.id);
    }
    addNotification(
      db,
      'New Lab Order',
      `${test?.name || 'Lab test'} ordered for ${pat ? `${pat.first_name} ${pat.last_name}` : 'patient'}.`,
      'laboratory',
      'Laboratory'
    );
    saveLocalDb(db);
    return order as unknown as T;
  }

  if (url.startsWith('/api/lab/orders/') && method === 'PUT') {
    const id = url.replace('/api/lab/orders/', '');
    const o = db.lab_orders.find((x) => x.id === id);
    if (!o) throw new Error('Lab order not found');
    const now = new Date().toISOString();
    if (body.action === 'collect') {
      o.status = 'Collected';
      o.sample_id = body.sample_id || `SMP-${Math.floor(1000 + Math.random() * 9000)}`;
      o.collected_at = now;
    } else if (body.action === 'enter_result') {
      o.status = 'Completed';
      o.result_notes = body.result_notes || '';
    } else if (body.action === 'verify') {
      o.status = 'Verified';
      if (body.result_notes !== undefined) o.result_notes = body.result_notes;
      o.verified_at = now;
      o.verified_by = body.verified_by || 'f7302f35-beba-460b-b630-dbc37ce134a3';
      const pat = db.patients.find((p) => p.id === o.patient_id);
      const test = db.lab_tests.find((t) => t.id === o.test_id);
      addNotification(
        db,
        'Lab Result Verified',
        `${test?.name || 'Test'} ready for ${pat ? `${pat.first_name} ${pat.last_name}` : 'patient'}.`,
        'laboratory',
        'Laboratory'
      );
    } else if (body.status) {
      o.status = body.status;
      if (body.result_notes !== undefined) o.result_notes = body.result_notes;
      if (body.sample_id !== undefined) o.sample_id = body.sample_id;
    }
    saveLocalDb(db);
    return o as unknown as T;
  }

  // Radiology
  if (url === '/api/radiology/scans' && method === 'POST') {
    const scan = { id: uid('rad'), name: body.name, price: Number(body.price || 0) };
    db.radiology_scans.push(scan);
    saveLocalDb(db);
    return scan as unknown as T;
  }

  if (url.startsWith('/api/radiology/scans/') && method === 'PUT') {
    const id = url.replace('/api/radiology/scans/', '');
    const s = db.radiology_scans.find((x) => x.id === id);
    if (!s) throw new Error('Scan not found');
    Object.assign(s, body, { price: Number(body.price ?? s.price) });
    saveLocalDb(db);
    return s as unknown as T;
  }

  if (url === '/api/radiology/orders' && method === 'POST') {
    const scan = db.radiology_scans.find((s) => s.id === body.scan_id);
    const order = {
      id: uid('rado'),
      consultation_id: body.consultation_id || null,
      patient_id: body.patient_id,
      scan_id: body.scan_id,
      status: 'Scheduled' as const,
      report_notes: null,
      image_urls: [],
      ordered_at: new Date().toISOString(),
      performed_at: null,
      approved_at: null,
      approved_by: null,
    };
    db.radiology_orders.unshift(order);
    if (scan) {
      const inv = ensureOpenInvoice(db, body.patient_id, body.consultation_id || null);
      db.invoice_items.push({
        id: uid('item'),
        invoice_id: inv.id,
        description: `Radiology: ${scan.name}`,
        quantity: 1,
        unit_price: scan.price,
        total_price: scan.price,
        reference_type: 'radiology',
        reference_id: order.id,
        created_at: new Date().toISOString(),
      });
      recalcInvoice(db, inv.id);
    }
    saveLocalDb(db);
    return order as unknown as T;
  }

  if (url.startsWith('/api/radiology/orders/') && method === 'PUT') {
    const id = url.replace('/api/radiology/orders/', '');
    const o = db.radiology_orders.find((x) => x.id === id);
    if (!o) throw new Error('Radiology order not found');
    const now = new Date().toISOString();
    if (body.action === 'perform') {
      o.status = 'Performed';
      o.performed_at = now;
      if (body.report_notes !== undefined) o.report_notes = body.report_notes;
    } else if (body.action === 'approve') {
      o.status = 'Approved';
      o.approved_at = now;
      o.approved_by = 'f7302f35-beba-460b-b630-dbc37ce134a3';
      if (body.report_notes !== undefined) o.report_notes = body.report_notes;
    }
    saveLocalDb(db);
    return o as unknown as T;
  }

  // Pharmacy & Inventory
  if (url === '/api/inventory/items' && method === 'POST') {
    const item = {
      id: uid('invt'),
      name: body.name,
      code: body.code || String(Math.floor(100 + Math.random() * 900)),
      category: body.category || 'Medicine',
      unit: body.unit || 'Pack',
      purchase_price: body.purchase_price !== undefined ? Number(body.purchase_price) : 0,
      selling_price: Number(body.selling_price || 0),
      current_stock: Number(body.current_stock || 0),
      reorder_level: Number(body.reorder_level || 10),
      expiry_date: body.expiry_date || null,
      created_at: new Date().toISOString(),
      therapeutic_class: body.therapeutic_class || null,
      active_ingredient: body.active_ingredient || null,
    };
    db.inventory_items.unshift(item);
    saveLocalDb(db);
    return item as unknown as T;
  }

  if (url.startsWith('/api/inventory/items/') && method === 'PUT') {
    const id = url.replace('/api/inventory/items/', '');
    const item = db.inventory_items.find((x) => x.id === id);
    if (!item) throw new Error('Item not found');
    Object.assign(item, body, {
      purchase_price: body.purchase_price !== undefined ? Number(body.purchase_price) : item.purchase_price,
      selling_price: body.selling_price !== undefined ? Number(body.selling_price) : item.selling_price,
      reorder_level: body.reorder_level !== undefined ? Number(body.reorder_level) : item.reorder_level,
    });
    saveLocalDb(db);
    return item as unknown as T;
  }

  if (url.startsWith('/api/inventory/items/') && method === 'DELETE') {
    const id = url.replace('/api/inventory/items/', '');
    db.inventory_items = db.inventory_items.filter((x) => x.id !== id);
    saveLocalDb(db);
    return { ok: true } as unknown as T;
  }

  if (/^\/api\/inventory\/items\/[^/]+\/adjust$/.test(url) && method === 'POST') {
    const id = url.split('/')[4];
    const item = db.inventory_items.find((x) => x.id === id);
    if (!item) throw new Error('Item not found');
    const delta = Number(body.quantity || 0);
    const previous_stock = item.current_stock;
    const new_stock = Math.max(0, previous_stock + delta);
    item.current_stock = new_stock;
    const adj = {
      id: uid('adj'),
      inventory_item_id: item.id,
      quantity: delta,
      previous_stock,
      new_stock,
      reason: body.reason || 'Manual adjustment',
      created_at: new Date().toISOString(),
    };
    db.stock_adjustments.unshift(adj);
    saveLocalDb(db);
    return { item, adjustment: adj } as unknown as T;
  }

  if (url === '/api/pharmacy/dispense' && method === 'POST') {
    const rx = db.prescriptions.find((p) => p.id === body.prescription_id);
    const item = db.inventory_items.find((i) => i.id === body.inventory_item_id);
    if (!rx || !item) throw new Error('Prescription or inventory item not found');
    const qty = Number(body.quantity_dispensed || rx.quantity || 1);
    if (item.current_stock < qty) {
      throw new Error(`Insufficient stock for ${item.name} (${item.current_stock} available)`);
    }
    item.current_stock -= qty;
    rx.is_dispensed = true;
    const disp = {
      id: uid('disp'),
      prescription_id: rx.id,
      inventory_item_id: item.id,
      quantity_dispensed: qty,
      dispensed_at: new Date().toISOString(),
      dispensed_by: null,
      cost_price: item.purchase_price || 0,
    };
    db.dispensations.unshift(disp);
    const cons = db.consultations.find((c) => c.id === rx.consultation_id);
    if (cons) {
      const inv = ensureOpenInvoice(db, cons.patient_id, cons.id);
      db.invoice_items.push({
        id: uid('item'),
        invoice_id: inv.id,
        description: `Pharmacy: ${item.name} x${qty}`,
        quantity: qty,
        unit_price: item.selling_price,
        total_price: qty * item.selling_price,
        reference_type: 'pharmacy',
        reference_id: disp.id,
        created_at: new Date().toISOString(),
      });
      recalcInvoice(db, inv.id);
    }
    if (item.current_stock <= item.reorder_level) {
      addNotification(
        db,
        'Low Stock Warning',
        `${item.name} stock dropped to ${item.current_stock} (reorder level ${item.reorder_level}).`,
        'pharmacy',
        'Pharmacy'
      );
    }
    saveLocalDb(db);
    return disp as unknown as T;
  }

  if (url === '/api/pharmacy/sales' && method === 'POST') {
    const item = db.inventory_items.find((i) => i.id === body.inventory_item_id);
    if (!item) throw new Error('Inventory item not found');
    const qty = Number(body.quantity || 1);
    if (item.current_stock < qty) {
      throw new Error(`Insufficient stock (${item.current_stock} available)`);
    }
    item.current_stock -= qty;
    const sale = {
      id: uid('sale'),
      patient_id: body.patient_id || null,
      inventory_item_id: item.id,
      quantity: qty,
      unit_price: item.selling_price,
      total: qty * item.selling_price,
      payment_method: body.payment_method || 'Cash',
      invoice_id: null,
      sold_at: new Date().toISOString(),
      cost_price: item.purchase_price || 0,
    };
    db.pharmacy_sales.unshift(sale);
    saveLocalDb(db);
    return sale as unknown as T;
  }

  // Inpatient
  if (url === '/api/wards' && method === 'POST') {
    const ward = {
      id: uid('ward'),
      name: body.name,
      floor: body.floor ? Number(body.floor) : 1,
      description: body.description || null,
    };
    db.wards.push(ward);
    saveLocalDb(db);
    return ward as unknown as T;
  }

  if (url.startsWith('/api/wards/') && method === 'DELETE') {
    const id = url.replace('/api/wards/', '');
    db.wards = db.wards.filter((w) => w.id !== id);
    saveLocalDb(db);
    return { ok: true } as unknown as T;
  }

  if (url === '/api/beds' && method === 'POST') {
    const bed = {
      id: uid('bed'),
      ward_id: body.ward_id,
      room_number: body.room_number || null,
      bed_number: body.bed_number,
      status: 'Available' as const,
      daily_rent: Number(body.daily_rent || 50000),
    };
    db.beds.push(bed);
    saveLocalDb(db);
    return bed as unknown as T;
  }

  if (url.startsWith('/api/beds/') && method === 'PUT') {
    const id = url.replace('/api/beds/', '');
    const bed = db.beds.find((b) => b.id === id);
    if (!bed) throw new Error('Bed not found');
    Object.assign(bed, body, {
      daily_rent: body.daily_rent !== undefined ? Number(body.daily_rent) : bed.daily_rent,
    });
    saveLocalDb(db);
    return bed as unknown as T;
  }

  if (url.startsWith('/api/beds/') && method === 'DELETE') {
    const id = url.replace('/api/beds/', '');
    db.beds = db.beds.filter((b) => b.id !== id);
    saveLocalDb(db);
    return { ok: true } as unknown as T;
  }

  if (url === '/api/admissions' && method === 'POST') {
    const bed = db.beds.find((b) => b.id === body.bed_id);
    if (!bed || bed.status !== 'Available') throw new Error('Selected bed is not available.');
    bed.status = 'Occupied';
    const adm = {
      id: uid('adm'),
      consultation_id: body.consultation_id,
      bed_id: body.bed_id,
      admission_date: body.admission_date || new Date().toISOString().slice(0, 10),
      expected_discharge_date: body.expected_discharge_date || null,
      actual_discharge_date: null,
      discharge_summary: null,
      status: 'Admitted' as const,
    };
    db.admissions.unshift(adm);
    const cons = db.consultations.find((c) => c.id === body.consultation_id);
    if (cons) {
      cons.consultation_type = 'IPD';
      cons.status = 'InProgress';
    }
    saveLocalDb(db);
    return adm as unknown as T;
  }

  if (url === '/api/admissions/transfer' && method === 'POST') {
    const adm = db.admissions.find((a) => a.id === body.admission_id);
    const nextBed = db.beds.find((b) => b.id === body.new_bed_id);
    if (!adm || !nextBed || nextBed.status !== 'Available') {
      throw new Error('Target bed is unavailable.');
    }
    if (adm.bed_id) {
      const oldBed = db.beds.find((b) => b.id === adm.bed_id);
      if (oldBed) oldBed.status = 'Available';
    }
    nextBed.status = 'Occupied';
    adm.bed_id = nextBed.id;
    saveLocalDb(db);
    return adm as unknown as T;
  }

  if (url === '/api/admissions/discharge' && method === 'POST') {
    const adm = db.admissions.find((a) => a.id === body.admission_id);
    if (!adm) throw new Error('Admission not found');
    const endDateStr = body.actual_discharge_date || new Date().toISOString().slice(0, 10);
    adm.status = 'Discharged';
    adm.actual_discharge_date = endDateStr;
    adm.discharge_summary = body.discharge_summary || 'Patient stabilized and discharged.';
    let days = 1;
    try {
      const diff = Math.ceil(
        (new Date(endDateStr).getTime() - new Date(adm.admission_date).getTime()) / 86400000
      );
      days = Math.max(1, diff);
    } catch {
      days = 1;
    }
    const bed = db.beds.find((b) => b.id === adm.bed_id);
    if (bed) {
      bed.status = 'Available';
      const cons = db.consultations.find((c) => c.id === adm.consultation_id);
      if (cons) {
        const inv = ensureOpenInvoice(db, cons.patient_id, cons.id);
        db.invoice_items.push({
          id: uid('item'),
          invoice_id: inv.id,
          description: `Inpatient Bed (${bed.bed_number}) x${days} day(s)`,
          quantity: days,
          unit_price: bed.daily_rent,
          total_price: days * bed.daily_rent,
          reference_type: 'bed',
          reference_id: adm.id,
          created_at: new Date().toISOString(),
        });
        recalcInvoice(db, inv.id);
        cons.status = 'Completed';
      }
    }
    saveLocalDb(db);
    return adm as unknown as T;
  }

  // Billing
  if (url === '/api/invoices' && method === 'POST') {
    const inv = ensureOpenInvoice(db, body.patient_id, body.consultation_id || null);
    if (Array.isArray(body.items)) {
      for (const it of body.items) {
        const qty = Number(it.quantity || 1);
        const price = Number(it.unit_price || 0);
        db.invoice_items.push({
          id: uid('item'),
          invoice_id: inv.id,
          description: it.description,
          quantity: qty,
          unit_price: price,
          total_price: qty * price,
          reference_type: it.reference_type || 'manual',
          reference_id: null,
          created_at: new Date().toISOString(),
        });
      }
    }
    recalcInvoice(db, inv.id);
    saveLocalDb(db);
    return inv as unknown as T;
  }

  if (/^\/api\/invoices\/[^/]+\/items$/.test(url) && method === 'POST') {
    const id = url.split('/')[3];
    const inv = db.invoices.find((i) => i.id === id);
    if (!inv) throw new Error('Invoice not found');
    const qty = Number(body.quantity || 1);
    const unit_price = Number(body.unit_price || 0);
    const item: InvoiceItem = {
      id: uid('item'),
      invoice_id: inv.id,
      description: body.description,
      quantity: qty,
      unit_price,
      total_price: qty * unit_price,
      reference_type: body.reference_type || 'manual',
      reference_id: null,
      created_at: new Date().toISOString(),
    };
    db.invoice_items.push(item);
    recalcInvoice(db, inv.id);
    saveLocalDb(db);
    return item as unknown as T;
  }

  if (/^\/api\/invoices\/[^/]+\/pay$/.test(url) && method === 'POST') {
    const id = url.split('/')[3];
    const inv = db.invoices.find((i) => i.id === id);
    if (!inv) throw new Error('Invoice not found');
    const amount = Number(body.amount || 0);
    if (amount <= 0) throw new Error('Payment amount must be greater than zero');
    const payment = {
      id: uid('pay'),
      invoice_id: inv.id,
      amount,
      payment_method: body.payment_method || 'Cash',
      reference: body.reference || `RCP-${Math.floor(10000 + Math.random() * 89999)}`,
      paid_at: new Date().toISOString(),
      received_by: 'f7302f35-beba-460b-b630-dbc37ce134a3',
      notes: body.notes || '',
      created_at: new Date().toISOString(),
    };
    db.payments.unshift(payment);
    inv.amount_paid = Number(inv.amount_paid) + amount;
    inv.payment_method = payment.payment_method;
    recalcInvoice(db, inv.id);
    addAudit(db, 'Payment', payment.id, 'RECORD', { invoice: inv.invoice_number, amount });
    saveLocalDb(db);
    return { payment, invoice: inv } as unknown as T;
  }

  if (/^\/api\/invoices\/[^/]+\/void$/.test(url) && method === 'POST') {
    const id = url.split('/')[3];
    const inv = db.invoices.find((i) => i.id === id);
    if (!inv) throw new Error('Invoice not found');
    inv.status = 'Void';
    saveLocalDb(db);
    return inv as unknown as T;
  }

  if (url === '/api/expenses' && method === 'POST') {
    const exp = {
      id: uid('exp'),
      description: body.description,
      category: body.category || 'Operations',
      amount: Number(body.amount || 0),
      expense_date: body.expense_date || new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
    };
    db.expenses.unshift(exp);
    saveLocalDb(db);
    return exp as unknown as T;
  }

  if (url.startsWith('/api/expenses/') && method === 'DELETE') {
    const id = url.replace('/api/expenses/', '');
    db.expenses = db.expenses.filter((e) => e.id !== id);
    saveLocalDb(db);
    return { ok: true } as unknown as T;
  }

  if (url === '/api/insurance/providers' && method === 'POST') {
    const prov = {
      id: uid('ins'),
      name: body.name,
      contact_person: body.contact_person || '',
      phone: body.phone || '',
      email: body.email || '',
      coverage_percent: Number(body.coverage_percent || 80),
      is_active: true,
    };
    db.insurance_providers.push(prov);
    saveLocalDb(db);
    return prov as unknown as T;
  }

  if (url === '/api/insurance/claims' && method === 'POST') {
    const claim = {
      id: uid('clm'),
      invoice_id: body.invoice_id,
      provider_id: body.provider_id,
      patient_id: body.patient_id,
      policy_number: body.policy_number || '',
      claim_amount: Number(body.claim_amount || 0),
      approved_amount: 0,
      status: 'Submitted' as const,
      submitted_at: new Date().toISOString(),
      notes: body.notes || '',
    };
    db.insurance_claims.unshift(claim);
    saveLocalDb(db);
    return claim as unknown as T;
  }

  if (url.startsWith('/api/insurance/claims/') && method === 'PUT') {
    const id = url.replace('/api/insurance/claims/', '');
    const cl = db.insurance_claims.find((c) => c.id === id);
    if (cl) Object.assign(cl, body);
    saveLocalDb(db);
    return cl as unknown as T;
  }

  if (url === '/api/prices/update' && method === 'POST') {
    const numPrice = Number(body.price || 0);
    if (body.type === 'doctor') {
      const d = db.doctors.find((x) => x.id === body.id);
      if (d) d.consultation_fee = numPrice;
    } else if (body.type === 'lab') {
      const l = db.lab_tests.find((x) => x.id === body.id);
      if (l) l.price = numPrice;
    } else if (body.type === 'radiology') {
      const r = db.radiology_scans.find((x) => x.id === body.id);
      if (r) r.price = numPrice;
    } else if (body.type === 'pharmacy') {
      const i = db.inventory_items.find((x) => x.id === body.id);
      if (i) i.selling_price = numPrice;
    } else if (body.type === 'bed') {
      const b = db.beds.find((x) => x.id === body.id);
      if (b) b.daily_rent = numPrice;
    }
    saveLocalDb(db);
    return { ok: true } as unknown as T;
  }

  // Maternity
  if (url === '/api/maternity/antenatal' && method === 'POST') {
    const rec = {
      id: uid('anc'),
      ...body,
      gestational_weeks: Number(body.gestational_weeks || 12),
      fundal_height_cm: body.fundal_height_cm ? Number(body.fundal_height_cm) : null,
      fetal_heart_rate: body.fetal_heart_rate ? Number(body.fetal_heart_rate) : null,
      weight_kg: body.weight_kg ? Number(body.weight_kg) : null,
    };
    db.antenatal_visits.unshift(rec);
    saveLocalDb(db);
    return rec as unknown as T;
  }

  if (url === '/api/maternity/deliveries' && method === 'POST') {
    const rec = { id: uid('del'), ...body };
    db.deliveries.unshift(rec);
    saveLocalDb(db);
    return rec as unknown as T;
  }

  if (url === '/api/maternity/babies' && method === 'POST') {
    const baby = {
      id: uid('baby'),
      ...body,
      birth_weight_kg: Number(body.birth_weight_kg || 3.0),
    };
    db.babies.unshift(baby);
    const dob = new Date(baby.date_of_birth || new Date().toISOString().slice(0, 10));
    for (const vt of db.immunisation_types) {
      const due = new Date(dob.getTime() + vt.recommended_age_weeks * 7 * 86400000);
      db.immunisations.push({
        id: uid('imm'),
        baby_id: baby.id,
        vaccine_type_id: vt.id,
        administered_date: null,
        due_date: due.toISOString().slice(0, 10),
        status: 'Scheduled',
        batch_number: '',
        administered_by: '',
      });
    }
    saveLocalDb(db);
    return baby as unknown as T;
  }

  if (url.startsWith('/api/maternity/immunisations/') && method === 'PUT') {
    const id = url.replace('/api/maternity/immunisations/', '');
    const imm = db.immunisations.find((x) => x.id === id);
    if (imm) Object.assign(imm, body);
    saveLocalDb(db);
    return imm as unknown as T;
  }

  if (url === '/api/maternity/postnatal' && method === 'POST') {
    const rec = { id: uid('pnc'), ...body };
    db.postnatal_visits.unshift(rec);
    saveLocalDb(db);
    return rec as unknown as T;
  }

  // HR
  if (url === '/api/hr/employees' && method === 'POST') {
    const emp = {
      id: uid('emp'),
      user_id: null,
      employee_code: `EMP-${Math.floor(200 + Math.random() * 800)}`,
      full_name: body.full_name,
      department: body.department || 'General',
      position: body.position || 'Staff',
      base_salary: Number(body.base_salary || 0),
      hire_date: new Date().toISOString().slice(0, 10),
      phone: body.phone || '',
      status: 'Active' as const,
    };
    db.employees.unshift(emp);
    saveLocalDb(db);
    return emp as unknown as T;
  }

  if (url === '/api/hr/attendance/clock' && method === 'POST') {
    const today = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 5);
    const existing = db.attendance.find(
      (a) => a.employee_id === body.employee_id && a.date === today
    );
    if (body.action === 'in') {
      if (existing) return existing as unknown as T;
      const rec = {
        id: uid('att'),
        employee_id: body.employee_id,
        date: today,
        clock_in: timeStr,
        clock_out: null,
        status: 'Present' as const,
        note: body.note || '',
      };
      db.attendance.unshift(rec);
      saveLocalDb(db);
      return rec as unknown as T;
    } else if (existing) {
      existing.clock_out = timeStr;
      saveLocalDb(db);
      return existing as unknown as T;
    }
    return { ok: true } as unknown as T;
  }

  if (url === '/api/hr/leave' && method === 'POST') {
    const lv = { id: uid('lv'), ...body, status: 'Pending' as const };
    db.leave_requests.unshift(lv);
    saveLocalDb(db);
    return lv as unknown as T;
  }

  if (url.startsWith('/api/hr/leave/') && method === 'PUT') {
    const id = url.replace('/api/hr/leave/', '');
    const lv = db.leave_requests.find((x) => x.id === id);
    if (lv) lv.status = body.status;
    saveLocalDb(db);
    return lv as unknown as T;
  }

  if (url === '/api/hr/payroll/generate' && method === 'POST') {
    const period = body.pay_period || new Date().toISOString().slice(0, 7);
    let generated = 0;
    for (const emp of db.employees) {
      if (emp.status !== 'Active') continue;
      if (db.payroll.some((p) => p.employee_id === emp.id && p.pay_period === period)) continue;
      const allowances = Math.round(emp.base_salary * 0.1);
      const deductions = Math.round(emp.base_salary * 0.15);
      db.payroll.unshift({
        id: uid('payr'),
        employee_id: emp.id,
        pay_period: period,
        base_salary: emp.base_salary,
        allowances,
        deductions,
        net_pay: emp.base_salary + allowances - deductions,
        status: 'Processed',
        paid_at: null,
      });
      generated++;
    }
    saveLocalDb(db);
    return { generated } as unknown as T;
  }

  if (url.startsWith('/api/hr/payroll/') && method === 'PUT') {
    const id = url.replace('/api/hr/payroll/', '');
    const rec = db.payroll.find((p) => p.id === id);
    if (rec) {
      Object.assign(rec, body);
      if (rec.status === 'Paid' && !rec.paid_at) rec.paid_at = new Date().toISOString();
    }
    saveLocalDb(db);
    return rec as unknown as T;
  }

  if (url === '/api/hr/performance' && method === 'POST') {
    const rev = { id: uid('rev'), ...body, rating: Number(body.rating || 4) };
    db.performance_reviews.unshift(rev);
    saveLocalDb(db);
    return rev as unknown as T;
  }

  // Donations
  if (url === '/api/donations' && method === 'POST') {
    const don = {
      id: uid('don'),
      donor_name: body.donor_name,
      donor_contact: body.donor_contact || '',
      donation_type: body.donation_type || 'Medical Supplies',
      description: body.description || '',
      quantity: Number(body.quantity || 1),
      estimated_value: Number(body.estimated_value || 0),
      received_date: body.received_date || new Date().toISOString().slice(0, 10),
      status: 'Received' as const,
      allocated_to: null,
      created_at: new Date().toISOString(),
    };
    db.donations.unshift(don);
    saveLocalDb(db);
    return don as unknown as T;
  }

  if (url.startsWith('/api/donations/') && method === 'PUT') {
    const id = url.replace('/api/donations/', '');
    const don = db.donations.find((d) => d.id === id);
    if (don) Object.assign(don, body);
    saveLocalDb(db);
    return don as unknown as T;
  }

  // Users & Roles
  if (url === '/api/users' && method === 'POST') {
    if (db.users.some((u) => u.username.toLowerCase() === String(body.username).toLowerCase())) {
      throw new Error('Username already exists');
    }
    const userId = uid('usr');
    const newUser = {
      id: userId,
      username: body.username,
      password: body.password || 'password123',
      full_name: body.full_name,
      role: (body.role || 'Receptionist') as UserRole,
      is_active: true,
      last_login: null,
      created_at: new Date().toISOString(),
      email: body.email || '',
      phone: body.phone || '',
    };
    db.users.push(newUser);
    if (newUser.role === 'Doctor') {
      db.doctors.push({
        id: userId,
        user_id: userId,
        specialization: body.specialization || 'General Practice',
        license_number: `UMDPC-${Math.floor(1000 + Math.random() * 8999)}`,
        consultation_fee: Number(body.consultation_fee || 15000),
        created_at: new Date().toISOString(),
      });
    }
    saveLocalDb(db);
    const { password: _p, ...safe } = newUser;
    return safe as unknown as T;
  }

  if (/^\/api\/users\/[^/]+\/toggle$/.test(url) && method === 'PUT') {
    const id = url.split('/')[3];
    const u = db.users.find((x) => x.id === id);
    if (!u) throw new Error('User not found');
    u.is_active = !u.is_active;
    saveLocalDb(db);
    return { id: u.id, is_active: u.is_active } as unknown as T;
  }

  if (url === '/api/admin/roles' && method === 'PUT') {
    const existing = db.role_permissions.find((r) => r.role === body.role);
    if (existing) {
      existing.modules = body.modules;
    } else {
      db.role_permissions.push({ role: body.role, modules: body.modules });
    }
    saveLocalDb(db);
    return { ok: true } as unknown as T;
  }

  throw new Error(`Unsupported static action: ${method} ${url}`);
}
