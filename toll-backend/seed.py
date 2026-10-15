"""Seed the database with gates, tariffs, admin users and demo motorists.
Run: python seed.py   (venv active, from project root). Safe to re-run."""
from app.database import SessionLocal
from app.models import Account, Gate, Tariff, User, Vehicle
from app.security import hash_password, sha256

GATES = [
    ("Kafue Toll Plaza",  "Lusaka-Mongu Road",  "-15.77, 28.05"),
    ("Chongwe Toll Plaza", "Great East Road",   "-15.35, 28.35"),
    ("Katuba Toll Plaza",  "Lusaka-Kabwe Road", "-14.95, 28.05"),
]

TARIFFS = {  # ngwee
    "motorcycle": 1000,
    "light": 2500,
    "medium": 5000,
    "heavy": 7500,
}

EXTRA_MOTORISTS = [
    # phone, name, plate, tag, class, balance (ngwee)
    ("+260977123457", "Mwape Chileshe",   "BCA1111", "TAG-000111", "light",     40000),
    ("+260977123458", "Chanda Phiri",     "CAB2222", "TAG-000222", "heavy",      6000),
    ("+260977123459", "Bwalya Mukupa",    "DAC3333", "TAG-000333", "motorcycle", 12000),
    ("+260977123460", "Nachela Kabwe",    "EAD4444", "TAG-000444", "medium",         0),
    ("+260977123461", "Tembo Nyirenda",   "FAE5555", "TAG-000555", "light",     150000),
]


def main():
    db = SessionLocal()
    try:
        if db.query(Gate).count() == 0:
            for name, route, gps in GATES:
                slug = name.lower().split()[0]
                gate = Gate(name=name, route=route, gps_location=gps,
                            api_key_hash=sha256(f"dev-key-{slug}"))
                db.add(gate)
                db.flush()
                for vclass, fee in TARIFFS.items():
                    db.add(Tariff(gate_id=gate.gate_id, vehicle_class=vclass,
                                  base_fee=fee, discount_type="none"))
            db.commit()
            print("Seeded 3 gates x 4 tariffs.")
        else:
            print("Gates already exist — skipping.")

        admins = [
            ("Super Admin", "+260970000000", "admin123", "super_admin"),
            ("NRFA Admin",  "+260970000001", "admin123", "admin"),
            ("NRFA Auditor", "+260970000002", "audit123", "auditor"),
            ("Deputy Super Admin", "+260970000003", "admin123", "super_admin"),
        ]
        for full_name, phone, pw, role in admins:
            if not db.query(User).filter_by(phone_number=phone).first():
                u = User(full_name=full_name, phone_number=phone,
                         password_hash=hash_password(pw), role=role, verified=True)
                u.account = Account(account_type="individual")
                db.add(u)
        db.commit()
        print("Admin users ready (+260970000000/admin123 etc.)")

        demo_phone = "+260977123456"
        if not db.query(User).filter_by(phone_number=demo_phone).first():
            u = User(full_name="Demo Motorist", phone_number=demo_phone,
                     password_hash=hash_password("password123"),
                     role="motorist", verified=True)
            u.account = Account(account_type="individual", balance=50000)
            db.add(u)
            db.flush()
            db.add(Vehicle(account_id=u.account.account_id, plate_number="ABC1234",
                           rfid_tag_id="TAG-000123", vehicle_class="light"))
            db.commit()
            print("Demo motorist ready: +260977123456 / password123")
        else:
            print("Demo motorist already exists — skipping.")

        created = 0
        for phone, name, plate, tag, vclass, balance in EXTRA_MOTORISTS:
            if db.query(User).filter_by(phone_number=phone).first():
                continue
            u = User(full_name=name, phone_number=phone,
                     password_hash=hash_password("password123"),
                     role="motorist", verified=True)
            u.account = Account(account_type="individual", balance=balance)
            db.add(u)
            db.flush()
            db.add(Vehicle(account_id=u.account.account_id, plate_number=plate,
                           rfid_tag_id=tag, vehicle_class=vclass))
            created += 1
        db.commit()
        print(f"Extra demo motorists: {created} new "
              f"(all phone +26097712345x / password123)")

        # Katuba light vehicles get the frequent-user discount (10%) — for the demo
        katuba = db.query(Gate).filter_by(name="Katuba Toll Plaza").first()
        if katuba:
            db.query(Tariff).filter_by(gate_id=katuba.gate_id,
                                       vehicle_class="light")\
                .update({"discount_type": "frequent_user"}, synchronize_session=False)
            db.commit()

        print("\nGate API keys (dev only):")
        for name, _, _ in GATES:
            print(f"  {name}: dev-key-{name.lower().split()[0]}")
    finally:
        db.close()


if __name__ == "__main__":
    main()