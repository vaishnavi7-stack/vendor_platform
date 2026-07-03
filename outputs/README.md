# Industrial Execution Control Python Web App

This is a Python web app for the Rays-style PO to WCC to invoice workflow.

## Files

- `app.py` - Python web server, workflow logic, validations, page rendering, and data persistence.
- `styles.css` - Corporate black/yellow theme and responsive layout.
- `index.html` - Small landing page that points to the Python app.
- `data.json` - Created automatically when the app runs. Stores vendors, POs, MB logs, WCCs, invoices, compliance records, and retention ledger entries.

## Run

From this folder, run either:

```bash
python app.py
```

Or, if `python` is not on PATH on this machine:

```powershell
.\run_app.ps1
```

Then open:

```text
http://127.0.0.1:8765/
```

## Workflow Covered

- Vendor onboarding
- LOI, PO, PO terms, and signed annexures
- Measurement Book logging
- WCC table with executed and passed quantity validation
- Rays Site Engineer, Quality, and Vertical Lead sign-off
- Certified WCC sent to vendor
- Tax invoice limited by WCC passed quantity
- Billing checklist and HR compliance
- PF and ESIC proof tracking
- PMO approval, 10% retention, and payment release
