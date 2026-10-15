"""Toll Gate Simulator — acts as the edge controller at a toll plaza.

Commands:
  python simulator.py gates
  python simulator.py refresh
  python simulator.py pass --gate katuba --plate ABC1234 --tag TAG-000123
  python simulator.py pass --gate katuba --plate EAD4444          (momo fallback)
  python simulator.py autopilot --gate katuba --count 10
  python simulator.py offline --gate katuba --plate ABC1234       (offline queue)
  python simulator.py sync                                        (upload queue)
  python simulator.py violation --gate katuba --plate ZZZ9999
  python simulator.py pass --mqtt --gate katuba --plate ABC1234   (MQTT mode)
"""
import argparse
import json
import random
import sqlite3
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE = "http://localhost:8080/api/v1"
QUEUE_DB = Path("edge_queue.db")
CACHE_FILE = Path("edge_cache.json")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def slugify(name):
    return name.lower().split()[0]


def gate_headers(gate):
    return {"X-Gate-Id": gate["gate_id"], "X-Gate-Key": f"dev-key-{slugify(gate['name'])}"}


def get_gates():
    r = requests.get(f"{BASE}/dev/gates")
    r.raise_for_status()
    return r.json()["data"]


def resolve_gate(name):
    gates = get_gates()
    for g in gates:
        if name.lower() in g["name"].lower() or g["gate_id"] == name:
            return g
    print(f"Gate '{name}' not found. Known gates:")
    for g in gates:
        print(f"  - {g['name']}")
    sys.exit(1)


def refresh_cache(args=None):
    r = requests.get(f"{BASE}/dev/edge-cache")
    r.raise_for_status()
    data = r.json()["data"]
    CACHE_FILE.write_text(json.dumps(data, indent=2))
    print(f"Edge cache refreshed: {len(data['vehicles'])} vehicles, "
          f"{len(data['tariffs'])} tariffs -> {CACHE_FILE}")
    return data


def load_cache():
    if not CACHE_FILE.exists():
        print("No edge cache yet — run: python simulator.py refresh")
        sys.exit(1)
    return json.loads(CACHE_FILE.read_text())


def init_queue():
    con = sqlite3.connect(QUEUE_DB)
    con.execute("""CREATE TABLE IF NOT EXISTS queue (
        transaction_id TEXT PRIMARY KEY, gate_id TEXT, plate, tag,
        captured_at TEXT, amount INTEGER, synced INTEGER DEFAULT 0)""")
    con.commit()
    return con


def fmt(ngwee):
    return f"ZMW {ngwee / 100:.2f}"


def post_passage(gate, plate, tag):
    payload = {"transaction_id": str(uuid.uuid4()), "plate_number": plate,
               "rfid_tag_id": tag, "captured_at": now_iso()}
    r = requests.post(f"{BASE}/gate/transactions", json=payload,
                      headers=gate_headers(gate))
    return r


def handle_outcome(gate, plate, body, interactive=True):
    d = body["data"]
    if d["decision"] == "open":
        print(f"  BARRIER OPENS - {plate} paid {fmt(d['amount'])} ({d['reason']})")
        return "open"
    if d["decision"] == "manual_lane":
        print(f"  MANUAL LANE - {plate}: {d['reason']}")
        return "manual_lane"
    # momo_pending -> poll G2
    ref = d["payment_reference"]
    print(f"  MoMo prompt {ref} sent for {fmt(d['amount'])} - waiting for approval...")
    if interactive:
        print(f"  (approve via Swagger: POST /api/v1/mock/momo/{ref}/approve "
              f"or the app's fake phone)")
    deadline = time.time() + 120
    while time.time() < deadline:
        time.sleep(1)
        pr = requests.get(f"{BASE}/gate/payments/{ref}", headers=gate_headers(gate))
        pd = pr.json()["data"]
        if pd["status"] == "approved":
            print(f"  BARRIER OPENS - {plate} paid {fmt(pd['amount'])} via mobile money")
            return "open"
        if pd["status"] in ("declined", "timeout"):
            print(f"  MANUAL LANE - {plate}: MOMO_{pd['status'].upper()}")
            return "manual_lane"
    print(f"  MANUAL LANE - {plate}: polling window expired")
    return "manual_lane"


def do_pass(args):
    gate = resolve_gate(args.gate)
    plate = args.plate.upper().replace(" ", "") if args.plate else None
    print(f"Approaching {gate['name']}: plate={plate or '-'} tag={args.tag or '-'}")
    if args.mqtt:
        mqtt_pass(gate, plate, args.tag, args.wait)
        return
    r = post_passage(gate, plate, args.tag)
    if r.status_code == 401:
        print("GATE_KEY_INVALID - check gate name/credentials")
        return
    if not r.ok:
        print(f"API error {r.status_code}: {r.json().get('error', {}).get('code')}")
        return
    handle_outcome(gate, plate or "UNKNOWN", r.json())


def autopilot(args):
    gate = resolve_gate(args.gate)
    cache = load_cache()
    vehicles = cache["vehicles"]
    outcomes = {}
    for i in range(args.count):
        if random.random() < 0.15:  # unregistered vehicle shows up sometimes
            plate = "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=3)) \
                    + str(random.randint(1000, 9999))
            tag = None
        else:
            v = random.choice(vehicles)
            plate, tag = v["plate_number"], v["rfid_tag_id"]
        print(f"\n[{i + 1}/{args.count}] Vehicle approaching: {plate}")
        r = post_passage(gate, plate, tag)
        if not r.ok:
            print(f"  API error {r.status_code}")
            continue
        data = r.json()["data"]
        if data["decision"] == "momo_pending":   # motorist responds on their phone
            ref = data["payment_reference"]
            time.sleep(random.uniform(1.5, 4))
            verb = "approve" if random.random() < 0.8 else "decline"
            requests.post(f"{BASE}/mock/momo/{ref}/{verb}")
        result = handle_outcome(gate, plate, r.json(), interactive=False)
        outcomes[result] = outcomes.get(result, 0) + 1
        if (data["decision"] == "manual_lane"
                and data.get("reason") == "VEHICLE_NOT_FOUND"
                and random.random() < 0.5):
            requests.post(f"{BASE}/gate/violations",
                          json={"plate_number": plate, "captured_at": now_iso()},
                          headers=gate_headers(gate))
            print(f"  Violation filed for {plate}")
        time.sleep(args.interval)
    print(f"\nSession summary: {outcomes}")


def offline_pass(args):
    gate = resolve_gate(args.gate)
    cache = load_cache()
    plate = args.plate.upper().replace(" ", "")
    vehicle = next((v for v in cache["vehicles"]
                    if v["plate_number"] == plate), None)
    if not vehicle:
        print(f"MANUAL LANE (offline) - {plate}: VEHICLE_NOT_FOUND in local cache")
        return
    tariff = next((t for t in cache["tariffs"]
                   if t["gate_id"] == gate["gate_id"]
                   and t["vehicle_class"] == vehicle["vehicle_class"]), None)
    if not tariff:
        print(f"MANUAL LANE (offline) - no cached tariff for {vehicle['vehicle_class']}")
        return
    con = init_queue()
    con.execute("INSERT INTO queue (transaction_id, gate_id, plate, tag, captured_at, amount) "
                "VALUES (?,?,?,?,?,?)",
                (str(uuid.uuid4()), gate["gate_id"], plate,
                 vehicle["rfid_tag_id"], now_iso(), tariff["base_fee"]))
    con.commit()
    con.close()
    print(f"BARRIER OPENS (OFFLINE) - {plate} passed; {fmt(tariff['base_fee'])} "
          f"queued locally, settles on sync")


def do_sync(args):
    con = init_queue()
    rows = con.execute("SELECT transaction_id, gate_id, plate, tag, captured_at, amount "
                       "FROM queue WHERE synced = 0").fetchall()
    if not rows:
        print("Offline queue is empty.")
        return
    gates = get_gates()
    by_gate = {}
    for r in rows:
        by_gate.setdefault(r[1], []).append(r)
    for gate_id, items in by_gate.items():
        gate = next(g for g in gates if g["gate_id"] == gate_id)
        payload = {"transactions": [
            {"transaction_id": t[0], "plate_number": t[2], "rfid_tag_id": t[3],
             "captured_at": t[4], "amount": t[5]} for t in items]}
        r = requests.post(f"{BASE}/gate/transactions/sync", json=payload,
                          headers=gate_headers(gate))
        for res in r.json()["data"]["results"]:
            mark = {"accepted": "+", "duplicate": "~"}.get(res["result"], "!")
            print(f"  [{mark}] {res['transaction_id'][:8]}... "
                  f"{res['result']} / {res['status']}"
                  + (f" / {res['reason']}" if res.get("reason") else ""))
        con.execute("UPDATE queue SET synced = 1 WHERE gate_id = ?", (gate_id,))
    con.commit()
    con.close()
    print("Sync complete - queue cleared.")


def do_violation(args):
    gate = resolve_gate(args.gate)
    r = requests.post(f"{BASE}/gate/violations",
                      json={"plate_number": args.plate, "captured_at": now_iso()},
                      headers=gate_headers(gate))
    print(r.json())


def mqtt_pass(gate, plate, tag, wait=30):
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        print("paho-mqtt not installed - run: pip install paho-mqtt==1.6.1")
        return
    result, connected = {}, threading.Event()

    def on_connect(client, userdata, flags, rc):
        client.subscribe(f"gate/{gate['gate_id']}/commands")
        connected.set()

    def on_message(client, userdata, msg):
        result["resp"] = json.loads(msg.payload.decode())

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect("localhost", 1883)
    client.loop_start()
    connected.wait(5)
    payload = {"transaction_id": str(uuid.uuid4()), "plate_number": plate,
               "rfid_tag_id": tag, "captured_at": now_iso(),
               "gate_id": gate["gate_id"]}
    client.publish(f"gate/{gate['gate_id']}/detections", json.dumps(payload))
    print(f"  Detection published over MQTT - waiting for barrier command (max {wait}s)...")
    start = time.time()
    while time.time() - start < wait and "resp" not in result:
        time.sleep(0.3)
    client.loop_stop()
    client.disconnect()
    if "resp" not in result:
        print("  No command received (link down?) - this is the offline scenario.")
        return
    handle_outcome(gate, plate or "UNKNOWN", {"data": result["resp"]})


def main():
    ap = argparse.ArgumentParser(description="Toll Gate Simulator (edge controller)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("gates")
    sub.add_parser("refresh")
    sub.add_parser("sync")
    p = sub.add_parser("pass")
    p.add_argument("--gate", required=True)
    p.add_argument("--plate", default=None)
    p.add_argument("--tag", default=None)
    p.add_argument("--mqtt", action="store_true")
    p.add_argument("--wait", type=int, default=30)
    p = sub.add_parser("autopilot")
    p.add_argument("--gate", required=True)
    p.add_argument("--count", type=int, default=10)
    p.add_argument("--interval", type=float, default=2.0)
    p = sub.add_parser("offline")
    p.add_argument("--gate", required=True)
    p.add_argument("--plate", required=True)
    p = sub.add_parser("violation")
    p.add_argument("--gate", required=True)
    p.add_argument("--plate", required=True)
    args = ap.parse_args()

    {"gates": lambda args: [print(f"{g['name']}  {g['gate_id']}") for g in get_gates()],
     "refresh": refresh_cache,
     "pass": do_pass,
     "autopilot": autopilot,
     "offline": offline_pass,
     "sync": do_sync,
     "violation": do_violation}[args.cmd](args)


if __name__ == "__main__":
    main()