mod config;
mod error;
mod domain;
mod application;
mod infrastructure;
mod presentation;

use axum::{
    routing::{get, post, delete},
    Router,
    middleware::from_fn_with_state,
};
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
    services::ServeDir,
};
use tower_cookies::CookieManagerLayer;
use tokio::net::TcpListener;
use dotenvy::dotenv;
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use crate::infrastructure::events::EventDispatcher;
use crate::presentation::handlers::{
    patient, consultation, pharmacy, user, lab, billing,
    radiology, inpatient, inventory, donation, dashboard, report, auth, financial, receipt,
    notification, notification_admin, notification_admin_preferences, availability, expense, insurance, hr, admin, maternity,
};
use crate::presentation::middleware::auth::auth_middleware;
use crate::presentation::middleware::permission::permission_middleware;

#[derive(Clone)]
pub struct AppState {
    pub db_pool: sqlx::PgPool,
    pub event_bus: EventDispatcher,
    pub jwt_secret: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "hospital_management=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    let jwt_secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET must be set");

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    sqlx::migrate!().run(&pool).await?;

    let event_bus = EventDispatcher::new();

    let state = AppState {
        db_pool: pool,
        event_bus,
        jwt_secret,
    };

    // ---- Protected routes (require authentication) ----
    let protected_routes = Router::new()
        // ---------- Patients ----------
        .route("/patients", get(patient::list_patients))
        .route("/patients/new", get(patient::new_patient_form))
        .route("/patients", post(patient::create_patient))
        .route("/patients/:id", get(patient::get_patient))
        .route("/patients/:id/edit", get(patient::edit_patient_form))
        .route("/patients/:id", post(patient::update_patient))
        .route("/patients/:id/delete", post(patient::delete_patient))
        .route("/patients/search", post(patient::search_patients))
        .route("/patients/:id/vitals", post(patient::add_vitals))
        .route("/patients/:id/consult", get(patient::start_consultation_get))
        .route("/patients/:id/consult", post(patient::start_consultation_post))
        .route("/api/vitals", post(patient::add_vitals_api))
        .route("/inpatient/dashboard", get(inpatient::dashboard))

        // ---------- Consultations ----------
        .route("/consultations", get(consultation::list_consultations))
        .route("/consultations/new", get(consultation::new_consultation_form))
        .route("/consultations", post(consultation::create_consultation))
        .route("/consultations/:id", get(consultation::get_consultation))
        .route("/consultations/:id/start", post(consultation::start_consultation))
        .route("/consultations/:id/prescription", post(consultation::add_prescription))
        .route("/consultations/:id/diagnosis", post(consultation::add_diagnosis))
        .route("/consultations/:id/complete", get(consultation::complete_consultation))
        .route("/consultations/:id/lab-order", get(consultation::new_lab_order_form))
        .route("/consultations/:id/lab-order", post(consultation::create_lab_order))
        .route("/consultations/:id/update", post(consultation::update_consultation))
        .route("/consultations/:id/type", post(consultation::change_consultation_type))
        // Doctor Dashboard
        .route("/doctor/dashboard", get(consultation::doctor_dashboard))

        // ---------- Pharmacy ----------
        .route("/pharmacy/items", get(pharmacy::list_items))
        .route("/pharmacy/items/new", get(pharmacy::new_item_form))
        .route("/pharmacy/items/new", post(pharmacy::create_item))
        .route("/pharmacy/items/:id", get(pharmacy::get_item))
        .route("/pharmacy/items/:id/edit", get(pharmacy::edit_item_form))
        .route("/pharmacy/items/:id/edit", post(pharmacy::update_item))
        .route("/pharmacy/items/:id/delete", post(pharmacy::delete_item))
        .route("/pharmacy/items/:id/adjust", get(pharmacy::adjust_stock_form))
        .route("/pharmacy/items/:id/adjust", post(pharmacy::adjust_stock))
        .route("/pharmacy/items/:id/alternatives", get(pharmacy::get_alternatives))
        .route("/pharmacy/dispense/:prescription_id", get(pharmacy::dispense_form))
        .route("/pharmacy/dispense", post(pharmacy::dispense_prescription))
        .route("/pharmacy/dispensations", get(pharmacy::list_dispensations))
        .route("/pharmacy/sales", get(pharmacy::list_sales))
        .route("/pharmacy/sales/new", get(pharmacy::new_sale_form))
        .route("/pharmacy/sales/new", post(pharmacy::create_sale))
        .route("/pharmacy/prescriptions", get(pharmacy::list_prescriptions))
        .route("/pharmacy/dashboard", get(pharmacy::dashboard))

        // ---------- Expenses ----------
        .route("/expenses", get(expense::list_expenses))
        .route("/expenses/new", get(expense::new_expense_form))
        .route("/expenses", post(expense::create_expense))
        .route("/expenses/:id", get(expense::get_expense))
        .route("/expenses/:id/edit", get(expense::edit_expense_form))
        .route("/expenses/:id", post(expense::update_expense))
        .route("/expenses/:id/delete", post(expense::delete_expense))

        // ---------- Payment Modes ----------
        .route("/billing/payment-modes", get(billing::payment_modes_page))
        .route("/billing/payment-modes", post(billing::update_payment_modes))

        // ---------- Insurance ----------
        .route("/insurance/providers", get(insurance::list_providers))
        .route("/insurance/providers", post(insurance::create_provider))
        .route("/insurance/providers/:id", post(insurance::update_provider))
        .route("/insurance/providers/:id/delete", post(insurance::delete_provider))
        .route("/insurance/claims", get(insurance::list_claims))
        .route("/insurance/claims", post(insurance::create_claim))
        .route("/insurance/claims/:id", post(insurance::update_claim))

        // ---------- Reports ----------
        .route("/api/reports/pharmacy-usage", get(report::pharmacy_usage_report))
        .route("/api/reports/lab-usage", get(report::lab_usage_report))
        .route("/api/reports/doctor-revenue", get(report::doctor_revenue_report))
        .route("/api/reports/patient-revenue", get(report::patient_revenue_report))
        .route("/api/reports/revenue/csv", get(report::export_revenue_csv))

        // ---------- Appointments Calendar ----------
        .route("/appointments/calendar", get(consultation::calendar_dashboard))
        .route("/api/appointments/events", get(consultation::calendar_events))

        // ---------- Doctor Availability ----------
        .route("/doctors/:id/availability", get(availability::manage_availability_form))
        .route("/doctors/:id/availability", post(availability::set_availability))
        .route("/doctors/:id/availability/:id/delete", post(availability::delete_availability))

        // ---------- Users ----------
        .route("/users", get(user::list_users))
        .route("/users/new", get(user::new_user_form))
        .route("/users", post(user::create_user))
        .route("/users/:id", get(user::get_user))
        .route("/users/:id/edit", get(user::edit_user_form))
        .route("/users/:id", post(user::update_user))
        .route("/users/:id/delete", post(user::delete_user))
        .route("/doctors", get(user::list_doctors))
        .route("/doctors/new", get(user::new_doctor_form))
        .route("/doctors", post(user::create_doctor))
        .route("/users/:id/toggle-status", post(user::toggle_user_status))

        // ---------- Lab ----------
        .route("/lab/orders/new", get(lab::new_order_form))
        .route("/lab/tests/new", get(lab::new_test_form))
        .route("/lab/dashboard", get(lab::lab_dashboard))
        .route("/lab/pick-sample", get(lab::pick_sample))
        .route("/lab/enter-results", get(lab::enter_results))
        .route("/lab/review-results", get(lab::review_results))
        .route("/lab/results-ready", get(lab::results_ready))
        .route("/lab/orders", get(lab::list_orders))
        .route("/lab/orders", post(lab::create_order))
        .route("/lab/orders/:id", get(lab::get_order))
        .route("/lab/orders/:id/verify", post(lab::verify_order))
        .route("/lab/tests", get(lab::list_tests))
        .route("/lab/tests", post(lab::create_test))
        .route("/lab/tests/:id/edit", get(lab::edit_test_form))
        .route("/lab/tests/:id", post(lab::update_test))
        .route("/lab/tests/:id/delete", post(lab::delete_test))
        .route("/lab/pick-sample/:id", post(lab::pick_sample_post))
        .route("/lab/enter-results/:id", post(lab::enter_results_post))
        .route("/lab/review-results/:id", post(lab::review_results_post))
        .route("/lab/results/:id/print", get(lab::print_result))

        // User Profile & Password
        .route("/users/profile", get(user::profile_page))
        .route("/users/change-password", post(user::change_password))
        .route("/users/profile/update", post(user::update_profile))
        
        // Forgot Password (public)
        .route("/forgot-password", get(user::forgot_password_form))
        .route("/forgot-password", post(user::forgot_password))
        .route("/reset-password", get(user::reset_password_form))
        .route("/reset-password", post(user::reset_password))
        
        // Role Management (using user handlers)
        .route("/admin/roles", get(user::roles_page))
        .route("/admin/roles/update", post(admin::update_role_permissions))
        
        // ---------- Billing ----------
        .route("/invoices", get(billing::list_invoices))
        .route("/invoices/new", get(billing::new_invoice_form))
        .route("/invoices", post(billing::create_invoice))
        .route("/invoices/generate", post(billing::generate_invoice))
        .route("/invoices/:id", get(billing::get_invoice))
        .route("/invoices/:id/pay", get(billing::payment_form))
        .route("/invoices/:id/pay", post(billing::record_payment))
        .route("/invoices/:id/items", get(billing::list_invoice_items))
        .route("/invoices/:id/items", post(billing::add_invoice_item))
        .route("/invoices/:id/void", post(billing::void_invoice))
        .route("/pending-payments", get(billing::pending_payments))
        .route("/debtors", get(billing::list_debtors))
        .route("/billing/prices", get(billing::price_management))
        .route("/api/prices/consultation/:doctor_id", post(billing::set_consultation_fee))
        .route("/api/prices/lab/:test_id", post(billing::set_lab_price))
        .route("/api/prices/radiology/:scan_id", post(billing::set_radiology_price))
        .route("/api/prices/pharmacy/:item_id", post(billing::set_pharmacy_price))
        .route("/api/prices/bed/:bed_id", post(billing::set_bed_rent))
        .route("/billing/payment-receipts", get(billing::payment_receipts))
        .route("/billing/debtors", get(billing::debtors_page))
        .route("/billing/insurance", get(billing::insurance_billing))
        .route("/billing/financial-accounts", get(billing::financial_accounts))
        .route("/billing/accounting-reports", get(billing::accounting_reports))
        .route("/billing/dashboard", get(billing::dashboard))

        // ---------- Financial Dashboard & Receipts ----------
        .route("/financial-dashboard", get(financial::financial_dashboard))
        .route("/receipts/:payment_id", get(receipt::payment_receipt))

        // ---------- Radiology ----------
        .route("/radiology/scans/new", get(radiology::new_scan_form))
        .route("/radiology/orders/new", get(radiology::new_order_form))
        .route("/radiology/scans", get(radiology::list_scans))
        .route("/radiology/scans", post(radiology::create_scan))
        .route("/radiology/orders", get(radiology::list_orders))
        .route("/radiology/orders", post(radiology::create_order))
        .route("/radiology/orders/:id", get(radiology::get_order))
        .route("/radiology/orders/:id/perform", post(radiology::perform_order))
        .route("/radiology/orders/:id/approve", post(radiology::approve_order))
        .route("/radiology/dashboard", get(radiology::dashboard))

        // ---------- Inpatient ----------
        .route("/admissions/new", get(inpatient::new_admission_form))
        .route("/admissions", get(inpatient::list_admissions))
        .route("/admissions", post(inpatient::create_admission))
        .route("/admissions/:id", get(inpatient::get_admission))
        .route("/admissions/discharge", post(inpatient::discharge_patient))
        .route("/admissions/transfer", post(inpatient::transfer_bed))
        .route("/beds/new", get(inpatient::new_bed_form))
        .route("/beds", get(inpatient::list_beds))
        .route("/beds", post(inpatient::create_bed))
        .route("/beds/:id/edit", get(inpatient::edit_bed_form))
        .route("/beds/:id", post(inpatient::update_bed))
        .route("/beds/:id/delete", post(inpatient::delete_bed))
        .route("/wards/new", get(inpatient::new_ward_form))
        .route("/wards", get(inpatient::list_wards_page))
        .route("/wards", post(inpatient::create_ward))
        .route("/wards/:id/edit", get(inpatient::edit_ward_form))
        .route("/wards/:id", post(inpatient::update_ward))
        .route("/wards/:id/delete", post(inpatient::delete_ward))

        // ---------- Inventory ----------
        .route("/inventory/items", get(inventory::list_items))
        .route("/inventory/items/new", get(inventory::new_item_form))
        .route("/inventory/items", post(inventory::create_item))
        .route("/inventory/items/:id", get(inventory::get_item))
        .route("/inventory/items/:id/edit", get(inventory::edit_item_form))
        .route("/inventory/items/:id", post(inventory::update_item))
        .route("/inventory/items/:id/adjust", post(inventory::adjust_stock))
        .route("/inventory/items/:id/delete", post(inventory::delete_item))

        // ---------- Donations ----------
        .route("/donations", get(donation::list_donations))
        .route("/donations/new", get(donation::new_donation_form))
        .route("/donations", post(donation::create_donation))
        .route("/donations/:id", get(donation::get_donation))
        .route("/donations/:id/edit", get(donation::edit_donation_form))
        .route("/donations/:id", post(donation::update_donation))
        .route("/donations/:id/allocate", post(donation::allocate_donation))
        .route("/donations/:id/use", post(donation::mark_used))

        // ---------- Dashboard & Reports ----------
        .route("/dashboard", get(dashboard::dashboard))
        .route("/api/dashboard/kpis", get(dashboard::get_kpis))
        .route("/api/dashboard/revenue", get(dashboard::revenue_chart))
        .route("/api/dashboard/appointments", get(dashboard::appointment_chart))
        .route("/api/dashboard/monthly-revenue", get(dashboard::monthly_revenue_chart))
        .route("/api/dashboard/monthly-visits", get(dashboard::monthly_visits_chart))
        .route("/reports", get(report::reports_index))
        .route("/api/reports/revenue", get(report::revenue_report))
        .route("/api/reports/patients", get(report::patient_report))
        .route("/api/reports/appointments", get(report::appointment_report))

        // ---------- Notifications ----------
        // ---- API endpoints ----
        .route("/api/notifications", get(notification::get_notifications))
        .route("/api/notifications/unread", get(notification::unread_count))
        .route("/api/notifications/mark-read", post(notification::mark_read))
        .route("/api/notifications/:id", delete(notification::delete_notification))
        .route("/api/notifications/clear-read", delete(notification::clear_read_notifications))
        .route("/api/notifications/preferences", get(notification::get_preferences))
        .route("/api/notifications/preferences", post(notification::update_preferences_json))
        
        // ---- Web pages ----
        .route("/notifications", get(notification::notifications_page))
        .route("/notifications/preferences", get(notification::preferences_page))
        .route("/notifications/preferences", post(notification::update_preferences_form))
        
        // ---- Admin Notification Templates ----
        .route("/admin/notification-templates", get(notification_admin::list_templates))
        .route("/admin/notification-templates/:id/edit", get(notification_admin::edit_template))
        .route("/admin/notification-templates/:id", post(notification_admin::update_template))
		
		// ---------- Admin Notification Preferences ----------
		.route("/admin/notification-preferences", get(notification_admin_preferences::list_user_preferences))
		.route("/admin/notification-preferences/:user_id/edit", get(notification_admin_preferences::edit_user_preferences))
		.route("/admin/notification-preferences/:user_id", post(notification_admin_preferences::update_user_preferences))

       // ---------- HR ----------
		// Employees
		.route("/hr/employees", get(hr::employees::list_employees))
		.route("/hr/employees/new", get(hr::employees::new_employee_form))
		.route("/hr/employees", post(hr::employees::create_employee))
		.route("/hr/employees/:id/edit", get(hr::employees::edit_employee_form))
		.route("/hr/employees/:id", post(hr::employees::update_employee))
		.route("/hr/employees/:id/delete", post(hr::employees::delete_employee))
		
		// Attendance
		.route("/hr/attendance", get(hr::attendance::attendance_history))
		.route("/hr/attendance/clock-in", post(hr::attendance::clock_in))
		.route("/hr/attendance/clock-out", post(hr::attendance::clock_out))
		.route("/hr/attendance/overview", get(hr::attendance::overview))
		.route("/hr/attendance/note", post(hr::attendance::add_note))
		.route("/hr/leave/:id/delete", post(hr::leave::delete_leave))
		
		// Leave
		.route("/hr/leave", get(hr::leave::list_leave_requests))
		.route("/hr/leave/new", get(hr::leave::request_leave_form))
		.route("/hr/leave", post(hr::leave::request_leave))
		.route("/hr/leave/:id/approve", post(hr::leave::approve_leave))
		.route("/hr/leave/:id/reject", post(hr::leave::reject_leave))
		
		// Payroll
		.route("/hr/payroll", get(hr::payroll::list_payroll))
		.route("/hr/payroll/new", get(hr::payroll::new_payroll_form))
		.route("/hr/payroll", post(hr::payroll::create_payroll))
		.route("/hr/payroll/generate", post(hr::payroll::generate_payroll))
		.route("/hr/payroll/:id/edit", get(hr::payroll::edit_payroll_form))
		.route("/hr/payroll/:id", post(hr::payroll::update_payroll))
		.route("/hr/payroll/:id/delete", post(hr::payroll::delete_payroll))
		
		// Performance
		.route("/hr/performance", get(hr::performance::list_reviews))
		.route("/hr/performance/new", get(hr::performance::new_review_form))
		.route("/hr/performance", post(hr::performance::create_review))
		.route("/hr/sync-users", post(hr::employees::sync_users))
		
		// ---------- Maternity ----------
		// Dashboard
		.route("/maternity/dashboard", get(maternity::dashboard::dashboard))
		
		// Antenatal
		.route("/maternity/antenatal", get(maternity::antenatal::list_antenatal_visits))
		.route("/maternity/antenatal/new", get(maternity::antenatal::new_antenatal_form))
		.route("/maternity/antenatal", post(maternity::antenatal::create_antenatal_visit))
		.route("/maternity/antenatal/:id", get(maternity::antenatal::get_antenatal_visit))
		.route("/maternity/antenatal/:id/edit", get(maternity::antenatal::edit_antenatal_form))
		.route("/maternity/antenatal/:id", post(maternity::antenatal::update_antenatal_visit))
		.route("/maternity/antenatal/:id/delete", post(maternity::antenatal::delete_antenatal_visit))
		
		// Deliveries
		.route("/maternity/deliveries", get(maternity::delivery::list_deliveries))
		.route("/maternity/deliveries/new", get(maternity::delivery::new_delivery_form))
		.route("/maternity/deliveries", post(maternity::delivery::create_delivery))
		.route("/maternity/deliveries/:id", get(maternity::delivery::get_delivery))
		.route("/maternity/deliveries/:id/edit", get(maternity::delivery::edit_delivery_form))
		.route("/maternity/deliveries/:id", post(maternity::delivery::update_delivery))
		.route("/maternity/deliveries/:id/delete", post(maternity::delivery::delete_delivery))
		
		// Babies
		.route("/maternity/babies", get(maternity::baby::list_babies))
		.route("/maternity/babies/new", get(maternity::baby::new_baby_form))
		.route("/maternity/babies", post(maternity::baby::create_baby))
		.route("/maternity/babies/:id", get(maternity::baby::get_baby))
		.route("/maternity/babies/:id/edit", get(maternity::baby::edit_baby_form))
		.route("/maternity/babies/:id", post(maternity::baby::update_baby))
		.route("/maternity/babies/:id/delete", post(maternity::baby::delete_baby))
		
		// Immunisations
		.route("/maternity/immunisations", get(maternity::immunisation::list_immunisations))
		.route("/maternity/immunisations/new", get(maternity::immunisation::new_immunisation_form))
		.route("/maternity/immunisations", post(maternity::immunisation::create_immunisation))
		.route("/maternity/immunisations/:id/edit", get(maternity::immunisation::edit_immunisation_form))
		.route("/maternity/immunisations/:id", post(maternity::immunisation::update_immunisation))
		.route("/maternity/immunisations/:id/delete", post(maternity::immunisation::delete_immunisation))
		.route("/maternity/immunisations/schedule/:baby_id", get(maternity::immunisation::get_immunisation_schedule))
		.route("/maternity/immunisations/schedule/:baby_id/print", get(maternity::immunisation::print_immunisation_schedule))
		
		// Immunisation Types (Vaccines) - new
		.route("/maternity/immunisation-types", get(maternity::immunisation::list_immunisation_types))
		.route("/maternity/immunisation-types/new", get(maternity::immunisation::new_immunisation_type_form))
		.route("/maternity/immunisation-types", post(maternity::immunisation::create_immunisation_type))
		.route("/maternity/immunisation-types/:id/edit", get(maternity::immunisation::edit_immunisation_type_form))
		.route("/maternity/immunisation-types/:id", post(maternity::immunisation::update_immunisation_type))
		.route("/maternity/immunisation-types/:id/delete", post(maternity::immunisation::delete_immunisation_type))
		
		// Postnatal
		.route("/maternity/postnatal", get(maternity::postnatal::list_postnatal_visits))
		.route("/maternity/postnatal/new", get(maternity::postnatal::new_postnatal_form))
		.route("/maternity/postnatal", post(maternity::postnatal::create_postnatal_visit))
		.route("/maternity/postnatal/:id", get(maternity::postnatal::get_postnatal_visit))
		.route("/maternity/postnatal/:id/edit", get(maternity::postnatal::edit_postnatal_form))
		.route("/maternity/postnatal/:id", post(maternity::postnatal::update_postnatal_visit))
		.route("/maternity/postnatal/:id/delete", post(maternity::postnatal::delete_postnatal_visit))
	   
	    // ---------- Logout (protected) ----------
        .route("/logout", get(auth::logout))

        // ---------- Middleware Order ----------
        .layer(from_fn_with_state(state.clone(), permission_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware));

    // ---- Public routes (no authentication required) ----
    let app = Router::new()
        .route("/login", get(auth::login_form))
        .route("/login", post(auth::login))
        .route("/health", get(|| async { "OK" }))
        .nest_service("/static", ServeDir::new("static"))
        .nest("/", protected_routes)
        .layer(CookieManagerLayer::new())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".into());
    let port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "3000".into());
    let addr = format!("{}:{}", host, port);
    let listener = TcpListener::bind(&addr).await?;
    tracing::info!("?? MyHealth HMIS running on http://{}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}