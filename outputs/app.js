const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const storeKey = "industrialExecutionControl.v1";

const tabs = [
  ["dashboard", "DB", "Dashboard", "Live pipeline health and financial exposure", "Dashboard"],
  ["vendors", "VN", "Vendors", "Vendor onboarding and PO activation", "Vendor Onboarding"],
  ["field", "MB", "Field Logs", "Measurement book capture and executed quantity vaulting", "Field MB Logs"],
  ["wcc", "WC", "WCC", "Passed quantity validation and signature chain", "WCC Approval"],
  ["billing", "IN", "Billing", "Certified milestone invoices and compliance receipts", "Billing & Compliance"],
  ["finance", "FN", "Finance", "Retention holdback and payment release", "PMO Finance"]
];

let currentTab = "dashboard";
let state = load();

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function initialState() {
  return { vendors: [], pos: [], logs: [], wccs: [], invoices: [], compliance: [], ledger: [] };
}

function seedState() {
  const s = initialState();
  const vendor = {
    id: id(),
    company: "Suryatech Fabricators Pvt Ltd",
    gstin: "27AABCS1234F1Z5",
    pan: "AABCS1234F",
    email: "accounts@suryatech.example",
    bank: "HDFC 0091",
    status: "ACTIVE_EMPANELLED"
  };
  const po = {
    id: id(),
    vendorId: vendor.id,
    number: "PO-2026-0701-1001",
    item: "Structural steel erection",
    uom: "MT",
    totalQty: 250,
    unitRate: 15000,
    totalValue: 3750000,
    blueprint: "GA-STEEL-REV-C.pdf",
    loiRef: "LOI-RAYS-PMO-2026-014",
    poTerms: "PMO-HO standard terms, retention 10%, invoice on certified WCC passed quantity",
    annexureList: "Annexure A BOQ, Annexure B safety, Annexure C billing checklist",
    signedAnnexures: "Vendor signed PO acceptance and annexures",
    status: "ACTIVE_EXECUTION",
    acceptedAt: now()
  };
  const log = {
    id: id(),
    poId: po.id,
    item: po.item,
    uom: po.uom,
    executedQty: 42,
    document: "signed-mb-page-019.png",
    status: "UNVERIFIED_FIELD_LOG",
    createdAt: now()
  };
  const wcc = {
    id: id(),
    logId: log.id,
    serialNo: "1",
    passedQty: 39.5,
    siteIncharge: "Rays Site Engineer",
    qualityReviewer: "Quality Team",
    verticalLead: "Vertical Lead",
    conditionNote: "Passed quantity verified against site execution and signed MB page.",
    sentToVendor: false,
    signedEngineer: true,
    signedQuality: true,
    signedLead: false,
    status: "QUALITY_APPROVED",
    createdAt: now()
  };
  s.vendors.push(vendor);
  s.pos.push(po);
  s.logs.push(log);
  s.wccs.push(wcc);
  save(s);
  return s;
}

function load() {
  const raw = localStorage.getItem(storeKey);
  if (!raw) return seedState();
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return seedState();
  }
}

function save(next = state) {
  localStorage.setItem(storeKey, JSON.stringify(next));
}

function migrate(s) {
  s.vendors ||= [];
  s.pos ||= [];
  s.logs ||= [];
  s.wccs ||= [];
  s.invoices ||= [];
  s.compliance ||= [];
  s.ledger ||= [];
  s.pos.forEach(po => {
    po.loiRef ||= "LOI pending";
    po.poTerms ||= "Invoice allowed only after certified WCC passed quantity.";
    po.annexureList ||= "BOQ, billing checklist, HR compliance";
    po.signedAnnexures ||= po.acceptedAt ? "Signed annexures received" : "";
  });
  s.wccs.forEach(wcc => {
    wcc.serialNo ||= "1";
    wcc.siteIncharge ||= "Rays Site Engineer";
    wcc.qualityReviewer ||= "Quality Team";
    wcc.verticalLead ||= "Vertical Lead";
    wcc.conditionNote ||= "Site execution verified against MB entry.";
    wcc.sentToVendor = Boolean(wcc.sentToVendor);
  });
  s.invoices.forEach(inv => {
    inv.billingChecklist ||= "Billing checklist annexure pending";
  });
  s.compliance.forEach(c => {
    c.hrRoute ||= "Vendor to HR";
    c.pmoLoop ||= "HR compliance to PMO team";
  });
  save(s);
  return s;
}

function byId(list, itemId) {
  return list.find(item => item.id === itemId);
}

function vendorName(vendorId) {
  return byId(state.vendors, vendorId)?.company || "Unknown vendor";
}

function poById(poId) {
  return byId(state.pos, poId);
}

function logById(logId) {
  return byId(state.logs, logId);
}

function wccById(wccId) {
  return byId(state.wccs, wccId);
}

function invoiceById(invoiceId) {
  return byId(state.invoices, invoiceId);
}

function maxBillable(wcc) {
  const log = logById(wcc.logId);
  const po = poById(log.poId);
  return Number(wcc.passedQty) * Number(po.unitRate);
}

function updateWccStatus(wcc) {
  if (wcc.signedEngineer && wcc.signedQuality && wcc.signedLead) wcc.status = "CERTIFIED_MILESTONE";
  else if (wcc.signedEngineer && wcc.signedQuality) wcc.status = "QUALITY_APPROVED";
  else if (wcc.signedEngineer) wcc.status = "ENGINEER_SIGNED";
  else wcc.status = "AWAITING_ENGINEER";
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function fileName(input) {
  return input.files && input.files[0] ? input.files[0].name : "";
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
}

function statusBadge(status) {
  const green = ["ACTIVE_EMPANELLED", "ACTIVE_EXECUTION", "CERTIFIED_MILESTONE", "CLEARED_FOR_BANK_TRANSFER", "APPROVED"];
  const blue = ["SUBMITTED_AWAITING_COMPLIANCE", "PENDING_REVIEW", "QUALITY_APPROVED", "ENGINEER_SIGNED"];
  const gold = ["DRAFT_ISSUED", "UNVERIFIED_FIELD_LOG", "PENDING_ONBOARDING", "AWAITING_ENGINEER"];
  const red = ["REJECTED", "BLOCKED"];
  const color = green.includes(status) ? "green" : blue.includes(status) ? "blue" : gold.includes(status) ? "gold" : red.includes(status) ? "red" : "gray";
  return `<span class="badge ${color}">${status.replaceAll("_", " ")}</span>`;
}

function renderNav() {
  document.getElementById("nav").innerHTML = tabs.map(t => `
    <button class="${currentTab === t[0] ? "active" : ""}" data-tab="${t[0]}">
      <span class="ico">${t[1]}</span><span class="nav-label">${t[4]}</span>
    </button>
  `).join("");
  document.querySelectorAll("[data-tab]").forEach(button => {
    button.onclick = () => {
      currentTab = button.dataset.tab;
      render();
    };
  });
}

function render() {
  renderNav();
  const tab = tabs.find(t => t[0] === currentTab) || tabs[0];
  document.getElementById("pageTitle").textContent = tab[2];
  document.getElementById("pageSubtitle").textContent = tab[3];
  document.getElementById("app").innerHTML = views[currentTab]();
  binders[currentTab]();
}

function card(title, status, body, actions = "") {
  return `<article class="card">
    <div class="card-head"><strong>${title}</strong>${statusBadge(status)}</div>
    ${body}
    ${actions ? `<div class="split-actions">${actions}</div>` : ""}
  </article>`;
}

function meta(items) {
  return `<div class="meta">${items.map(([label, value]) => `<div><span>${label}</span>${value}</div>`).join("")}</div>`;
}

const views = {
  dashboard() {
    const certified = state.wccs.filter(w => w.status === "CERTIFIED_MILESTONE").length;
    const retention = state.ledger.reduce((sum, item) => sum + Number(item.retention || 0), 0);
    const done = [
      state.vendors.some(v => v.status === "ACTIVE_EMPANELLED"),
      state.pos.some(p => p.status === "ACTIVE_EXECUTION"),
      state.logs.length > 0,
      state.wccs.some(w => w.status === "CERTIFIED_MILESTONE"),
      state.compliance.some(c => c.status === "APPROVED"),
      state.invoices.some(i => i.status === "CLEARED_FOR_BANK_TRANSFER")
    ];
    return `
      <div class="grid stats">
        <div class="stat"><span>Active vendors</span><b>${state.vendors.filter(v => v.status === "ACTIVE_EMPANELLED").length}</b></div>
        <div class="stat"><span>Certified WCCs</span><b>${certified}</b></div>
        <div class="stat"><span>Invoices in flow</span><b>${state.invoices.length}</b></div>
        <div class="stat"><span>Retention ledger</span><b>${INR.format(retention)}</b></div>
      </div>
      <div class="panel" style="margin-top:16px">
        <h2>Pipeline State Machine</h2>
        <div class="timeline">${["Vendor", "PO", "MB Log", "WCC", "Compliance", "Payment"].map((name, i) => `<div class="step ${done[i] ? "done" : ""}">${name}</div>`).join("")}</div>
        <div class="process-strip">
          <div><b>1. LOI</b>PMO-HO starts vendor work package and annexure list.</div>
          <div><b>2. PO</b>Purchase order locks PO number, PO quantity, UOM, and rate.</div>
          <div><b>3. Acceptance</b>Vendor accepts PO one time and returns signed annexures.</div>
          <div><b>4. WCC</b>Site team records executed and passed quantity with sign-offs.</div>
          <div><b>5. Billing</b>Vendor raises tax invoice only on WCC passed quantity.</div>
          <div><b>6. HR/PMO</b>Billing checklist, PF proof, ESIC proof, and PMO release.</div>
        </div>
      </div>
      <div class="panel" style="margin-top:16px">
        <h2>Recent Records</h2>
        <div class="list">${state.invoices.length ? state.invoices.slice(-4).reverse().map(invoiceCard).join("") : `<div class="empty">No invoices submitted yet.</div>`}</div>
      </div>
    `;
  },
  vendors() {
    return `
      <div class="workbench">
        <section class="panel">
          <h2>Onboard Vendor</h2>
          <form id="vendorForm" class="form-grid">
            <label class="full">Company Name<input name="company" required></label>
            <label>GSTIN<input name="gstin" required minlength="15" maxlength="15"></label>
            <label>PAN<input name="pan" required minlength="10" maxlength="10"></label>
            <label>Corporate Email<input name="email" type="email" required></label>
            <label>Bank Reference<input name="bank" required></label>
            <button class="full">Create Vendor</button>
          </form>
          <h2 style="margin-top:22px">Generate PO</h2>
          <form id="poForm" class="form-grid">
            <label class="full">Vendor<select name="vendorId" required>${state.vendors.map(v => `<option value="${v.id}">${v.company}</option>`).join("")}</select></label>
            <label>LOI Reference<input name="loiRef" required placeholder="LOI-RAYS-PMO-2026-001"></label>
            <label>Annexure List Format<input name="annexureList" required placeholder="BOQ, safety, billing checklist"></label>
            <label class="full">Item Description<input name="item" required value="Structural steel erection"></label>
            <label>UOM<input name="uom" required value="MT"></label>
            <label>Total Quantity<input name="totalQty" type="number" min="0.01" step="0.01" required></label>
            <label>Unit Rate<input name="unitRate" type="number" min="1" step="0.01" required></label>
            <label class="full">PO Terms<input name="poTerms" required value="Invoice allowed only after certified WCC passed quantity."></label>
            <label class="full">Signed Annexures / PO Acceptance<input name="signedAnnexures" placeholder="Vendor signed annexures received"></label>
            <label>Blueprint File<input name="blueprint" type="file"></label>
            <button class="full">Issue Draft PO</button>
          </form>
        </section>
        <section class="list">${state.pos.length ? state.pos.map(poCard).join("") : `<div class="empty">No purchase orders yet.</div>`}</section>
      </div>`;
  },
  field() {
    return `
      <div class="workbench">
        <section class="panel">
          <h2>Measurement Book Log</h2>
          <form id="logForm" class="form-grid">
            <label class="full">Active PO<select name="poId" required>${state.pos.filter(p => p.status === "ACTIVE_EXECUTION").map(p => `<option value="${p.id}">${p.number} - ${p.item}</option>`).join("")}</select></label>
            <label>Executed Quantity<input name="executedQty" type="number" min="0.01" step="0.01" required></label>
            <label>Signed MB Page<input name="document" type="file"></label>
            <button class="full">Vault Field Log</button>
          </form>
        </section>
        <section class="list">${state.logs.length ? state.logs.map(logCard).join("") : `<div class="empty">No field logs captured yet.</div>`}</section>
      </div>`;
  },
  wcc() {
    const available = state.logs.filter(log => !state.wccs.some(w => w.logId === log.id));
    return `
      <div class="workbench">
        <section class="panel">
          <h2>Create WCC</h2>
          <form id="wccForm" class="form-grid">
            <label class="full">MB Log<select name="logId" required>${available.map(l => `<option value="${l.id}">${poById(l.poId).number} - executed ${l.executedQty} ${l.uom}</option>`).join("")}</select></label>
            <label>S. No.<input name="serialNo" required value="1"></label>
            <label>Passed Quantity<input name="passedQty" type="number" min="0.01" step="0.01" required></label>
            <label>Rays Site Engineer<input name="siteIncharge" required placeholder="Engineer name"></label>
            <label>Quality Reviewer<input name="qualityReviewer" required placeholder="Quality name"></label>
            <label>Vertical Lead<input name="verticalLead" required placeholder="Lead name"></label>
            <label class="full">Site Conditions / Remarks<input name="conditionNote" required placeholder="Passed quantity checked with site execution and MB page"></label>
            <button class="full" ${available.length ? "" : "disabled"}>Start WCC</button>
          </form>
        </section>
        <section class="list">${state.wccs.length ? state.wccs.map(wccCard).join("") : `<div class="empty">No WCC records yet.</div>`}</section>
      </div>`;
  },
  billing() {
    const certified = state.wccs.filter(w => w.status === "CERTIFIED_MILESTONE" && w.sentToVendor && !state.invoices.some(i => i.wccId === w.id));
    const awaiting = state.invoices.filter(i => i.status === "SUBMITTED_AWAITING_COMPLIANCE" && !state.compliance.some(c => c.invoiceId === i.id));
    return `
      <div class="workbench">
        <section class="panel">
          <h2>Submit Invoice</h2>
          <form id="invoiceForm" class="form-grid">
            <label class="full">Certified WCC Sent To Vendor<select name="wccId" required>${certified.map(w => `<option value="${w.id}">${poById(logById(w.logId).poId).number} - max ${INR.format(maxBillable(w))}</option>`).join("")}</select></label>
            <label>Invoice Number<input name="number" required></label>
            <label>Invoice Date<input name="date" type="date" required></label>
            <label>Billing Amount<input name="amount" type="number" min="1" step="0.01" required></label>
            <label>Invoice PDF<input name="pdf" type="file"></label>
            <label class="full">Billing Checklist Annexure<input name="billingChecklist" required placeholder="Filled billing checklist annexure"></label>
            <button class="full" ${certified.length ? "" : "disabled"}>Submit Invoice</button>
          </form>
          <h2 style="margin-top:22px">Compliance Dropzone</h2>
          <form id="complianceForm" class="form-grid">
            <label class="full">Invoice<select name="invoiceId" required>${awaiting.map(i => `<option value="${i.id}">${i.number} - ${INR.format(i.amount)}</option>`).join("")}</select></label>
            <label>PF ECR Receipt<input name="pf" type="file"></label>
            <label>ESIC Receipt<input name="esic" type="file"></label>
            <label>PF ECR Reference<input name="pfRef" placeholder="PF-ECR-JUL-2026"></label>
            <label>ESIC Reference<input name="esicRef" placeholder="ESIC-JUL-2026"></label>
            <label>Vendor To HR Route<input name="hrRoute" required value="Vendor to HR"></label>
            <label>PMO Loop<input name="pmoLoop" required value="HR compliance to PMO team"></label>
            <button class="full">Submit Compliance</button>
          </form>
        </section>
        <section class="list">${state.invoices.length ? state.invoices.map(invoiceCard).join("") : `<div class="empty">No invoices submitted yet.</div>`}</section>
      </div>`;
  },
  finance() {
    return `
      <div class="workbench">
        <section class="panel"><h2>Payment Queue</h2><div class="list">${state.compliance.length ? state.compliance.map(complianceCard).join("") : `<div class="empty">No compliance submissions yet.</div>`}</div></section>
        <section class="list">${state.ledger.length ? state.ledger.map(ledgerCard).join("") : `<div class="empty">No retention ledger entries yet.</div>`}</section>
      </div>`;
  }
};

function poCard(po) {
  const body = meta([
    ["Vendor", vendorName(po.vendorId)],
    ["Quantity", `${po.totalQty} ${po.uom}`],
    ["Value", INR.format(po.totalValue)],
    ["LOI", po.loiRef || "Not captured"],
    ["Annexures", po.annexureList || "Not captured"],
    ["PO Terms", po.poTerms || "Not captured"]
  ]) + `
    <div class="checklist">
      <div><span class="tick">${po.signedAnnexures ? "Y" : "!"}</span> Signed annexures: ${po.signedAnnexures || "Pending from vendor"}</div>
      <div><span class="tick">${po.acceptedAt ? "Y" : "!"}</span> PO acceptance: ${po.acceptedAt ? "Completed" : "Pending one-time vendor acceptance"}</div>
    </div>`;
  const actions = po.status === "DRAFT_ISSUED" ? `<button data-accept-po="${po.id}">Vendor Accept</button>` : "";
  return card(po.number, po.status, body, actions);
}

function logCard(log) {
  const po = poById(log.poId);
  return card(`${po.number} MB Log`, log.status, meta([
    ["Executed", `${log.executedQty} ${log.uom}`],
    ["Item", log.item],
    ["Document", log.document || "No file"]
  ]));
}

function wccCard(wcc) {
  const log = logById(wcc.logId);
  const po = poById(log.poId);
  const next = !wcc.signedEngineer ? "Rays Site Engineer Sign" : !wcc.signedQuality ? "Quality Sign" : !wcc.signedLead ? "Vertical Lead Sign" : "";
  const send = wcc.status === "CERTIFIED_MILESTONE" && !wcc.sentToVendor ? `<button data-send-wcc="${wcc.id}">Send WCC To Vendor</button>` : "";
  const body = meta([
    ["Executed Qty", `${log.executedQty} ${log.uom}`],
    ["Passed Qty", `${wcc.passedQty} ${log.uom}`],
    ["Max Billable", INR.format(maxBillable(wcc))],
    ["Site Engineer", wcc.siteIncharge || "Pending"],
    ["Quality", wcc.qualityReviewer || "Pending"],
    ["Vertical Lead", wcc.verticalLead || "Pending"]
  ]) + `
    <table class="mini-table">
      <thead><tr><th>S.No</th><th>Desc</th><th>UOM</th><th>PO Qty</th><th>PO No</th><th>Executed Qty</th><th>Passed Qty</th><th>Rays Site Engineer</th></tr></thead>
      <tbody><tr><td>${wcc.serialNo || "1"}</td><td>${log.item}</td><td>${log.uom}</td><td>${po.totalQty}</td><td>${po.number}</td><td>${log.executedQty}</td><td>${wcc.passedQty}</td><td>${wcc.siteIncharge || "Pending"}</td></tr></tbody>
    </table>
    <div class="checklist">
      <div><span class="tick">${wcc.conditionNote ? "Y" : "!"}</span> Site conditions: ${wcc.conditionNote || "Not captured"}</div>
      <div><span class="tick">${wcc.sentToVendor ? "Y" : "!"}</span> WCC to vendor: ${wcc.sentToVendor ? "Sent after site team approval" : "Pending after certification"}</div>
    </div>
    <div class="timeline">
      <div class="step ${wcc.signedEngineer ? "done" : ""}">Rays Site Engineer</div>
      <div class="step ${wcc.signedQuality ? "done" : ""}">Quality</div>
      <div class="step ${wcc.signedLead ? "done" : ""}">Vertical Lead</div>
    </div>`;
  return card(`${po.number} WCC`, wcc.status, body, `${next ? `<button data-sign-wcc="${wcc.id}">${next}</button>` : ""}${send}`);
}

function invoiceCard(inv) {
  const wcc = wccById(inv.wccId);
  const po = poById(logById(wcc.logId).poId);
  return card(`${inv.number} - ${po.number}`, inv.status, meta([
    ["Billing", INR.format(inv.amount)],
    ["Max Allowed", INR.format(inv.maxBillable)],
    ["Invoice PDF", inv.pdf || "No file"],
    ["Billing Checklist", inv.billingChecklist || "Not captured"],
    ["Based On", "WCC passed quantity"],
    ["Vendor Step", "Tax invoice submitted"]
  ]));
}

function complianceCard(c) {
  const inv = invoiceById(c.invoiceId);
  const actions = c.status === "PENDING_REVIEW" ? `<button data-approve-compliance="${c.id}">Approve Compliance</button>` : inv.status !== "CLEARED_FOR_BANK_TRANSFER" ? `<button data-release="${inv.id}">Release Payment</button>` : "";
  return card(`${inv.number} Compliance`, c.status, meta([
    ["PF ECR", c.pf],
    ["ESIC", c.esic],
    ["Invoice", INR.format(inv.amount)],
    ["HR Route", c.hrRoute || "Vendor to HR"],
    ["PMO Loop", c.pmoLoop || "HR compliance to PMO team"],
    ["Checklist", inv.billingChecklist || "Not captured"]
  ]), actions);
}

function ledgerCard(item) {
  return card(`Retention ${item.invoiceNumber}`, "CLEARED_FOR_BANK_TRANSFER", meta([
    ["Gross", INR.format(item.gross)],
    ["Retention 10%", INR.format(item.retention)],
    ["Net Payable", INR.format(item.net)]
  ]));
}

const binders = {
  dashboard() {},
  vendors() {
    document.getElementById("vendorForm").onsubmit = e => {
      e.preventDefault();
      const d = formData(e.target);
      if (state.vendors.some(v => v.gstin.toUpperCase() === d.gstin.toUpperCase())) return toast("Duplicate GSTIN blocked.");
      state.vendors.push({ id: id(), company: d.company, gstin: d.gstin.toUpperCase(), pan: d.pan.toUpperCase(), email: d.email, bank: d.bank, status: "PENDING_ONBOARDING" });
      save();
      toast("Vendor created in PENDING_ONBOARDING.");
      render();
    };
    document.getElementById("poForm").onsubmit = e => {
      e.preventDefault();
      const d = formData(e.target);
      const qty = Number(d.totalQty);
      const rate = Number(d.unitRate);
      state.pos.push({
        id: id(),
        vendorId: d.vendorId,
        number: `PO-${new Date().getFullYear()}-${String(state.pos.length + 1001).padStart(4, "0")}`,
        item: d.item,
        uom: d.uom,
        totalQty: qty,
        unitRate: rate,
        totalValue: qty * rate,
        loiRef: d.loiRef,
        poTerms: d.poTerms,
        annexureList: d.annexureList,
        signedAnnexures: d.signedAnnexures,
        blueprint: fileName(e.target.blueprint),
        status: "DRAFT_ISSUED",
        acceptedAt: ""
      });
      save();
      toast("Draft PO issued.");
      render();
    };
    document.querySelectorAll("[data-accept-po]").forEach(button => {
      button.onclick = () => {
        const po = poById(button.dataset.acceptPo);
        if (!po.signedAnnexures) return toast("PO acceptance blocked until signed annexures are captured.");
        byId(state.vendors, po.vendorId).status = "ACTIVE_EMPANELLED";
        po.status = "ACTIVE_EXECUTION";
        po.acceptedAt = now();
        save();
        toast("PO accepted and vendor activated.");
        render();
      };
    });
  },
  field() {
    document.getElementById("logForm").onsubmit = e => {
      e.preventDefault();
      const d = formData(e.target);
      const po = poById(d.poId);
      if (!po) return toast("No active PO available.");
      state.logs.push({ id: id(), poId: po.id, item: po.item, uom: po.uom, executedQty: Number(d.executedQty), document: fileName(e.target.document), status: "UNVERIFIED_FIELD_LOG", createdAt: now() });
      save();
      toast("Measurement book log vaulted.");
      render();
    };
  },
  wcc() {
    document.getElementById("wccForm").onsubmit = e => {
      e.preventDefault();
      const d = formData(e.target);
      const log = logById(d.logId);
      const passed = Number(d.passedQty);
      if (!log) return toast("No MB log available.");
      if (passed > Number(log.executedQty)) return toast("Blocked: passed quantity cannot exceed executed quantity.");
      state.wccs.push({
        id: id(),
        logId: log.id,
        serialNo: d.serialNo,
        passedQty: passed,
        siteIncharge: d.siteIncharge,
        qualityReviewer: d.qualityReviewer,
        verticalLead: d.verticalLead,
        conditionNote: d.conditionNote,
        sentToVendor: false,
        signedEngineer: false,
        signedQuality: false,
        signedLead: false,
        status: "AWAITING_ENGINEER",
        createdAt: now()
      });
      save();
      toast("WCC started.");
      render();
    };
    document.querySelectorAll("[data-sign-wcc]").forEach(button => {
      button.onclick = () => {
        const wcc = wccById(button.dataset.signWcc);
        if (!wcc.signedEngineer) wcc.signedEngineer = true;
        else if (!wcc.signedQuality) wcc.signedQuality = true;
        else if (!wcc.signedLead) wcc.signedLead = true;
        updateWccStatus(wcc);
        save();
        toast(`WCC status: ${wcc.status.replaceAll("_", " ")}.`);
        render();
      };
    });
    document.querySelectorAll("[data-send-wcc]").forEach(button => {
      button.onclick = () => {
        const wcc = wccById(button.dataset.sendWcc);
        if (wcc.status !== "CERTIFIED_MILESTONE") return toast("WCC can be sent only after vertical lead certification.");
        wcc.sentToVendor = true;
        save();
        toast("Certified WCC sent to vendor for tax invoice.");
        render();
      };
    });
  },
  billing() {
    document.getElementById("invoiceForm").onsubmit = e => {
      e.preventDefault();
      const d = formData(e.target);
      const wcc = wccById(d.wccId);
      if (!wcc || wcc.status !== "CERTIFIED_MILESTONE") return toast("Invoice blocked until WCC is certified.");
      if (!wcc.sentToVendor) return toast("Invoice blocked until certified WCC is sent to vendor.");
      const maximum = maxBillable(wcc);
      const amount = Number(d.amount);
      if (amount > maximum) return toast("Invoice amount blocked: exceeds WCC max billable amount.");
      state.invoices.push({ id: id(), wccId: wcc.id, number: d.number, date: d.date, amount, maxBillable: maximum, pdf: fileName(e.target.pdf), billingChecklist: d.billingChecklist, status: "SUBMITTED_AWAITING_COMPLIANCE" });
      save();
      toast("Invoice submitted for compliance.");
      render();
    };
    document.getElementById("complianceForm").onsubmit = e => {
      e.preventDefault();
      const d = formData(e.target);
      const inv = invoiceById(d.invoiceId);
      if (!inv) return toast("No invoice awaiting compliance.");
      const pf = fileName(e.target.pf) || d.pfRef.trim();
      const esic = fileName(e.target.esic) || d.esicRef.trim();
      if (!pf || !esic) return toast("PF and ESIC receipts or references are required.");
      state.compliance.push({ id: id(), invoiceId: inv.id, pf, esic, hrRoute: d.hrRoute, pmoLoop: d.pmoLoop, status: "PENDING_REVIEW" });
      save();
      toast("Compliance documents submitted.");
      render();
    };
  },
  finance() {
    document.querySelectorAll("[data-approve-compliance]").forEach(button => {
      button.onclick = () => {
        byId(state.compliance, button.dataset.approveCompliance).status = "APPROVED";
        save();
        toast("Compliance approved.");
        render();
      };
    });
    document.querySelectorAll("[data-release]").forEach(button => {
      button.onclick = () => {
        const inv = invoiceById(button.dataset.release);
        const comp = state.compliance.find(c => c.invoiceId === inv.id);
        if (!comp || comp.status !== "APPROVED") return toast("Payment blocked until compliance is approved.");
        const retention = Number(inv.amount) * 0.1;
        inv.retention = retention;
        inv.netPayable = Number(inv.amount) - retention;
        inv.status = "CLEARED_FOR_BANK_TRANSFER";
        state.ledger.push({ id: id(), invoiceId: inv.id, invoiceNumber: inv.number, gross: inv.amount, retention, net: inv.netPayable, createdAt: now() });
        save();
        toast("Payment released and retention ledger written.");
        render();
      };
    });
  }
};

document.getElementById("seedBtn").onclick = () => {
  state = seedState();
  toast("Demo data reset.");
  render();
};

document.getElementById("exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: "industrial-execution-control.json" });
  link.click();
  URL.revokeObjectURL(url);
};

render();
