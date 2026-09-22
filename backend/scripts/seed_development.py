"""Idempotent, production-shaped local data for presenting the SLAB workflows."""
from datetime import UTC, datetime, timedelta
from uuid import NAMESPACE_URL, uuid5

from app.database.local import SessionLocal, User, get_user_by_email, init_local_database, pwd_context
from app.database.local_client import LocalClient

SEED_NAMESPACE = NAMESPACE_URL

def sid(name: str) -> str:
    return str(uuid5(SEED_NAMESPACE, f"slab-development:{name}"))

def upsert(client: LocalClient, table: str, key: str, values: dict) -> None:
    client.table(table).upsert({"id": sid(key), **values}).execute()

def main() -> None:
    init_local_database()
    customers_to_seed = [
        ("customer@slab.local", "Arjun Menon"),
        ("rahul.nair@slab.local", "Rahul Nair"),
        ("aditya.varma@slab.local", "Aditya Varma"),
        ("neeraj.kumar@slab.local", "Neeraj Kumar"),
        ("vivek.raj@slab.local", "Vivek Raj"),
        ("anjali.menon@slab.local", "Anjali Menon"),
    ]
    with SessionLocal.begin() as session:
        for email, name in customers_to_seed:
            user = get_user_by_email(session, email)
            if user is None:
                user = User(id=sid(f"customer-user-{email}"), email=email, password_hash=pwd_context.hash("Customer@123"), full_name=name, role="customer")
                session.add(user)
            else:
                user.full_name = name
        customer = get_user_by_email(session, "customer@slab.local")
        provider = get_user_by_email(session, "provider@slab.local")
        admin = get_user_by_email(session, "admin@slab.local")
        if not customer or not provider or not admin:
            raise RuntimeError("Run the API once first so development auth users are created.")
    client = LocalClient()
    now = datetime.now(UTC)
    customer_rows = [(get_user_by_email(session, email).id, name, email) for email, name in customers_to_seed]
    customer_id, provider_id, admin_id = customer.id, provider.id, admin.id
    for user_id, name, email in customer_rows:
        upsert(client, "profiles", f"profile-{user_id}", {"user_id": user_id, "role": "customer", "full_name": name, "email": email, "phone": "+91 90000 11000"})
    for user_id, role, name, email in [(provider_id, "provider", "Nikhil Rao", provider.email), (admin_id, "admin", "SLAB Operations", admin.email)]:
        upsert(client, "profiles", f"profile-{user_id}", {"user_id": user_id, "role": role, "full_name": name, "email": email, "phone": "+91 90000 11000"})
    upsert(client, "providers", f"provider-{provider_id}", {"user_id": provider_id, "profile_id": provider_id, "company_name": "SLAB Equipment Services", "phone": "+91 98765 43210", "verification_status": "approved", "is_online": True, "latitude": 12.9716, "longitude": 77.5946, "rating_average": 4.8, "rating_count": 124, "operating_area_km": 80})
    upsert(client, "provider_verifications", f"verification-{provider_id}", {"provider_user_id": provider_id, "provider_profile_id": provider_id, "status": "approved", "submitted_at": now.isoformat(), "reviewed_at": now.isoformat(), "reviewed_by": admin_id})
    fleet = [("jcb", "JCB Backhoe Loader", "3DX, 74 HP, 4WD", 1800, 12000), ("excavator", "Hydraulic Excavator", "20T crawler, 1.0 m3 bucket", 2400, 16500), ("mini_excavator", "Mini Excavator", "5T compact excavator", 1500, 10500), ("crane", "Pick & Carry Crane", "20T hydraulic mobile crane", 3200, 22000), ("mobile_crane", "Mobile Crane", "40T all-terrain crane", 5200, 36000), ("crawler_crane", "Crawler Crane", "80T lattice boom crane", 7800, 54000), ("loader", "Wheel Loader", "2.5 m3 bucket, 3T payload", 2100, 14500), ("bulldozer", "Bulldozer", "D6 class, 170 HP", 2900, 20000), ("mini_tipper", "Mini Tipper", "6T compact tipper for narrow site access", 1100, 8000), ("standard_tipper", "Standard Tipper", "10-wheel, 16T payload, operator included", 1500, 12000), ("heavy_tipper", "Heavy / Large Tipper", "25T high-capacity tipper for bulk site material", 2200, 17000)]
    equipment_ids = []
    for index, (kind, name, specs, hourly, daily) in enumerate(fleet, 1):
        equipment_id = sid(f"equipment-{kind}")
        equipment_ids.append(equipment_id)
        upsert(client, "provider_equipment", f"equipment-{kind}", {"id": equipment_id, "provider_user_id": provider_id, "name": name, "display_name": name, "equipment_type": kind, "equipment_type_slug": kind, "registration_number": f"KA01SL{index:02d}E", "identification_number": f"SLAB-{index:04d}", "status": "available", "hourly_rate": hourly, "daily_rate": daily, "monthly_rate": daily * 24, "operating_latitude": 12.9716, "operating_longitude": 77.5946, "specifications": {"summary": specs, "condition": "fleet maintained", "operator": True, "rating": 4.7}, "photo_urls": ["/assets/slab-equipment-hero.webp"]})
    upsert(client, "provider_availability_blocks", "availability-week", {"provider_user_id": provider_id, "starts_at": now.isoformat(), "ends_at": (now + timedelta(days=365)).isoformat(), "reason": "Operating schedule: Monday to Saturday, 07:00 to 20:00"})
    company_id = sid("company-slab-infrastructure")
    upsert(client, "companies", "company-slab-infrastructure", {"owner_user_id": customer_id, "company_name": "SLAB Infrastructure Works", "business_email": "projects@slab.local", "business_phone": "+91 90000 22000", "address": {"line1": "Outer Ring Road, Bengaluru"}})
    projects = [("project-logistics", "Bengaluru North Logistics Hub", "Devanahalli, Bengaluru", 13.1986, 77.7066), ("project-metro", "Whitefield Metro Expansion", "Whitefield, Bengaluru", 12.9698, 77.7499), ("project-highway", "Tumakuru Highway Package", "Nelamangala, Bengaluru", 13.1023, 77.3936)]
    for index, (key, name, address, lat, lng) in enumerate(projects):
        owner_id = customer_rows[index % len(customer_rows)][0]
        upsert(client, "projects", key, {"owner_user_id": owner_id, "company_id": company_id if owner_id == customer_id else None, "project_name": name, "address": {"line1": address}, "latitude": lat, "longitude": lng, "site_contact_name": "Site Operations", "site_contact_phone": "+91 90000 11000", "description": "Active civil works package with coordinated equipment requirements."})
    statuses = ["pending", "confirmed", "matching", "assigned", "provider_en_route", "provider_arrived", "in_progress", "completed", "cancelled"]
    booking_ids = []
    for index, status in enumerate(statuses, 1):
        booking_id = sid(f"booking-{status}")
        booking_ids.append(booking_id)
        project = projects[index % len(projects)]
        item = {"equipment_id": equipment_ids[index % len(equipment_ids)], "quantity": 1, "hours": 8}
        booking_customer_id, booking_customer_name, _ = customer_rows[(index - 1) % len(customer_rows)]
        upsert(client, "bookings", f"booking-{status}", {"id": booking_id, "user_id": booking_customer_id, "company_id": company_id if booking_customer_id == customer_id else None, "project_id": sid(project[0]), "provider_id": provider_id if index >= 4 and status != "cancelled" else None, "equipment_id": equipment_ids[index % len(equipment_ids)], "status": status, "site_location": {"line1": project[2], "latitude": project[3], "longitude": project[4]}, "starts_at": (now + timedelta(days=index)).isoformat(), "ends_at": (now + timedelta(days=index, hours=8)).isoformat(), "items": [item], "pricing_snapshot": {"platform_fee": "250.00", "service_amount": str(12000 + index * 750), "travel_charge": "850.00", "estimated_total": str(13100 + index * 750), "currency": "INR"}, "requirements": f"Coordinated site access for {booking_customer_name}."})
        upsert(client, "booking_status_history", f"history-{status}", {"booking_id": booking_id, "actor_user_id": booking_customer_id, "from_status": "pending", "to_status": status, "metadata": {"source": "operations"}, "created_at": (now - timedelta(hours=index)).isoformat()})
    for status, booking_id in [("assigned", booking_ids[3]), ("provider_en_route", booking_ids[4]), ("provider_arrived", booking_ids[5]), ("in_progress", booking_ids[6]), ("completed", booking_ids[7])]:
        upsert(client, "booking_assignments", f"assignment-{status}", {"booking_id": booking_id, "provider_user_id": provider_id, "status": status, "estimated_amount": 14500, "distance_km": 18.4, "eta_minutes": 42})
    upsert(client, "provider_booking_requests", "request-pending", {"booking_id": booking_ids[1], "provider_user_id": provider_id, "status": "pending", "estimated_amount": 14750, "distance_km": 22.6, "eta_minutes": 48, "expires_at": (now + timedelta(minutes=20)).isoformat(), "requirements": "Operator required; weekday morning arrival."})
    for index, status in enumerate(["pending", "succeeded", "failed"]):
        upsert(client, "slab_payments", f"payment-{status}", {"booking_id": booking_ids[index], "user_id": customer_id, "amount_cents": 25000, "currency": "inr", "status": status, "stripe_session_id": f"cs_test_slab_{status}", "idempotency_key": f"seed-payment-{status}"})
    notices = [(provider_id, "New equipment request", "A customer has requested a Hydraulic Excavator for Bengaluru North Logistics Hub.", "booking_request"), (provider_id, "Dispatch update", "Your assigned mobile crane job starts tomorrow at 07:00.", "dispatch"), (customer_id, "Booking confirmed", "SLAB Equipment Services has been assigned to your logistics hub project.", "booking_confirmed"), (customer_id, "Payment received", "Your SLAB platform fee has been verified in Stripe Test Mode.", "payment_success")]
    for index, (recipient, title, body, kind) in enumerate(notices, 1):
        upsert(client, "notifications", f"notification-{index}", {"recipient_user_id": recipient, "title": title, "body": body, "notification_type": kind, "is_read": index == 2, "created_at": (now - timedelta(hours=index)).isoformat()})
    upsert(client, "booking_chat_messages", "chat-1", {"booking_id": booking_ids[3], "sender_id": customer_id, "receiver_id": provider_id, "message": "Please confirm the site gate access window for tomorrow morning.", "created_at": (now - timedelta(hours=2)).isoformat(), "read_at": None})
    upsert(client, "booking_chat_messages", "chat-2", {"booking_id": booking_ids[3], "sender_id": provider_id, "receiver_id": customer_id, "message": "Confirmed. Our operator will arrive at 07:30 with the required equipment.", "created_at": (now - timedelta(hours=1)).isoformat(), "read_at": now.isoformat()})
    upsert(client, "booking_reviews", "review-completed", {"booking_id": booking_ids[7], "customer_id": customer_id, "provider_user_id": provider_id, "rating": 5, "comment": "Professional operator and excellent machine condition.", "status": "published"})
    upsert(client, "disputes", "dispute-resolved", {"booking_id": booking_ids[7], "customer_id": customer_id, "provider_id": provider_id, "reason": "billing_question", "description": "Request for final invoice clarification.", "status": "resolved", "assigned_admin": admin_id})
    print("SLAB development environment seeded idempotently with connected marketplace data.")

if __name__ == "__main__":
    main()
