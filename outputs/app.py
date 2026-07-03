from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import html
import json
import uuid
from datetime import datetime


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data.json"
HOST = "127.0.0.1"
PORT = 8765

TABS = [
    ("dashboard", "DB", "Dashboard", "Live pipeline health and financial exposure", "Dashboard"),
    ("vendors", "VN", "Vendors", "Vendor onboarding and PO activation", "Vendor Onboarding"),
    ("field", "MB", "Field Logs", "Measurement book capture and executed quantity vaulting", "Field MB Logs"),
    ("wcc", "WC", "WCC", "Passed quantity validation and signature chain", "WCC Approval"),
    ("billing", "IN", "Billing", "Certified milestone invoices and compliance receipts", "Billing & Compliance"),
    ("finance", "FN", "Finance", "Retention holdback and payment release", "PMO Finance"),
]


def uid():
    return str(uuid.uuid4())


def now():
    return datetime.now().isoformat(timespec="seconds")


def money(value):
    try:
        amount = float(value)
    except (TypeError, ValueError):
        amount = 0
    return "INR {:,.0f}".format(amount)


def esc(value):
    return html.escape(str(value or ""))


def seed_state():
    vendor_id = uid()
    po_id = uid()
    log_id = uid()
    wcc_id = uid()
    return {
        "vendors": [
            {
                "id": vendor_id,
                "company": "Suryatech Fabricators Pvt Ltd",
                "gstin": "27AABCS1234F1Z5",
                "pan": "AABCS1234F",
                "email": "accounts@suryatech.example",
                "bank": "HDFC 0091",
                "status": "ACTIVE_EMPANELLED",
            }
        ],
        "pos": [
            {
                "id": po_id,
                "vendorId": vendor_id,
                "number": "PO-2026-0701-1001",
                "item": "Structural steel erection",
                "uom": "MT",
                "totalQty": 250,
                "unitRate": 15000,
                "totalValue": 3750000,
                "blueprint": "GA-STEEL-REV-C.pdf",
                "loiRef": "LOI-RAYS-PMO-2026-014",
                "poTerms": "PMO-HO standard terms, retention 10%, invoice on certified WCC passed quantity",
                "annexureList": "Annexure A BOQ, Annexure B safety, Annexure C billing checklist",
                "signedAnnexures": "Vendor signed PO acceptance and annexures",
                "status": "ACTIVE_EXECUTION",
                "acceptedAt": now(),
            }
        ],
        "logs": [
            {
                "id": log_id,
                "poId": po_id,
                "item": "Structural steel erection",
                "uom": "MT",
                "executedQty": 42,
                "document": "signed-mb-page-019.png",
                "status": "UNVERIFIED_FIELD_LOG",
                "createdAt": now(),
            }
        ],
        "wccs": [
            {
                "id": wcc_id,
                "logId": log_id,
                "serialNo": "1",
                "passedQty": 39.5,
                "siteIncharge": "Rays Site Engineer",
                "qualityReviewer": "Quality Team",
                "verticalLead": "Vertical Lead",
                "conditionNote": "Passed quantity verified against site execution and signed MB page.",
                "sentToVendor": False,
                "signedEngineer": True,
                "signedQuality": True,
                "signedLead": False,
                "status": "QUALITY_APPROVED",
                "createdAt": now(),
            }
        ],
        "invoices": [],
        "compliance": [],
        "ledger": [],
    }


def load_state():
    if not DATA_FILE.exists():
        state = seed_state()
        save_state(state)
        return state
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        state = seed_state()
        save_state(state)
        return state


def save_state(state):
    DATA_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def find(items, item_id):
    return next((item for item in items if item.get("id") == item_id), None)


def vendor_name(state, vendor_id):
    vendor = find(state["vendors"], vendor_id)
    return vendor["company"] if vendor else "Unknown vendor"


def po_by_id(state, po_id):
    return find(state["pos"], po_id)


def log_by_id(state, log_id):
    return find(state["logs"], log_id)


def wcc_by_id(state, wcc_id):
    return find(state["wccs"], wcc_id)


def invoice_by_id(state, invoice_id):
    return find(state["invoices"], invoice_id)


def max_billable(state, wcc):
    log = log_by_id(state, wcc["logId"])
    po = po_by_id(state, log["poId"])
    return float(wcc["passedQty"]) * float(po["unitRate"])


def update_wcc_status(wcc):
    if wcc.get("signedEngineer") and wcc.get("signedQuality") and wcc.get("signedLead"):
        wcc["status"] = "CERTIFIED_MILESTONE"
    elif wcc.get("signedEngineer") and wcc.get("signedQuality"):
        wcc["status"] = "QUALITY_APPROVED"
    elif wcc.get("signedEngineer"):
        wcc["status"] = "ENGINEER_SIGNED"
    else:
        wcc["status"] = "AWAITING_ENGINEER"


def badge(status):
    green = {"ACTIVE_EMPANELLED", "ACTIVE_EXECUTION", "CERTIFIED_MILESTONE", "CLEARED_FOR_BANK_TRANSFER", "APPROVED"}
    blue = {"SUBMITTED_AWAITING_COMPLIANCE", "PENDING_REVIEW", "QUALITY_APPROVED", "ENGINEER_SIGNED"}
    gold = {"DRAFT_ISSUED", "UNVERIFIED_FIELD_LOG", "PENDING_ONBOARDING", "AWAITING_ENGINEER"}
    red = {"REJECTED", "BLOCKED"}
    color = "green" if status in green else "blue" if status in blue else "gold" if status in gold else "red" if status in red else "gray"
    return f'<span class="badge {color}">{esc(status).replace("_", " ")}</span>'


def post_button(action, label, **fields):
    inputs = "".join(f'<input type="hidden" name="{esc(k)}" value="{esc(v)}">' for k, v in fields.items())
    return f'<form method="post" action="/action" class="inline-form"><input type="hidden" name="action" value="{esc(action)}">{inputs}<button>{esc(label)}</button></form>'


def card(title, status, body, actions=""):
    return f"""
    <article class="card">
      <div class="card-head"><strong>{esc(title)}</strong>{badge(status)}</div>
      {body}
      {f'<div class="split-actions">{actions}</div>' if actions else ''}
    </article>
    """


def meta(items):
    return '<div class="meta">' + "".join(f"<div><span>{esc(k)}</span>{v}</div>" for k, v in items) + "</div>"


def render_nav(active):
    items = []
    for key, code, _, _, label in TABS:
        cls = "active" if key == active else ""
        items.append(f'<a class="{cls}" href="/?tab={key}"><span class="ico">{code}</span><span class="nav-label">{esc(label)}</span></a>')
    return "".join(items)


def render_layout(state, tab, message=""):
    tab_meta = next((item for item in TABS if item[0] == tab), TABS[0])
    content = VIEWS.get(tab, view_dashboard)(state)
    toast = f'<div class="toast show">{esc(message)}</div>' if message else '<div class="toast"></div>'
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Industrial Execution Control</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="shell">
    <aside class="rail">
      <div class="brand">
        <div class="mark">IE</div>
        <div><strong>Execution Control</strong><span>PO to bank transfer</span></div>
      </div>
      <nav class="nav">{render_nav(tab)}</nav>
      <div class="rail-foot"><div><b>Python workflow engine</b></div><div>All state transitions run through server-side Python handlers.</div></div>
    </aside>
    <main>
      <div class="topbar">
        <div><h1>{esc(tab_meta[2])}</h1><div class="subtle">{esc(tab_meta[3])}</div></div>
        <div class="actions" style="margin-top:0">
          {post_button("reset", "Reset Demo Data")}
          <a class="button-link secondary" href="/data.json">Export JSON</a>
        </div>
      </div>
      <section>{content}</section>
    </main>
  </div>
  {toast}
</body>
</html>"""


def view_dashboard(state):
    certified = sum(1 for w in state["wccs"] if w["status"] == "CERTIFIED_MILESTONE")
    retention = sum(float(l.get("retention", 0)) for l in state["ledger"])
    done = [
        any(v["status"] == "ACTIVE_EMPANELLED" for v in state["vendors"]),
        any(p["status"] == "ACTIVE_EXECUTION" for p in state["pos"]),
        bool(state["logs"]),
        any(w["status"] == "CERTIFIED_MILESTONE" for w in state["wccs"]),
        any(c["status"] == "APPROVED" for c in state["compliance"]),
        any(i["status"] == "CLEARED_FOR_BANK_TRANSFER" for i in state["invoices"]),
    ]
    steps = "".join(f'<div class="step {"done" if ok else ""}">{name}</div>' for name, ok in zip(["Vendor", "PO", "MB Log", "WCC", "Compliance", "Payment"], done))
    invoices = "".join(invoice_card(state, inv) for inv in state["invoices"][-4:][::-1]) or '<div class="empty">No invoices submitted yet.</div>'
    return f"""
    <div class="grid stats">
      <div class="stat"><span>Active vendors</span><b>{sum(1 for v in state["vendors"] if v["status"] == "ACTIVE_EMPANELLED")}</b></div>
      <div class="stat"><span>Certified WCCs</span><b>{certified}</b></div>
      <div class="stat"><span>Invoices in flow</span><b>{len(state["invoices"])}</b></div>
      <div class="stat"><span>Retention ledger</span><b>{money(retention)}</b></div>
    </div>
    <div class="panel" style="margin-top:16px">
      <h2>Pipeline State Machine</h2>
      <div class="timeline">{steps}</div>
      <div class="process-strip">
        <div><b>1. LOI</b>PMO-HO starts vendor work package and annexure list.</div>
        <div><b>2. PO</b>Purchase order locks PO number, PO quantity, UOM, and rate.</div>
        <div><b>3. Acceptance</b>Vendor accepts PO one time and returns signed annexures.</div>
        <div><b>4. WCC</b>Site team records executed and passed quantity with sign-offs.</div>
        <div><b>5. Billing</b>Vendor raises tax invoice only on WCC passed quantity.</div>
        <div><b>6. HR/PMO</b>Billing checklist, PF proof, ESIC proof, and PMO release.</div>
      </div>
    </div>
    <div class="panel" style="margin-top:16px"><h2>Recent Records</h2><div class="list">{invoices}</div></div>
    """


def view_vendors(state):
    vendor_options = "".join(f'<option value="{v["id"]}">{esc(v["company"])}</option>' for v in state["vendors"])
    po_cards = "".join(po_card(state, po) for po in state["pos"]) or '<div class="empty">No purchase orders yet.</div>'
    return f"""
    <div class="workbench">
      <section class="panel">
        <h2>Onboard Vendor</h2>
        <form method="post" action="/action" class="form-grid">
          <input type="hidden" name="action" value="create_vendor">
          <label class="full">Company Name<input name="company" required></label>
          <label>GSTIN<input name="gstin" required minlength="15" maxlength="15"></label>
          <label>PAN<input name="pan" required minlength="10" maxlength="10"></label>
          <label>Corporate Email<input name="email" type="email" required></label>
          <label>Bank Reference<input name="bank" required></label>
          <button class="full">Create Vendor</button>
        </form>
        <h2 style="margin-top:22px">Generate PO</h2>
        <form method="post" action="/action" class="form-grid">
          <input type="hidden" name="action" value="create_po">
          <label class="full">Vendor<select name="vendorId" required>{vendor_options}</select></label>
          <label>LOI Reference<input name="loiRef" required placeholder="LOI-RAYS-PMO-2026-001"></label>
          <label>Annexure List Format<input name="annexureList" required placeholder="BOQ, safety, billing checklist"></label>
          <label class="full">Item Description<input name="item" required value="Structural steel erection"></label>
          <label>UOM<input name="uom" required value="MT"></label>
          <label>Total Quantity<input name="totalQty" type="number" min="0.01" step="0.01" required></label>
          <label>Unit Rate<input name="unitRate" type="number" min="1" step="0.01" required></label>
          <label class="full">PO Terms<input name="poTerms" required value="Invoice allowed only after certified WCC passed quantity."></label>
          <label class="full">Signed Annexures / PO Acceptance<input name="signedAnnexures" placeholder="Vendor signed annexures received"></label>
          <label>Blueprint Reference<input name="blueprint"></label>
          <button class="full">Issue Draft PO</button>
        </form>
      </section>
      <section class="list">{po_cards}</section>
    </div>
    """


def view_field(state):
    options = "".join(f'<option value="{p["id"]}">{esc(p["number"])} - {esc(p["item"])}</option>' for p in state["pos"] if p["status"] == "ACTIVE_EXECUTION")
    cards = "".join(log_card(state, log) for log in state["logs"]) or '<div class="empty">No field logs captured yet.</div>'
    return f"""
    <div class="workbench">
      <section class="panel">
        <h2>Measurement Book Log</h2>
        <form method="post" action="/action" class="form-grid">
          <input type="hidden" name="action" value="log_mb">
          <label class="full">Active PO<select name="poId" required>{options}</select></label>
          <label>Executed Quantity<input name="executedQty" type="number" min="0.01" step="0.01" required></label>
          <label>Signed MB Page Reference<input name="document" placeholder="signed-mb-page.png"></label>
          <button class="full">Vault Field Log</button>
        </form>
      </section>
      <section class="list">{cards}</section>
    </div>
    """


def view_wcc(state):
    available = [log for log in state["logs"] if not any(w["logId"] == log["id"] for w in state["wccs"])]
    options = "".join(f'<option value="{l["id"]}">{esc(po_by_id(state, l["poId"])["number"])} - executed {esc(l["executedQty"])} {esc(l["uom"])}</option>' for l in available)
    cards = "".join(wcc_card(state, wcc) for wcc in state["wccs"]) or '<div class="empty">No WCC records yet.</div>'
    disabled = "" if available else "disabled"
    return f"""
    <div class="workbench">
      <section class="panel">
        <h2>Create WCC</h2>
        <form method="post" action="/action" class="form-grid">
          <input type="hidden" name="action" value="create_wcc">
          <label class="full">MB Log<select name="logId" required>{options}</select></label>
          <label>S. No.<input name="serialNo" required value="1"></label>
          <label>Passed Quantity<input name="passedQty" type="number" min="0.01" step="0.01" required></label>
          <label>Rays Site Engineer<input name="siteIncharge" required placeholder="Engineer name"></label>
          <label>Quality Reviewer<input name="qualityReviewer" required placeholder="Quality name"></label>
          <label>Vertical Lead<input name="verticalLead" required placeholder="Lead name"></label>
          <label class="full">Site Conditions / Remarks<input name="conditionNote" required placeholder="Passed quantity checked with site execution and MB page"></label>
          <button class="full" {disabled}>Start WCC</button>
        </form>
      </section>
      <section class="list">{cards}</section>
    </div>
    """


def view_billing(state):
    certified = [w for w in state["wccs"] if w["status"] == "CERTIFIED_MILESTONE" and w.get("sentToVendor") and not any(i["wccId"] == w["id"] for i in state["invoices"])]
    wcc_options = "".join(f'<option value="{w["id"]}">{esc(po_by_id(state, log_by_id(state, w["logId"])["poId"])["number"])} - max {money(max_billable(state, w))}</option>' for w in certified)
    invoice_options = "".join(f'<option value="{i["id"]}">{esc(i["number"])} - {money(i["amount"])}</option>' for i in state["invoices"] if i["status"] == "SUBMITTED_AWAITING_COMPLIANCE" and not any(c["invoiceId"] == i["id"] for c in state["compliance"]))
    cards = "".join(invoice_card(state, inv) for inv in state["invoices"]) or '<div class="empty">No invoices submitted yet.</div>'
    return f"""
    <div class="workbench">
      <section class="panel">
        <h2>Submit Invoice</h2>
        <form method="post" action="/action" class="form-grid">
          <input type="hidden" name="action" value="create_invoice">
          <label class="full">Certified WCC Sent To Vendor<select name="wccId" required>{wcc_options}</select></label>
          <label>Invoice Number<input name="number" required></label>
          <label>Invoice Date<input name="date" type="date" required></label>
          <label>Billing Amount<input name="amount" type="number" min="1" step="0.01" required></label>
          <label>Invoice PDF Reference<input name="pdf"></label>
          <label class="full">Billing Checklist Annexure<input name="billingChecklist" required placeholder="Filled billing checklist annexure"></label>
          <button class="full" {"disabled" if not certified else ""}>Submit Invoice</button>
        </form>
        <h2 style="margin-top:22px">Compliance Dropzone</h2>
        <form method="post" action="/action" class="form-grid">
          <input type="hidden" name="action" value="submit_compliance">
          <label class="full">Invoice<select name="invoiceId" required>{invoice_options}</select></label>
          <label>PF ECR Reference<input name="pf" required placeholder="PF-ECR-JUL-2026"></label>
          <label>ESIC Reference<input name="esic" required placeholder="ESIC-JUL-2026"></label>
          <label>Vendor To HR Route<input name="hrRoute" required value="Vendor to HR"></label>
          <label>PMO Loop<input name="pmoLoop" required value="HR compliance to PMO team"></label>
          <button class="full">Submit Compliance</button>
        </form>
      </section>
      <section class="list">{cards}</section>
    </div>
    """


def view_finance(state):
    queue = "".join(compliance_card(state, c) for c in state["compliance"]) or '<div class="empty">No compliance submissions yet.</div>'
    ledger = "".join(ledger_card(l) for l in state["ledger"]) or '<div class="empty">No retention ledger entries yet.</div>'
    return f'<div class="workbench"><section class="panel"><h2>Payment Queue</h2><div class="list">{queue}</div></section><section class="list">{ledger}</section></div>'


def po_card(state, po):
    body = meta([
        ("Vendor", esc(vendor_name(state, po["vendorId"]))),
        ("Quantity", f'{esc(po["totalQty"])} {esc(po["uom"])}'),
        ("Value", money(po["totalValue"])),
        ("LOI", esc(po.get("loiRef", "Not captured"))),
        ("Annexures", esc(po.get("annexureList", "Not captured"))),
        ("PO Terms", esc(po.get("poTerms", "Not captured"))),
    ])
    body += f"""
    <div class="checklist">
      <div><span class="tick">{"Y" if po.get("signedAnnexures") else "!"}</span> Signed annexures: {esc(po.get("signedAnnexures") or "Pending from vendor")}</div>
      <div><span class="tick">{"Y" if po.get("acceptedAt") else "!"}</span> PO acceptance: {"Completed" if po.get("acceptedAt") else "Pending one-time vendor acceptance"}</div>
    </div>
    """
    actions = post_button("accept_po", "Vendor Accept", poId=po["id"]) if po["status"] == "DRAFT_ISSUED" else ""
    return card(po["number"], po["status"], body, actions)


def log_card(state, log):
    po = po_by_id(state, log["poId"])
    body = meta([
        ("Executed", f'{esc(log["executedQty"])} {esc(log["uom"])}'),
        ("Item", esc(log["item"])),
        ("Document", esc(log.get("document") or "No file")),
    ])
    return card(f'{po["number"]} MB Log', log["status"], body)


def wcc_card(state, wcc):
    log = log_by_id(state, wcc["logId"])
    po = po_by_id(state, log["poId"])
    body = meta([
        ("Executed Qty", f'{esc(log["executedQty"])} {esc(log["uom"])}'),
        ("Passed Qty", f'{esc(wcc["passedQty"])} {esc(log["uom"])}'),
        ("Max Billable", money(max_billable(state, wcc))),
        ("Site Engineer", esc(wcc.get("siteIncharge", "Pending"))),
        ("Quality", esc(wcc.get("qualityReviewer", "Pending"))),
        ("Vertical Lead", esc(wcc.get("verticalLead", "Pending"))),
    ])
    body += f"""
    <table class="mini-table">
      <thead><tr><th>S.No</th><th>Desc</th><th>UOM</th><th>PO Qty</th><th>PO No</th><th>Executed Qty</th><th>Passed Qty</th><th>Rays Site Engineer</th></tr></thead>
      <tbody><tr><td>{esc(wcc.get("serialNo", "1"))}</td><td>{esc(log["item"])}</td><td>{esc(log["uom"])}</td><td>{esc(po["totalQty"])}</td><td>{esc(po["number"])}</td><td>{esc(log["executedQty"])}</td><td>{esc(wcc["passedQty"])}</td><td>{esc(wcc.get("siteIncharge", "Pending"))}</td></tr></tbody>
    </table>
    <div class="checklist">
      <div><span class="tick">Y</span> Site conditions: {esc(wcc.get("conditionNote", "Not captured"))}</div>
      <div><span class="tick">{"Y" if wcc.get("sentToVendor") else "!"}</span> WCC to vendor: {"Sent after site team approval" if wcc.get("sentToVendor") else "Pending after certification"}</div>
    </div>
    <div class="timeline">
      <div class="step {'done' if wcc.get('signedEngineer') else ''}">Rays Site Engineer</div>
      <div class="step {'done' if wcc.get('signedQuality') else ''}">Quality</div>
      <div class="step {'done' if wcc.get('signedLead') else ''}">Vertical Lead</div>
    </div>
    """
    if not wcc.get("signedEngineer"):
        actions = post_button("sign_wcc", "Rays Site Engineer Sign", wccId=wcc["id"])
    elif not wcc.get("signedQuality"):
        actions = post_button("sign_wcc", "Quality Sign", wccId=wcc["id"])
    elif not wcc.get("signedLead"):
        actions = post_button("sign_wcc", "Vertical Lead Sign", wccId=wcc["id"])
    elif wcc["status"] == "CERTIFIED_MILESTONE" and not wcc.get("sentToVendor"):
        actions = post_button("send_wcc", "Send WCC To Vendor", wccId=wcc["id"])
    else:
        actions = ""
    return card(f'{po["number"]} WCC', wcc["status"], body, actions)


def invoice_card(state, inv):
    wcc = wcc_by_id(state, inv["wccId"])
    po = po_by_id(state, log_by_id(state, wcc["logId"])["poId"])
    body = meta([
        ("Billing", money(inv["amount"])),
        ("Max Allowed", money(inv["maxBillable"])),
        ("Invoice PDF", esc(inv.get("pdf") or "No file")),
        ("Billing Checklist", esc(inv.get("billingChecklist", "Not captured"))),
        ("Based On", "WCC passed quantity"),
        ("Vendor Step", "Tax invoice submitted"),
    ])
    return card(f'{inv["number"]} - {po["number"]}', inv["status"], body)


def compliance_card(state, comp):
    inv = invoice_by_id(state, comp["invoiceId"])
    body = meta([
        ("PF ECR", esc(comp["pf"])),
        ("ESIC", esc(comp["esic"])),
        ("Invoice", money(inv["amount"])),
        ("HR Route", esc(comp.get("hrRoute", "Vendor to HR"))),
        ("PMO Loop", esc(comp.get("pmoLoop", "HR compliance to PMO team"))),
        ("Checklist", esc(inv.get("billingChecklist", "Not captured"))),
    ])
    if comp["status"] == "PENDING_REVIEW":
        actions = post_button("approve_compliance", "Approve Compliance", complianceId=comp["id"])
    elif inv["status"] != "CLEARED_FOR_BANK_TRANSFER":
        actions = post_button("release_payment", "Release Payment", invoiceId=inv["id"])
    else:
        actions = ""
    return card(f'{inv["number"]} Compliance', comp["status"], body, actions)


def ledger_card(item):
    body = meta([
        ("Gross", money(item["gross"])),
        ("Retention 10%", money(item["retention"])),
        ("Net Payable", money(item["net"])),
    ])
    return card(f'Retention {item["invoiceNumber"]}', "CLEARED_FOR_BANK_TRANSFER", body)


VIEWS = {
    "dashboard": view_dashboard,
    "vendors": view_vendors,
    "field": view_field,
    "wcc": view_wcc,
    "billing": view_billing,
    "finance": view_finance,
}


def first(form, key, default=""):
    return form.get(key, [default])[0].strip()


def number(value):
    return float(value or 0)


def handle_action(state, form):
    action = first(form, "action")
    if action == "reset":
        state = seed_state()
        save_state(state)
        return state, "Demo data reset.", "dashboard"

    if action == "create_vendor":
        gstin = first(form, "gstin").upper()
        if any(v["gstin"] == gstin for v in state["vendors"]):
            return state, "Duplicate GSTIN blocked.", "vendors"
        state["vendors"].append({
            "id": uid(),
            "company": first(form, "company"),
            "gstin": gstin,
            "pan": first(form, "pan").upper(),
            "email": first(form, "email"),
            "bank": first(form, "bank"),
            "status": "PENDING_ONBOARDING",
        })
        tab, msg = "vendors", "Vendor created in PENDING_ONBOARDING."

    elif action == "create_po":
        qty = number(first(form, "totalQty"))
        rate = number(first(form, "unitRate"))
        state["pos"].append({
            "id": uid(),
            "vendorId": first(form, "vendorId"),
            "number": f"PO-{datetime.now().year}-{len(state['pos']) + 1001:04d}",
            "item": first(form, "item"),
            "uom": first(form, "uom"),
            "totalQty": qty,
            "unitRate": rate,
            "totalValue": qty * rate,
            "blueprint": first(form, "blueprint"),
            "loiRef": first(form, "loiRef"),
            "poTerms": first(form, "poTerms"),
            "annexureList": first(form, "annexureList"),
            "signedAnnexures": first(form, "signedAnnexures"),
            "status": "DRAFT_ISSUED",
            "acceptedAt": "",
        })
        tab, msg = "vendors", "Draft PO issued."

    elif action == "accept_po":
        po = po_by_id(state, first(form, "poId"))
        if not po:
            return state, "PO not found.", "vendors"
        if not po.get("signedAnnexures"):
            return state, "PO acceptance blocked until signed annexures are captured.", "vendors"
        vendor = find(state["vendors"], po["vendorId"])
        vendor["status"] = "ACTIVE_EMPANELLED"
        po["status"] = "ACTIVE_EXECUTION"
        po["acceptedAt"] = now()
        tab, msg = "vendors", "PO accepted and vendor activated."

    elif action == "log_mb":
        po = po_by_id(state, first(form, "poId"))
        if not po:
            return state, "No active PO available.", "field"
        state["logs"].append({
            "id": uid(),
            "poId": po["id"],
            "item": po["item"],
            "uom": po["uom"],
            "executedQty": number(first(form, "executedQty")),
            "document": first(form, "document"),
            "status": "UNVERIFIED_FIELD_LOG",
            "createdAt": now(),
        })
        tab, msg = "field", "Measurement book log vaulted."

    elif action == "create_wcc":
        log = log_by_id(state, first(form, "logId"))
        passed = number(first(form, "passedQty"))
        if not log:
            return state, "No MB log available.", "wcc"
        if passed > float(log["executedQty"]):
            return state, "Blocked: passed quantity cannot exceed executed quantity.", "wcc"
        state["wccs"].append({
            "id": uid(),
            "logId": log["id"],
            "serialNo": first(form, "serialNo"),
            "passedQty": passed,
            "siteIncharge": first(form, "siteIncharge"),
            "qualityReviewer": first(form, "qualityReviewer"),
            "verticalLead": first(form, "verticalLead"),
            "conditionNote": first(form, "conditionNote"),
            "sentToVendor": False,
            "signedEngineer": False,
            "signedQuality": False,
            "signedLead": False,
            "status": "AWAITING_ENGINEER",
            "createdAt": now(),
        })
        tab, msg = "wcc", "WCC started."

    elif action == "sign_wcc":
        wcc = wcc_by_id(state, first(form, "wccId"))
        if not wcc:
            return state, "WCC not found.", "wcc"
        if not wcc.get("signedEngineer"):
            wcc["signedEngineer"] = True
        elif not wcc.get("signedQuality"):
            wcc["signedQuality"] = True
        elif not wcc.get("signedLead"):
            wcc["signedLead"] = True
        update_wcc_status(wcc)
        tab, msg = "wcc", f"WCC status: {wcc['status'].replace('_', ' ')}."

    elif action == "send_wcc":
        wcc = wcc_by_id(state, first(form, "wccId"))
        if not wcc or wcc["status"] != "CERTIFIED_MILESTONE":
            return state, "WCC can be sent only after vertical lead certification.", "wcc"
        wcc["sentToVendor"] = True
        tab, msg = "wcc", "Certified WCC sent to vendor for tax invoice."

    elif action == "create_invoice":
        wcc = wcc_by_id(state, first(form, "wccId"))
        amount = number(first(form, "amount"))
        if not wcc or wcc["status"] != "CERTIFIED_MILESTONE":
            return state, "Invoice blocked until WCC is certified.", "billing"
        if not wcc.get("sentToVendor"):
            return state, "Invoice blocked until certified WCC is sent to vendor.", "billing"
        maximum = max_billable(state, wcc)
        if amount > maximum:
            return state, "Invoice amount blocked: exceeds WCC max billable amount.", "billing"
        state["invoices"].append({
            "id": uid(),
            "wccId": wcc["id"],
            "number": first(form, "number"),
            "date": first(form, "date"),
            "amount": amount,
            "maxBillable": maximum,
            "pdf": first(form, "pdf"),
            "billingChecklist": first(form, "billingChecklist"),
            "status": "SUBMITTED_AWAITING_COMPLIANCE",
        })
        tab, msg = "billing", "Invoice submitted for compliance."

    elif action == "submit_compliance":
        inv = invoice_by_id(state, first(form, "invoiceId"))
        if not inv:
            return state, "No invoice awaiting compliance.", "billing"
        state["compliance"].append({
            "id": uid(),
            "invoiceId": inv["id"],
            "pf": first(form, "pf"),
            "esic": first(form, "esic"),
            "hrRoute": first(form, "hrRoute"),
            "pmoLoop": first(form, "pmoLoop"),
            "status": "PENDING_REVIEW",
        })
        tab, msg = "billing", "Compliance documents submitted."

    elif action == "approve_compliance":
        comp = find(state["compliance"], first(form, "complianceId"))
        if comp:
            comp["status"] = "APPROVED"
        tab, msg = "finance", "Compliance approved."

    elif action == "release_payment":
        inv = invoice_by_id(state, first(form, "invoiceId"))
        comp = next((c for c in state["compliance"] if inv and c["invoiceId"] == inv["id"]), None)
        if not inv or not comp or comp["status"] != "APPROVED":
            return state, "Payment blocked until compliance is approved.", "finance"
        retention = float(inv["amount"]) * 0.10
        inv["retention"] = retention
        inv["netPayable"] = float(inv["amount"]) - retention
        inv["status"] = "CLEARED_FOR_BANK_TRANSFER"
        state["ledger"].append({
            "id": uid(),
            "invoiceId": inv["id"],
            "invoiceNumber": inv["number"],
            "gross": inv["amount"],
            "retention": retention,
            "net": inv["netPayable"],
            "createdAt": now(),
        })
        tab, msg = "finance", "Payment released and retention ledger written."

    else:
        tab, msg = "dashboard", "Unknown action."

    save_state(state)
    return state, msg, tab


class AppHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/styles.css":
            self.send_file(BASE_DIR / "styles.css", "text/css")
            return
        if parsed.path == "/data.json":
            self.send_file(DATA_FILE, "application/json")
            return
        state = load_state()
        params = parse_qs(parsed.query)
        tab = params.get("tab", ["dashboard"])[0]
        message = params.get("message", [""])[0]
        if tab not in VIEWS:
            tab = "dashboard"
        self.send_html(render_layout(state, tab, message))

    def do_POST(self):
        if urlparse(self.path).path != "/action":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8")
        form = parse_qs(body)
        state, message, tab = handle_action(load_state(), form)
        self.send_response(303)
        self.send_header("Location", f"/?tab={tab}&message={html.escape(message)}")
        self.end_headers()

    def send_file(self, path, content_type):
        if not path.exists():
            self.send_error(404)
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_html(self, html_text):
        data = html_text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    load_state()
    print(f"Python app running at http://{HOST}:{PORT}/")
    HTTPServer((HOST, PORT), AppHandler).serve_forever()
