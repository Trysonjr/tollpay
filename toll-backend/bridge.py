"""MQTT <-> REST bridge: subscribes to gate/+/detections, calls the toll API (G1),
publishes the barrier command back to gate/{gate_id}/commands.
Run: python bridge.py   (Mosquitto + backend must be running)"""
import json

import paho.mqtt.client as mqtt
import requests

BROKER_HOST, BROKER_PORT = "localhost", 1883
BASE = "http://localhost:8080/api/v1"


def gate_headers(gate_id):
    gates = requests.get(f"{BASE}/dev/gates").json()["data"]
    gate = next(g for g in gates if g["gate_id"] == gate_id)
    return {"X-Gate-Id": gate_id, "X-Gate-Key": f"dev-key-{gate['name'].lower().split()[0]}"}


def publish_retained_tariffs(client):
    """Retained message: any gate reconnecting after an outage instantly
    receives the current tariff table."""
    try:
        gates = requests.get(f"{BASE}/dev/gates").json()["data"]
        r = requests.get(f"{BASE}/gate/tariffs", headers=gate_headers(gates[0]["gate_id"]))
        client.publish("edge/tariffs", json.dumps(r.json()["data"]), retain=True)
        print("Published retained tariff table to edge/tariffs")
    except Exception as e:
        print(f"Could not publish tariffs: {e}")


def on_connect(client, userdata, flags, rc):
    print(f"Bridge connected to broker (rc={rc})")
    client.subscribe("gate/+/detections")
    publish_retained_tariffs(client)


def on_message(client, userdata, msg):
    gate_id = msg.topic.split("/")[1]
    detection = json.loads(msg.payload.decode())
    print(f"<- Detection at gate {gate_id[:8]}...: "
          f"plate={detection.get('plate_number')} tag={detection.get('rfid_tag_id')}")
    try:
        r = requests.post(f"{BASE}/gate/transactions",
                          json={"transaction_id": detection["transaction_id"],
                                "plate_number": detection.get("plate_number"),
                                "rfid_tag_id": detection.get("rfid_tag_id"),
                                "captured_at": detection.get("captured_at")},
                          headers=gate_headers(gate_id), timeout=10)
        command = r.json()["data"]
        print(f"-> Barrier command: {command['decision'].upper()}")
    except Exception as e:
        print(f"!! Backend unreachable ({e}) - no command will reach the gate")
        return
    client.publish(f"gate/{gate_id}/commands", json.dumps(command))


client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message
client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
print("Bridge running (Ctrl+C to stop)")
client.loop_forever()