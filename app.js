
const STORAGE_KEY = "piece-rate-calculator-v1";
const DEFAULT_SIZE_LIST = ["XS", "S", "M", "L", "XL", "XXL"];
const SECTION_ACCESS_TABS = ["styles", "cutting", "production", "acceptance", "dispatch"];
const SECTION_ACCESS_LABELS = {
  styles: "Style Master",
  cutting: "Cutting Entry",
  production: "Production Entry",
  acceptance: "Acceptance Entry",
  dispatch: "Dispatch Entry"
};
const DEFAULTS = {
  styles: [],
  cuttingEntries: [],
  styleProductionEntries: [],
  productionEntries: [],
  acceptanceEntries: [],
  dispatchEntries: [],
  settings: {
    sizes: DEFAULT_SIZE_LIST,
    accessCodes: {
      styles: "",
      cutting: "",
      production: "",
      acceptance: "",
      dispatch: ""
    }
  }
};
const CLOUD_REFRESH_MS = 15000;

let state = clone(DEFAULTS);
let supabaseClient = null;
let lastCloudUpdatedAt = "";
let cloudRefreshTimer = null;
let isApplyingRemoteState = false;
let isSyncing = false;
let pastedStyleImageDataUrl = "";
let activeSharedSection = "";
let pendingStyleImportFile = null;

const $ = (id) => document.getElementById(id);
const els = {
  sidebar: document.querySelector(".sidebar"),
  sidebarCards: document.querySelectorAll(".sidebar-card"),
  navLinks: document.querySelectorAll(".nav-link"),
  panels: document.querySelectorAll(".tab-panel"),
  styleForm: $("styleForm"),
  styleCardSearch: $("styleCardSearch"),
  sizeSettingsForm: $("sizeSettingsForm"),
  sizeListInput: $("sizeListInput"),
  accessCodeForm: $("accessCodeForm"),
  accessCodeStatus: $("accessCodeStatus"),
  operationRateRows: $("operationRateRows"),
  addOperationRateBtn: $("addOperationRateBtn"),
  operationRateTemplate: $("operationRateTemplate"),
  styleCards: $("styleCards"),
  cuttingForm: $("cuttingForm"),
  cuttingStyleSearch: $("cuttingStyleSearch"),
  cuttingStyleSelect: $("cuttingStyleSelect"),
  cuttingSizeRows: $("cuttingSizeRows"),
  cuttingEntriesTable: $("cuttingEntriesTable"),
  styleProductionForm: $("styleProductionForm"),
  styleProductionStyleSearch: $("styleProductionStyleSearch"),
  styleProductionStyleSelect: $("styleProductionStyleSelect"),
  styleProductionSizeRows: $("styleProductionSizeRows"),
  styleProductionEntriesTable: $("styleProductionEntriesTable"),
  styleProductionImportInput: $("styleProductionImportInput"),
  productionForm: $("productionForm"),
  productionStyleSearch: $("productionStyleSearch"),
  productionStyleSelect: $("productionStyleSelect"),
  productionOperationSelect: $("productionOperationSelect"),
  productionSizeSelect: $("productionSizeSelect"),
  productionEntriesTable: $("productionEntriesTable"),
  acceptanceForm: $("acceptanceForm"),
  acceptanceStyleSearch: $("acceptanceStyleSearch"),
  acceptanceStyleSelect: $("acceptanceStyleSelect"),
  acceptanceSizeRows: $("acceptanceSizeRows"),
  acceptanceEntriesTable: $("acceptanceEntriesTable"),
  dispatchForm: $("dispatchForm"),
  dispatchStyleSearch: $("dispatchStyleSearch"),
  dispatchStyleSelect: $("dispatchStyleSelect"),
  dispatchSizeRows: $("dispatchSizeRows"),
  dispatchEntriesTable: $("dispatchEntriesTable"),
  dashboardStats: $("dashboardStats"),
  styleBillingTable: $("styleBillingTable"),
  workerBillingTable: $("workerBillingTable"),
  styleAmountReportTable: $("styleAmountReportTable"),
  reconciliationTable: $("reconciliationTable"),
  cuttingReportHead: $("cuttingReportHead"),
  cuttingReportTable: $("cuttingReportTable"),
  dispatchReportTable: $("dispatchReportTable"),
  operationCostTable: $("operationCostTable"),
  reportDate: $("reportDate"),
  clearReportDate: $("clearReportDate"),
  downloadStyleAmountReport: $("downloadStyleAmountReport"),
  downloadCuttingReport: $("downloadCuttingReport"),
  downloadInternalChallan: $("downloadInternalChallan"),
  downloadFlowReport: $("downloadFlowReport"),
  exportBtn: $("exportBtn"),
  importInput: $("importInput"),
  styleImportInput: $("styleImportInput"),
  styleImageImportInput: $("styleImageImportInput"),
  styleImageFile: $("styleImageFile"),
  pasteStyleImageBtn: $("pasteStyleImageBtn"),
  styleImagePasteStatus: $("styleImagePasteStatus"),
  styleFormImagePreview: $("styleFormImagePreview"),
  styleFormImagePreviewImg: $("styleFormImagePreviewImg"),
  cuttingImportInput: $("cuttingImportInput"),
  productionImportInput: $("productionImportInput"),
  storageModeBadge: $("storageModeBadge"),
  syncStatusText: $("syncStatusText"),
  imagePreviewModal: $("imagePreviewModal"),
  imagePreviewModalImg: $("imagePreviewModalImg"),
  closeImagePreview: $("closeImagePreview")
};

init().catch((error) => {
  console.error(error);
  alert("The app could not start correctly. Check the browser console for details.");
});

async function init() {
  state = await loadInitialState();
  normalizeState();
  bindTabs();
  seedOperationRows();
  buildSizeInputs();
  setToday();
  buildSizeSelect();
  els.sizeListInput.value = getSizes().join(", ");
  populateAccessCodeInputs();
  bindForms();
  applySharedSectionAccess();
  updateStorageModeUi();
  render();
  startCloudRefresh();
}

function bindTabs() {
  els.navLinks.forEach((btn) => btn.addEventListener("click", () => {
    if (activeSharedSection && !isSharedSectionTabAllowed(btn.dataset.tab)) return;
    activateTab(btn.dataset.tab);
  }));
}

function activateTab(tabId) {
  els.navLinks.forEach((n) => n.classList.toggle("active", n.dataset.tab === tabId));
  els.panels.forEach((p) => p.classList.toggle("active", p.id === tabId));
}

function seedOperationRows() {
  if (els.operationRateRows.children.length) return;
  ["Singer", "Overlock", "Kaaj", "Button", "Collar", "Patti"].forEach((name) => addOperationRow(name, ""));
}

function addOperationRow(name, rate) {
  const row = els.operationRateTemplate.content.cloneNode(true);
  row.querySelector('[name="operationName"]').value = name;
  row.querySelector('[name="operationRate"]').value = rate;
  els.operationRateRows.appendChild(row);
}

function buildSizeInputs() {
  const sizes = getSizes();
  els.cuttingSizeRows.innerHTML = sizes.map((size) => sizeCard(size, `cut_${size}`)).join("");
  els.styleProductionSizeRows.innerHTML = sizes.map((size) => sizeCard(size, `styleProd_${size}`)).join("");
  els.acceptanceSizeRows.innerHTML = sizes.map((size) => `
    <div class="size-card">
      <h4>${size}</h4>
      <label>Accepted Qty<input type="number" min="0" name="accepted_${size}" placeholder="0"></label>
      <label>Rejected Qty<input type="number" min="0" name="rejected_${size}" placeholder="0"></label>
    </div>`).join("");
  els.dispatchSizeRows.innerHTML = sizes.map((size) => sizeCard(size, `dispatch_${size}`)).join("");
}

function sizeCard(size, name) {
  return `<div class="size-card"><h4>${size}</h4><label>Quantity<input type="number" min="0" name="${name}" placeholder="0"></label></div>`;
}

function setToday() {
  const today = new Date().toISOString().slice(0, 10);
  els.cuttingForm.date.value = els.cuttingForm.date.value || today;
  els.styleProductionForm.date.value = els.styleProductionForm.date.value || today;
  els.productionForm.date.value = els.productionForm.date.value || today;
  els.acceptanceForm.date.value = els.acceptanceForm.date.value || today;
  els.dispatchForm.date.value = els.dispatchForm.date.value || today;
}

function buildSizeSelect() {
  els.productionSizeSelect.innerHTML = `<option value="">Select size</option>` + getSizes().map((s) => `<option value="${s}">${s}</option>`).join("");
}

function bindForms() {
  els.addOperationRateBtn.addEventListener("click", () => addOperationRow("", ""));
  els.operationRateRows.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-operation")) e.target.closest(".operation-rate-row").remove();
  });
  els.styleCards.addEventListener("click", handleStyleCardAction);
  els.cuttingReportTable?.addEventListener("click", handleImagePreviewAction);
  els.dispatchReportTable?.addEventListener("click", handleImagePreviewAction);
  els.cuttingEntriesTable.addEventListener("click", handleCuttingTableAction);
  els.styleProductionEntriesTable.addEventListener("click", handleStyleProductionTableAction);
  els.productionEntriesTable.addEventListener("click", handleProductionTableAction);
  els.acceptanceEntriesTable.addEventListener("click", handleAcceptanceTableAction);
  els.dispatchEntriesTable.addEventListener("click", handleDispatchTableAction);
  els.sizeSettingsForm.addEventListener("submit", saveSizes);
  els.accessCodeForm?.addEventListener("submit", saveAccessCodes);
  els.accessCodeForm?.addEventListener("click", handleAccessLinkCopy);

  els.styleForm.addEventListener("submit", saveStyle);
  els.styleForm.addEventListener("reset", () => {
    setTimeout(() => {
      clearPastedStyleImage();
      updateStyleFormImagePreview();
    }, 0);
  });
  els.styleForm.addEventListener("paste", handleStyleImagePaste);
  els.styleForm.image?.addEventListener("input", () => {
    if (clean(els.styleForm.image.value)) pastedStyleImageDataUrl = "";
    updateStyleFormImagePreview();
  });
  els.styleImageFile?.addEventListener("change", handleStyleImageFileChange);
  els.cuttingForm.addEventListener("submit", saveCutting);
  els.styleProductionForm.addEventListener("submit", saveStyleProduction);
  els.productionForm.addEventListener("submit", saveProduction);
  els.acceptanceForm.addEventListener("submit", saveAcceptance);
  els.dispatchForm.addEventListener("submit", saveDispatch);
  els.productionStyleSelect.addEventListener("change", renderOperationSelect);
  els.reportDate.addEventListener("change", renderReports);
  els.clearReportDate.addEventListener("click", clearReportDateFilter);
  els.downloadStyleAmountReport.addEventListener("click", downloadStyleAmountReport);
  els.downloadCuttingReport.addEventListener("click", downloadCuttingReport);
  els.downloadInternalChallan?.addEventListener("click", downloadInternalChallan);
  els.downloadFlowReport.addEventListener("click", downloadFlowReport);
  els.exportBtn.addEventListener("click", exportData);
  els.importInput.addEventListener("change", importData);
  els.styleImportInput.addEventListener("change", importStylesCsv);
  els.styleImageImportInput?.addEventListener("change", importStylesCsvFromPendingSelection);
  els.cuttingImportInput.addEventListener("change", importCuttingCsv);
  els.styleProductionImportInput?.addEventListener("change", importStyleProductionCsv);
  els.productionImportInput.addEventListener("change", importProductionCsv);
  els.pasteStyleImageBtn?.addEventListener("click", pasteStyleImageFromClipboard);
  bindStyleSearches();
  els.closeImagePreview?.addEventListener("click", closeImagePreview);
  els.imagePreviewModal?.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.dataset.closeImagePreview === "true") {
      closeImagePreview();
    }
  });
}

function bindStyleSearches() {
  [
    [els.styleCardSearch, null],
    [els.cuttingStyleSearch, els.cuttingStyleSelect],
    [els.styleProductionStyleSearch, els.styleProductionStyleSelect],
    [els.productionStyleSearch, els.productionStyleSelect],
    [els.acceptanceStyleSearch, els.acceptanceStyleSelect],
    [els.dispatchStyleSearch, els.dispatchStyleSelect]
  ].forEach(([input, select]) => {
    input?.addEventListener("input", () => {
      if (select) renderStyleSelect(select, input.value);
      else renderStyles();
    });
  });
}
async function saveStyle(e) {
  e.preventDefault();
  const f = new FormData(els.styleForm);
  const styleNumber = clean(f.get("styleNumber"));
  const color = clean(f.get("color"));
  const editId = els.styleForm.dataset.editId || "";
  if (!styleNumber) return;
  if (state.styles.some((s) => s.id !== editId && s.styleNumber.toLowerCase() === styleNumber.toLowerCase() && clean(s.color).toLowerCase() === color.toLowerCase())) {
    alert("This style number and color already exists.");
    return;
  }
  const operations = [...els.operationRateRows.querySelectorAll(".operation-rate-row")].map((row) => ({
    operationName: clean(row.querySelector('[name="operationName"]').value),
    rate: num(row.querySelector('[name="operationRate"]').value)
  })).filter((x) => x.operationName);

  const uploadedFile = els.styleForm.querySelector('[name="imageFile"]').files?.[0];
  const imageValue = clean(f.get("image"));
  const uploadedImage = uploadedFile ? await fileToDataUrl(uploadedFile) : null;
  const existingStyle = editId ? byId(editId) : null;

  const stylePayload = {
    id: editId || uid(),
    styleNumber,
    buyerName: clean(f.get("buyerName")),
    styleName: clean(f.get("styleName")),
    color,
    orderQty: num(f.get("orderQty")),
    cmtRate: num(f.get("cmtRate")),
    serviceChargePct: num(f.get("serviceChargePct")),
    image: uploadedImage || pastedStyleImageDataUrl || imageValue || existingStyle?.image || "",
    notes: clean(f.get("notes")),
    operations
  };

  if (editId) {
    const index = state.styles.findIndex((s) => s.id === editId);
    if (index >= 0) state.styles[index] = stylePayload;
    delete els.styleForm.dataset.editId;
  } else {
    state.styles.push(stylePayload);
  }

  els.styleForm.reset();
  clearPastedStyleImage();
  updateStyleFormImagePreview();
  els.operationRateRows.innerHTML = "";
  seedOperationRows();
  setToday();
  await persistState();
}

async function saveCutting(e) {
  e.preventDefault();
  const f = new FormData(els.cuttingForm);
  const sizes = getSizes();
  const entryId = els.cuttingForm.dataset.editId || uid();
  const payload = {
    id: entryId,
    date: f.get("date"),
    styleId: f.get("styleId"),
    service: clean(f.get("service")),
    remarks: clean(f.get("remarks")),
    quantities: Object.fromEntries(sizes.map((size) => [size, num(els.cuttingSizeRows.querySelector(`[name="cut_${size}"]`).value)]))
  };
  upsertEntry("cuttingEntries", payload, entryId);
  delete els.cuttingForm.dataset.editId;
  els.cuttingForm.reset();
  setToday();
  await persistState();
}

async function saveStyleProduction(e) {
  e.preventDefault();
  const f = new FormData(els.styleProductionForm);
  const sizes = getSizes();
  const entryId = els.styleProductionForm.dataset.editId || uid();
  const quantities = Object.fromEntries(sizes.map((size) => [size, num(els.styleProductionSizeRows.querySelector(`[name="styleProd_${size}"]`).value)]));
  const totalQty = num(f.get("totalQty"));
  const payload = {
    id: entryId,
    date: f.get("date"),
    styleId: f.get("styleId"),
    remarks: clean(f.get("remarks")),
    totalQty,
    quantities
  };
  upsertEntry("styleProductionEntries", payload, entryId);
  delete els.styleProductionForm.dataset.editId;
  els.styleProductionForm.reset();
  setToday();
  await persistState();
}

async function saveProduction(e) {
  e.preventDefault();
  const f = new FormData(els.productionForm);
  const style = byId(f.get("styleId"));
  const operationName = f.get("operationName");
  const op = style?.operations.find((x) => x.operationName === operationName);
  const entryId = els.productionForm.dataset.editId || uid();
  const payload = {
    id: entryId,
    date: f.get("date"),
    styleId: f.get("styleId"),
    operationName,
    operationRate: op ? num(op.rate) : 0,
    workerName: clean(f.get("workerName")),
    size: f.get("size"),
    quantity: num(f.get("quantity")),
    remarks: clean(f.get("remarks"))
  };
  upsertEntry("productionEntries", payload, entryId);
  delete els.productionForm.dataset.editId;
  els.productionForm.reset();
  setToday();
  await persistState();
}

async function saveAcceptance(e) {
  e.preventDefault();
  const f = new FormData(els.acceptanceForm);
  const sizes = getSizes();
  const entryId = els.acceptanceForm.dataset.editId || uid();
  const payload = {
    id: entryId,
    date: f.get("date"),
    styleId: f.get("styleId"),
    remarks: clean(f.get("remarks")),
    items: sizes.map((size) => ({
      size,
      accepted: num(els.acceptanceSizeRows.querySelector(`[name="accepted_${size}"]`).value),
      rejected: num(els.acceptanceSizeRows.querySelector(`[name="rejected_${size}"]`).value)
    }))
  };
  upsertEntry("acceptanceEntries", payload, entryId);
  delete els.acceptanceForm.dataset.editId;
  els.acceptanceForm.reset();
  setToday();
  await persistState();
}

async function saveDispatch(e) {
  e.preventDefault();
  const f = new FormData(els.dispatchForm);
  const sizes = getSizes();
  const entryId = els.dispatchForm.dataset.editId || uid();
  const payload = {
    id: entryId,
    date: f.get("date"),
    styleId: f.get("styleId"),
    remarks: clean(f.get("remarks")),
    quantities: Object.fromEntries(sizes.map((size) => [size, num(els.dispatchSizeRows.querySelector(`[name="dispatch_${size}"]`).value)]))
  };
  upsertEntry("dispatchEntries", payload, entryId);
  delete els.dispatchForm.dataset.editId;
  els.dispatchForm.reset();
  setToday();
  await persistState();
}

function render() {
  renderStyleSelects();
  renderOperationSelect();
  renderStyles();
  renderCutting();
  renderStyleProduction();
  renderProduction();
  renderAcceptance();
  renderDispatch();
  renderDashboard();
  renderReports();
}

function renderStyleSelects() {
  renderStyleSelect(els.cuttingStyleSelect, els.cuttingStyleSearch?.value || "");
  renderStyleSelect(els.styleProductionStyleSelect, els.styleProductionStyleSearch?.value || "");
  renderStyleSelect(els.productionStyleSelect, els.productionStyleSearch?.value || "");
  renderStyleSelect(els.acceptanceStyleSelect, els.acceptanceStyleSearch?.value || "");
  renderStyleSelect(els.dispatchStyleSelect, els.dispatchStyleSearch?.value || "");
}

function renderStyleSelect(select, searchTerm = "") {
  const current = select.value;
  const filteredStyles = filterStyles(searchTerm);
  const emptyLabel = !state.styles.length
    ? "No style created"
    : filteredStyles.length
      ? "Select style"
      : "No matching style";
  select.innerHTML = `<option value="">${emptyLabel}</option>` +
    filteredStyles.map((s) => `<option value="${s.id}">${esc(styleLabel(s))}</option>`).join("");
  if ([...select.options].some((o) => o.value === current)) {
    select.value = current;
  } else if (filteredStyles.length === 1) {
    select.value = filteredStyles[0].id;
  }
}

function renderOperationSelect() {
  const style = byId(els.productionStyleSelect.value);
  const current = els.productionOperationSelect.value;
  els.productionOperationSelect.innerHTML = `<option value="">${style ? "Select operation" : "Select style first"}</option>` +
    (style ? style.operations.map((o) => `<option value="${escAttr(o.operationName)}">${esc(o.operationName)} (Rs ${fmt(o.rate)})</option>`).join("") : "");
  if ([...els.productionOperationSelect.options].some((o) => o.value === current)) els.productionOperationSelect.value = current;
}

function renderStyles() {
  const filteredStyles = filterStyles(els.styleCardSearch?.value || "");
  els.styleCards.innerHTML = filteredStyles.length ? filteredStyles.map((style) => `
    <article class="style-card">
      ${style.image ? `
        <div class="style-media">
          <img class="style-thumb" src="${escAttr(style.image)}" alt="${escAttr(style.styleNumber)}">
          <div class="style-preview-meta">
            <span class="chip">Full image available</span>
            <button type="button" class="ghost small preview-link" data-action="preview-image" data-image-src="${escAttr(style.image)}" data-image-title="${escAttr(styleLabel(style))}">Preview Full Image</button>
          </div>
        </div>` : ""}
      <h4>${esc(style.styleNumber)}${style.styleName ? ` - ${esc(style.styleName)}` : ""}</h4>
      <p><strong>Buyer:</strong> ${esc(style.buyerName || "-")}</p>
      <p><strong>Color:</strong> ${esc(style.color || "-")}</p>
      <p><strong>Order Qty:</strong> ${fmtInt(style.orderQty || 0)}</p>
      <p><strong>Total CMT:</strong> Rs ${fmt(style.cmtRate)}</p>
      <p><strong>Service Charge:</strong> ${fmt(style.serviceChargePct || 0)}%</p>
      <p><strong>Image:</strong> ${style.image ? "Uploaded" : "-"}</p>
      <div class="chip-row">${style.operations.map((o) => `<span class="chip">${esc(o.operationName)}: Rs ${fmt(o.rate)}</span>`).join("") || "<span class='chip'>No operations</span>"}</div>
      <div class="card-actions">
        <button type="button" class="ghost small" data-action="edit-style" data-style-id="${style.id}">Edit</button>
        <button type="button" class="ghost small" data-action="delete-style" data-style-id="${style.id}">Delete</button>
      </div>
    </article>`).join("") : `<div class="empty-state">${state.styles.length ? "No styles match this search." : "No styles added yet."}</div>`;
}

function renderCutting() {
  els.cuttingEntriesTable.innerHTML = rowsOrEmpty(state.cuttingEntries.slice().reverse().map((entry) => `
    <tr><td>${esc(entry.date)}</td><td>${esc(styleLabel(byId(entry.styleId)))}</td><td>${esc(entry.service || "-")}</td><td>${fmtInt(byId(entry.styleId)?.orderQty || 0)}</td><td>${fmtInt(sumObj(entry.quantities))}</td><td>${esc(formatQuantities(entry.quantities))}</td><td>${esc(entry.remarks || "-")}</td><td><button type="button" class="ghost small" data-action="edit-cutting" data-entry-id="${entry.id}">Edit</button> <button type="button" class="ghost small" data-action="delete-cutting" data-entry-id="${entry.id}">Delete</button></td></tr>`), 8, "No cutting entries recorded.");
}

function renderStyleProduction() {
  els.styleProductionEntriesTable.innerHTML = rowsOrEmpty(state.styleProductionEntries.slice().reverse().map((entry) => `
    <tr><td>${esc(entry.date)}</td><td>${esc(styleLabel(byId(entry.styleId)))}</td><td>${fmtInt(entryProducedQty(entry))}</td><td>${esc(formatProductionQuantities(entry))}</td><td>${esc(entry.remarks || "-")}</td><td><button type="button" class="ghost small" data-action="edit-style-production" data-entry-id="${entry.id}">Edit</button> <button type="button" class="ghost small" data-action="delete-style-production" data-entry-id="${entry.id}">Delete</button></td></tr>`), 6, "No style production entries recorded.");
}

function renderProduction() {
  els.productionEntriesTable.innerHTML = rowsOrEmpty(state.productionEntries.slice().reverse().map((entry) => `
    <tr><td>${esc(entry.date)}</td><td>${esc(styleLabel(byId(entry.styleId)))}</td><td>${esc(entry.operationName)}</td><td>${esc(entry.workerName)}</td><td>${esc(entry.size)}</td><td>${fmtInt(entry.quantity)}</td><td>${esc(entry.remarks || "-")}</td><td><button type="button" class="ghost small" data-action="edit-production" data-entry-id="${entry.id}">Edit</button> <button type="button" class="ghost small" data-action="delete-production" data-entry-id="${entry.id}">Delete</button></td></tr>`), 8, "No production entries recorded.");
}
function renderAcceptance() {
  els.acceptanceEntriesTable.innerHTML = rowsOrEmpty(state.acceptanceEntries.slice().reverse().map((entry) => `
    <tr><td>${esc(entry.date)}</td><td>${esc(styleLabel(byId(entry.styleId)))}</td><td>${fmtInt(entry.items.reduce((s, i) => s + i.accepted, 0))}</td><td>${fmtInt(entry.items.reduce((s, i) => s + i.rejected, 0))}</td><td>${esc(formatAcceptanceItems(entry.items))}</td><td>${esc(entry.remarks || "-")}</td><td><button type="button" class="ghost small" data-action="edit-acceptance" data-entry-id="${entry.id}">Edit</button></td></tr>`), 7, "No acceptance entries recorded.");
}

function renderDispatch() {
  els.dispatchEntriesTable.innerHTML = rowsOrEmpty(state.dispatchEntries.slice().reverse().map((entry) => `
    <tr><td>${esc(entry.date)}</td><td>${esc(styleLabel(byId(entry.styleId)))}</td><td>${fmtInt(sumObj(entry.quantities))}</td><td>${esc(formatQuantities(entry.quantities))}</td><td>${esc(entry.remarks || "-")}</td><td><button type="button" class="ghost small" data-action="edit-dispatch" data-entry-id="${entry.id}">Edit</button> <button type="button" class="ghost small" data-action="delete-dispatch" data-entry-id="${entry.id}">Delete</button></td></tr>`), 6, "No dispatch entries recorded.");
}

function renderDashboard() {
  const totalBilling = styleBillingRows().reduce((s, r) => s + r.billing, 0);
  els.dashboardStats.innerHTML = [
    ["Styles", state.styles.length],
    ["Cut Qty", state.cuttingEntries.reduce((s, e) => s + sumObj(e.quantities), 0)],
    ["Produced Qty", state.styleProductionEntries.reduce((s, e) => s + entryProducedQty(e), 0)],
    ["Billing (Rs)", totalBilling]
  ].map(([label, value]) => `<div class="stat-card"><p>${label}</p><strong>${fmt(value)}</strong></div>`).join("");

  const billing = styleBillingRows();
  els.styleBillingTable.innerHTML = rowsOrEmpty(billing.map((r) => `
    <tr><td>${esc(r.styleNumber)}</td><td>${esc(r.color || "-")}</td><td>${fmtInt(r.acceptedQty)}</td><td>Rs ${fmt(r.cmtRate)}</td><td>Rs ${fmt(r.billing)}</td></tr>`), 5, "No style billing yet.");

  const workers = workerBillingRows();
  els.workerBillingTable.innerHTML = rowsOrEmpty(workers.map((r) => `
    <tr><td>${esc(r.workerName)}</td><td>${esc(r.operationName)}</td><td>${fmtInt(r.quantity)}</td><td>Rs ${fmt(r.amount)}</td></tr>`), 4, "No worker billing yet.");
}

function renderReports() {
  renderCuttingReportHeader();
  const styleAmounts = styleBillingRows(getReportDateFilter());
  els.styleAmountReportTable.innerHTML = rowsOrEmpty(styleAmounts.map((r) => `
    <tr><td>${esc(r.dateLabel)}</td><td>${esc(r.styleNumber)}</td><td>${esc(r.color || "-")}</td><td>${fmtInt(r.producedQty)}</td><td>Rs ${fmt(r.cmtRate)}</td><td>${fmt(r.serviceChargePct)}%</td><td>Rs ${fmt(r.serviceChargeAmount)}</td><td>Rs ${fmt(r.billing)}</td></tr>`), 8, "No style amount report for the selected date.");

  const reconciliation = reconciliationRows(getReportDateFilter());
  els.reconciliationTable.innerHTML = rowsOrEmpty(reconciliation.map((r) => `
    <tr><td>${esc(r.styleNumber)}</td><td>${fmtInt(r.cutQty)}</td><td>${fmtInt(r.producedQty)}</td><td>${fmtInt(r.acceptedQty)}</td><td>${fmtInt(r.rejectedQty)}</td><td class="${r.balance < 0 ? "text-danger" : "text-success"}">${fmtInt(r.balance)}</td></tr>`), 6, "No reconciliation data yet.");

  const cuttingRows = cuttingReportRows(getReportDateFilter());
  els.cuttingReportTable.innerHTML = rowsOrEmpty(cuttingRows.map((r) => `
    <tr>
      <td>${esc(r.date)}</td>
      <td>${r.image ? `<img class="report-thumb" src="${escAttr(r.image)}" alt="${escAttr(r.styleNumber)}" data-action="preview-image" data-image-src="${escAttr(r.image)}" data-image-title="${escAttr(r.styleNumber)}">` : "-"}</td>
      <td>${esc(r.styleNumber)}</td>
      <td>${esc(r.color || "-")}</td>
      <td>${esc(r.service || "-")}</td>
      ${getSizes().map((size) => `<td>${fmtInt(r.quantities[size] || 0)}</td>`).join("")}
      <td>${fmtInt(r.totalQty)}</td>
      <td>${esc(r.remarks || "-")}</td>
    </tr>`), getSizes().length + 7, "No cutting report for the selected date.");

  const dispatchRows = dispatchReportRows(getReportDateFilter());
  els.dispatchReportTable.innerHTML = rowsOrEmpty(dispatchRows.map((r) => `
    <tr>
      <td>${r.image ? `<img class="report-thumb" src="${escAttr(r.image)}" alt="${escAttr(r.styleNumber)}" data-action="preview-image" data-image-src="${escAttr(r.image)}" data-image-title="${escAttr(r.styleNumber)}">` : "-"}</td>
      <td>${esc(r.styleNumber)}</td>
      <td>${esc(r.color || "-")}</td>
      <td>${esc(r.size)}</td>
      <td>${fmtInt(r.cutQty)}</td>
      <td>${fmtInt(r.makeQty)}</td>
      <td>${fmtInt(r.dispatchQty)}</td>
      <td>Rs ${fmt(r.amount)}</td>
      <td class="${r.balance < 0 ? "text-danger" : "text-success"}">${fmtInt(r.balance)}</td>
    </tr>`), 9, "No size-wise dispatch details yet.");

  const ops = operationCostRows(getReportDateFilter());
  els.operationCostTable.innerHTML = rowsOrEmpty(ops.map((r) => `
    <tr><td>${esc(r.styleNumber)}</td><td>${esc(r.operationName)}</td><td>${fmtInt(r.quantity)}</td><td>Rs ${fmt(r.rate)}</td><td>Rs ${fmt(r.amount)}</td></tr>`), 5, "No operation costing yet.");
}

function renderCuttingReportHeader() {
  if (!els.cuttingReportHead) return;
  els.cuttingReportHead.innerHTML = `<tr><th>Date</th><th>Photo</th><th>Style</th><th>Colour</th><th>Service</th>${getSizes().map((size) => `<th>${esc(size)}</th>`).join("")}<th>Total Qty</th><th>Remarks</th></tr>`;
}

function styleBillingRows(reportDate = "") {
  return state.styles.map((style) => {
    const entries = state.styleProductionEntries.filter((e) => e.styleId === style.id && matchesDate(e.date, reportDate));
    const producedQty = entries.reduce((s, e) => s + entryProducedQty(e), 0);
    const baseAmount = producedQty * num(style.cmtRate);
    const serviceChargePct = num(style.serviceChargePct);
    const serviceChargeAmount = baseAmount * serviceChargePct / 100;
    return {
      styleNumber: style.styleNumber,
      color: style.color,
      producedQty,
      acceptedQty: producedQty,
      cmtRate: num(style.cmtRate),
      serviceChargePct,
      serviceChargeAmount,
      billing: baseAmount + serviceChargeAmount,
      dateLabel: reportDate || "All Dates"
    };
  }).filter((row) => row.producedQty > 0 || !reportDate);
}

function workerBillingRows() {
  const map = new Map();
  state.productionEntries.forEach((e) => {
    const key = `${e.workerName}__${e.operationName}`;
    const row = map.get(key) || { workerName: e.workerName, operationName: e.operationName, quantity: 0, amount: 0 };
    row.quantity += num(e.quantity);
    row.amount += num(e.quantity) * num(e.operationRate);
    map.set(key, row);
  });
  return [...map.values()].sort((a, b) => a.workerName.localeCompare(b.workerName));
}

function reconciliationRows(reportDate = "") {
  return state.styles.map((style) => {
    const cutQty = state.cuttingEntries.filter((e) => e.styleId === style.id && matchesDate(e.date, reportDate)).reduce((s, e) => s + sumObj(e.quantities), 0);
    const producedQty = state.styleProductionEntries.filter((e) => e.styleId === style.id && matchesDate(e.date, reportDate)).reduce((s, e) => s + entryProducedQty(e), 0);
    const acceptedQty = state.acceptanceEntries.filter((e) => e.styleId === style.id && matchesDate(e.date, reportDate)).reduce((s, e) => s + e.items.reduce((a, i) => a + i.accepted, 0), 0);
    const rejectedQty = state.acceptanceEntries.filter((e) => e.styleId === style.id && matchesDate(e.date, reportDate)).reduce((s, e) => s + e.items.reduce((a, i) => a + i.rejected, 0), 0);
    return { styleNumber: style.styleNumber, cutQty, producedQty, acceptedQty, rejectedQty, balance: cutQty - acceptedQty };
  }).filter((row) => row.cutQty || row.producedQty || row.acceptedQty || row.rejectedQty || !reportDate);
}

function operationCostRows(reportDate = "") {
  const map = new Map();
  state.productionEntries.filter((e) => matchesDate(e.date, reportDate)).forEach((e) => {
    const key = `${e.styleId}__${e.operationName}`;
    const row = map.get(key) || { styleNumber: byId(e.styleId)?.styleNumber || "-", operationName: e.operationName, quantity: 0, rate: num(e.operationRate), amount: 0 };
    row.quantity += num(e.quantity);
    row.amount += num(e.quantity) * num(e.operationRate);
    map.set(key, row);
  });
  return [...map.values()].sort((a, b) => a.styleNumber.localeCompare(b.styleNumber));
}

function cuttingReportRows(reportDate = "") {
  return state.cuttingEntries
    .filter((entry) => matchesDate(entry.date, reportDate))
    .slice()
    .sort((a, b) => clean(b.date).localeCompare(clean(a.date)))
    .map((entry) => {
      const style = byId(entry.styleId);
      return {
        date: entry.date,
        image: style?.image || "",
        styleNumber: style?.styleNumber || "-",
        color: style?.color || "",
        service: entry.service || "",
        quantities: getSizeQuantities(entry.quantities),
        totalQty: sumObj(entry.quantities),
        sizeWise: formatQuantities(entry.quantities),
        remarks: entry.remarks || ""
      };
    });
}

function dispatchReportRows(reportDate = "") {
  const rows = [];
  state.styles.forEach((style) => {
    getSizes().forEach((size) => {
      const cutQty = state.cuttingEntries
        .filter((entry) => entry.styleId === style.id && matchesDate(entry.date, reportDate))
        .reduce((sum, entry) => sum + num(entry.quantities?.[size]), 0);
      const makeQty = state.styleProductionEntries
        .filter((entry) => entry.styleId === style.id && matchesDate(entry.date, reportDate))
        .reduce((sum, entry) => sum + num(entry.quantities?.[size]), 0);
      const dispatchQty = state.dispatchEntries
        .filter((entry) => entry.styleId === style.id && matchesDate(entry.date, reportDate))
        .reduce((sum, entry) => sum + num(entry.quantities?.[size]), 0);
      if (!cutQty && !makeQty && !dispatchQty && reportDate) return;
      if (!cutQty && !makeQty && !dispatchQty) return;
      const amount = (makeQty * num(style.cmtRate)) + ((makeQty * num(style.cmtRate) * num(style.serviceChargePct)) / 100);
      rows.push({
        styleNumber: style.styleNumber,
        color: style.color,
        image: style.image || "",
        size,
        cutQty,
        makeQty,
        dispatchQty,
        amount,
        balance: cutQty - dispatchQty
      });
    });
  });
  return rows.sort((a, b) => `${a.styleNumber}${a.color}${a.size}`.localeCompare(`${b.styleNumber}${b.color}${b.size}`));
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `piece-rate-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      state = { ...DEFAULTS, ...JSON.parse(String(reader.result)) };
      normalizeState();
      await persistState();
      alert("Data imported successfully.");
    } catch {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
  els.importInput.value = "";
}

async function importStylesCsv(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  pendingStyleImportFile = file;
  await importPendingStylesCsv();
}

async function importStylesCsvFromPendingSelection() {
  if (!pendingStyleImportFile && !els.styleImportInput?.files?.[0]) return;
  pendingStyleImportFile = pendingStyleImportFile || els.styleImportInput.files[0];
  await importPendingStylesCsv();
}

async function importPendingStylesCsv() {
  const file = pendingStyleImportFile;
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    if (styleImportNeedsLocalImages(rows) && !els.styleImageImportInput?.files?.length) {
      alert("This style CSV uses image file names. Please select those image files in 'Select Style Images' and the import will continue.");
      return;
    }
    const importedImageMap = await buildImportedImageMap(els.styleImageImportInput?.files);
    rows.forEach((row) => {
      const styleNumber = clean(row.styleNumber);
      if (!styleNumber) return;
      const existing = state.styles.find((s) => s.styleNumber.toLowerCase() === styleNumber.toLowerCase());
      const color = clean(row.color);
      const variant = state.styles.find((s) => s.styleNumber.toLowerCase() === styleNumber.toLowerCase() && clean(s.color).toLowerCase() === color.toLowerCase());
      const operations = extractOperations(row);
      const resolvedImage = resolveImportedImage(row.image, importedImageMap);
      const payload = {
        id: variant?.id || uid(),
        styleNumber,
        buyerName: clean(row.buyerName),
        styleName: clean(row.styleName),
        color,
        orderQty: num(row.orderQty),
        cmtRate: num(row.cmtRate),
        serviceChargePct: num(row.serviceChargePct),
        image: resolvedImage || variant?.image || existing?.image || "",
        notes: clean(row.notes),
        operations
      };
      if (variant) {
        Object.assign(variant, payload);
      } else if (existing && !color) {
        Object.assign(existing, payload);
      } else {
        state.styles.push(payload);
      }
    });
    await persistState();
    alert("Styles imported successfully.");
  } catch {
    alert("Could not import style CSV.");
  }
  pendingStyleImportFile = null;
  els.styleImportInput.value = "";
  if (els.styleImageImportInput) els.styleImageImportInput.value = "";
}

function styleImportNeedsLocalImages(rows) {
  return rows.some((row) => {
    const imageValue = clean(row.image);
    return imageValue && !isDirectImageSource(imageValue);
  });
}

async function importCuttingCsv(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    rows.forEach((row) => {
      const style = findStyleByNumber(row.styleNumber, row.color);
      if (!style) return;
      state.cuttingEntries.push({
        id: uid(),
        date: clean(row.date),
        styleId: style.id,
        service: clean(row.service),
        remarks: clean(row.remarks),
        quantities: sizeQuantitiesFromRow(row)
      });
    });
    await persistState();
    alert("Cutting data imported successfully.");
  } catch {
    alert("Could not import cutting CSV.");
  }
  els.cuttingImportInput.value = "";
}
async function importProductionCsv(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    rows.forEach((row) => {
      const style = findStyleByNumber(row.styleNumber, row.color);
      if (!style) return;
      const operationName = clean(row.operationName);
      const op = style.operations.find((x) => x.operationName.toLowerCase() === operationName.toLowerCase());
      state.productionEntries.push({
        id: uid(),
        date: clean(row.date),
        styleId: style.id,
        operationName,
        operationRate: op ? num(op.rate) : num(row.operationRate),
        workerName: clean(row.workerName),
        size: clean(row.size),
        quantity: num(row.quantity),
        remarks: clean(row.remarks)
      });
    });
    await persistState();
    alert("Production data imported successfully.");
  } catch {
    alert("Could not import production CSV.");
  }
  els.productionImportInput.value = "";
}

async function importStyleProductionCsv(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    rows.forEach((row) => {
      const style = findStyleByNumber(row.styleNumber, row.color);
      if (!style) return;
      const quantities = sizeQuantitiesFromRow(row);
      state.styleProductionEntries.push({
        id: uid(),
        date: clean(row.date),
        styleId: style.id,
        totalQty: num(row.totalQty),
        remarks: clean(row.remarks),
        quantities
      });
    });
    await persistState();
    alert("Style production data imported successfully.");
  } catch {
    alert("Could not import style production CSV.");
  }
  if (els.styleProductionImportInput) els.styleProductionImportInput.value = "";
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((h) => clean(h));
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((value) => value.trim());
}

function extractOperations(row) {
  const operations = [];
  for (let i = 1; i <= 10; i += 1) {
    const name = clean(row[`operation${i}Name`]);
    if (!name) continue;
    operations.push({ operationName: name, rate: num(row[`operation${i}Rate`]) });
  }
  return operations;
}

function sizeQuantitiesFromRow(row) {
  return Object.fromEntries(getSizes().map((size) => [size, num(row[size])]));
}

function findStyleByNumber(styleNumber, color = "") {
  const styleNumberText = clean(styleNumber).toLowerCase();
  const colorText = clean(color).toLowerCase();
  return state.styles.find((style) => style.styleNumber.toLowerCase() === styleNumberText && (!colorText || clean(style.color).toLowerCase() === colorText));
}

function handleStyleCardAction(e) {
  const button = e.target.closest("[data-action]");
  if (!button) return;
  const styleId = button.dataset.styleId;
  if (button.dataset.action === "edit-style") editStyle(styleId);
  if (button.dataset.action === "delete-style") void deleteStyle(styleId);
  if (button.dataset.action === "preview-image") openImagePreview(button.dataset.imageSrc, button.dataset.imageTitle);
}

function editStyle(styleId) {
  const style = byId(styleId);
  if (!style) return;
  clearPastedStyleImage();
  els.styleForm.dataset.editId = style.id;
  els.styleForm.styleNumber.value = style.styleNumber;
  els.styleForm.buyerName.value = style.buyerName || "";
  els.styleForm.styleName.value = style.styleName || "";
  els.styleForm.color.value = style.color || "";
  els.styleForm.orderQty.value = style.orderQty || "";
  els.styleForm.cmtRate.value = style.cmtRate || "";
  els.styleForm.serviceChargePct.value = style.serviceChargePct || "";
  els.styleForm.image.value = style.image && !style.image.startsWith("data:") ? style.image : "";
  els.styleForm.querySelector('[name="imageFile"]').value = "";
  els.styleForm.notes.value = style.notes || "";
  els.operationRateRows.innerHTML = "";
  (style.operations.length ? style.operations : [{ operationName: "", rate: "" }]).forEach((op) => addOperationRow(op.operationName, op.rate));
  updateStyleFormImagePreview(style.image || "");
  els.styleForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteStyle(styleId) {
  const style = byId(styleId);
  if (!style) return;
  if (hasStyleTransactions(styleId)) {
    alert("This style cannot be deleted because cutting, production, or acceptance data already exists for it.");
    return;
  }
  const confirmed = window.confirm(`Delete style ${style.styleNumber}?`);
  if (!confirmed) return;
  state.styles = state.styles.filter((s) => s.id !== styleId);
  if (els.styleForm.dataset.editId === styleId) {
    delete els.styleForm.dataset.editId;
    els.styleForm.reset();
    els.operationRateRows.innerHTML = "";
    seedOperationRows();
    setToday();
  }
  await persistState();
}

function hasStyleTransactions(styleId) {
  return state.cuttingEntries.some((e) => e.styleId === styleId)
    || state.styleProductionEntries.some((e) => e.styleId === styleId)
    || state.productionEntries.some((e) => e.styleId === styleId)
    || state.acceptanceEntries.some((e) => e.styleId === styleId)
    || state.dispatchEntries.some((e) => e.styleId === styleId);
}

function handleCuttingTableAction(e) {
  const button = e.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "edit-cutting") editCutting(button.dataset.entryId);
  if (button.dataset.action === "delete-cutting") void deleteEntry("cuttingEntries", button.dataset.entryId, "cutting entry");
}

function handleStyleProductionTableAction(e) {
  const button = e.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "edit-style-production") editStyleProduction(button.dataset.entryId);
  if (button.dataset.action === "delete-style-production") void deleteEntry("styleProductionEntries", button.dataset.entryId, "style production entry");
}

function handleProductionTableAction(e) {
  const button = e.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "edit-production") editProduction(button.dataset.entryId);
  if (button.dataset.action === "delete-production") void deleteEntry("productionEntries", button.dataset.entryId, "production entry");
}

function handleAcceptanceTableAction(e) {
  const button = e.target.closest("[data-action='edit-acceptance']");
  if (!button) return;
  editAcceptance(button.dataset.entryId);
}

function handleDispatchTableAction(e) {
  const button = e.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "edit-dispatch") editDispatch(button.dataset.entryId);
  if (button.dataset.action === "delete-dispatch") void deleteEntry("dispatchEntries", button.dataset.entryId, "dispatch entry");
}

async function deleteEntry(collectionName, entryId, label) {
  const entry = state[collectionName]?.find((item) => item.id === entryId);
  if (!entry) return;
  const confirmed = window.confirm(`Delete this ${label}?`);
  if (!confirmed) return;
  state[collectionName] = state[collectionName].filter((item) => item.id !== entryId);
  await persistState();
}

function editCutting(entryId) {
  const entry = state.cuttingEntries.find((item) => item.id === entryId);
  if (!entry) return;
  els.cuttingForm.dataset.editId = entry.id;
  els.cuttingForm.date.value = entry.date || "";
  els.cuttingForm.styleId.value = entry.styleId || "";
  els.cuttingForm.service.value = entry.service || "";
  els.cuttingForm.remarks.value = entry.remarks || "";
  fillSizeQuantities(els.cuttingSizeRows, "cut_", entry.quantities);
  els.cuttingForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editStyleProduction(entryId) {
  const entry = state.styleProductionEntries.find((item) => item.id === entryId);
  if (!entry) return;
  els.styleProductionForm.dataset.editId = entry.id;
  els.styleProductionForm.date.value = entry.date || "";
  els.styleProductionForm.styleId.value = entry.styleId || "";
  els.styleProductionForm.totalQty.value = entry.totalQty || "";
  els.styleProductionForm.remarks.value = entry.remarks || "";
  fillSizeQuantities(els.styleProductionSizeRows, "styleProd_", entry.quantities);
  els.styleProductionForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editProduction(entryId) {
  const entry = state.productionEntries.find((item) => item.id === entryId);
  if (!entry) return;
  els.productionForm.dataset.editId = entry.id;
  els.productionForm.date.value = entry.date || "";
  els.productionForm.styleId.value = entry.styleId || "";
  renderOperationSelect();
  els.productionForm.operationName.value = entry.operationName || "";
  els.productionForm.workerName.value = entry.workerName || "";
  els.productionForm.size.value = entry.size || "";
  els.productionForm.quantity.value = entry.quantity || "";
  els.productionForm.remarks.value = entry.remarks || "";
  els.productionForm.scrollIntoView({ behavior: "smooth", block: "start" });
}
function editAcceptance(entryId) {
  const entry = state.acceptanceEntries.find((item) => item.id === entryId);
  if (!entry) return;
  els.acceptanceForm.dataset.editId = entry.id;
  els.acceptanceForm.date.value = entry.date || "";
  els.acceptanceForm.styleId.value = entry.styleId || "";
  els.acceptanceForm.remarks.value = entry.remarks || "";
  entry.items.forEach((item) => {
    const acceptedInput = els.acceptanceSizeRows.querySelector(`[name="accepted_${item.size}"]`);
    const rejectedInput = els.acceptanceSizeRows.querySelector(`[name="rejected_${item.size}"]`);
    if (acceptedInput) acceptedInput.value = item.accepted || "";
    if (rejectedInput) rejectedInput.value = item.rejected || "";
  });
  els.acceptanceForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editDispatch(entryId) {
  const entry = state.dispatchEntries.find((item) => item.id === entryId);
  if (!entry) return;
  els.dispatchForm.dataset.editId = entry.id;
  els.dispatchForm.date.value = entry.date || "";
  els.dispatchForm.styleId.value = entry.styleId || "";
  els.dispatchForm.remarks.value = entry.remarks || "";
  fillSizeQuantities(els.dispatchSizeRows, "dispatch_", entry.quantities);
  els.dispatchForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillSizeQuantities(container, prefix, quantities = {}) {
  getSizes().forEach((size) => {
    const input = container.querySelector(`[name="${prefix}${size}"]`);
    if (input) input.value = quantities[size] || "";
  });
}

function upsertEntry(collectionName, payload, entryId) {
  const index = state[collectionName].findIndex((item) => item.id === entryId);
  if (index >= 0) state[collectionName][index] = payload;
  else state[collectionName].push(payload);
}

function styleLabel(style) {
  if (!style) return "-";
  return style.color ? `${style.styleNumber} - ${style.color}` : style.styleNumber;
}

function filterStyles(searchTerm = "") {
  const query = normalizeStyleSearch(searchTerm);
  if (!query) {
    return state.styles.slice().sort((a, b) => styleLabel(a).localeCompare(styleLabel(b)));
  }
  return state.styles
    .filter((style) => styleMatchesSearch(style, query))
    .sort((a, b) => styleLabel(a).localeCompare(styleLabel(b)));
}

function styleMatchesSearch(style, query) {
  const styleNumber = normalizeStyleSearch(style?.styleNumber || "");
  if (styleNumber.includes(query)) return true;
  const styleDigits = digitsOnly(styleNumber);
  const queryDigits = digitsOnly(query);
  return queryDigits.length >= 2 && styleDigits.endsWith(queryDigits);
}

function normalizeStyleSearch(value) {
  return clean(value).toLowerCase().replace(/\s+/g, "");
}

function digitsOnly(value) {
  return String(value || "").replace(/\D+/g, "");
}

function formatQuantities(quantities = {}) {
  return Object.entries(quantities).filter(([, qty]) => num(qty) > 0).map(([size, qty]) => `${size}: ${fmtInt(qty)}`).join(", ") || "-";
}

function formatProductionQuantities(entry = {}) {
  const sizeWise = formatQuantities(entry.quantities);
  if (sizeWise !== "-") return sizeWise;
  return num(entry.totalQty) > 0 ? `Total only: ${fmtInt(entry.totalQty)}` : "-";
}

function entryProducedQty(entry = {}) {
  const sizeWiseTotal = sumObj(entry.quantities);
  return sizeWiseTotal > 0 ? sizeWiseTotal : num(entry.totalQty);
}

function formatAcceptanceItems(items = []) {
  return items.filter((item) => num(item.accepted) > 0 || num(item.rejected) > 0).map((item) => `${item.size} A:${fmtInt(item.accepted)} R:${fmtInt(item.rejected)}`).join(", ") || "-";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function handleStyleImagePaste(e) {
  const clipboardItems = [...(e.clipboardData?.items || [])];
  const imageItem = clipboardItems.find((item) => item.type.startsWith("image/"));
  if (!imageItem) return;
  e.preventDefault();
  const file = imageItem.getAsFile();
  if (!file) return;
  void storePastedStyleImage(file);
}

async function pasteStyleImageFromClipboard() {
  if (!navigator.clipboard?.read) {
    setStyleImagePasteStatus("Clipboard paste button is not supported in this browser. Use Ctrl + V after copying the image.");
    return;
  }
  try {
    const clipboardItems = await navigator.clipboard.read();
    for (const item of clipboardItems) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      await storePastedStyleImage(blob);
      return;
    }
    setStyleImagePasteStatus("No image found in the clipboard.");
  } catch (error) {
    console.error(error);
    setStyleImagePasteStatus("Clipboard access was blocked. Try the button again or use Ctrl + V.");
  }
}

async function storePastedStyleImage(fileOrBlob) {
  pastedStyleImageDataUrl = await blobToDataUrl(fileOrBlob);
  const imageInput = els.styleForm?.querySelector('[name="imageFile"]');
  if (imageInput) imageInput.value = "";
  if (els.styleForm?.image) els.styleForm.image.value = "";
  setStyleImagePasteStatus("Clipboard image added. Save Style to keep it.");
  updateStyleFormImagePreview();
}

function clearPastedStyleImage() {
  pastedStyleImageDataUrl = "";
  setStyleImagePasteStatus("You can also click here after copying a screenshot and press Ctrl + V.");
}

function setStyleImagePasteStatus(message) {
  if (els.styleImagePasteStatus) els.styleImagePasteStatus.textContent = message;
}

async function handleStyleImageFileChange() {
  const file = els.styleImageFile?.files?.[0];
  if (!file) {
    updateStyleFormImagePreview();
    return;
  }
  pastedStyleImageDataUrl = await fileToDataUrl(file);
  if (els.styleForm?.image) els.styleForm.image.value = "";
  setStyleImagePasteStatus("Uploaded image selected. Save Style to keep it.");
  updateStyleFormImagePreview();
}

function updateStyleFormImagePreview(explicitSource = "") {
  if (!els.styleFormImagePreview || !els.styleFormImagePreviewImg) return;
  const source = explicitSource || pastedStyleImageDataUrl || clean(els.styleForm?.image?.value || "");
  if (!source) {
    els.styleFormImagePreview.hidden = true;
    els.styleFormImagePreviewImg.removeAttribute("src");
    return;
  }
  els.styleFormImagePreview.hidden = false;
  els.styleFormImagePreviewImg.src = source;
}

async function buildImportedImageMap(fileList) {
  const files = [...(fileList || [])];
  const entries = await Promise.all(files.map(async (file) => {
    const dataUrl = await fileToDataUrl(file);
    return [normalizeImageLookupKey(file.name), dataUrl];
  }));
  return new Map(entries);
}

function resolveImportedImage(imageValue, importedImageMap) {
  const rawValue = clean(imageValue);
  if (!rawValue) return "";
  if (isDirectImageSource(rawValue)) return rawValue;
  const lookupKeys = [
    normalizeImageLookupKey(rawValue),
    normalizeImageLookupKey(fileNameFromPath(rawValue))
  ].filter(Boolean);
  for (const key of lookupKeys) {
    if (importedImageMap.has(key)) return importedImageMap.get(key);
  }
  return "";
}

function isDirectImageSource(value) {
  return /^data:image\//i.test(value) || /^(https?:)?\/\//i.test(value) || value.startsWith("./") || value.startsWith("../") || value.startsWith("/");
}

function fileNameFromPath(value) {
  return clean(value).split(/[\\/]/).pop() || "";
}

function normalizeImageLookupKey(value) {
  return clean(value).toLowerCase();
}

async function saveSizes(e) {
  e.preventDefault();
  const sizes = parseSizeList(els.sizeListInput.value);
  if (!sizes.length) {
    alert("Please enter at least one size.");
    return;
  }
  state.settings = state.settings || {};
  state.settings.sizes = sizes;
  buildSizeInputs();
  buildSizeSelect();
  await persistState();
  alert("Sizes updated successfully.");
}

async function saveAccessCodes(e) {
  e.preventDefault();
  state.settings = state.settings || {};
  state.settings.accessCodes = state.settings.accessCodes || {};
  SECTION_ACCESS_TABS.forEach((section) => {
    state.settings.accessCodes[section] = clean(els.accessCodeForm?.elements?.[section]?.value || "");
  });
  await persistState();
  setAccessCodeStatus("Access codes saved.");
}

async function handleAccessLinkCopy(e) {
  const button = e.target.closest("[data-copy-access-link]");
  if (!button) return;
  const section = button.dataset.copyAccessLink;
  const code = getSectionAccessCode(section);
  if (!code) {
    setAccessCodeStatus(`Set and save a code for ${SECTION_ACCESS_LABELS[section]} first.`);
    return;
  }
  const shareUrl = buildSectionAccessUrl(section, code);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      setAccessCodeStatus(`${SECTION_ACCESS_LABELS[section]} link copied.`);
    } else {
      setAccessCodeStatus(shareUrl);
    }
  } catch {
    setAccessCodeStatus(shareUrl);
  }
}

function populateAccessCodeInputs() {
  if (!els.accessCodeForm) return;
  SECTION_ACCESS_TABS.forEach((section) => {
    const input = els.accessCodeForm.elements?.[section];
    if (input) input.value = getSectionAccessCode(section);
  });
}

function setAccessCodeStatus(message) {
  if (els.accessCodeStatus) els.accessCodeStatus.textContent = message;
}

function getSectionAccessCode(section) {
  return clean(state.settings?.accessCodes?.[section] || "");
}

function buildSectionAccessUrl(section, code) {
  const url = new URL(window.location.href);
  url.searchParams.set("section", section);
  url.searchParams.set("code", code);
  return url.toString();
}

function isSharedSectionTabAllowed(tabId) {
  return !activeSharedSection || tabId === "dashboard" || tabId === "reports" || tabId === activeSharedSection;
}

function applySharedSectionAccess() {
  const url = new URL(window.location.href);
  const requestedSection = clean(url.searchParams.get("section"));
  const requestedCode = clean(url.searchParams.get("code"));
  activeSharedSection = "";
  if (!requestedSection || !requestedCode || !SECTION_ACCESS_TABS.includes(requestedSection)) {
    clearSharedSectionAccess();
    return;
  }
  if (requestedCode !== getSectionAccessCode(requestedSection)) {
    clearSharedSectionAccess();
    setAccessCodeStatus(`Shared link code for ${SECTION_ACCESS_LABELS[requestedSection]} is invalid.`);
    alert("This shared section link is invalid or the access code does not match.");
    return;
  }
  activeSharedSection = requestedSection;
  if (els.sidebar) els.sidebar.classList.toggle("shared-mode", true);
  els.sidebarCards.forEach((card) => {
    card.hidden = true;
  });
  els.navLinks.forEach((btn) => {
    const allowed = isSharedSectionTabAllowed(btn.dataset.tab);
    btn.hidden = !allowed;
    btn.style.display = allowed ? "" : "none";
  });
  els.panels.forEach((panel) => {
    const allowed = isSharedSectionTabAllowed(panel.id);
    panel.hidden = !allowed;
    panel.style.display = allowed ? "" : "none";
  });
  activateTab(requestedSection);
}

function clearSharedSectionAccess() {
  if (els.sidebar) els.sidebar.classList.toggle("shared-mode", false);
  els.sidebarCards.forEach((card) => {
    card.hidden = false;
  });
  els.navLinks.forEach((btn) => {
    btn.hidden = false;
    btn.style.display = "";
  });
  els.panels.forEach((panel) => {
    panel.hidden = false;
    panel.style.display = "";
  });
  const activeButton = [...els.navLinks].find((btn) => btn.classList.contains("active")) || els.navLinks[0];
  if (activeButton) activateTab(activeButton.dataset.tab);
}

function getSizes() {
  return (state.settings?.sizes?.length ? state.settings.sizes : DEFAULT_SIZE_LIST).map((size) => clean(size)).filter(Boolean);
}

function getSizeQuantities(quantities = {}) {
  return Object.fromEntries(getSizes().map((size) => [size, num(quantities?.[size])]));
}

function parseSizeList(value) {
  return [...new Set(String(value || "").split(",").map((item) => clean(item)).filter(Boolean))];
}

function normalizeState() {
  state = { ...clone(DEFAULTS), ...state };
  state.settings = state.settings || {};
  if (!Array.isArray(state.settings.sizes) || !state.settings.sizes.length) {
    state.settings.sizes = [...DEFAULT_SIZE_LIST];
  }
  state.settings.accessCodes = { ...clone(DEFAULTS.settings.accessCodes), ...(state.settings.accessCodes || {}) };
  state.styles = (state.styles || []).map((style) => ({
    ...style,
    orderQty: num(style.orderQty),
    cmtRate: num(style.cmtRate),
    serviceChargePct: num(style.serviceChargePct),
    operations: Array.isArray(style.operations) ? style.operations : []
  }));
  state.cuttingEntries = (Array.isArray(state.cuttingEntries) ? state.cuttingEntries : []).map((entry) => ({
    ...entry,
    service: clean(entry.service)
  }));
  state.styleProductionEntries = (Array.isArray(state.styleProductionEntries) ? state.styleProductionEntries : []).map((entry) => ({
    ...entry,
    totalQty: num(entry.totalQty)
  }));
  state.productionEntries = Array.isArray(state.productionEntries) ? state.productionEntries : [];
  state.acceptanceEntries = Array.isArray(state.acceptanceEntries) ? state.acceptanceEntries : [];
  state.dispatchEntries = Array.isArray(state.dispatchEntries) ? state.dispatchEntries : [];
}

function getReportDateFilter() {
  return clean(els.reportDate.value);
}

function clearReportDateFilter() {
  els.reportDate.value = "";
  renderReports();
}

function matchesDate(entryDate, reportDate) {
  return !reportDate || clean(entryDate) === reportDate;
}

function downloadStyleAmountReport() {
  const reportDate = getReportDateFilter();
  const rows = styleBillingRows(reportDate);
  if (!rows.length) {
    alert("No style amount report found for the selected date.");
    return;
  }
  const csv = [
    ["dateFilter", "styleNumber", "color", "producedQty", "cmtRate", "serviceChargePct", "serviceChargeAmount", "totalAmount"].join(","),
    ...rows.map((row) => [csvValue(row.dateLabel), csvValue(row.styleNumber), csvValue(row.color || ""), row.producedQty, row.cmtRate, row.serviceChargePct, row.serviceChargeAmount, row.billing].join(","))
  ].join("\n");
  downloadTextFile(`style-amount-report-${reportDate || "all-dates"}.csv`, csv, "text/csv");
}

async function downloadCuttingReport() {
  const reportDate = getReportDateFilter();
  const rows = cuttingReportRows(reportDate);
  if (!rows.length) {
    alert("No cutting report found for the selected date.");
    return;
  }
  const workbook = createWorkbookOrAlert();
  if (!workbook) return;
  const sheet = workbook.addWorksheet("Cutting Report");
  const sizeColumns = getSizes();
  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Photo", key: "photo", width: 16 },
    { header: "Style", key: "styleNumber", width: 18 },
    { header: "Colour", key: "color", width: 16 },
    { header: "Service", key: "service", width: 18 },
    ...sizeColumns.map((size) => ({ header: size, key: `size_${size}`, width: 10 })),
    { header: "Total Qty", key: "totalQty", width: 12 },
    { header: "Remarks", key: "remarks", width: 24 }
  ];
  styleWorksheetHeader(sheet);
  for (const row of rows) {
    const excelRow = sheet.addRow({
      date: row.date,
      styleNumber: row.styleNumber,
      color: row.color || "",
      service: row.service || "",
      ...Object.fromEntries(sizeColumns.map((size) => [`size_${size}`, row.quantities[size] || 0])),
      totalQty: row.totalQty,
      remarks: row.remarks || ""
    });
    excelRow.height = 62;
    await addWorksheetImage(sheet, row.image, excelRow.number, 2);
  }
  finalizeWorksheet(sheet);
  await downloadWorkbook(`cutting-report-${reportDate || "all-dates"}.xlsx`, workbook);
}

async function downloadInternalChallan() {
  const reportDate = getReportDateFilter();
  const rows = cuttingReportRows(reportDate);
  if (!rows.length) {
    alert("No cutting entries found for internal challan.");
    return;
  }
  const pdf = createPdfDocumentOrAlert();
  if (!pdf) return;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (index > 0) pdf.addPage([148, 210], "portrait");
    await buildInternalChallanPdfPage(pdf, row, index + 1);
  }
  pdf.save(`internal-challan-${reportDate || "all-dates"}.pdf`);
}

async function downloadFlowReport() {
  const reportDate = getReportDateFilter();
  const rows = dispatchReportRows(reportDate);
  if (!rows.length) {
    alert("No cut-make-dispatch report found for the selected date.");
    return;
  }
  const workbook = createWorkbookOrAlert();
  if (!workbook) return;
  const sheet = workbook.addWorksheet("Cut Make Dispatch");
  sheet.columns = [
    { header: "Photo", key: "photo", width: 16 },
    { header: "Style", key: "styleNumber", width: 18 },
    { header: "Colour", key: "color", width: 16 },
    { header: "Size", key: "size", width: 10 },
    { header: "Cut Qty", key: "cutQty", width: 11 },
    { header: "Make Qty", key: "makeQty", width: 11 },
    { header: "Dispatch Qty", key: "dispatchQty", width: 13 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Balance", key: "balance", width: 11 }
  ];
  styleWorksheetHeader(sheet);
  for (const row of rows) {
    const excelRow = sheet.addRow({
      styleNumber: row.styleNumber,
      color: row.color || "",
      size: row.size,
      cutQty: row.cutQty,
      makeQty: row.makeQty,
      dispatchQty: row.dispatchQty,
      amount: row.amount,
      balance: row.balance
    });
    excelRow.height = 62;
    await addWorksheetImage(sheet, row.image, excelRow.number, 1);
  }
  finalizeWorksheet(sheet);
  await downloadWorkbook(`cut-make-dispatch-${reportDate || "all-dates"}.xlsx`, workbook);
}

function handleImagePreviewAction(e) {
  const trigger = e.target.closest("[data-action='preview-image']");
  if (!trigger) return;
  openImagePreview(trigger.dataset.imageSrc, trigger.dataset.imageTitle);
}

function openImagePreview(src, title = "Style Preview") {
  if (!src || !els.imagePreviewModal || !els.imagePreviewModalImg) return;
  els.imagePreviewModalImg.src = src;
  els.imagePreviewModalImg.alt = title;
  const titleEl = $("imagePreviewTitle");
  if (titleEl) titleEl.textContent = title;
  els.imagePreviewModal.hidden = false;
}

function closeImagePreview() {
  if (!els.imagePreviewModal || !els.imagePreviewModalImg) return;
  els.imagePreviewModal.hidden = true;
  els.imagePreviewModalImg.removeAttribute("src");
}

function createWorkbookOrAlert() {
  if (!window.ExcelJS?.Workbook) {
    alert("XLSX export library could not load. Please refresh and try again.");
    return null;
  }
  const workbook = new window.ExcelJS.Workbook();
  workbook.creator = "Piece Rate Calculator";
  workbook.created = new Date();
  return workbook;
}

function styleWorksheetHeader(sheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8F3B20" } };
  headerRow.height = 24;
}

function finalizeWorksheet(sheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.eachRow((row) => {
    row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
}

function buildInternalChallanNumber(row, serialNumber) {
  const styleCode = clean(row.styleNumber || "STYLE").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8) || "STYLE";
  const dateCode = clean(row.date || "").replace(/-/g, "") || "DATE";
  return `${dateCode}-${styleCode}-${String(serialNumber).padStart(2, "0")}`;
}

function createPdfDocumentOrAlert() {
  const jsPdfCtor = window.jspdf?.jsPDF;
  if (!jsPdfCtor) {
    alert("PDF export library could not load. Please refresh and try again.");
    return null;
  }
  return new jsPdfCtor({
    orientation: "portrait",
    unit: "mm",
    format: [148, 210]
  });
}

async function buildInternalChallanPdfPage(pdf, row, serialNumber) {
  const pageWidth = 148;
  const pageHeight = 210;
  const margin = 8;
  const contentWidth = pageWidth - (margin * 2);
  const leftColWidth = 88;
  const rightColX = margin + leftColWidth + 4;
  const challanNumber = buildInternalChallanNumber(row, serialNumber);
  const quantities = getNonZeroQuantityPairs(row.quantities);

  pdf.setDrawColor(185, 164, 140);
  pdf.setLineWidth(0.4);
  pdf.rect(4, 4, pageWidth - 8, pageHeight - 8);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("ENVOGUE CLOTHING", pageWidth / 2, 14, { align: "center" });
  pdf.setFontSize(12);
  pdf.text("Internal Challan", pageWidth / 2, 21, { align: "center" });

  pdf.setFontSize(9);
  pdf.text(`Challan No: ${challanNumber}`, margin, 29);
  pdf.text(`Date: ${row.date || "-"}`, pageWidth - margin, 29, { align: "right" });

  drawPdfFieldBox(pdf, margin, 34, contentWidth, 10, "Issue To", "Production Department");
  drawPdfFieldBox(pdf, margin, 44, contentWidth, 10, "Purpose", "Stitching");
  drawPdfFieldBox(pdf, margin, 54, leftColWidth, 10, "Style", row.styleNumber || "-");
  drawPdfFieldBox(pdf, rightColX, 54, contentWidth - leftColWidth - 4, 10, "Colour", row.color || "-");
  drawPdfFieldBox(pdf, margin, 64, leftColWidth, 10, "Service", row.service || "-");
  drawPdfFieldBox(pdf, rightColX, 64, contentWidth - leftColWidth - 4, 10, "Total Qty", fmtInt(row.totalQty || 0));
  drawPdfFieldBox(pdf, margin, 74, contentWidth, 12, "Remarks", row.remarks || "-");

  const imageBottomY = await drawChallanImageBox(pdf, row.image, rightColX, 88, contentWidth - leftColWidth - 4, 36);

  const tableTop = 88;
  const tableWidth = leftColWidth;
  pdf.setFillColor(143, 59, 32);
  pdf.setTextColor(255, 255, 255);
  pdf.rect(margin, tableTop, tableWidth, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("Size", margin + 10, tableTop + 5.4, { align: "center" });
  pdf.text("Quantity", margin + tableWidth - 14, tableTop + 5.4, { align: "center" });
  pdf.setTextColor(0, 0, 0);

  let currentY = tableTop + 8;
  if (quantities.length) {
    quantities.forEach(([size, qty]) => {
      pdf.rect(margin, currentY, tableWidth * 0.45, 7);
      pdf.rect(margin + (tableWidth * 0.45), currentY, tableWidth * 0.55, 7);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(size), margin + (tableWidth * 0.225), currentY + 4.6, { align: "center" });
      pdf.text(fmtInt(qty), margin + (tableWidth * 0.45) + (tableWidth * 0.275), currentY + 4.6, { align: "center" });
      currentY += 7;
    });
  } else {
    pdf.rect(margin, currentY, tableWidth, 10);
    pdf.text("No size-wise details", margin + (tableWidth / 2), currentY + 6, { align: "center" });
    currentY += 10;
  }

  const signatureY = Math.max(currentY + 18, imageBottomY + 18, 175);
  pdf.line(margin, signatureY, margin + 46, signatureY);
  pdf.line(pageWidth - margin - 46, signatureY, pageWidth - margin, signatureY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("Cutting Incharge Signature", margin + 23, signatureY + 5, { align: "center" });
  pdf.text("Production Received By", pageWidth - margin - 23, signatureY + 5, { align: "center" });
}

function drawPdfFieldBox(pdf, x, y, width, height, label, value) {
  pdf.rect(x, y, width, height);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(`${label}:`, x + 2, y + 3.8);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const text = pdf.splitTextToSize(String(value || "-"), width - 4);
  pdf.text(text, x + 2, y + 7.4);
}

async function drawChallanImageBox(pdf, source, x, y, width, height) {
  pdf.rect(x, y, width, height);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("Image", x + 2, y + 4);

  const imageData = await imageSourceToBase64(source);
  if (!imageData) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("No image", x + (width / 2), y + (height / 2) + 1, { align: "center" });
    return y + height;
  }

  const imageType = imageData.startsWith("data:image/png") ? "PNG" : "JPEG";
  const fit = await calculateImageFit(width - 4, height - 8, imageData);
  pdf.addImage(imageData, imageType, x + 2 + fit.xOffset, y + 6 + fit.yOffset, fit.width, fit.height);
  return y + height;
}

async function calculateImageFit(maxWidth, maxHeight, imageData) {
  const { width: sourceWidth, height: sourceHeight } = await getImageDimensions(imageData);
  const ratio = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = Math.max(1, sourceWidth * ratio);
  const height = Math.max(1, sourceHeight * ratio);
  return {
    width,
    height,
    xOffset: (maxWidth - width) / 2,
    yOffset: (maxHeight - height) / 2
  };
}

function getImageDimensions(imageData) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({
      width: image.naturalWidth || 1,
      height: image.naturalHeight || 1
    });
    image.onerror = () => resolve({ width: 1, height: 1 });
    image.src = imageData;
  });
}

function getNonZeroQuantityPairs(quantities = {}) {
  return Object.entries(quantities).filter(([, qty]) => num(qty) > 0);
}

async function addWorksheetImage(sheet, source, rowNumber, columnNumber) {
  const imageData = await imageSourceToBase64(source);
  if (!imageData) return;
  const extension = imageData.startsWith("data:image/png") ? "png" : "jpeg";
  const imageId = sheet.workbook.addImage({
    base64: imageData,
    extension
  });
  sheet.addImage(imageId, {
    tl: { col: columnNumber - 1 + 0.15, row: rowNumber - 1 + 0.15 },
    ext: { width: 52, height: 52 }
  });
}

async function imageSourceToBase64(source) {
  const value = clean(source);
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;
  try {
    const response = await fetch(value);
    if (!response.ok) return "";
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return "";
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read blob"));
    reader.readAsDataURL(blob);
  });
}

async function downloadWorkbook(filename, workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(filename, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename, content, type) {
  downloadBlob(filename, content, type);
}

function csvValue(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

async function persistState() {
  normalizeState();
  saveLocalState();
  updateStorageModeUi();
  render();
  if (cloudEnabled()) {
    await syncStateToCloud();
  }
}

async function loadInitialState() {
  const localState = loadLocalState();
  if (!cloudEnabled()) {
    setSyncStatus("Cloud sync is not configured yet.");
    return localState;
  }

  setSyncStatus("Checking cloud data...");
  try {
    const remote = await fetchCloudState();
    if (remote?.state) {
      lastCloudUpdatedAt = clean(remote.updatedAt);
      saveLocalState(remote.state);
      setSyncStatus(`Connected to cloud. Last sync ${formatSyncTime(remote.updatedAt)}.`);
      return remote.state;
    }

    setSyncStatus("Cloud storage is empty. Your next save will create the shared dataset.");
    return localState;
  } catch (error) {
    console.error(error);
    setSyncStatus("Cloud sync could not connect. Using local browser data only.");
    return localState;
  }
}

function cloudEnabled() {
  const cfg = window.APP_CONFIG?.supabase;
  return Boolean(clean(cfg?.url) && clean(cfg?.anonKey) && window.supabase?.createClient);
}

function getSupabaseClient() {
  if (!cloudEnabled()) return null;
  if (!supabaseClient) {
    const cfg = window.APP_CONFIG.supabase;
    supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
  }
  return supabaseClient;
}

function getCloudAppId() {
  return clean(window.APP_CONFIG?.supabase?.appId) || "piece-rate-main";
}
async function fetchCloudState() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from("piece_rate_app_state")
    .select("state_json, updated_at")
    .eq("app_id", getCloudAppId())
    .maybeSingle();
  if (error) throw error;
  if (!data?.state_json) return null;
  return { state: { ...clone(DEFAULTS), ...data.state_json }, updatedAt: data.updated_at || "" };
}

async function syncStateToCloud() {
  if (isSyncing || isApplyingRemoteState) return;
  isSyncing = true;
  setSyncStatus("Syncing data to cloud...");
  try {
    const client = getSupabaseClient();
    const payload = {
      app_id: getCloudAppId(),
      state_json: state,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from("piece_rate_app_state").upsert(payload);
    if (error) throw error;
    lastCloudUpdatedAt = payload.updated_at;
    setSyncStatus(`Connected to cloud. Last sync ${formatSyncTime(payload.updated_at)}.`);
  } catch (error) {
    console.error(error);
    setSyncStatus("Cloud sync failed. Data is still saved in this browser.");
  } finally {
    isSyncing = false;
  }
}

function startCloudRefresh() {
  if (!cloudEnabled()) return;
  if (cloudRefreshTimer) window.clearInterval(cloudRefreshTimer);
  cloudRefreshTimer = window.setInterval(() => {
    void refreshFromCloud();
  }, CLOUD_REFRESH_MS);
}

async function refreshFromCloud() {
  if (!cloudEnabled() || isSyncing) return;
  try {
    const remote = await fetchCloudState();
    if (!remote?.state) return;
    if (!remote.updatedAt || remote.updatedAt === lastCloudUpdatedAt) return;
    if (JSON.stringify(remote.state) === JSON.stringify(state)) {
      lastCloudUpdatedAt = remote.updatedAt;
      setSyncStatus(`Connected to cloud. Last sync ${formatSyncTime(remote.updatedAt)}.`);
      return;
    }
    isApplyingRemoteState = true;
    state = { ...clone(DEFAULTS), ...remote.state };
    normalizeState();
    saveLocalState();
    lastCloudUpdatedAt = remote.updatedAt;
    updateStorageModeUi();
    render();
    setSyncStatus(`Cloud changes received. Last sync ${formatSyncTime(remote.updatedAt)}.`);
  } catch (error) {
    console.error(error);
    setSyncStatus("Cloud sync check failed. Working from local data until the next refresh.");
  } finally {
    isApplyingRemoteState = false;
  }
}

function updateStorageModeUi() {
  if (!els.storageModeBadge || !els.syncStatusText) return;
  if (cloudEnabled()) {
    els.storageModeBadge.textContent = "Shared cloud sync enabled";
    els.storageModeBadge.classList.add("is-online");
  } else {
    els.storageModeBadge.textContent = "Local browser only";
    els.storageModeBadge.classList.remove("is-online");
  }
}

function setSyncStatus(message) {
  if (els.syncStatusText) {
    els.syncStatusText.textContent = message;
  }
}

function formatSyncTime(value) {
  if (!value) return "just now";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "just now" : date.toLocaleString("en-IN");
}

function saveLocalState(nextState = state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...clone(DEFAULTS), ...JSON.parse(raw) } : clone(DEFAULTS);
  } catch {
    return clone(DEFAULTS);
  }
}

function rowsOrEmpty(rows, colspan, msg) { return rows.length ? rows.join("") : `<tr><td colspan="${colspan}" class="empty-state">${esc(msg)}</td></tr>`; }
function byId(id) { return state.styles.find((s) => s.id === id); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function uid() { return window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function clean(v) { return String(v || "").trim(); }
function num(v) { return Number(v || 0); }
function sumObj(obj) { return Object.values(obj || {}).reduce((s, v) => s + num(v), 0); }
function fmt(v) { return num(v).toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(num(v)) ? 0 : 2, maximumFractionDigits: 2 }); }
function fmtInt(v) { return num(v).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }
function esc(v) { return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function escAttr(v) { return esc(v); }
