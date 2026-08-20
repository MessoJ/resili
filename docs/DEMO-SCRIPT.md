# Demo Script

## Setup (before the demo)

```bash
# Option A: Full Docker (recommended for judges)
cd infrastructure
docker compose up -d

# Option B: Local development
# Terminal 1: Python ML service
cd services/forecast-ingest
pip install -e .
python -m src.model.train
uvicorn src.api.serve:app --host 0.0.0.0 --port 8001

# Terminal 2: Go API gateway
cd services/gateway
go run ./cmd/server

# Terminal 3: Operations Console portal
cd apps/command-centre
npm run dev
```

---

## Demo Flow (8-10 minutes)

### Scene 1: The Problem (1 minute)

Open the Operations Console portal. The map shows 5 wards around Lake
Victoria. Two are red (Nyando, Budalangi), one orange (Nzoia), one
yellow (Kano), one green (Rachuonyo).

> "This is the Rezili Operations Console. Each ward on this map has a live
> risk score. Nyando is red — score 82 out of 100, severe band. But
> what does that number mean? Let me click on it."

### Scene 2: Explainable Risk (2 minutes)

Click the Nyando ward. The detail panel shows:
- Score: 82 (severe)
- Top contributors:
  - 3-day precipitation forecast: 28.5 points
  - River discharge ratio: 22.1 points
  - Ward vulnerability: 15.3 points
- Lead time: 4 days
- Data source: GloFAS + CHIRPS + Open-Meteo

> "Every number here is traceable. The 3-day precipitation forecast
> comes from Open-Meteo, which mirrors ECMWF data. The discharge ratio
> comes from GloFAS — the river is at 1.9 times its long-term average.
> And the ward vulnerability score reflects that 72% of Nyando is in
> the flood plain and 58% of households are below the poverty line.
>
> This is not a black box. If a county officer asks 'why is Nyando
> severe?', the system shows exactly why."

### Scene 3: The ML Model (1 minute)

Hit the API directly:

```bash
curl http://localhost:8001/predict -X POST \
  -H "Content-Type: application/json" \
  -d '{"ward_id": "KE-039-NYANDO"}'
```

> "Under the hood, we trained an XGBoost model on 500 labelled
> observations calibrated to real Nyando catchment statistics. The
> model takes 11 features — precipitation, discharge, soil moisture,
> exposure, vulnerability — and outputs a probability of flood impact.
> We got 85% accuracy and 0.90 AUC-ROC on held-out data."

### Scene 4: Trigger + Approval (2 minutes)

Go to the Trigger panel in the dashboard.

> "Now the score is 82 and lead time is 4 days. That meets our trigger
> threshold. But we can't just send money — that would be reckless.
> Rezili requires two-person approval."

Show the approval workflow:
1. County officer approves
2. NDMA observer approves
3. Trigger becomes eligible
4. Payout receipt generated with idempotency key

> "Notice two things: the decision hash in the audit trail, and the
> idempotency key. If someone hits 'approve' twice, the same payout
> is returned — no double payment."

### Scene 5: USSD Access (1 minute)

Hit the USSD endpoint:

```bash
curl http://localhost:8080/api/v1/ussd -X POST \
  -d "sessionId=demo&phoneNumber=+254712345678&text="
```

> "Not everyone has a smartphone. This USSD menu works on any phone.
> Press 1 for flood risk — you get the same ward-level information in
> Swahili. Notice it says 'uwezekano' — probability — not 'itafanya' —
> it will. And it attributes KMD and NDMA. We never impersonate
> authorities."

### Scene 6: Audit Ledger (1 minute)

```bash
curl http://localhost:8080/api/v1/ledger
```

> "Every decision in the system — risk scored, trigger approved,
> payout sent — is recorded in a hash chain. Each event's hash
> includes the previous event's hash. If anyone changes a record,
> the chain breaks. This is our blockchain-for-sustainability
> bonus category: transparency without the gas fees."

### Scene 7: CAP 1.2 Alert (30 seconds)

```bash
curl http://localhost:8080/api/v1/alerts -H "Accept: application/cap+xml"
```

> "We export alerts in CAP 1.2 — the international standard used by
> WMO, NDMA, and the Common Alerting Protocol. Any system that reads
> CAP can consume our alerts."

### Scene 8: Safety (30 seconds)

> "Finally — we track the carbon footprint of our own ML inference.
> Every prediction's compute cost is logged. And our safety docs
> commit to open-source, probabilistic language, and never
> impersonating warning authorities."
