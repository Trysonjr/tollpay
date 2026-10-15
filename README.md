TollPay — Automated Self-Service Toll Collection & Management Platform
A Mini-year mini project for Zambia: an integrated tolling platform where registeredvehicles pass through toll gates without stopping. The system identifies vehicles(dual-mode ANPR + RFID simulation), computes the tariff, settles payment from a prepaidwallet or mobile-money prompt, and opens the barrier — with offline resilience at thegate, role-based administration, and a full audit trail.

Built to extend, not replace, the NRFA's existing E-Toll infrastructure.

Tech Stack
Layer	Technology
Backend	Python 3.11, FastAPI, SQLAlchemy 2, Alembic
Database	MySQL 9
Frontend	React 18 + Vite (motorist PWA + admin portal)
Gate messaging	MQTT (Mosquitto) — REST/HTTPS in the prototype
Auth	JWT access/refresh tokens, phone-OTP verification
Payments	Mobile-money simulation (Airtel / MTN / Zamtel patterns)
Features
Motorist app (PWA): register with phone OTP, manage vehicles, top up viamobile money, buy prepaid toll passes, live toll history & receipts (PDF/CSV)
Automated toll gate: ANPR + RFID dual identification with cross-check,tariff & discount engine, wallet debit, mobile-money fallback, barrier control
Offline resilience: gate-side queue (SQLite/localStorage) with exactly-oncesync when connectivity returns
Simulation cockpit: browser-based gate simulator with camera (QR-plate)capture, autopilot traffic, and offline mode — no hardware required
Admin portal: dashboard & revenue reports, tariff management, gatemanagement, violations, user provisioning, role-based access(super_admin / admin / auditor) and a full audit log
Mobile: installable PWA, responsive to any screen size & orientation
Repository Layout
toll-backend/    FastAPI application (API, DB models, gate endpoints, seed data)toll-frontend/   React + Vite application (motorist app, admin portal, simulator)
Prerequisites
Python 3.11+
Node.js 18+ (LTS)
MySQL 8+ or 9
Setup — Backend
cd toll-backend# 1. Create & activate a virtual environmentpython -m venv .venv# Windows:.venv\Scripts\activate# macOS/Linux:source .venv/bin/activate# 2. Install dependenciespip install -r requirements.txt# 3. Create the database (MySQL Workbench or CLI):#    CREATE USER 'toll'@'localhost' IDENTIFIED BY 'toll';#    CREATE DATABASE toll CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;#    GRANT ALL PRIVILEGES ON toll.* TO 'toll'@'localhost';# 4. Configure environment — create a .env file:#    DATABASE_URL=mysql+pymysql://toll:toll@localhost:3306/toll?charset=utf8mb4#    JWT_SECRET=<any-long-random-string>#    APP_ENV=development# 5. Run database migrationsalembic upgrade head#    (first-time: see "Migrations note" below)# 6. Seed demo data (gates, tariffs, demo users)python seed.py# 7. Start the APIpython -m uvicorn app.main:app --host 0.0.0.0 --port 8080
The API is now live at http://localhost:8080 — interactive docs athttp://localhost:8080/docs.

Migrations note
This project ships with an alembic/versions/ history. If migrations have notyet been applied to a fresh database, run:

python -m alembic revision --autogenerate -m "initial schema"   # only if versions/ is emptypython -m alembic upgrade head
Setup — Frontend
cd toll-frontend# 1. Install dependenciesnpm install# 2. Configure the API base (optional — defaults to localhost):#    create .env.development with:#    VITE_API_BASE=http://localhost:8080/api/v1# 3. Start the dev servernpm run dev
Open http://localhost:5173.

To use the camera simulator or install the app as a PWA, serve over HTTPS onyour LAN: npm install -D @vitejs/plugin-basic-ssl (already configured invite.config.js), then access via the Network URL shown in the terminal andaccept the development certificate.

Demo Accounts
Role	Phone	Password
Motorist (vehicle ABC1234, ZMW 500)	+260977123456	password123
Super Admin	+260970000000	admin123
Admin	+260970000001	admin123
Auditor (read-only)	+260970000002	audit123
Running the Gate Simulator
The simulation cockpit runs in the browser at /simulator — drive vehiclesthrough a plaza, approve mobile-money prompts on a simulated phone, enableoffline mode, and watch the barrier respond.

A terminal-based simulator (with MQTT support) is also included:

python simulator.py gatespython simulator.py refreshpython simulator.py pass --gate katuba --plate ABC1234 --tag TAG-000123python simulator.py autopilot --gate katuba --count 10python simulator.py offline --gate katuba --plate BCA1111   # then: python simulator.py sync
Reset Demo Data
POST http://localhost:8080/api/v1/dev/reset
Clears transactions, payments, notifications and logs; sets every wallet to ZMW 500.