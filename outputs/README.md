# Industrial Execution Control Web App

This is a static web app for the Rays-style PO to WCC to invoice workflow.

## Files

- `index.html` - Page shell and app mount point.
- `styles.css` - Corporate black/yellow theme and responsive layout.
- `app.js` - Data model, workflow logic, forms, validations, and localStorage persistence.

## Run

Open `index.html` directly in a browser, or serve this folder locally:

```bash
python -m http.server 8765 --directory outputs
```

Then open:

```text
http://127.0.0.1:8765/index.html
```

Use **Reset Demo Data** inside the app if old browser data is still cached.
