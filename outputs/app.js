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

    const initialState = () => ({
      vendors: [
        { id: crypto.randomUUID(), company: "Suryatech Fabricators Pvt Ltd", gstin: "27AABCS1234F1Z5", pan: "AABCS1234F", email: "accounts@suryatech.example", bank: "HDFC 0091", status: "ACTIVE_EMPANELLED" }
      ],
      pos: [],
      logs: [],
      wccs: [],
      invoices: [],
      compliance: [],
      ledger: []
    });

    function seedState() {
      const s = initialState();
      const vendor = s.vendors[0];
      const po = {
        id: crypto.randomUUID(), vendorId: vendor.id, number: "PO-2026-0701-1001",
        item: "Structural steel erection", uom: "MT", totalValue: 3750000,
        totalQty: 250, unitRate: 15000, blueprint: "GA-STEEL-REV-C.pdf",
        loiRef: "LOI-RAYS-PMO-2026-014", poTerms: "PMO-HO standard terms, retention 10%, invoice on certified WCC passed quantity",
        annexureList: "Annexure A BOQ, Annexure B safety, Annexure C billing checklist",
        signedAnnexures: "Vendor signed PO acceptance and annexures",
        status: "ACTIVE_EXECUTION", acceptedAt: new Date().toISOString()
      };
      s.pos.push(po);
      const log = {
        id: crypto.randomUUID(), poId: po.id, item: po.item, uom: po.uom,
        executedQty: 42, document: "signed-mb-page-019.png",
        status: "UNVERIFIED_FIELD_LOG", createdAt: new Date().toISOString()
      };
      s.logs.push(log);
      const wcc = {
        id: crypto.randomUUID(), logId: log.id, passedQty: 39.5,
        serialNo: "1", siteIncharge: "Rays Site Incharge", qualityReviewer: "Quality Team", verticalLead: "Vertical Lead",
        conditionNote: "Passed quantity verified against site execution and signed MB page.",
        sentToVendor: false,
        signedEngineer: true, signedQuality: true, signedLead: false,
        status: "QUALITY_APPROVED", createdAt: new Date().toISOString()
      };
      s.wccs.push(wcc);
      save(s);
      return s;
    }

    let state = load();
    let currentTab = "dashboard";

    function load() {
      const raw = localStorage.getItem(storeKey);
      if (!raw) return seedState();
      try { return migrate(JSON.parse(raw)); } catch { return seedState(); }
    }

    function migrate(s) {
      s.pos = s.pos || [];
      s.logs = s.logs || [];
      s.wccs = s.wccs || [];
      s.invoices = s.invoices || [];
      s.compliance = s.compliance || [];
      s.ledger = s.ledger || [];
      s.pos.forEach(po => {
        po.loiRef ||= "LOI pending";
        po.poTerms ||= "Invoice allowed only after certified WCC passed quantity.";
        po.annexureList ||= "BOQ, billing checklist, HR compliance";
        po.signedAnnexures ||= po.acceptedAt ? "Signed annexures received" : "";
      });
      s.wccs.forEach(w => {
        w.serialNo ||= "1";
        w.siteIncharge ||= "Rays Site Engineer";
        w.qualityReviewer ||= "Quality Team";
        w.verticalLead ||= "Vertical Lead";
        w.conditionNote ||= "Site execution verified against MB entry.";
        w.sentToVendor = Boolean(w.sentToVendor);
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

    function save(next = state) {
      localStorage.setItem(storeKey, JSON.stringify(next));
    }

    function vendorName(id) {
      return state.vendors.find(v => v.id === id)?.company || "Unknown vendor";
    }

    function poById(id) { return state.pos.find(p => p.id === id); }
    function logById(id) { return state.logs.find(l => l.id === id); }
    function wccById(id) { return state.wccs.find(w => w.id === id); }
    function invoiceById(id) { return state.invoices.find(i => i.id === id); }

    function statusBadge(status) {
      const green = ["ACTIVE_EMPANELLED", "ACTIVE_EXECUTION", "CERTIFIED_MILESTONE", "CLEARED_FOR_BANK_TRANSFER", "APPROVED"];
      const blue = ["SUBMITTED_AWAITING_COMPLIANCE", "PENDING_REVIEW", "QUALITY_APPROVED", "ENGINEER_SIGNED"];
      const gold = ["DRAFT_ISSUED", "UNVERIFIED_FIELD_LOG", "PENDING_ONBOARDING"];
      const red = ["REJECTED", "BLOCKED"];
      const color = green.includes(status) ? "green" : blue.includes(status) ? "blue" : gold.includes(status) ? "gold" : red.includes(status) ? "red" : "gray";
      return `<span class="badge ${color}">${status.replaceAll("_", " ")}</span>`;
    }

    function toast(msg) {
      const el = document.getElementById("toast");
      el.textContent = msg;
      el.classList.add("show");
      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
    }

    function formData(form) {
      return Object.fromEntries(new FormData(form).entries());
    }

    function fileName(input) {
      return input.files && input.files[0] ? input.files[0].name : "";
    }

    function maxBillable(wcc) {
      const log = logById(wcc.logId);
      const po = poById(log.poId);
      return wcc.passedQty * po.unitRate;
    }

    function updateWccStatus(wcc) {
      if (wcc.signedEngineer && wcc.signedQuality && wcc.signedLead) wcc.status = "CERTIFIED_MILESTONE";
      else if (wcc.signedEngineer && wcc.signedQuality) wcc.status = "QUALITY_APPROVED";
      else if (wcc.signedEngineer) wcc.status = "ENGINEER_SIGNED";
      else wcc.status = "AWAITING_ENGINEER";
    }

    function renderNav() {
      document.getElementById("nav").innerHTML = tabs.map(t => `
        <button class="${currentTab === t[0] ? "active" : ""}" data-tab="${t[0]}">
          <span class="ico">${t[1]}</span><span class="nav-label">${t[4]}</span>
        </button>
      `).join("");
      document.querySelectorAll("[data-tab]").forEach(btn => btn.onclick = () => {
        currentTab = btn.dataset.tab;
        render();
      });
    }

    function render() {
      renderNav();
      const tab = tabs.find(t => t[0] === currentTab);
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

    const views = {
      dashboard() {
        const certified = state.wccs.filter(w => w.status === "CERTIFIED_MILESTONE").length;
        const payable = state.invoices.reduce((sum, i) => i.status === "CLEARED_FOR_BANK_TRANSFER" ? sum + i.netPayable : sum, 0);
        const retention = state.ledger.reduce((sum, l) => sum + l.retention, 0);
        return `
          <div class="grid stats">
            <div class="stat"><span>Active vendors</span><b>${state.vendors.filter(v => v.status === "ACTIVE_EMPANELLED").length}</b></div>
            <div class="stat"><span>Certified WCCs</span><b>${certified}</b></div>
            <div class="stat"><span>Invoices in flow</span><b>${state.invoices.length}</b></div>
            <div class="stat"><span>Retention ledger</span><b>${INR.format(retention)}</b></div>
          </div>
          <div class="panel" style="margin-top:16px">
            <h2>Pipeline State Machine</h2>
            <div class="timeline">
              ${["Vendor", "PO", "MB Log", "WCC", "Compliance", "Payment"].map((s, i) => {
                const done = [
                  state.vendors.some(v => v.status === "ACTIVE_EMPANELLED"),
                  state.pos.some(p => p.status === "ACTIVE_EXECUTION"),
                  state.logs.length > 0,
                  state.wccs.some(w => w.status === "CERTIFIED_MILESTONE"),
                  state.compliance.some(c => c.status === "APPROVED"),
                  state.invoices.some(inv => inv.status === "CLEARED_FOR_BANK_TRANSFER")
                ][i];
                return `<div class="step ${done ? "done" : ""}">${s}</div>`;
              }).join("")}
            </div>
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
          </div>
        `;
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
          </div>
        `;
      },
      wcc() {
        const available = state.logs.filter(l => !state.wccs.some(w => w.logId === l.id));
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
          </div>
        `;
      },
      billing() {
        const certified = state.wccs.filter(w => w.status === "CERTIFIED_MILESTONE" && w.sentToVendor && !state.invoices.some(i => i.wccId === w.id));
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
                <label class="full">Invoice<select name="invoiceId" required>${state.invoices.filter(i => i.status === "SUBMITTED_AWAITING_COMPLIANCE" && !state.compliance.some(c => c.invoiceId === i.id)).map(i => `<option value="${i.id}">${i.number} - ${INR.format(i.amount)}</option>`).join("")}</select></label>
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
          </div>
        `;
      },
      finance() {
        return `
          <div class="workbench">
            <section class="panel">
              <h2>Payment Queue</h2>
              <div class="list">${state.compliance.length ? state.compliance.map(complianceCard).join("") : `<div class="empty">No compliance submissions yet.</div>`}</div>
            </section>
            <section class="list">${state.ledger.length ? state.ledger.map(ledgerCard).join("") : `<div class="empty">No retention ledger entries yet.</div>`}</section>
          </div>
        `;
      }
    };

    function poCard(po) {
      return card(po.number, po.status, `
        <div class="meta">
          <div><span>Vendor</span>${vendorName(po.vendorId)}</div>
          <div><span>Quantity</span>${po.totalQty} ${po.uom}</div>
          <div><span>Value</span>${INR.format(po.totalValue)}</div>
          <div><span>LOI</span>${po.loiRef || "Not captured"}</div>
          <div><span>Annexures</span>${po.annexureList || "Not captured"}</div>
          <div><span>PO Terms</span>${po.poTerms || "Not captured"}</div>
        </div>
        <div class="checklist">
          <div><span class="tick">${po.signedAnnexures ? "Y" : "!"}</span> Signed annexures: ${po.signedAnnexures || "Pending from vendor"}</div>
          <div><span class="tick">${po.acceptedAt ? "Y" : "!"}</span> PO acceptance: ${po.acceptedAt ? "Completed" : "Pending one-time vendor acceptance"}</div>
        </div>
      `, po.status === "DRAFT_ISSUED" ? `<button data-accept-po="${po.id}">Vendor Accept</button>` : "");
    }

    function logCard(log) {
      const po = poById(log.poId);
      return card(`${po.number} MB Log`, log.status, `
        <div class="meta">
          <div><span>Executed</span>${log.executedQty} ${log.uom}</div>
          <div><span>Item</span>${log.item}</div>
          <div><span>Document</span>${log.document || "No file"}</div>
        </div>
      `);
    }

    function wccCard(wcc) {
      const log = logById(wcc.logId);
      const po = poById(log.poId);
      const next = !wcc.signedEngineer ? "Rays Site Engineer Sign" : !wcc.signedQuality ? "Quality Sign" : !wcc.signedLead ? "Vertical Lead Sign" : "";
      const sendAction = wcc.status === "CERTIFIED_MILESTONE" && !wcc.sentToVendor ? `<button data-send-wcc="${wcc.id}">Send WCC To Vendor</button>` : "";
      return card(`${po.number} WCC`, wcc.status, `
        <div class="meta">
          <div><span>Executed Qty</span>${log.executedQty} ${log.uom}</div>
          <div><span>Passed Qty</span>${wcc.passedQty} ${log.uom}</div>
          <div><span>Max Billable</span>${INR.format(maxBillable(wcc))}</div>
          <div><span>Site Engineer</span>${wcc.siteIncharge || "Pending"}</div>
          <div><span>Quality</span>${wcc.qualityReviewer || "Pending"}</div>
          <div><span>Vertical Lead</span>${wcc.verticalLead || "Pending"}</div>
        </div>
        <table class="mini-table">
          <thead><tr><th>S.No</th><th>Desc</th><th>UOM</th><th>PO Qty</th><th>PO No</th><th>Executed Qty</th><th>Passed Qty</th><th>Rays Site Engineer</th></tr></thead>
          <tbody><tr>
            <td>${wcc.serialNo || "1"}</td><td>${log.item}</td><td>${log.uom}</td><td>${po.totalQty}</td><td>${po.number}</td><td>${log.executedQty}</td><td>${wcc.passedQty}</td><td>${wcc.siteIncharge || "Pending"}</td>
          </tr></tbody>
        </table>
        <div class="checklist">
          <div><span class="tick">${wcc.conditionNote ? "Y" : "!"}</span> Site conditions: ${wcc.conditionNote || "Not captured"}</div>
          <div><span class="tick">${wcc.sentToVendor ? "Y" : "!"}</span> WCC to vendor: ${wcc.sentToVendor ? "Sent after site team approval" : "Pending after certification"}</div>
        </div>
        <div class="timeline">
          <div class="step ${wcc.signedEngineer ? "done" : ""}">Rays Site Engineer</div>
          <div class="step ${wcc.signedQuality ? "done" : ""}">Quality</div>
          <div class="step ${wcc.signedLead ? "done" : ""}">Vertical Lead</div>
        </div>
      `, `${next ? `<button data-sign-wcc="${wcc.id}">${next}</button>` : ""}${sendAction}`);
    }

    function invoiceCard(inv) {
      const wcc = wccById(inv.wccId);
      const po = poById(logById(wcc.logId).poId);
      return card(`${inv.number} - ${po.number}`, inv.status, `
        <div class="meta">
          <div><span>Billing</span>${INR.format(inv.amount)}</div>
          <div><span>Max Allowed</span>${INR.format(inv.maxBillable)}</div>
          <div><span>Invoice PDF</span>${inv.pdf || "No file"}</div>
          <div><span>Billing Checklist</span>${inv.billingChecklist || "Not captured"}</div>
          <div><span>Based On</span>WCC passed quantity</div>
          <div><span>Vendor Step</span>Tax invoice submitted</div>
        </div>
      `);
    }

    function complianceCard(c) {
      const inv = invoiceById(c.invoiceId);
      return card(`${inv.number} Compliance`, c.status, `
        <div class="meta">
          <div><span>PF ECR</span>${c.pf}</div>
          <div><span>ESIC</span>${c.esic}</div>
          <div><span>Invoice</span>${INR.format(inv.amount)}</div>
          <div><span>HR Route</span>${c.hrRoute || "Vendor to HR"}</div>
          <div><span>PMO Loop</span>${c.pmoLoop || "HR compliance to PMO team"}</div>
          <div><span>Checklist</span>${inv.billingChecklist || "Not captured"}</div>
        </div>
      `, c.status === "PENDING_REVIEW" ? `<button data-approve-compliance="${c.id}">Approve Compliance</button>` : inv.status !== "CLEARED_FOR_BANK_TRANSFER" ? `<button data-release="${inv.id}">Release Payment</button>` : "");
    }

    function ledgerCard(l) {
      return card(`Retention ${l.invoiceNumber}`, "CLEARED_FOR_BANK_TRANSFER", `
        <div class="meta">
          <div><span>Gross</span>${INR.format(l.gross)}</div>
          <div><span>Retention 10%</span>${INR.format(l.retention)}</div>
          <div><span>Net Payable</span>${INR.format(l.net)}</div>
        </div>
      `);
    }

    const binders = {
      dashboard() {},
      vendors() {
        document.getElementById("vendorForm").onsubmit = e => {
          e.preventDefault();
          const d = formData(e.target);
          if (state.vendors.some(v => v.gstin.toUpperCase() === d.gstin.toUpperCase())) return toast("Duplicate GSTIN blocked.");
          state.vendors.push({ id: crypto.randomUUID(), ...d, gstin: d.gstin.toUpperCase(), pan: d.pan.toUpperCase(), status: "PENDING_ONBOARDING" });
          save(); toast("Vendor created in PENDING_ONBOARDING."); render();
        };
        document.getElementById("poForm").onsubmit = e => {
          e.preventDefault();
          const d = formData(e.target);
          const qty = Number(d.totalQty), rate = Number(d.unitRate);
          const po = {
            id: crypto.randomUUID(), vendorId: d.vendorId, number: `PO-${new Date().getFullYear()}-${String(state.pos.length + 1001).padStart(4, "0")}`,
            item: d.item, uom: d.uom, totalQty: qty, unitRate: rate, totalValue: qty * rate,
            loiRef: d.loiRef, poTerms: d.poTerms, annexureList: d.annexureList, signedAnnexures: d.signedAnnexures,
            blueprint: fileName(e.target.blueprint), status: "DRAFT_ISSUED", acceptedAt: ""
          };
          state.pos.push(po); save(); toast("Draft PO issued."); render();
        };
        document.querySelectorAll("[data-accept-po]").forEach(b => b.onclick = () => {
          const po = poById(b.dataset.acceptPo);
          const vendor = state.vendors.find(v => v.id === po.vendorId);
          if (!po.signedAnnexures) return toast("PO acceptance blocked until signed annexures are captured.");
          vendor.status = "ACTIVE_EMPANELLED";
          po.status = "ACTIVE_EXECUTION";
          po.acceptedAt = new Date().toISOString();
          save(); toast("PO accepted and vendor activated."); render();
        });
      },
      field() {
        document.getElementById("logForm").onsubmit = e => {
          e.preventDefault();
          const d = formData(e.target);
          const po = poById(d.poId);
          if (!po) return toast("No active PO available.");
          state.logs.push({
            id: crypto.randomUUID(), poId: po.id, item: po.item, uom: po.uom,
            executedQty: Number(d.executedQty), document: fileName(e.target.document),
            status: "UNVERIFIED_FIELD_LOG", createdAt: new Date().toISOString()
          });
          save(); toast("Measurement book log vaulted."); render();
        };
      },
      wcc() {
        document.getElementById("wccForm").onsubmit = e => {
          e.preventDefault();
          const d = formData(e.target);
          const log = logById(d.logId);
          const passed = Number(d.passedQty);
          if (!log) return toast("No MB log available.");
          if (passed > log.executedQty) return toast("Blocked: passed quantity cannot exceed executed quantity.");
          state.wccs.push({
            id: crypto.randomUUID(), logId: log.id, serialNo: d.serialNo, passedQty: passed,
            siteIncharge: d.siteIncharge, qualityReviewer: d.qualityReviewer, verticalLead: d.verticalLead,
            conditionNote: d.conditionNote, sentToVendor: false,
            signedEngineer: false, signedQuality: false, signedLead: false,
            status: "AWAITING_ENGINEER", createdAt: new Date().toISOString()
          });
          save(); toast("WCC started."); render();
        };
        document.querySelectorAll("[data-sign-wcc]").forEach(b => b.onclick = () => {
          const w = wccById(b.dataset.signWcc);
          if (!w.signedEngineer) w.signedEngineer = true;
          else if (!w.signedQuality) w.signedQuality = true;
          else if (!w.signedLead) w.signedLead = true;
          updateWccStatus(w);
          save(); toast(`WCC status: ${w.status.replaceAll("_", " ")}.`); render();
        });
        document.querySelectorAll("[data-send-wcc]").forEach(b => b.onclick = () => {
          const w = wccById(b.dataset.sendWcc);
          if (w.status !== "CERTIFIED_MILESTONE") return toast("WCC can be sent only after vertical lead certification.");
          w.sentToVendor = true;
          save(); toast("Certified WCC sent to vendor for tax invoice."); render();
        });
      },
      billing() {
        document.getElementById("invoiceForm").onsubmit = e => {
          e.preventDefault();
          const d = formData(e.target);
          const w = wccById(d.wccId);
          if (!w || w.status !== "CERTIFIED_MILESTONE") return toast("Invoice blocked until WCC is certified.");
          if (!w.sentToVendor) return toast("Invoice blocked until certified WCC is sent to vendor.");
          const max = maxBillable(w), amount = Number(d.amount);
          if (amount > max) return toast("Invoice amount blocked: exceeds WCC max billable amount.");
          state.invoices.push({ id: crypto.randomUUID(), wccId: w.id, number: d.number, date: d.date, amount, maxBillable: max, pdf: fileName(e.target.pdf), billingChecklist: d.billingChecklist, status: "SUBMITTED_AWAITING_COMPLIANCE" });
          save(); toast("Invoice submitted for compliance."); render();
        };
        document.getElementById("complianceForm").onsubmit = e => {
          e.preventDefault();
          const d = formData(e.target);
          const inv = invoiceById(d.invoiceId);
          if (!inv) return toast("No invoice awaiting compliance.");
          const pf = fileName(e.target.pf) || d.pfRef.trim();
          const esic = fileName(e.target.esic) || d.esicRef.trim();
          if (!pf || !esic) return toast("PF and ESIC receipts or references are required.");
          state.compliance.push({ id: crypto.randomUUID(), invoiceId: inv.id, pf, esic, hrRoute: d.hrRoute, pmoLoop: d.pmoLoop, status: "PENDING_REVIEW" });
          save(); toast("Compliance documents submitted."); render();
        };
      },
      finance() {
        document.querySelectorAll("[data-approve-compliance]").forEach(b => b.onclick = () => {
          const c = state.compliance.find(x => x.id === b.dataset.approveCompliance);
          c.status = "APPROVED";
          save(); toast("Compliance approved."); render();
        });
        document.querySelectorAll("[data-release]").forEach(b => b.onclick = () => {
          const inv = invoiceById(b.dataset.release);
          const compliance = state.compliance.find(c => c.invoiceId === inv.id);
          if (!compliance || compliance.status !== "APPROVED") return toast("Payment blocked until compliance is approved.");
          const retention = inv.amount * 0.10;
          inv.retention = retention;
          inv.netPayable = inv.amount - retention;
          inv.status = "CLEARED_FOR_BANK_TRANSFER";
          state.ledger.push({ id: crypto.randomUUID(), invoiceId: inv.id, invoiceNumber: inv.number, gross: inv.amount, retention, net: inv.netPayable, createdAt: new Date().toISOString() });
          save(); toast("Payment released and retention ledger written."); render();
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
      const a = Object.assign(document.createElement("a"), { href: url, download: "industrial-execution-control.json" });
      a.click();
      URL.revokeObjectURL(url);
    };

    render();
  