$(document).ready(function () {
    formSalesOrder.fillForm(0, true);
    controlSalesOrder.init();
    buttonSalesOrder.init();
});

const tradeStatus = { 1: 'Draft', 2: 'Paid', 3: 'Debt', 4: 'PartialRefund', 5: 'Refund', 6: 'PartialExchange', 7: 'Exchange', 8: 'Completed' };
const tradeStatusBadge = { 1: 'badge-draft', 2: 'badge-paid', 3: 'badge-debt', 4: 'badge-refund', 5: 'badge-refund', 6: 'badge-exchange', 7: 'badge-exchange', 8: 'badge-completed' };
const doStatus = { 1: 'Pending', 2: 'Assigned', 3: 'Out For Delivery', 4: 'Delivered', 5: 'Canceled' };

// small helper utilities
const uiHelpers = {
    setText: (selector, text) => $(selector).text(text),
    setHtml: (selector, html) => $(selector).html(html),
    toggleClass: (selector, className, shouldHave) => $(selector).toggleClass(className, shouldHave),
    disableElements: ($container, disabled) => $container.find('input,textarea,select').prop('disabled', disabled),
    formatNumber: (num, decimals = 2) => Number(num || 0).toFixed(decimals)
};

function normalizeListResult(list) {
    if (Array.isArray(list)) return list;
    if (list && Array.isArray(list.result)) return list.result;
    if (list && Array.isArray(list.data)) return list.data;
    // additional fallbacks
    const fallbacks = ['salesOrderDetails', 'SalesOrderDetails', 'items', 'Items', 'list', 'List', 'details', 'Details'];
    for (const key of fallbacks) { if (list && Array.isArray(list[key])) return list[key]; }
    return [];
}

function updateStatusBadge(statusID) {
    const $badge = $('#salesOrderStatus');
    const text = tradeStatus[statusID] || 'Draft';
    $badge.text(text);
    $badge.attr('class', 'badge-status ' + (tradeStatusBadge[statusID] || 'badge-draft'));
    // Update workflow bar
    $('#soWorkflowBar .wf-step').each(function() {
        const step = parseInt($(this).data('step'));
        $(this).removeClass('active done');
        if (step < statusID) $(this).addClass('done');
        else if (step === statusID) $(this).addClass('active');
    });
    togglePaymentButton(statusID);
    setTimeout(applyLockState, 50);
}

function togglePaymentButton(statusID) {
    if (statusID == null) { statusID = parseInt($('#salesOrderStatusID').val() || '0', 10); }
    const $btnPay = $('#btnAddPayment');
    $btnPay.toggleClass('d-none', statusID === 2);
}

function applyLockState() {
    const statusID = parseInt($('#salesOrderStatusID').val() || '0', 10);
    const forcedLocked = ($('#salesOrderIsLocked').val() || '').toString().toLowerCase() === 'true';
    const lockedStatuses = [2, 4, 5, 6, 7, 8];
    const isLocked = forcedLocked || lockedStatuses.includes(statusID);
    const $form = $('#salesOrderHeaderBody');
    if (isLocked) {
        uiHelpers.disableElements($form, true);
        $('#soProductSearch').prop('disabled', true);
        // keep Create Invoice visible even when locked
        $('#buttonSave,#btnCreateDO').addClass('d-none');
    } else {
        uiHelpers.disableElements($form, false);
        $('#soProductSearch').prop('disabled', false);
        $('#buttonSave').removeClass('d-none');
    }
}

function showOrHideCreateDOButton() {
    const soId = parseInt($('#salesOrderID').val() || '0', 10);
    const statusID = parseInt($('#salesOrderStatusID').val() || '1', 10);
    const $btn = $('#btnCreateDO');
    if (soId > 0 && statusID >= 2) { // allow from status2 and above
        // Check if DO exists
        Common.Api.get('/DeliveryOrder/List?statusID=')
            .then(list => {
                const data = normalizeListResult(list);
                const exists = Array.isArray(data) && data.some(d => (d.salesOrderID || d.SalesOrderID) === soId);
                $btn.toggleClass('d-none', exists);
            })
            .catch(() => { $btn.addClass('d-none'); });
    } else { $btn.addClass('d-none'); }
}

function showCreateInvoiceButton() {
    const soId = parseInt($('#salesOrderID').val() || '0', 10);
    const $btn = $('#btnCreateInvoice');
    if (soId <= 0) { $btn.addClass('d-none'); return; }
    // check if invoice exists
    Common.Api.get(`/SalesInvoice/ExistsForSO?soId=${soId}`)
        .then(res => {
            const exists = !!(res && (res.exists === true || res.exists === 1));
            $btn.toggleClass('d-none', exists).prop('disabled', exists);
        })
        .catch(() => { $btn.removeClass('d-none'); });
}

// Auto-toggle payment type based on amount vs grand total
$(document).off('input', '#piAmount').on('input', '#piAmount', function () {
    const total = Number($('#total').text() || '0');
    const val = Number($(this).val() || '0');
    if (total > 0 && val >= total) { $('input[name="piType"][value="Full"]').prop('checked', true); }
    else if (val > 0 && val < total) { $('input[name="piType"][value="DP"]').prop('checked', true); }
});

function loadDeliveryOrderInfo() {
    const soId = parseInt($('#salesOrderID').val() || '0', 10);
    if (!soId) { $('#deliveryOrderSection').hide(); return; }
    Common.Api.get('/DeliveryOrder/List')
        .then(list => {
            const data = normalizeListResult(list);
            const doData = (Array.isArray(data) ? data : []).find(d => (d.salesOrderID || d.SalesOrderID) === soId);
            if (!doData) { $('#deliveryOrderSection').hide(); return; }
            $('#deliveryOrderSection').show();
            $('#deliveryOrderNo').text(doData.no || doData.No);
            const sId = doData.statusID || doData.StatusID;
            const sTxt = doStatus[sId] || '-';
            const $b = $('#deliveryOrderStatusBadge');
            $b.text(sTxt).removeClass('bg-secondary bg-info bg-warning bg-success bg-danger');
            const statusToClass = { 1: 'bg-secondary', 2: 'bg-info', 3: 'bg-warning', 4: 'bg-success' };
            $b.addClass(statusToClass[sId] || 'bg-danger');
            $('#btnViewDO').removeClass('d-none').off('click').on('click', function () { deliveryOrderModal.open(doData.id || doData.ID); });
        })
        .catch(() => { $('#deliveryOrderSection').hide(); });
}

const buttonSalesOrder = {
    init: function () {
        $('#buttonSave').click(function (event) {
            event.preventDefault();
            const table = $('#tableProduct').DataTable();
            if (table.rows().count() <= 0) { toastr.info('Insert at least1 product', 'Cannot save'); return; }
            formSalesOrder.save(false);
        });
        $('#buttonSearch').click(function () { tableManager.fillGridSearch(); });
        $('#buttonNew').click(function () { formSalesOrder.reset(); });
        $('#buttonPrint').click(function () { const id = parseInt($('#salesOrderID').val() || '0', 10); if (!id) { toastr.info('Save Sales Order first'); return; } MksPrint.salesOrder(); });

        $(document).on('click', '#btnCreateDO', function () {
            const soId = parseInt($('#salesOrderID').val() || '0', 10); if (!soId) { toastr.info('Save SO first'); return; }
            const $self = $(this);
            $self.prop('disabled', true).text('Processing...');
            Common.Api.post('/DeliveryOrder/CreateFromSO', { soId: soId })
                .then(res => {
                    if (res.success) { toastr.success('Delivery Order created'); loadDeliveryOrderInfo(); $('#btnCreateDO').addClass('d-none'); }
                    else toastr.error(res.result || 'Failed create DO');
                })
                .catch(() => toastr.error('Error create DO'))
                .finally(() => $self.prop('disabled', false).html('<i class="fa fa-truck"></i> Create Delivery Order'));
        });

        $(document).on('click', '#btnCreateInvoice', function () {
            const soId = parseInt($('#salesOrderID').val() || '0', 10);
            if (!soId) { toastr.info('Save SO first'); return; }
            const $btn = $(this);
            const original = $btn.html();
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...');
            Common.Api.post('/SalesInvoice/CreateFromSO', { soId: soId })
                .then(res => {
                    if (res && res.success) {
                        toastr.success('Invoice created' + (res.no ? ` (${res.no})` : ''));
                        $('#btnCreateInvoice').addClass('d-none');
                    } else {
                        toastr.error((res && res.result) || 'Failed create invoice');
                    }
                })
                .catch(() => toastr.error('Error create invoice'))
                .finally(() => $btn.prop('disabled', false).html(original));
        });

        $(document).on('click', '#btnAddPayment', function () {
            const so = {
                id: parseInt($('#salesOrderID').val() || '0', 10),
                customerID: parseInt($('#selectCustomer').val() || '0', 10),
                customerName: $('#selectCustomer option:selected').text(),
                amount: Number($('#total').text() || '0'),
                paidAmount: Number($('#salesOrderPaidAmount').val() || '0')
            };
            if (!so.id) { toastr.info('Save SO first'); return; }
            const remaining = so.amount - so.paidAmount;
            // Only block when SO has a positive amount and no remaining balance.
            if (so.amount > 0 && remaining <= 0) { toastr.info('Already fully paid'); return; }
            PaymentIn.openFromSO(so);
        });

        $(document).on('so:payment:updated', function (e, res) {
            if (res && res.paymentStatusID) { $('#salesOrderStatusID').val(res.paymentStatusID); updateStatusBadge(res.paymentStatusID); togglePaymentButton(res.paymentStatusID); }
        });
    }
};

const deliveryOrderModal = {
    open: function (id) {
        Common.Api.get(`/DeliveryOrder/Get?id=${id}`)
            .then(data => {
                const status = data.statusID || data.StatusID;
                const driverNameFromApi = data.driverName || data.DriverName || null;
                const driverId = data.driverUserID || data.DriverUserID || null;
                const steps = [1, 2, 3, 4];
                const stepHtml = steps.map(s => { const active = status >= s ? 'active-step' : ''; const label = doStatus[s]; return `<div class="do-step ${active}"><div class='circle'>${s}</div><div class='label small'>${label}</div></div>`; }).join('<div class="do-line"></div>');
                const items = (data.items || data.Items || []).map(i => {
                    const pname =
                        (i.product && (i.product.name || i.product.Name)) ||
                        (i.Product && (i.Product.name || i.Product.Name)) ||
                        i.productName || i.ProductName || i.name || i.Name ||
                        (i.productID || i.ProductID);
                    const qty = i.quantity || i.Quantity;
                    return `<tr><td>${pname}</td><td>${qty}</td></tr>`;
                }).join('');
                const custIdRaw = data.customerID || data.CustomerID;
                let isGeneral = false;
                if (custIdRaw !== undefined && custIdRaw !== null) { isGeneral = Number(custIdRaw) === 0; }
                else { isGeneral = (parseInt($('#selectCustomer').val() || '0', 10) === 0); }
                const addressVal = (data.deliveryAddress || data.DeliveryAddress) || '';
                const addressHtml = (!isGeneral && addressVal) ? `<div class='mb-2'><strong>Address:</strong> ${addressVal}</div>` : '';
                // NOTE: Do not show SO ID here per request
                const modalHtml = `<div class='text-start'>
 <div class='do-progress d-flex align-items-center justify-content-between mb-3 flex-wrap'>${stepHtml}</div>
 <div class='mb-2'><strong>DO No:</strong> ${data.no || data.No}</div>
 <div class='mb-2'><strong>Status:</strong> ${doStatus[status]} &nbsp; <strong>Driver:</strong> <span id='doDriverLabel'>${driverNameFromApi || '-'}</span></div>
 ${addressHtml}
 <div class='border rounded p-2 mb-2'><div class='fw-bold mb-1'>Items</div><table class='table table-sm mb-0'><thead><tr><th>Product</th><th>Qty</th></tr></thead><tbody>${items}</tbody></table></div>
 <div id='assignDriverContainer' class='mt-2 d-none'>
 <div class='row g-2 align-items-center'>
 <div class='col-12 col-md-7'>
 <select id='selectDriver' class='form-select'>
 <option value=''>-- Select driver --</option>
 </select>
 </div>
 <div class='col'>
 <button class='btn btn-sm btn-primary' id='btnSaveAssign'>Save</button>
 <button class='btn btn-sm btn-outline-secondary' id='btnCancelAssign'>Cancel</button>
 </div>
 </div>
 </div>
 <div class='mt-3 d-flex justify-content-end flex-wrap' id='doActionContainer'></div>
 </div>`;
                let actionBtns = '';
                if (status === 1) { actionBtns += `<button class='btn btn-sm btn-outline-primary me-2' id='btnAssignDriver'><i class='fa fa-user'></i> Assign Driver</button>`; }
                if (status === 2) { actionBtns += `<button class='btn btn-sm btn-outline-warning me-2' id='btnOutForDelivery'><i class='fa fa-truck'></i> Out For Delivery</button>`; }
                if (status === 3) { actionBtns += `<button class='btn btn-sm btn-outline-success me-2' id='btnMarkDelivered'><i class='fa fa-check'></i> Mark Delivered</button>`; }
                Swal.fire({ title: 'Delivery Order', html: modalHtml, width: 720, showConfirmButton: false, showCloseButton: true });
                if (actionBtns) $('#doActionContainer').html(actionBtns);
                // populate driver select and resolve driver label if only ID provided
                deliveryOrderModal.loadDrivers(function (users) {
                    if (!driverNameFromApi && driverId) {
                        const found = (users || []).find(u => (u.id || u.ID) == driverId);
                        if (found) {
                            const name = found.name || found.Name || found.userName || found.UserName;
                            $('#doDriverLabel').text(name);
                        }
                    }
                });
                deliveryOrderModal.bindActions(id, status);
            })
            .catch(() => toastr.error('Failed load DO'));
    },
    loadDrivers: function (callback) { 
        Common.Api.get('/DeliveryOrder/GetDrivers')
            .then(list => { 
                let data = list; 
                if (list && list.result) data = list.result; 
                const sel = $('#selectDriver'); 
                if (!sel.length) { if (typeof callback === 'function') callback(data); return; } 
                sel.empty().append(`<option value=''>-- Select driver --</option>`); 
                (data || []).forEach(u => sel.append(`<option value='${u.id || u.ID}'>${u.name || u.Name || u.userName || u.UserName}</option>`)); 
                if (typeof callback === 'function') callback(data); 
            })
            .catch(() => { if (typeof callback === 'function') callback([]); });
    },
    bindActions: function (id, status) {
        $(document).off('click', '#btnAssignDriver').on('click', '#btnAssignDriver', function () { $('#assignDriverContainer').removeClass('d-none'); });
        $(document).off('click', '#btnCancelAssign').on('click', '#btnCancelAssign', function () { $('#assignDriverContainer').addClass('d-none'); });
        $(document).off('click', '#btnSaveAssign').on('click', '#btnSaveAssign', function () { 
            const driverID = $('#selectDriver').val(); 
            if (!driverID) { toastr.info('Select driver'); return; } 
            const $btn = $('#btnSaveAssign'); 
            $btn.prop('disabled', true).text('Saving...'); 
            Common.Api.post('/DeliveryOrder/AssignDriver', { id: id, driverUserID: driverID })
                .then(res => { if (res.success) { toastr.success('Driver assigned'); Swal.close(); loadDeliveryOrderInfo(); } else toastr.error(res.result || 'Assign failed'); })
                .catch(() => toastr.error('Error assign driver'))
                .finally(() => $btn.prop('disabled', false).text('Save')); 
        });
        $(document).off('click', '#btnOutForDelivery').on('click', '#btnOutForDelivery', function () { deliveryOrderModal.updateStatus(id, 3); });
        $(document).off('click', '#btnMarkDelivered').on('click', '#btnMarkDelivered', function () { deliveryOrderModal.updateStatus(id, 4); });
    },
    updateStatus: function (id, newStatus) {
        Common.Api.post('/DeliveryOrder/UpdateStatus', { id: id, newStatus: newStatus })
            .then(res => { if (res.success) { toastr.success('Status updated'); Swal.close(); loadDeliveryOrderInfo(); } else toastr.error(res.result || 'Update failed'); })
            .catch(() => toastr.error('Error update status'));
    }
};

// ==================== TABLE MANAGER ====================
const tableManager = {
    fillGridProduct: async function (id, isReset) {
        const tableSelector = '#tableProduct';
        const $table = $(tableSelector);
        if (!$table.length) return;
        if ($.fn.DataTable.isDataTable(tableSelector)) { $table.DataTable().clear().destroy(); }
        let dataList = [];
        const parsedId = parseInt(id, 10);
        if (!isNaN(parsedId) && parsedId > 0) {
            try {
                const resp = await Common.Api.get('/SalesOrder/GetDetailListById?id=' + parsedId);
                console.log('SO detail raw response:', resp);
                if (Array.isArray(resp)) dataList = resp;
                else if (resp && Array.isArray(resp.result)) dataList = resp.result;
                else if (resp && resp.data && Array.isArray(resp.data)) dataList = resp.data;
                else {
                    const keys = ['salesOrderDetails', 'SalesOrderDetails', 'items', 'Items', 'list', 'List', 'details', 'Details'];
                    for (const k of keys) { if (resp && Array.isArray(resp[k])) { dataList = resp[k]; break; } }
                }
                // Fallback: if still empty but amount > 0, try reload using current hidden ID (maybe differs from passed id)
                if ((!dataList || dataList.length === 0) && parsedId > 0) {
                    const currentHiddenId = parseInt($('#salesOrderID').val() || '0', 10);
                    if (currentHiddenId && currentHiddenId !== parsedId) {
                        try {
                            const resp2 = await Common.Api.get('/SalesOrder/GetDetailListById?id=' + currentHiddenId);
                            console.log('Fallback SO detail response:', resp2);
                            if (Array.isArray(resp2)) dataList = resp2;
                            else if (resp2 && Array.isArray(resp2.result)) dataList = resp2.result;
                        } catch (e2) { console.warn('Fallback detail fetch failed', e2); }
                    }
                }
            } catch { dataList = []; }
        }
        dataList = (dataList || []).map(r => ({
            id: r.id ?? r.ID ?? 0,
            productID: r.productID ?? r.ProductID ?? 0,
            supplierID: r.supplierID ?? r.SupplierID ?? 0,
            stockQuantity: r.stockQuantity ?? r.StockQuantity ?? null,
            product: r.product || r.Product || r.productName || r.ProductName || '-',
            supplier: r.supplier || r.Supplier || '-',
            quantity: r.quantity ?? r.Quantity ?? 0,
            unit: r.unit || r.Unit || '-',
            unitPrice: r.unitPrice ?? r.UnitPrice ?? 0,
            subTotal: (r.subTotal ?? r.SubTotal) ?? ((r.unitPrice ?? r.UnitPrice ?? 0) * (r.quantity ?? r.Quantity ?? 0))
        }));
        const statusID = parseInt($('#salesOrderStatusID').val() || '1', 10);
        const canEditItems = (statusID === 1);
        const columns = [
            { data: 'productID', visible: false, defaultContent: 0 },
            { data: 'supplierID', visible: false, defaultContent: 0 },
            { data: 'stockQuantity', visible: false, defaultContent: 0 },
            { data: 'product' },
            { data: 'supplier' },
            canEditItems ? { data: 'quantity', render: (d,t) => t==='display'?`<input type="number" class="form-control form-control-sm quantity" value="${d}" min="1" />`:d } : { data: 'quantity', render: $.fn.dataTable.render.number(',', '.', 0) },
            { data: 'unit' },
            { data: 'unitPrice', render: $.fn.dataTable.render.number(',', '.', 2) },
            { data: 'subTotal', render: $.fn.dataTable.render.number(',', '.', 2) },
            { data: null, render: () => canEditItems ? `<button class="btn btn-sm btn-outline-danger delete"><i class="fa fa-trash"></i></button>` : '', orderable: false }
        ];
        const dt = $table.DataTable({ deferRender:true, processing:true, serverSide:false, destroy:true, filter:true, searching:false, responsive:true, columns, decimal:',', thousands:'.', data: dataList });

        // Ensure total footer recalculates right after data is drawn
        controlSalesOrder.calculateGrandTotal();
        dt.on('draw.dt', function(){ controlSalesOrder.calculateGrandTotal(); });

        $(`${tableSelector} tbody`).off(); $(tableSelector).off('change');
        if (canEditItems) {
            $(tableSelector).on('change', 'input[type="number"]', function () {
                const table = $(tableSelector).DataTable();
                const rowIndex = table.cell($(this).closest('td')).index().row;
                const row = table.row(rowIndex).data(); if (!row) return;
                let newQuantity = parseInt($(this).val(), 10); if (isNaN(newQuantity) || newQuantity < 1) newQuantity = 1;
                if (row.stockQuantity != null && newQuantity > row.stockQuantity) { toastr.info('Quantity reach stock quantity'); newQuantity = row.stockQuantity; }
                row.quantity = newQuantity; const unitPrice = parseFloat(row.unitPrice) || 0; row.subTotal = newQuantity * unitPrice;
                table.row(rowIndex).data(row).invalidate(); table.draw(false); controlSalesOrder.calculateGrandTotal();
            });
            $(`${tableSelector} tbody`).on('click', '.delete', function () {
                const row = dt.row($(this).parents('tr')).data();
                if (row && row.id) {
                    Swal.fire({
                        title:'Are you sure?', text:"You won't be able to revert this!", icon:'warning', showCancelButton:true, confirmButtonText:'Yes, delete it', showLoaderOnConfirm:true,
                        preConfirm: () => Common.Api.post(`/SalesOrder/DeleteItem`, { id: row.id })
                            .then(response => { toastr.options.onShown = () => { tableManager.fillGridProduct(parsedId, true); }; if (response && response.success) toastr.success('Data has been deleted'); else toastr.error('Data not deleted'); })
                            .catch(error => { Swal.showValidationMessage(error.message || 'Request failed'); }),
                        allowOutsideClick: () => !Swal.isLoading()
                    });
                } else { dt.row($(this).parents('tr')).remove().draw(); controlSalesOrder.calculateGrandTotal(); }
            });
        }
    },
    fillGridSearch: function () {
        const tableSelector = '#tableSearch'; const $table = $(tableSelector);
        Common.Api.get('/SalesOrder/FillGrid')
            .then(data => {
                const columns = [
                    { data:'no' }, { data:'date', render: d => Common.Format.Date(d) }, { data:'amount' },
                    { data:null, render: (_d,_t,row) => { const s = row && (row.statusID || row.StatusID || row.status || row.Status); return tradeStatus[s] || (s || ''); } },
                    { data:'customerName' }, { data:'createdBy' }, { data:'updatedBy' },
                    { data:null, render: (_d,_t,row) => `<div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary edit"><i class="fa fa-pencil"></i></button>
                        <button class="btn btn-outline-danger delete"><i class="fa fa-trash"></i></button>
                    </div>`, orderable:false }
                ];
                const dt = $table.DataTable({ deferRender:true, processing:true, serverSide:false, destroy:true, filter:true, searching:false, responsive:true, data, columns });
                $table.find('tbody').off();
                $table.find('tbody').on('click', '.edit', function(){ const row = dt.row($(this).parents('tr')).data(); const soId = row.id || row.ID; formSalesOrder.fillForm(soId, true); $('#searchModal').modal('hide'); });
                $table.find('tbody').on('click', '.delete', function(){ const row = dt.row($(this).parents('tr')).data(); Swal.fire({
                    title:'Are you sure?', text:"You won't be able to revert this!", icon:'warning', showCancelButton:true, confirmButtonText:'Yes, delete it', showLoaderOnConfirm:true,
                    preConfirm: () => Common.Api.post(`/SalesOrder/Delete`, { id: row.id || row.ID })
                        .then(response => { toastr.options.onShown = () => { tableManager.fillGridSearch(); formSalesOrder.reset(); }; if (response && response.success) toastr.success('Data has been deleted'); else toastr.error('Data not deleted'); })
                        .catch(error => { Swal.showValidationMessage(error.message || 'Request failed'); }),
                    allowOutsideClick: () => !Swal.isLoading()
                }); });
            })
            .catch(() => toastr.error('Failed load SO list'));
    }
};

// ==================== CONTROL SALES ORDER ====================
const controlSalesOrder = {
    _search: null,
    init: function () { this.initProductSearch(); },
    initProductSearch: function () {
        if (this._search) this._search.destroy();
        this._search = MksProductSearch.attach('#soProductSearch', {
            showPrice: true, showStock: true, blockZeroStock: true,
            onSelect: (prod) => this.checkProduct(prod)
        });
    },
    addRow: function (productID, supplierID, stockQuantity, productName, supplier, quantity, unit, unitPrice) { const table = $('#tableProduct').DataTable(); table.row.add({ productID, supplierID, stockQuantity: stockQuantity ?? 0, product: productName, supplier, quantity, unit, unitPrice, subTotal: quantity * unitPrice }).draw(); },
    checkProduct: function (selectedProduct) { if (selectedProduct.stockQuantity === 0) { toastr.info('Stock is empty'); return; } const table = $('#tableProduct').DataTable(); let exists = false; const rows = table.rows().nodes(); $(rows).each(function(){ const rowData = table.row(this).data(); if (rowData.productID == selectedProduct.id) { exists = true; let newQuantity = parseInt(rowData.quantity) + 1; if (newQuantity > selectedProduct.stockQuantity) { return toastr.info('Quantity reach stock quantity'); } rowData.quantity = newQuantity; rowData.subTotal = newQuantity * rowData.unitPrice; table.row(this).data(rowData).invalidate(); } }); if (!exists) { controlSalesOrder.addRow(selectedProduct.id, selectedProduct.supplierID, selectedProduct.stockQuantity, selectedProduct.name, selectedProduct.supplierName, 1, selectedProduct.unit, selectedProduct.unitPrice); } table.draw(false); controlSalesOrder.calculateGrandTotal(); },
    calculateGrandTotal: function () { let totalSum = 0; const table = $('#tableProduct').DataTable(); const rows = table.rows().nodes(); $(rows).each(function(){ const rowData = table.row(this).data(); const subTotal = (parseFloat(rowData.unitPrice) || 0) * (parseInt(rowData.quantity) || 0); totalSum += subTotal; }); $('#total').text(uiHelpers.formatNumber(totalSum, 2)); }
};

// ==================== FORM SALES ORDER ====================
const formSalesOrder = {
    fillForm: function (id, isReset = false) {
        Common.Api.post('/SalesOrder/FillForm', { id })
            .then(result => {
                try {
                    if (result && typeof result === 'object' && result.success === false) { toastr.error(result.result || 'Error load data'); return; }
                    if (typeof result === 'string') { $('#salesOrderHeaderBody').html(result); }
                    else if (result && typeof result === 'object' && result.html) { $('#salesOrderHeaderBody').html(result.html); }
                    else if (result && typeof result === 'object') { const possibleHtml = result.result || result.data || null; if (typeof possibleHtml === 'string') $('#salesOrderHeaderBody').html(possibleHtml); else $('#salesOrderHeaderBody').html('<pre class="text-danger">Unexpected response format. Check server logs.</pre>'); }
                    // ensure table exists
                    if (!$('#tableProduct').length) {
                        $('#salesOrderHeaderBody').after(`<div class='table-responsive'><table class='table table-sm table-hover align-middle mb-0' width='100%' id='tableProduct'><thead><tr><th hidden>ProductID</th><th hidden>SupplierID</th><th hidden>Stock Quantity</th><th>Name</th><th>Supplier</th><th class="text-center" style="width:90px">Quantity</th><th style="width:80px">Unit</th><th class="text-end" style="width:120px">Unit Price</th><th class="text-end" style="width:130px">Subtotal</th><th class="text-center" style="width:60px"></th></tr></thead><tbody></tbody><tfoot><tr><th colspan='8' class='text-end text-muted small fw-semibold'>TOTAL</th><th id='total' class='text-end fs-5 fw-bold text-primary'>0</th><th></th></tr></tfoot></table></div>`);
                    }
                    const statusVal = parseInt($('#salesOrderStatusID').val() || '1', 10); updateStatusBadge(statusVal);
                    setTimeout(() => { try { tableManager.fillGridProduct(id, true); } catch (e) { console.error('fillGridProduct failed', e); } }, 0);
                    try { controlSalesOrder.initProductSearch(); } catch (e) { console.warn('product search init failed', e); }
                    // Do not calculate here because data may not be loaded yet; calculation will run after grid is filled
                    setTimeout(() => { try { showOrHideCreateDOButton(); showCreateInvoiceButton(); loadDeliveryOrderInfo(); togglePaymentButton(statusVal); } catch (e) { console.error('post-fill handlers failed', e); } }, 200);
                } catch (ex) { console.error('formSalesOrder.fillForm success handler error', ex); toastr.error(ex.message || 'Error processing response'); }
            })
            .catch(error => { toastr.error(error.message || 'Error load data'); });
    },
    save: function (isPay) {
        const postData = { ID: parseInt($('#salesOrderID').val() || '0', 10), Date: $('#salesOrderDate').val(), No: $('#salesOrderNumber').val(), CustomerID: $('#selectCustomer').val(), Note: $('#salesOrderNote').val(), SalesOrderDetails: [], IsPaid: !!isPay };
        const table = $('#tableProduct').DataTable();
        table.rows().every(function(){ const r = this.data(); if (r && r.productID && r.quantity) { postData.SalesOrderDetails.push({ ProductID: r.productID, Quantity: r.quantity, ID: r.id == undefined ? 0 : r.id, Subtotal: r.subTotal, UnitPrice: r.unitPrice }); } });
        const $btn = $('#buttonSave'); const originalHtml = $btn.html(); $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...');
        Common.Api.postJson('/SalesOrder/Save', postData)
            .then(result => { if (result && result.success) { toastr.success('Data saved'); const newId = result.id || result.ID; if (newId) formSalesOrder.fillForm(newId, true); else console.warn('Save response missing id/ID'); if (result.lowStockWarnings && result.lowStockWarnings.length > 0) { var msgs = result.lowStockWarnings.map(function(w){ return (w.name||w.Name)+': '+(w.stockQuantity??0)+'/'+(w.lowStockThreshold??0); }); toastr.warning('Low stock: ' + msgs.join(', '), 'Stock Alert', { timeOut: 8000 }); } } else { toastr.error((result && result.result) || 'Data not saved'); } })
            .catch(err => { toastr.error(err.message || 'Error', 'Data not saved'); })
            .finally(() => { $btn.prop('disabled', false).html(originalHtml); });
    },
    reset: function () { this.fillForm(0, true); }
};