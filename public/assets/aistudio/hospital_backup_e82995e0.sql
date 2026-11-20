--
-- PostgreSQL database dump
--

\restrict BnqX2KXZFclTL8fEu7PMkGCplhRE0LsNdytNgAElIA31VxGBuvbviyqNhYTLerg

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _sqlx_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sqlx_migrations (
    version bigint NOT NULL,
    description text NOT NULL,
    installed_on timestamp with time zone DEFAULT now() NOT NULL,
    success boolean NOT NULL,
    checksum bytea NOT NULL,
    execution_time bigint NOT NULL
);


ALTER TABLE public._sqlx_migrations OWNER TO postgres;

--
-- Name: admissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consultation_id uuid NOT NULL,
    bed_id uuid,
    admission_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_discharge_date date,
    actual_discharge_date date,
    discharge_summary text,
    status text DEFAULT 'Admitted'::text,
    CONSTRAINT admissions_status_check CHECK ((status = ANY (ARRAY['Admitted'::text, 'Transferred'::text, 'Discharged'::text])))
);


ALTER TABLE public.admissions OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    changes jsonb,
    performed_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: beds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.beds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ward_id uuid NOT NULL,
    room_number text,
    bed_number text NOT NULL,
    status text DEFAULT 'Available'::text,
    daily_rent numeric(10,2) DEFAULT 0 NOT NULL,
    CONSTRAINT beds_status_check CHECK ((status = ANY (ARRAY['Available'::text, 'Occupied'::text, 'Maintenance'::text, 'Reserved'::text])))
);


ALTER TABLE public.beds OWNER TO postgres;

--
-- Name: wards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    floor integer,
    description text
);


ALTER TABLE public.wards OWNER TO postgres;

--
-- Name: bed_occupancy; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.bed_occupancy AS
 SELECT w.name AS ward_name,
    count(b.id) AS total_beds,
    count(
        CASE
            WHEN (b.status = 'Occupied'::text) THEN 1
            ELSE NULL::integer
        END) AS occupied_beds,
    count(
        CASE
            WHEN (b.status = 'Available'::text) THEN 1
            ELSE NULL::integer
        END) AS available_beds
   FROM (public.wards w
     LEFT JOIN public.beds b ON ((w.id = b.ward_id)))
  GROUP BY w.id, w.name
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.bed_occupancy OWNER TO postgres;

--
-- Name: consultations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consultations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    consultation_type text NOT NULL,
    scheduled_start timestamp with time zone NOT NULL,
    scheduled_end timestamp with time zone NOT NULL,
    chief_complaint text,
    history_of_presenting_illness text,
    past_medical_history text,
    examination_findings text,
    diagnosis_codes text[],
    diagnosis_text text,
    status text DEFAULT 'Scheduled'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    code character varying(30) NOT NULL,
    CONSTRAINT consultations_consultation_type_check CHECK ((consultation_type = ANY (ARRAY['OPD'::text, 'IPD'::text]))),
    CONSTRAINT consultations_status_check CHECK ((status = ANY (ARRAY['Scheduled'::text, 'InProgress'::text, 'Completed'::text, 'Cancelled'::text])))
);


ALTER TABLE public.consultations OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    consultation_id uuid,
    invoice_number text NOT NULL,
    issued_at timestamp with time zone DEFAULT now(),
    due_date date NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) NOT NULL,
    amount_paid numeric(10,2) DEFAULT 0,
    status text DEFAULT 'Unpaid'::text,
    payment_method text,
    insurance_provider text,
    insurance_policy_number text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['Unpaid'::text, 'PartiallyPaid'::text, 'Paid'::text, 'Overdue'::text, 'Void'::text])))
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: daily_revenue; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.daily_revenue AS
 SELECT date(issued_at) AS report_date,
    count(DISTINCT id) AS invoices_count,
    sum(total_amount) AS total_revenue,
    sum(amount_paid) AS collected
   FROM public.invoices
  GROUP BY (date(issued_at))
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.daily_revenue OWNER TO postgres;

--
-- Name: dispensations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispensations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prescription_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity_dispensed integer NOT NULL,
    dispensed_at timestamp with time zone DEFAULT now(),
    dispensed_by uuid,
    cost_price numeric(12,2) DEFAULT 0.00
);


ALTER TABLE public.dispensations OWNER TO postgres;

--
-- Name: doctors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    specialization text,
    license_number text,
    consultation_fee numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.doctors OWNER TO postgres;

--
-- Name: donations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.donations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    donor_name text,
    donor_contact text,
    donation_type text,
    description text,
    quantity integer,
    estimated_value numeric(10,2),
    received_date date DEFAULT CURRENT_DATE,
    status text DEFAULT 'Received'::text,
    allocated_to text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT donations_status_check CHECK ((status = ANY (ARRAY['Received'::text, 'Allocated'::text, 'Used'::text])))
);


ALTER TABLE public.donations OWNER TO postgres;

--
-- Name: expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    description text NOT NULL,
    category character varying(100) NOT NULL,
    amount numeric(12,2) NOT NULL,
    expense_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.expenses OWNER TO postgres;

--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    category text NOT NULL,
    unit text NOT NULL,
    purchase_price numeric(10,2),
    selling_price numeric(10,2) NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    reorder_level integer DEFAULT 10 NOT NULL,
    expiry_date date,
    created_at timestamp with time zone DEFAULT now(),
    therapeutic_class text,
    active_ingredient text
);


ALTER TABLE public.inventory_items OWNER TO postgres;

--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    description text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    reference_type text,
    reference_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.invoice_items OWNER TO postgres;

--
-- Name: lab_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consultation_id uuid,
    patient_id uuid NOT NULL,
    test_id uuid NOT NULL,
    status text DEFAULT 'Pending'::text,
    result_notes text,
    ordered_at timestamp with time zone DEFAULT now(),
    collected_at timestamp with time zone,
    verified_at timestamp with time zone,
    verified_by uuid,
    sample_id character varying(255),
    CONSTRAINT lab_orders_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Collected'::text, 'Processing'::text, 'Completed'::text, 'Verified'::text])))
);


ALTER TABLE public.lab_orders OWNER TO postgres;

--
-- Name: lab_tests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    normal_range text,
    price numeric(10,2) NOT NULL
);


ALTER TABLE public.lab_tests OWNER TO postgres;

--
-- Name: patients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    date_of_birth date NOT NULL,
    gender text,
    phone text,
    email text,
    address text,
    emergency_contact text,
    created_at timestamp with time zone DEFAULT now(),
    code character varying(20) NOT NULL
);


ALTER TABLE public.patients OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    reference character varying(100),
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    received_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: pharmacy_sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pharmacy_sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    inventory_item_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    payment_method text,
    invoice_id uuid,
    sold_at timestamp with time zone DEFAULT now(),
    cost_price numeric(12,2) DEFAULT 0.00
);


ALTER TABLE public.pharmacy_sales OWNER TO postgres;

--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prescriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consultation_id uuid NOT NULL,
    drug_name text NOT NULL,
    dosage text,
    route text,
    frequency text,
    duration_days integer,
    quantity integer,
    instructions text,
    is_dispensed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.prescriptions OWNER TO postgres;

--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity_ordered integer NOT NULL,
    quantity_received integer DEFAULT 0,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL
);


ALTER TABLE public.purchase_order_items OWNER TO postgres;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid,
    order_date date DEFAULT CURRENT_DATE,
    expected_delivery date,
    status text DEFAULT 'Draft'::text,
    total_amount numeric(10,2),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT purchase_orders_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Sent'::text, 'Received'::text, 'Cancelled'::text])))
);


ALTER TABLE public.purchase_orders OWNER TO postgres;

--
-- Name: radiology_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.radiology_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consultation_id uuid,
    patient_id uuid NOT NULL,
    scan_id uuid NOT NULL,
    status text DEFAULT 'Scheduled'::text,
    report_notes text,
    image_urls text[],
    ordered_at timestamp with time zone DEFAULT now(),
    performed_at timestamp with time zone,
    approved_at timestamp with time zone,
    approved_by uuid,
    CONSTRAINT radiology_orders_status_check CHECK ((status = ANY (ARRAY['Scheduled'::text, 'Performed'::text, 'ReportDraft'::text, 'Approved'::text])))
);


ALTER TABLE public.radiology_orders OWNER TO postgres;

--
-- Name: radiology_scans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.radiology_scans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    price numeric(10,2) NOT NULL
);


ALTER TABLE public.radiology_scans OWNER TO postgres;

--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity integer NOT NULL,
    previous_stock integer NOT NULL,
    new_stock integer NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.stock_adjustments OWNER TO postgres;

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    tax_id text
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: triage_vitals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.triage_vitals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now(),
    blood_pressure_systolic smallint,
    blood_pressure_diastolic smallint,
    temperature real,
    pulse smallint,
    respiratory_rate smallint,
    weight real,
    height real,
    spo2 smallint,
    notes text,
    recorded_by uuid,
    bmi real
);


ALTER TABLE public.triage_vitals OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    role text NOT NULL,
    is_active boolean DEFAULT true,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['Admin'::text, 'Doctor'::text, 'Nurse'::text, 'Receptionist'::text, 'LabTechnician'::text, 'Pharmacist'::text, 'Cashier'::text])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: _sqlx_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sqlx_migrations (version, description, installed_on, success, checksum, execution_time) FROM stdin;
20260630103632	initial schema	2026-07-09 03:09:46.836735-07	t	\\x2992491cb6a5a64d1ab06a5bd098180aa7cb697e0e9b91259846b98c070f2abd804952cf5e080f80efd7951b99f39097	569775100
20260709095221	stock adjustments	2026-07-09 03:37:08.257234-07	t	\\xc794bdd447ac2431b4f7490d2f212275e6ac196d9d25d79cb1d292cc2e8f725e6323f53ac77a92b062cd80357c2de353	114563400
20260709122056	inventory enhancements	2026-07-09 05:22:59.057143-07	t	\\x1e5ef3e028ef35de9d8e3627b5d79b5f47e5dec30ab479c80815405158dc5b941331b6c646aea6adf8bb6781e5c6a32d	1194219800
\.


--
-- Data for Name: admissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admissions (id, consultation_id, bed_id, admission_date, expected_discharge_date, actual_discharge_date, discharge_summary, status) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, entity_type, entity_id, action, changes, performed_by, created_at) FROM stdin;
\.


--
-- Data for Name: beds; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.beds (id, ward_id, room_number, bed_number, status, daily_rent) FROM stdin;
47cafd68-bae2-4337-b57e-ff1be76bf6b0	667d7fa1-c069-456e-aec0-e6fce0484b9d	\N	B-101	Occupied	50000.00
\.


--
-- Data for Name: consultations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.consultations (id, patient_id, doctor_id, consultation_type, scheduled_start, scheduled_end, chief_complaint, history_of_presenting_illness, past_medical_history, examination_findings, diagnosis_codes, diagnosis_text, status, created_at, updated_at, code) FROM stdin;
b577e240-4c0c-4125-afb7-87c2f53e68c7	3c481c67-349e-4820-9780-07e0d1aea275	362bc3c2-f5f1-4bd8-9248-05c3ffd73452	OPD	2026-07-09 11:37:00-07	2026-07-09 11:37:00-07	sick	\N	\N	\N	{11o0a}	next week	Completed	2026-07-09 08:37:29.933033-07	2026-07-09 08:38:18.242772-07	CONS-2026-7733
58372437-2e71-4290-9b0e-06233d8f42e2	3c481c67-349e-4820-9780-07e0d1aea275	362bc3c2-f5f1-4bd8-9248-05c3ffd73452	OPD	2026-07-10 05:05:57.920851-07	2026-07-10 06:05:57.920851-07	\N	\N	\N	\N	\N	\N	Completed	2026-07-10 05:05:57.920851-07	2026-07-10 08:45:18.044338-07	CONS-2026-6916
5c953b9e-dfcf-4374-a9f0-9ead48ba75ff	3c481c67-349e-4820-9780-07e0d1aea275	362bc3c2-f5f1-4bd8-9248-05c3ffd73452	OPD	2026-07-14 06:50:00-07	2026-07-14 06:50:00-07	Sick	\N	\N	\N	{}	sick	Completed	2026-07-14 03:51:01.411912-07	2026-07-14 03:52:55.988655-07	CONS-2026-3374
ebbc0411-03cb-4da8-9f30-4179b9f3613d	3c481c67-349e-4820-9780-07e0d1aea275	362bc3c2-f5f1-4bd8-9248-05c3ffd73452	OPD	2026-07-14 07:37:00-07	2026-07-14 07:37:00-07	sicked	\N	\N	\N	{11o0a}	sick	Completed	2026-07-14 04:37:15.394744-07	2026-07-14 06:26:23.279468-07	CONS-2026-3496
93a9db84-fb10-46d5-9930-8c6738e5e715	6b52bd82-6230-4e63-94c9-d08ca654ab42	362bc3c2-f5f1-4bd8-9248-05c3ffd73452	IPD	2026-07-15 18:34:00-07	2026-07-15 18:34:00-07	Malaria	\N	\N	\N	\N	\N	Completed	2026-07-15 15:34:58.002808-07	2026-07-20 02:57:03.280367-07	CONS-2026-6129
\.


--
-- Data for Name: dispensations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dispensations (id, prescription_id, inventory_item_id, quantity_dispensed, dispensed_at, dispensed_by, cost_price) FROM stdin;
74498c0b-03d2-44e4-bddf-5dc51ded95c2	0f3c234f-bd00-4e8c-b324-6ad69faffc39	678ecb2f-4723-46f3-946f-6d627f681c24	23	2026-07-14 15:20:08.800608-07	\N	0.00
\.


--
-- Data for Name: doctors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doctors (id, user_id, specialization, license_number, consultation_fee, created_at) FROM stdin;
362bc3c2-f5f1-4bd8-9248-05c3ffd73452	362bc3c2-f5f1-4bd8-9248-05c3ffd73452	\N	\N	10000.00	2026-07-09 08:37:02.920745-07
\.


--
-- Data for Name: donations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.donations (id, donor_name, donor_contact, donation_type, description, quantity, estimated_value, received_date, status, allocated_to, created_at) FROM stdin;
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expenses (id, description, category, amount, expense_date, created_at) FROM stdin;
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_items (id, name, code, category, unit, purchase_price, selling_price, current_stock, reorder_level, expiry_date, created_at, therapeutic_class, active_ingredient) FROM stdin;
678ecb2f-4723-46f3-946f-6d627f681c24	panadol	222	Medicine	5	2000.00	3000.00	64	7	2026-08-09	2026-07-09 03:37:24.026175-07	\N	\N
\.


--
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_items (id, invoice_id, description, quantity, unit_price, total_price, reference_type, reference_id, created_at) FROM stdin;
f3582b81-2088-411e-b059-c3a2b5a2d324	d5cbe940-31c8-4cf1-a79b-b799fe1a684c	Consultation fee (Dr. 362bc3c2-f5f1-4bd8-9248-05c3ffd73452)	1	0.00	0.00	consultation	b577e240-4c0c-4125-afb7-87c2f53e68c7	2026-07-09 08:38:18.250107-07
a1f38fd1-4eaa-4a04-9e2d-6db2e5ade7bf	3f1b4e00-6cef-44f1-9ec8-7f2bc6a136f3	Consultation fee (Dr. 362bc3c2-f5f1-4bd8-9248-05c3ffd73452)	1	0.00	0.00	consultation	58372437-2e71-4290-9b0e-06233d8f42e2	2026-07-10 08:45:18.052463-07
6a0a4845-d93c-44c5-87a4-8c5ca56bbaee	7bbc220d-e66d-41c0-a11c-a6304a3c2376	Consultation fee (Dr. 362bc3c2-f5f1-4bd8-9248-05c3ffd73452)	1	10000.00	10000.00	consultation	5c953b9e-dfcf-4374-a9f0-9ead48ba75ff	2026-07-14 03:52:56.027374-07
9ad3ffb8-bbae-4935-b9b6-3db3e9b632aa	f395542e-1dc6-4be8-ac04-06c7f0aa624b	Consultation fee (Dr. 362bc3c2-f5f1-4bd8-9248-05c3ffd73452)	1	10000.00	10000.00	consultation	ebbc0411-03cb-4da8-9f30-4179b9f3613d	2026-07-14 06:26:23.835115-07
a43543ba-c1eb-47dd-ab3b-3a86b0353431	298e55fe-8d40-4c0e-969f-8d52b234c8c5	Consultation fee	1	10000.00	10000.00	consultation	58372437-2e71-4290-9b0e-06233d8f42e2	2026-07-20 04:05:23.50074-07
23103aa6-e95b-48dc-8ead-24a4d6f5e4ea	52158b71-f5c0-4792-9c2e-7fd1d81fb502	Pharmacy: panadol x23	23	3000.00	69000.00	pharmacy	74498c0b-03d2-44e4-bddf-5dc51ded95c2	2026-07-20 04:23:41.089213-07
f6b35e63-768a-4268-a697-c8e65d5b8e27	355b0617-5c7c-4dfa-8bfa-612d7226b55a	Pharmacy: panadol x23	23	3000.00	69000.00	pharmacy	74498c0b-03d2-44e4-bddf-5dc51ded95c2	2026-07-20 05:58:05.760726-07
7e277c82-3d70-4a9d-9a06-93b542f29e43	90ac0a38-c55d-4997-b756-1e81399aa426	Consultation fee	1	10000.00	10000.00	consultation	93a9db84-fb10-46d5-9930-8c6738e5e715	2026-07-20 05:58:34.07371-07
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, patient_id, consultation_id, invoice_number, issued_at, due_date, subtotal, discount, tax, total_amount, amount_paid, status, payment_method, insurance_provider, insurance_policy_number, created_at) FROM stdin;
d5cbe940-31c8-4cf1-a79b-b799fe1a684c	3c481c67-349e-4820-9780-07e0d1aea275	b577e240-4c0c-4125-afb7-87c2f53e68c7	INV-20260709-c0650f3a	2026-07-09 08:38:18.292891-07	2026-07-24	0.00	0.00	0.00	0.00	40000.00	Paid	\N	\N	\N	2026-07-09 08:38:18.292896-07
7bbc220d-e66d-41c0-a11c-a6304a3c2376	3c481c67-349e-4820-9780-07e0d1aea275	5c953b9e-dfcf-4374-a9f0-9ead48ba75ff	INV-20260714-281e3df0	2026-07-14 03:52:56.044491-07	2026-07-29	10000.00	0.00	0.00	10000.00	0.00	Void	\N	\N	\N	2026-07-14 03:52:56.044509-07
3f1b4e00-6cef-44f1-9ec8-7f2bc6a136f3	3c481c67-349e-4820-9780-07e0d1aea275	58372437-2e71-4290-9b0e-06233d8f42e2	INV-20260710-be5f1594	2026-07-10 08:45:18.126427-07	2026-07-25	0.00	0.00	0.00	0.00	0.00	Void	\N	\N	\N	2026-07-10 08:45:18.126432-07
63edd845-6e4a-46a3-b486-7f6214c38c31	405db40e-a70d-4c68-a192-47d14197c237	\N	INV-20260720-fef4fda9	2026-07-20 03:54:23.057038-07	2026-08-04	0.00	0.00	0.00	0.00	0.00	Void	\N	\N	\N	2026-07-20 03:54:23.057044-07
298e55fe-8d40-4c0e-969f-8d52b234c8c5	3c481c67-349e-4820-9780-07e0d1aea275	\N	INV-20260720-3fc2bf3e	2026-07-20 04:05:23.50077-07	2026-08-04	10000.00	0.00	0.00	10000.00	10000.00	Paid	\N	\N	\N	2026-07-20 04:05:23.500773-07
90ac0a38-c55d-4997-b756-1e81399aa426	6b52bd82-6230-4e63-94c9-d08ca654ab42	\N	INV-20260720-318df7d5	2026-07-20 05:58:34.07374-07	2026-08-04	10000.00	0.00	0.00	10000.00	0.00	Void	\N	\N	\N	2026-07-20 05:58:34.073745-07
355b0617-5c7c-4dfa-8bfa-612d7226b55a	3c481c67-349e-4820-9780-07e0d1aea275	\N	INV-20260720-943dc87c	2026-07-20 05:58:05.760755-07	2026-08-04	69000.00	0.00	0.00	69000.00	69000.00	Paid	\N	\N	\N	2026-07-20 05:58:05.760758-07
52158b71-f5c0-4792-9c2e-7fd1d81fb502	3c481c67-349e-4820-9780-07e0d1aea275	\N	INV-20260720-154ea9ad	2026-07-20 04:23:41.089354-07	2026-08-04	69000.00	0.00	0.00	69000.00	69000.00	Paid	\N	\N	\N	2026-07-20 04:23:41.089359-07
f395542e-1dc6-4be8-ac04-06c7f0aa624b	3c481c67-349e-4820-9780-07e0d1aea275	ebbc0411-03cb-4da8-9f30-4179b9f3613d	INV-20260714-82b93be5	2026-07-14 06:26:23.875994-07	2026-07-29	10000.00	0.00	0.00	10000.00	10000.00	Paid	\N	\N	\N	2026-07-14 06:26:23.875999-07
\.


--
-- Data for Name: lab_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lab_orders (id, consultation_id, patient_id, test_id, status, result_notes, ordered_at, collected_at, verified_at, verified_by, sample_id) FROM stdin;
e9fdffc7-abed-4827-b708-baa1ad93e7ff	\N	3c481c67-349e-4820-9780-07e0d1aea275	0441b03f-f366-4b28-9e7c-008a22623ebb	Verified	negative	2026-07-09 08:40:31.428308-07	\N	2026-07-09 08:40:51.442836-07	\N	\N
12f3fd30-bdb8-4d1e-9571-24e105e3c188	\N	3c481c67-349e-4820-9780-07e0d1aea275	56dfa2c6-c403-4ca9-b46f-c82881ccf73d	Verified	nedative	2026-07-10 05:01:15.500942-07	\N	2026-07-10 05:01:37.472255-07	\N	\N
878d558d-62ac-4a16-bf32-5d63c841de1d	\N	3c481c67-349e-4820-9780-07e0d1aea275	56dfa2c6-c403-4ca9-b46f-c82881ccf73d	Verified	negative	2026-07-12 16:04:14.02649-07	\N	2026-07-12 16:04:37.322498-07	\N	\N
9e050f19-3476-48b7-bd58-5089b7730232	5c953b9e-dfcf-4374-a9f0-9ead48ba75ff	3c481c67-349e-4820-9780-07e0d1aea275	0441b03f-f366-4b28-9e7c-008a22623ebb	Verified	negative	2026-07-14 06:23:32.439022-07	2026-07-20 05:01:23.982424-07	2026-07-20 05:16:24.700351-07	\N	eeee
741df5c2-827e-4058-b827-f8032cbf50b6	5c953b9e-dfcf-4374-a9f0-9ead48ba75ff	3c481c67-349e-4820-9780-07e0d1aea275	92e64776-485f-4e7d-8d25-5462bc6af3dd	Verified	yeah	2026-07-14 03:51:23.63639-07	2026-07-14 04:43:29.992365-07	2026-07-20 05:16:34.64496-07	\N	testing
74b0ab9a-5572-4a57-aa13-2f1ec96db491	\N	3c481c67-349e-4820-9780-07e0d1aea275	2fba6b56-0b97-4568-9e7b-a40f1c7f47a9	Verified	Negative	2026-07-13 18:46:55.365832-07	2026-07-13 18:52:21.461695-07	2026-07-20 05:16:37.047787-07	\N	SMP-001
4c19e2e0-7db1-4884-9e74-2aa89a0d02d6	ebbc0411-03cb-4da8-9f30-4179b9f3613d	3c481c67-349e-4820-9780-07e0d1aea275	0441b03f-f366-4b28-9e7c-008a22623ebb	Verified	ngative	2026-07-14 04:41:59.275437-07	2026-07-20 05:16:51.085698-07	2026-07-20 05:17:45.417011-07	\N	ttttttt
\.


--
-- Data for Name: lab_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lab_tests (id, name, normal_range, price) FROM stdin;
2fba6b56-0b97-4568-9e7b-a40f1c7f47a9	Malaria Test	\N	20.00
56dfa2c6-c403-4ca9-b46f-c82881ccf73d	Full Blood Count	\N	5000.00
0441b03f-f366-4b28-9e7c-008a22623ebb	HIV		20000.00
92e64776-485f-4e7d-8d25-5462bc6af3dd	Liver Function Test	\N	80000.00
\.


--
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.patients (id, first_name, last_name, date_of_birth, gender, phone, email, address, emergency_contact, created_at, code) FROM stdin;
3c481c67-349e-4820-9780-07e0d1aea275	Immy	Nanyanzi	2007-06-27	Female	0777697398	nalu@loanmgr.com	wakiso		2026-07-09 08:36:20.201698-07	26895845
405db40e-a70d-4c68-a192-47d14197c237	manuelah	angel	1986-07-01	Female	0777697398	nalu@loanmgr.com	wakiso		2026-07-14 07:00:06.851596-07	26210644
6b52bd82-6230-4e63-94c9-d08ca654ab42	mugonzi	john	1999-07-16	Male	0777697398	mujuzi@gmail.com	wakiso		2026-07-15 15:15:57.940106-07	26603812
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, invoice_id, amount, payment_method, reference, paid_at, received_by, notes, created_at) FROM stdin;
eedd03f3-2661-49d7-add1-2aeaecb8ff6e	f395542e-1dc6-4be8-ac04-06c7f0aa624b	3000.00	Cash		2026-07-15 05:09:41.364707-07	f7302f35-beba-460b-b630-dbc37ce134a3		2026-07-15 05:09:41.364708-07
2f661cad-b0a4-4a20-a244-4a8f984e4ea0	f395542e-1dc6-4be8-ac04-06c7f0aa624b	2000.00	Cash		2026-07-20 02:16:54.914507-07	f7302f35-beba-460b-b630-dbc37ce134a3		2026-07-20 02:16:54.914508-07
b692c612-d9e9-49bb-b45d-74cab6aecb9e	298e55fe-8d40-4c0e-969f-8d52b234c8c5	10000.00	Cash		2026-07-20 04:15:32.655898-07	f7302f35-beba-460b-b630-dbc37ce134a3		2026-07-20 04:15:32.655899-07
cd987794-6ff9-43a4-973a-75d2c4807e96	355b0617-5c7c-4dfa-8bfa-612d7226b55a	69000.00	Cash		2026-07-20 06:00:11.218857-07	f7302f35-beba-460b-b630-dbc37ce134a3		2026-07-20 06:00:11.218858-07
96aa1e05-da63-409b-85e4-6cac03475579	52158b71-f5c0-4792-9c2e-7fd1d81fb502	69000.00	Cash		2026-07-20 06:00:31.792791-07	f7302f35-beba-460b-b630-dbc37ce134a3		2026-07-20 06:00:31.792793-07
118673f5-ebd1-485e-a92b-df4747af0ddf	f395542e-1dc6-4be8-ac04-06c7f0aa624b	5000.00	Cash		2026-07-20 06:00:49.581574-07	f7302f35-beba-460b-b630-dbc37ce134a3		2026-07-20 06:00:49.581576-07
\.


--
-- Data for Name: pharmacy_sales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pharmacy_sales (id, patient_id, inventory_item_id, quantity, unit_price, total, payment_method, invoice_id, sold_at, cost_price) FROM stdin;
c1adf003-5bd1-41d5-95c7-f044b54d6913	\N	678ecb2f-4723-46f3-946f-6d627f681c24	11	1000.00	11000.00	Cash	\N	2026-07-14 16:18:00.196079-07	0.00
\.


--
-- Data for Name: prescriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.prescriptions (id, consultation_id, drug_name, dosage, route, frequency, duration_days, quantity, instructions, is_dispensed, created_at) FROM stdin;
3ea95056-da35-4c4b-90ea-dee1606fa98f	ebbc0411-03cb-4da8-9f30-4179b9f3613d	Panadol				\N	\N		f	2026-07-14 04:41:18.574863-07
0f3c234f-bd00-4e8c-b324-6ad69faffc39	b577e240-4c0c-4125-afb7-87c2f53e68c7	Panadol	2x2	week	daily	2	23		t	2026-07-09 08:37:55.632804-07
\.


--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_order_items (id, purchase_order_id, inventory_item_id, quantity_ordered, quantity_received, unit_price, total_price) FROM stdin;
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_orders (id, supplier_id, order_date, expected_delivery, status, total_amount, created_at) FROM stdin;
\.


--
-- Data for Name: radiology_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.radiology_orders (id, consultation_id, patient_id, scan_id, status, report_notes, image_urls, ordered_at, performed_at, approved_at, approved_by) FROM stdin;
073cb857-1f0a-419c-838e-2478899541f3	ebbc0411-03cb-4da8-9f30-4179b9f3613d	3c481c67-349e-4820-9780-07e0d1aea275	4517a892-9ae3-4792-aaea-0c19abe5e599	Scheduled	\N	\N	2026-07-14 05:57:02.063215-07	\N	\N	\N
2ee44db7-e9ec-4d70-8dfe-7a8432ec31d4	93a9db84-fb10-46d5-9930-8c6738e5e715	6b52bd82-6230-4e63-94c9-d08ca654ab42	4517a892-9ae3-4792-aaea-0c19abe5e599	Scheduled	\N	\N	2026-07-15 15:37:01.761049-07	\N	\N	\N
\.


--
-- Data for Name: radiology_scans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.radiology_scans (id, name, price) FROM stdin;
4517a892-9ae3-4792-aaea-0c19abe5e599	Chest X-Ray	150.00
4f768f49-87f7-49c8-8748-20ca33abbaea	CT Scan	500.00
7140d3e4-b25e-4809-b488-809017f7e41c	MRI Brain	30000.00
\.


--
-- Data for Name: stock_adjustments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_adjustments (id, inventory_item_id, quantity, previous_stock, new_stock, reason, created_at) FROM stdin;
8daf80c7-f451-4d4b-b12d-2ea5f72059a7	678ecb2f-4723-46f3-946f-6d627f681c24	3	17	20		2026-07-10 03:25:11.030983-07
ac9a1d3e-ee71-4d30-9931-100e06401868	678ecb2f-4723-46f3-946f-6d627f681c24	-3	20	17		2026-07-10 03:25:20.273573-07
a6daf5ec-bb27-4c71-9730-80cebdd00243	678ecb2f-4723-46f3-946f-6d627f681c24	-6	17	11		2026-07-10 03:25:28.053695-07
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, name, contact_person, phone, email, tax_id) FROM stdin;
\.


--
-- Data for Name: triage_vitals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.triage_vitals (id, patient_id, recorded_at, blood_pressure_systolic, blood_pressure_diastolic, temperature, pulse, respiratory_rate, weight, height, spo2, notes, recorded_by, bmi) FROM stdin;
22644b64-efb7-4843-9ca7-0dc831ab4de5	6b52bd82-6230-4e63-94c9-d08ca654ab42	2026-07-15 15:30:54.847335-07	22	22	22	22	22	22	22	22		\N	454.55
29828415-291d-4b38-96a7-05e1a4a8569e	6b52bd82-6230-4e63-94c9-d08ca654ab42	2026-07-15 15:31:23.765025-07	22	22	22	22	22	22	22	22		\N	454.55
bc01a7f1-f915-40eb-b588-0c2214b2c56b	6b52bd82-6230-4e63-94c9-d08ca654ab42	2026-07-15 15:33:25.865232-07	22	22	22	22	22	22	22	22		\N	454.54547
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, full_name, role, is_active, last_login, created_at) FROM stdin;
362bc3c2-f5f1-4bd8-9248-05c3ffd73452	ckamo	$2b$12$/8MnI9NLbjF44Xu62mT.ye1OsEgvjhWjxsq8kBUGmf67E8w75Qd1C	Kamoga Charles	Doctor	t	2026-07-14 07:54:33.554704-07	2026-07-09 08:37:02.855256-07
f7302f35-beba-460b-b630-dbc37ce134a3	admin	$2b$12$4YrRUp1krLYMdunjcpKSUOdncNb3ZjFs.3DduWE.DFzUVrLmddaNG	Administrator	Admin	t	2026-07-20 05:03:12.246812-07	2026-07-11 14:07:38.687668-07
\.


--
-- Data for Name: wards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wards (id, name, floor, description) FROM stdin;
667d7fa1-c069-456e-aec0-e6fce0484b9d	General Ward	\N	\N
\.


--
-- Name: _sqlx_migrations _sqlx_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sqlx_migrations
    ADD CONSTRAINT _sqlx_migrations_pkey PRIMARY KEY (version);


--
-- Name: admissions admissions_consultation_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_consultation_id_key UNIQUE (consultation_id);


--
-- Name: admissions admissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: beds beds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_pkey PRIMARY KEY (id);


--
-- Name: beds beds_ward_id_bed_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_ward_id_bed_number_key UNIQUE (ward_id, bed_number);


--
-- Name: consultations consultations_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_code_key UNIQUE (code);


--
-- Name: consultations consultations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);


--
-- Name: dispensations dispensations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispensations
    ADD CONSTRAINT dispensations_pkey PRIMARY KEY (id);


--
-- Name: doctors doctors_license_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_license_number_key UNIQUE (license_number);


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (id);


--
-- Name: doctors doctors_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_user_id_key UNIQUE (user_id);


--
-- Name: donations donations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_code_key UNIQUE (code);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: lab_orders lab_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_pkey PRIMARY KEY (id);


--
-- Name: lab_tests lab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_pkey PRIMARY KEY (id);


--
-- Name: patients patients_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_code_key UNIQUE (code);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pharmacy_sales pharmacy_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_sales
    ADD CONSTRAINT pharmacy_sales_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: radiology_orders radiology_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radiology_orders
    ADD CONSTRAINT radiology_orders_pkey PRIMARY KEY (id);


--
-- Name: radiology_scans radiology_scans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radiology_scans
    ADD CONSTRAINT radiology_scans_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: triage_vitals triage_vitals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.triage_vitals
    ADD CONSTRAINT triage_vitals_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: wards wards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT wards_pkey PRIMARY KEY (id);


--
-- Name: idx_inventory_therapeutic; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_therapeutic ON public.inventory_items USING btree (therapeutic_class);


--
-- Name: idx_payments_invoice_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_invoice_id ON public.payments USING btree (invoice_id);


--
-- Name: idx_stock_adjustments_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_adjustments_item ON public.stock_adjustments USING btree (inventory_item_id);


--
-- Name: admissions admissions_bed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.beds(id) ON DELETE SET NULL;


--
-- Name: admissions admissions_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: beds beds_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_ward_id_fkey FOREIGN KEY (ward_id) REFERENCES public.wards(id) ON DELETE CASCADE;


--
-- Name: consultations consultations_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);


--
-- Name: consultations consultations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: dispensations dispensations_dispensed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispensations
    ADD CONSTRAINT dispensations_dispensed_by_fkey FOREIGN KEY (dispensed_by) REFERENCES public.users(id);


--
-- Name: dispensations dispensations_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispensations
    ADD CONSTRAINT dispensations_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: dispensations dispensations_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispensations
    ADD CONSTRAINT dispensations_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: doctors doctors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_orders lab_orders_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE SET NULL;


--
-- Name: lab_orders lab_orders_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: lab_orders lab_orders_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_tests(id);


--
-- Name: lab_orders lab_orders_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: payments payments_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: pharmacy_sales pharmacy_sales_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_sales
    ADD CONSTRAINT pharmacy_sales_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: pharmacy_sales pharmacy_sales_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_sales
    ADD CONSTRAINT pharmacy_sales_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: pharmacy_sales pharmacy_sales_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacy_sales
    ADD CONSTRAINT pharmacy_sales_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: radiology_orders radiology_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radiology_orders
    ADD CONSTRAINT radiology_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: radiology_orders radiology_orders_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radiology_orders
    ADD CONSTRAINT radiology_orders_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE SET NULL;


--
-- Name: radiology_orders radiology_orders_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radiology_orders
    ADD CONSTRAINT radiology_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: radiology_orders radiology_orders_scan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radiology_orders
    ADD CONSTRAINT radiology_orders_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.radiology_scans(id);


--
-- Name: stock_adjustments stock_adjustments_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: triage_vitals triage_vitals_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.triage_vitals
    ADD CONSTRAINT triage_vitals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: triage_vitals triage_vitals_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.triage_vitals
    ADD CONSTRAINT triage_vitals_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: bed_occupancy; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: postgres
--

REFRESH MATERIALIZED VIEW public.bed_occupancy;


--
-- Name: daily_revenue; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: postgres
--

REFRESH MATERIALIZED VIEW public.daily_revenue;


--
-- PostgreSQL database dump complete
--

\unrestrict BnqX2KXZFclTL8fEu7PMkGCplhRE0LsNdytNgAElIA31VxGBuvbviyqNhYTLerg

