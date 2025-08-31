from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import os

from app.database import SessionLocal
from app import models
from app.analysis import get_dashboard_data

# ---------------- App Setup ----------------
app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)


# ---------------- API Endpoints ----------------
@app.route("/api/dashboard", methods=["GET"])
def dashboard():
    return jsonify(get_dashboard_data())


@app.route("/api/vehicles", methods=["GET"])
def get_vehicles():
    db = SessionLocal()
    vehicles = db.query(models.Vehicle).all()
    data = [{"id": v.id, "vin": v.vin, "model": v.model} for v in vehicles]
    db.close()
    return jsonify(data)


@app.route("/api/dpc", methods=["GET"])
def get_dpc():
    db = SessionLocal()
    records = db.query(models.DPCRecord).all()
    data = [
        {
            "id": r.id,
            "vin": r.vin,
            "model": r.model,
            "date": r.date.isoformat(),
            "target": r.dpc_target,
            "actual": r.dpc_actual,
        }
        for r in records
    ]
    db.close()
    return jsonify(data)


@app.route("/api/rsp", methods=["GET"])
def get_rsp():
    db = SessionLocal()
    records = db.query(models.RSPRecord).all()
    data = [
        {
            "id": r.id,
            "date": r.date.isoformat(),
            "target": r.target,
            "actual": r.actual,
        }
        for r in records
    ]
    db.close()
    return jsonify(data)


@app.route("/api/docs", methods=["GET"])
def get_docs():
    db = SessionLocal()
    docs = db.query(models.QualityDoc).all()
    data = [
        {
            "id": d.id,
            "vehicle_id": d.vehicle_id,
            "title": d.title,
            "type": d.type,
            "path": d.path,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in docs
    ]
    db.close()
    return jsonify(data)


# ---------------- Serve Frontend ----------------
@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def serve_file(path):
    return send_from_directory(app.static_folder, path)


# ---------------- Run ----------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
