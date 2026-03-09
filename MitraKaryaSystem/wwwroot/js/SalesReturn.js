$(document).ready(() => SalesReturnPage.Init());

const SalesReturnPage = {
 ManualPairSeq:0,
 _searchReturned: null,
 _searchReplacement: null,
 Init() {
 this.Bind();
 this.InitTables();
 this.LoadForm(0);
 this.InitProductSearch();
 },
 // ================= PRODUCT SEARCH =================
 InitProductSearch() {
 if (this._searchReturned) this._searchReturned.destroy();
 if (this._searchReplacement) this._searchReplacement.destroy();
 this._searchReturned = MksProductSearch.attach('#srProduct', {
  showPrice: true, showStock: false, blockZeroStock: false,
  onSelect: (prod) => this.AddOrIncreaseProduct(prod, false)
 });
 this._searchReplacement = MksProductSearch.attach('#srProductReplacement', {
  showPrice: true, showStock: false, blockZeroStock: false,
  onSelect: (prod) => this.AddOrIncreaseProduct(prod, true)
 });
 },
 AddOrIncreaseProduct(prod, isReplacement) {
 const linked = $('#srLinkedMode').is(':checked');
 if (linked && !isReplacement) { return toastr.info('Returned items berasal dari Sales Order. Gunakan qty kolom.'); }
 const table = isReplacement ? $('#tableSalesReturnReplacement').DataTable() : $('#tableSalesReturnItems').DataTable();
 let exists = false;
 table.rows().every(function () {
  const r = this.data();
  if (r.productID == prod.id && !isReplacement) {
  exists = true;
  r.quantity += 1;
  r.subTotal = r.quantity * r.unitPrice;
  table.row(this).data(r).invalidate();
  }
 });
 if (!exists) {
  const baseRow = {
  id: 0, productID: prod.id, product: prod.name,
  quantity: 1, unitPrice: prod.unitPrice, subTotal: prod.unitPrice,
  isReplacement: isReplacement
  };
  if (!isReplacement && !linked) { baseRow.manualPairId = (++this.ManualPairSeq); }
  if (isReplacement) { baseRow.exchangeSourceItemID = null; }
  table.row.add(baseRow).draw();
 }
 if (!isReplacement) this.RefreshPairingOptions();
 this.RefreshSummary();
 },
 // ================= BINDINGS =================
 Bind() {
 $('#srNew').off('click').on('click', () => this.LoadForm(0));
 $('#srSave').off('click').on('click', () => this.Save());
 $('#srSearch').off('click').on('click', () => this.Search());
 $('#srPrint').off('click').on('click', () => {
  const id = parseInt($('#srID').val()||'0',10);
  if(!id){ toastr.info('Save Sales Return first'); return; }
  try { MksPrint.salesReturn(); } catch (e) { console.error('Print failed', e); toastr.error('Print failed'); }
 });
 $(document).off('change.srReturnType', 'input[name="srReturnType"]').on('change.srReturnType', 'input[name="srReturnType"]', () => this.ToggleReturnType());
 $(document).off('change.srRefund', '#srRefundAmount').on('change.srRefund', '#srRefundAmount', () => this.RefreshSummary());
 $(document).off('change.srROS', '#srReturnOriginalToStock').on('change.srROS', '#srReturnOriginalToStock', () => this.RefreshSummary());
 $(document).off('change.srLinked', '#srLinkedMode').on('change.srLinked', '#srLinkedMode', () => this.ToggleLinkedMode());
 $(document).off('click.pickSO', '#btnPickSO').on('click.pickSO', '#btnPickSO', () => this.OpenPickSO());
 $(document).off('click.clearSO', '#btnClearSO').on('click.clearSO', '#btnClearSO', () => this.ClearSO());
 },
 // ================= SO PICKER =================
 ToggleLinkedMode() {
 if ($('#srLinkedMode').is(':checked')) $('#srLinkedSelectWrapper').show();
 else { $('#srLinkedSelectWrapper').hide(); this.ClearSO(); }
 },
 OpenPickSO() {
 const modal = new bootstrap.Modal(document.getElementById('pickSOModal'));
 modal.show();
 this.LoadSOGrid();
 },
 LoadSOGrid() {
 const tb = $('#tablePickSO').DataTable({
 deferRender: true,
 destroy: true,
 searching: true,
 columns: [
 { data: 'id' },
 { data: 'no' },
 { data: 'date', render: d => Common.Format.Date(d) },
 { data: 'amount', className: 'text-end', render: $.fn.dataTable.render.number(',', '.',2) },
 { data: null, orderable: false, render: () => `<button class='btn btn-sm btn-primary so-pick'><i class='fa fa-check'></i></button>` }
 ]
 });

 $.get('/SalesOrder/ReturnSourceList', (data) => {
 const list = data.result || data;
 tb.clear().rows.add(list).draw();
 });

 $('#tablePickSO').off('click.soPick').on('click.soPick', '.so-pick', function () {
 const row = tb.row($(this).closest('tr')).data();
 $('#srLinkedSOID').val(row.id);
 $('#srLinkedSONo').val(row.no);
 bootstrap.Modal.getInstance(document.getElementById('pickSOModal')).hide();
 SalesReturnPage.LoadSalesOrderItems(row.id);
 $('#srLinkedMode').prop('checked', true);
 SalesReturnPage.ToggleLinkedMode();
 });
 },
 LoadSalesOrderItems(soId) {
 $.get('/SalesOrder/GetDetailListById', { id: soId }, (res) => {
 let list = Array.isArray(res) ? res : (res && res.result ? res.result : []);
 if (!list || list.length ===0) { toastr.warning('SO items not found'); return; }
 const tbl = $('#tableSalesReturnItems').DataTable();
 tbl.clear();
 this.ManualPairSeq =0;
 list.forEach((item) => {
 const unitPrice = item.unitPrice || item.UnitPrice ||0;
 const soQty = item.quantity != null ? item.quantity : (item.Quantity != null ? item.Quantity :0);
 const remaining = item.remainingQty != null ? item.remainingQty : null;
 const maxQty = remaining != null ? remaining : soQty;
 const qty = maxQty; // default quantity follows SO qty or remaining qty
 tbl.row.add({
 id:0,
 productID: item.productID || item.ProductID,
 product: item.product || item.Product || item.productName || item.ProductName,
 quantity: qty,
 unitPrice: unitPrice,
 subTotal: unitPrice * qty,
 sourceSalesOrderItemID: item.id || item.ID,
 maxQty: maxQty
 });
 });
 tbl.draw();
 this.RefreshPairingOptions();
 this.RefreshSummary();
 toastr.success('Sales Order loaded. Qty default mengikuti SO.');
 });
 },
 ClearSO() { $('#srLinkedSOID').val(''); $('#srLinkedSONo').val(''); },
 // ================= FORM LOAD =================
 LoadForm(id) {
 $('#srHeader').html('<div class="p-2 text-center"><div class="spinner-border spinner-border-sm"></div></div>');
 $.get('/SalesReturn/FillForm', { id: id ||0 }, (html) => {
 $('#srHeader').html(html);
 this.ToggleReturnType();
 this.ToggleLinkedMode();
 this.LoadDetails(id);
 this.ManualPairSeq =0;
 });
 },
 // ================= TABLE INIT =================
 InitTables() { this.InitReturnedTable(); this.InitReplacementTable(); },
 InitReturnedTable() {
 $('#tableSalesReturnItems').DataTable({
 deferRender: true,
 destroy: true,
 searching: false,
 paging: false,
 info: false,
 columns: [
 { data: 'productID', visible: false },
 { data: 'product' },
 { data: 'quantity', className: 'text-end', render: (d, t, r) => t === 'display' ? this.RenderQtyInput(d, r) : d },
 { data: 'unitPrice', className: 'text-end', render: $.fn.dataTable.render.number(',', '.',2) },
 { data: 'subTotal', className: 'text-end', render: $.fn.dataTable.render.number(',', '.',2) },
 { data: null, orderable: false, className: 'text-center', render: () => `<button class='btn btn-sm btn-outline-danger sr-del' title='Remove'><i class='fa fa-trash'></i></button>` }
 ],
 data: []
 });

 const tbl = $('#tableSalesReturnItems');

 tbl.off('change.qty').on('change.qty', 'input.sr-qty', (e) => {
 const t = $('#tableSalesReturnItems').DataTable();
 const idx = t.cell($(e.target).closest('td')).index();
 if (!idx) return;
 const row = t.row(idx.row).data();
 let q = parseInt($(e.target).val(),10);
 if (isNaN(q) || q <0) q =0;
 const max = parseInt($(e.target).data('max'));
 if (!isNaN(max) && q > max) {
 q = max;
 $(e.target).val(max);
 toastr.info('Exceeds max refundable qty');
 }
 row.quantity = q;
 row.subTotal = row.unitPrice * q;
 t.row(idx.row).data(row).invalidate();
 SalesReturnPage.RefreshPairingOptions();
 SalesReturnPage.RefreshSummary();
 });

 tbl.off('click.del').on('click.del', '.sr-del', function () {
 const t = $('#tableSalesReturnItems').DataTable();
 const r = t.row($(this).closest('tr'));
 const d = r.data();
 if (d.id >0) {
 Swal.fire({ title: 'Delete item?', icon: 'warning', showCancelButton: true }).then((rs) => {
 if (rs.isConfirmed) {
 $.get('/SalesReturn/DeleteItem', { id: d.id }, (res) => {
 if (res.success) {
 r.remove().draw();
 SalesReturnPage.RefreshPairingOptions();
 SalesReturnPage.RefreshSummary();
 } else toastr.error(res.result || 'Delete failed');
 });
 }
 });
 } else {
 r.remove().draw();
 SalesReturnPage.RefreshPairingOptions();
 SalesReturnPage.RefreshSummary();
 }
 });
 },
 RenderQtyInput(val, row) {
 const max = row.maxQty != null ? row.maxQty : '';
 return `<input type="number" class="form-control form-control-sm sr-qty" value="${val}" min="0" ${max !== '' ? `max='${max}'` : ''} data-max='${max}' />`;
 },
 InitReplacementTable() {
 $('#tableSalesReturnReplacement').DataTable({
 deferRender: true,
 destroy: true,
 searching: false,
 paging: false,
 info: false,
 columns: [
 { data: 'productID', visible: false },
 { data: 'product' },
 { data: 'exchangeSourceItemID', orderable: false, render: (d, t) => t === 'display' ? this.BuildSourceSelect(d) : d },
 { data: 'quantity', className: 'text-end', render: (d, t) => t === 'display' ? `<input type="number" class="form-control form-control-sm sr-rqty" value='${d}' min='1' />` : d },
 { data: 'unitPrice', className: 'text-end', render: $.fn.dataTable.render.number(',', '.',2) },
 { data: 'subTotal', className: 'text-end', render: $.fn.dataTable.render.number(',', '.',2) },
 { data: null, orderable: false, className: 'text-center', render: () => `<button class='btn btn-sm btn-outline-danger sr-rdel' title='Remove'><i class='fa fa-trash'></i></button>` }
 ],
 data: []
 });

 const tbl = $('#tableSalesReturnReplacement');

 tbl.off('change.rqty').on('change.rqty', 'input.sr-rqty', (e) => {
 const t = $('#tableSalesReturnReplacement').DataTable();
 const idx = t.cell($(e.target).closest('td')).index();
 if (!idx) return;
 const row = t.row(idx.row).data();
 let q = parseInt($(e.target).val(),10);
 if (isNaN(q) || q <1) q =1;
 row.quantity = q;
 row.subTotal = row.unitPrice * q;
 t.row(idx.row).data(row).invalidate();
 this.RefreshSummary();
 });

 tbl.off('change.srcSel').on('change.srcSel', '.sr-source-select', (e) => {
 const t = $('#tableSalesReturnReplacement').DataTable();
 const tr = $(e.target).closest('tr');
 const row = t.row(tr).data();
 const val = $(e.target).val();
 row.exchangeSourceItemID = val ? parseInt(val,10) : null;
 if (isNaN(row.exchangeSourceItemID)) row.exchangeSourceItemID = null;
 t.row(tr).data(row).invalidate();
 });

 tbl.off('click.rdel').on('click.rdel', '.sr-rdel', function () {
 const t = $('#tableSalesReturnReplacement').DataTable();
 const r = t.row($(this).closest('tr'));
 const d = r.data();
 if (d.id >0) {
 Swal.fire({ title: 'Delete item?', icon: 'warning', showCancelButton: true }).then((rs) => {
 if (rs.isConfirmed) {
 $.get('/SalesReturn/DeleteItem', { id: d.id }, (res) => {
 if (res.success) { r.remove().draw(); SalesReturnPage.RefreshSummary(); } else toastr.error(res.result || 'Delete failed');
 });
 }
 });
 } else { r.remove().draw(); SalesReturnPage.RefreshSummary(); }
 });
 },
 BuildSourceSelect(selectedId) {
 const retTable = $('#tableSalesReturnItems').DataTable();
 let opts = '<option value="">- choose -</option>';
 retTable.rows().every(function () {
 const r = this.data();
 const qty = (r.quantity ||0);
 if (qty >0) {
 let key = r.sourceSalesOrderItemID || r.manualPairId;
 if (!key && !r.sourceSalesOrderItemID && !r.manualPairId) {
 r.manualPairId = (++SalesReturnPage.ManualPairSeq);
 key = r.manualPairId;
 }
 if (!key) return;
 opts += `<option value='${key}' ${(selectedId && selectedId == key) ? 'selected' : ''}>${r.product} (Qty ${qty})</option>`;
 }
 });
 return `<select class='form-select form-select-sm sr-source-select'>${opts}</select>`;
 },
 RefreshPairingOptions() {
 const replTable = $('#tableSalesReturnReplacement').DataTable();
 replTable.rows().every(function () { this.invalidate(); });
 replTable.draw(false);
 },
 // ================= DATA LOAD =================
 LoadDetails(id) {
 const ret = $('#tableSalesReturnItems').DataTable();
 const rep = $('#tableSalesReturnReplacement').DataTable();
 if (!id) { ret.clear().draw(); rep.clear().draw(); this.RefreshSummary(); return; }
 $.get('/SalesReturn/GetDetailList', { id: id }, (res) => {
 const list = Array.isArray(res) ? res : (res && res.result ? res.result : []);
 ret.clear();
 rep.clear();
 (list || []).forEach((r) => {
 r.subTotal = r.quantity * r.unitPrice;
 if (r.isReplacement) rep.row.add(r);
 else ret.row.add(r);
 });
 ret.draw();
 rep.draw();
 this.RefreshPairingOptions();
 this.RefreshSummary();
 });
 },
 // ================= COLLECT & SAVE =================
 Collect() {
 const ret = $('#tableSalesReturnItems').DataTable();
 const details = [];
 ret.rows().every(function () {
 const r = this.data();
 if ((r.quantity ||0) >0) details.push({ ID: r.id ||0, ProductID: r.productID, Quantity: r.quantity, UnitPrice: r.unitPrice, IsReplacement: false, SourceSalesOrderItemID: r.sourceSalesOrderItemID });
 });

 const rep = $('#tableSalesReturnReplacement').DataTable();
 const repl = [];
 rep.rows().every(function () {
 const r = this.data();
 repl.push({ ID: r.id ||0, ProductID: r.productID, Quantity: r.quantity, UnitPrice: r.unitPrice, IsReplacement: true, ExchangeSourceItemID: r.exchangeSourceItemID });
 });

 return { details, repl };
 },
 Save() {
 const c = this.Collect();
 const type = $('input[name="srReturnType"]:checked').val();
 const linked = $('#srLinkedMode').is(':checked');

 if (type === 'Refund') {
 if (c.details.length ===0) { toastr.info('Masukkan minimal1 item yang diretur'); return; }
 } else if (type === 'Exchange') {
 if (c.details.length ===0) { toastr.info('Exchange perlu returned items'); return; }
 if (c.repl.length ===0) { toastr.info('Exchange perlu replacement items'); return; }
 if (linked) {
 const unpaired = c.repl.some(x => !x.ExchangeSourceItemID);
 if (unpaired) { toastr.info('Semua replacement harus dipair ke returned'); return; }
 }
 }

 const model = {
 ID: $('#srID').val(),
 Date: $('#srDate').val(),
 No: $('#srNo').val(),
 CustomerID: $('#srCustomerID').val(),
 Note: $('#srNote').val(),
 ReturnType: type,
 ReturnOriginalToStock: $('#srReturnOriginalToStock').is(':checked'),
 RefundAmount: $('#srRefundAmount').val(),
 IsLinked: linked,
 LinkedSalesOrderID: $('#srLinkedSOID').val(),
 Details: c.details,
 ReplacementDetails: c.repl
 };

 $('#srSave').prop('disabled', true);
 $('#srSave .spinner-border').removeClass('d-none');

 $.ajax({ url: '/SalesReturn/Save', type: 'POST', data: model })
 .done((res) => {
 if (res.success) {
 toastr.success('Saved');
 $('#srID').val(res.id);
 $('#srNo').val(res.no);
 if (res.netDifference !== undefined) {
 $('#lblSummaryNet').text(parseFloat(res.netDifference).toFixed(2));
 const note = res.netDifference >0 ? 'Customer Pays' : (res.netDifference <0 ? 'Refund to Customer' : 'Even');
 $('#lblSummaryNetNote').text(note);
 }
 } else toastr.error(res.result || 'Save failed');
 })
 .fail((err) => toastr.error(err.responseText || 'Error'))
 .always(() => {
 $('#srSave').prop('disabled', false);
 $('#srSave .spinner-border').addClass('d-none');
 });
 },
 // ================= SUMMARY =================
 ToggleReturnType() {
 const type = $('input[name="srReturnType"]:checked').val();
 if (type === 'Exchange') {
 $('#srExchangePanel').removeClass('d-none');
 $('#rowSummaryReplacement,#rowSummaryNet').removeClass('d-none');
 $('#rowSummaryRefund').addClass('d-none');
 } else {
 const rep = $('#tableSalesReturnReplacement').DataTable();
 rep.clear().draw();
 $('#srExchangePanel').addClass('d-none');
 $('#rowSummaryReplacement,#rowSummaryNet').addClass('d-none');
 $('#rowSummaryRefund').removeClass('d-none');
 }
 this.RefreshSummary();
 },
 RefreshSummary() {
 const ret = $('#tableSalesReturnItems').DataTable();
 let totalReturned =0;
 ret.rows().every(function () { const r = this.data(); totalReturned += (r.quantity * r.unitPrice); });

 const rep = $('#tableSalesReturnReplacement').DataTable();
 let totalReplacement =0;
 rep.rows().every(function () { const r = this.data(); totalReplacement += (r.quantity * r.unitPrice); });

 $('#srTotal').text(totalReturned.toFixed(2));
 $('#srReplacementTotal').text(totalReplacement.toFixed(2));
 $('#lblSummaryReturned').text(totalReturned.toFixed(2));
 $('#lblSummaryReplacement').text(totalReplacement.toFixed(2));

 const type = $('input[name="srReturnType"]:checked').val();
 if (type === 'Exchange') {
 const net = totalReplacement - totalReturned;
 $('#lblSummaryNet').text(net.toFixed(2));
 $('#lblSummaryNetNote').text(net >0 ? 'Customer Pays' : (net <0 ? 'Refund to Customer' : 'Even'));
 } else {
 const refundInput = parseFloat($('#srRefundAmount').val()) ||0;
 $('#lblSummaryRefund').text(refundInput.toFixed(2));
 }
 },
 // ================= SEARCH =================
 Search() {
 const modal = new bootstrap.Modal(document.getElementById('srSearchModal'));
 modal.show();
 const tb = $('#tableSalesReturnSearch').DataTable({
 deferRender: true,
 destroy: true,
 searching: false,
 columns: [
 { data: 'no' },
 { data: 'date', render: d => Common.Format.Date(d) },
 { data: 'customer' },
 { data: 'amount', className: 'text-end', render: $.fn.dataTable.render.number(',', '.',2) },
 { data: null, orderable: false, className: 'text-center', render: () => `<div class="btn-group btn-group-sm"><button class='btn btn-outline-primary sr-edit' title='Edit'><i class='fa fa-pencil'></i></button><button class='btn btn-outline-danger sr-del2' title='Delete'><i class='fa fa-trash'></i></button></div>` }
 ]
 });

 $.get('/SalesReturn/GetSearchList', function (data) {
 const list = Array.isArray(data) ? data : (data && data.result ? data.result : []);
 tb.clear().rows.add(list).draw();
 });

 $('#tableSalesReturnSearch').off('click.edit').on('click.edit', '.sr-edit', function () { const row = tb.row($(this).closest('tr')).data(); SalesReturnPage.LoadForm(row.id); modal.hide(); });

 $('#tableSalesReturnSearch').off('click.del').on('click.del', '.sr-del2', function () { const row = tb.row($(this).closest('tr')).data(); Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true }).then((r) => { if (r.isConfirmed) { $.get('/SalesReturn/Delete', { id: row.id }, (res) => { if (res.success) { toastr.success('Deleted'); SalesReturnPage.LoadForm(0); SalesReturnPage.Search(); } else toastr.error(res.result || 'Delete failed'); }); } }); });
 }
};