export type UserRole =
  | 'Admin'
  | 'Doctor'
  | 'Nurse'
  | 'Receptionist'
  | 'LabTechnician'
  | 'Pharmacist'
  | 'Cashier';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  email?: string;
  phone?: string;
}

export interface Doctor {
  id: string;
  user_id: string;
  specialization: string | null;
  license_number: string | null;
  consultation_fee: number;
  created_at: string;
  full_name?: string;
  username?: string;
}

export interface DoctorAvailability {
  id: string;
  doctor_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  slot_minutes: number;
}

export interface Patient {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'Female' | 'Male' | 'Other' | string;
  phone: string;
  email: string;
  address: string;
  emergency_contact: string;
  created_at: string;
}

export interface TriageVitals {
  id: string;
  patient_id: string;
  recorded_at: string;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  temperature: number | null;
  pulse: number | null;
  respiratory_rate: number | null;
  weight: number | null;
  height: number | null;
  spo2: number | null;
  bmi: number | null;
  notes: string;
  recorded_by: string | null;
}

export type ConsultationType = 'OPD' | 'IPD';
export type ConsultationStatus = 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled';

export interface Consultation {
  id: string;
  code: string;
  patient_id: string;
  doctor_id: string;
  consultation_type: ConsultationType;
  scheduled_start: string;
  scheduled_end: string;
  chief_complaint: string | null;
  history_of_presenting_illness: string | null;
  past_medical_history: string | null;
  examination_findings: string | null;
  diagnosis_codes: string[];
  diagnosis_text: string | null;
  status: ConsultationStatus;
  created_at: string;
  updated_at: string;
}

export interface Prescription {
  id: string;
  consultation_id: string;
  drug_name: string;
  dosage: string;
  route: string;
  frequency: string;
  duration_days: number | null;
  quantity: number | null;
  instructions: string;
  is_dispensed: boolean;
  created_at: string;
}

export interface Ward {
  id: string;
  name: string;
  floor: number | null;
  description: string | null;
}

export type BedStatus = 'Available' | 'Occupied' | 'Maintenance' | 'Reserved';

export interface Bed {
  id: string;
  ward_id: string;
  room_number: string | null;
  bed_number: string;
  status: BedStatus;
  daily_rent: number;
}

export type AdmissionStatus = 'Admitted' | 'Transferred' | 'Discharged';

export interface Admission {
  id: string;
  consultation_id: string;
  bed_id: string | null;
  admission_date: string;
  expected_discharge_date: string | null;
  actual_discharge_date: string | null;
  discharge_summary: string | null;
  status: AdmissionStatus;
}

export interface LabTest {
  id: string;
  name: string;
  normal_range: string | null;
  price: number;
}

export type LabOrderStatus = 'Pending' | 'Collected' | 'Processing' | 'Completed' | 'Verified';

export interface LabOrder {
  id: string;
  consultation_id: string | null;
  patient_id: string;
  test_id: string;
  status: LabOrderStatus;
  result_notes: string | null;
  ordered_at: string;
  collected_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  sample_id: string | null;
}

export interface RadiologyScan {
  id: string;
  name: string;
  price: number;
}

export type RadiologyOrderStatus = 'Scheduled' | 'Performed' | 'ReportDraft' | 'Approved';

export interface RadiologyOrder {
  id: string;
  consultation_id: string | null;
  patient_id: string;
  scan_id: string;
  status: RadiologyOrderStatus;
  report_notes: string | null;
  image_urls: string[];
  ordered_at: string;
  performed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  purchase_price: number | null;
  selling_price: number;
  current_stock: number;
  reorder_level: number;
  expiry_date: string | null;
  created_at: string;
  therapeutic_class: string | null;
  active_ingredient: string | null;
}

export interface StockAdjustment {
  id: string;
  inventory_item_id: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  created_at: string;
}

export interface Dispensation {
  id: string;
  prescription_id: string;
  inventory_item_id: string;
  quantity_dispensed: number;
  dispensed_at: string;
  dispensed_by: string | null;
  cost_price: number;
}

export interface PharmacySale {
  id: string;
  patient_id: string | null;
  inventory_item_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  payment_method: string | null;
  invoice_id: string | null;
  sold_at: string;
  cost_price: number;
}

export type InvoiceStatus = 'Unpaid' | 'PartiallyPaid' | 'Paid' | 'Overdue' | 'Void';

export interface Invoice {
  id: string;
  patient_id: string;
  consultation_id: string | null;
  invoice_number: string;
  issued_at: string;
  due_date: string;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  amount_paid: number;
  status: InvoiceStatus;
  payment_method: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  reference: string;
  paid_at: string;
  received_by: string;
  notes: string;
  created_at: string;
}

export interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  expense_date: string;
  created_at: string;
}

export interface InsuranceProvider {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  coverage_percent: number;
  is_active: boolean;
}

export interface InsuranceClaim {
  id: string;
  invoice_id: string;
  provider_id: string;
  patient_id: string;
  policy_number: string;
  claim_amount: number;
  approved_amount: number;
  status: 'Submitted' | 'UnderReview' | 'Approved' | 'Rejected' | 'Settled';
  submitted_at: string;
  notes: string;
}

export interface Donation {
  id: string;
  donor_name: string;
  donor_contact: string;
  donation_type: string;
  description: string;
  quantity: number;
  estimated_value: number;
  received_date: string;
  status: 'Received' | 'Allocated' | 'Used';
  allocated_to: string | null;
  created_at: string;
}

export interface AntenatalVisit {
  id: string;
  patient_id: string;
  visit_date: string;
  gestational_weeks: number;
  fundal_height_cm: number | null;
  fetal_heart_rate: number | null;
  blood_pressure: string;
  weight_kg: number | null;
  risk_level: 'Low' | 'Moderate' | 'High';
  next_visit_date: string;
  notes: string;
  attended_by: string;
}

export interface DeliveryRecord {
  id: string;
  mother_patient_id: string;
  delivery_date: string;
  delivery_mode: 'Normal Vaginal' | 'C-Section' | 'Assisted';
  outcome: 'Live Birth' | 'Stillbirth' | 'Multiple Birth';
  complications: string;
  attended_by: string;
  notes: string;
}

export interface BabyRecord {
  id: string;
  delivery_id: string;
  mother_patient_id: string;
  name: string;
  gender: 'Female' | 'Male';
  date_of_birth: string;
  birth_weight_kg: number;
  apgar_score: string;
  status: 'Healthy' | 'NICU' | 'Discharged';
}

export interface ImmunisationType {
  id: string;
  name: string;
  recommended_age_weeks: number;
  dose_description: string;
}

export interface ImmunisationRecord {
  id: string;
  baby_id: string;
  vaccine_type_id: string;
  administered_date: string | null;
  due_date: string;
  status: 'Scheduled' | 'Administered' | 'Missed';
  batch_number: string;
  administered_by: string;
}

export interface PostnatalVisit {
  id: string;
  mother_patient_id: string;
  baby_id: string | null;
  visit_date: string;
  mother_condition: string;
  baby_condition: string;
  breastfeeding_status: string;
  notes: string;
}

export interface Employee {
  id: string;
  user_id: string | null;
  employee_code: string;
  full_name: string;
  department: string;
  position: string;
  base_salary: number;
  hire_date: string;
  phone: string;
  status: 'Active' | 'OnLeave' | 'Terminated';
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  status: 'Present' | 'Late' | 'HalfDay' | 'Absent';
  note: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: 'Annual' | 'Sick' | 'Maternity' | 'Emergency' | 'Unpaid';
  start_date: string;
  end_date: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  pay_period: string;
  base_salary: number;
  allowances: number;
  deductions: number;
  net_pay: number;
  status: 'Draft' | 'Processed' | 'Paid';
  paid_at: string | null;
}

export interface PerformanceReview {
  id: string;
  employee_id: string;
  review_date: string;
  reviewer_name: string;
  rating: number;
  strengths: string;
  improvements: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  link: string;
  category: string;
  is_read: boolean;
  created_at: string;
}

export interface RolePermission {
  role: UserRole;
  modules: string[];
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: Record<string, unknown>;
  performed_by: string;
  created_at: string;
}

export interface HmisDatabase {
  users: (User & { password: string })[];
  doctors: Doctor[];
  doctor_availability: DoctorAvailability[];
  patients: Patient[];
  triage_vitals: TriageVitals[];
  consultations: Consultation[];
  prescriptions: Prescription[];
  wards: Ward[];
  beds: Bed[];
  admissions: Admission[];
  lab_tests: LabTest[];
  lab_orders: LabOrder[];
  radiology_scans: RadiologyScan[];
  radiology_orders: RadiologyOrder[];
  inventory_items: InventoryItem[];
  stock_adjustments: StockAdjustment[];
  dispensations: Dispensation[];
  pharmacy_sales: PharmacySale[];
  invoices: Invoice[];
  invoice_items: InvoiceItem[];
  payments: Payment[];
  expenses: Expense[];
  insurance_providers: InsuranceProvider[];
  insurance_claims: InsuranceClaim[];
  donations: Donation[];
  antenatal_visits: AntenatalVisit[];
  deliveries: DeliveryRecord[];
  babies: BabyRecord[];
  immunisation_types: ImmunisationType[];
  immunisations: ImmunisationRecord[];
  postnatal_visits: PostnatalVisit[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  leave_requests: LeaveRequest[];
  payroll: PayrollRecord[];
  performance_reviews: PerformanceReview[];
  notifications: NotificationItem[];
  role_permissions: RolePermission[];
  payment_modes: string[];
  audit_logs: AuditLog[];
}
