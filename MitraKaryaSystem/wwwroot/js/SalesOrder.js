$(document).ready(function () {
    $('.js-example-basic-responsive').select2({ width: 'resolve' });
    FormSalesOrder.FillForm(0, true);
    ControlSalesOrder.Init();
    ButtonSalesOrder.Init();
});

const TradeStatus = { 1: 'Draft', 2: 'Paid', 3: 'Debt', 4: 'PartialRefund', 5: 'Refund', 6: 'PartialExchange', 7: 'Exchange', 8: 'Completed' };
const DOStatus = { 1: 'Pending', 2: 'Assigned', 3: 'Out For Delivery', 4: 'Delivered', 5: 'Canceled' };

// utility to update main status badge
function UpdateStatusBadge(statusID) {
    const $badge = $('#salesOrderStatus');
    const text = TradeStatus[statusID] || 'Draft';
    $badge.text(text);
    $badge.removeClass('text-bg-warning text-bg-success text-bg-secondary text-bg-info text-bg-primary');
    if (statusID === 2) $badge.addClass('text-bg-success');
    else if (statusID === 3) $badge.addClass('text-bg-warning');
    else if (statusID === 8) $badge.addClass('text-bg-primary');
    else $badge.addClass('text-bg-secondary');
    TogglePaymentButton(statusID);
    setTimeout(ApplyLockState, 50);
}

function TogglePaymentButton(statusID) {
    if (statusID == null) { statusID = parseInt($('#salesOrderStatusID').val() || '0', 10); }
    const $btnPay = $('#btnAddPayment');
    if (statusID === 2) { // Paid
        $btnPay.addClass('d-none');
    } else {
        $btnPay.removeClass('d-none');
    }
}

// After UpdateStatusBadge definition add helper
function ApplyLockState() {
    const statusID = parseInt($('#salesOrderStatusID').val() || '0', 10);
    const forcedLocked = ($('#salesOrderIsLocked').val() || '').toString().toLowerCase() === 'true';
    const lockedStatuses = [2, 4, 5, 6, 7, 8];
    const isLocked = forcedLocked || lockedStatuses.includes(statusID);
    const $form = $('#salesOrderHeaderBody');
    if (isLocked) {
        $form.find('input,textarea,select').prop('disabled', true);
        $('#selectProduct').prop('disabled', true).trigger('change.select2');
        // keep Create Invoice visible even when locked
        $('#buttonSave,#btnCreateDO').addClass('d-none');
    } else {
        $form.find('input,textarea,select').prop('disabled', false);
        $('#selectProduct').prop('disabled', false);
        $('#buttonSave').removeClass('d-none');
    }
}

function normalizeListResult(list){
    if (Array.isArray(list)) return list;
    if (list && Array.isArray(list.result)) return list.result;
    if (list && Array.isArray(list.data)) return list.data;
    return [];
}

function ShowOrHideCreateDOButton() {
    const soId = parseInt($('#salesOrderID').val() || '0', 10);
    const statusID = parseInt($('#salesOrderStatusID').val() || '1', 10);
    if (soId > 0 && statusID >= 2) { // allow from status 2 and above
        // Check if DO exists
        $.get('/DeliveryOrder/List', { statusID: null }, function (list) {
            const data = normalizeListResult(list);
            const exists = data.some(d => (d.salesOrderID || d.SalesOrderID) === soId);
            if (!exists) $('#btnCreateDO').removeClass('d-none'); else $('#btnCreateDO').addClass('d-none');
        });
    } else { $('#btnCreateDO').addClass('d-none'); }
}

function ShowCreateInvoiceButton() {
    const soId = parseInt($('#salesOrderID').val() || '0', 10);
    const $btn = $('#btnCreateInvoice');
    if (soId <= 0) { $btn.addClass('d-none'); return; }
    // check if invoice exists
    $.get('/SalesInvoice/ExistsForSO', { soId: soId }, function (res) {
        const exists = !!(res && (res.exists === true || res.exists === 1));
        if (exists) { $btn.addClass('d-none').prop('disabled', true); } else { $btn.removeClass('d-none').prop('disabled', false); }
    }).fail(() => { $btn.removeClass('d-none'); });
}

// Auto-toggle payment type based on amount vs grand total
$(document).off('input', '#piAmount').on('input', '#piAmount', function () {
    const total = Number($('#total').text() || '0');
    const val = Number($(this).val() || '0');
    if (total > 0 && val >= total) { $('input[name="piType"][value="Full"]').prop('checked', true); }
    else if (val > 0 && val < total) { $('input[name="piType"][value="DP"]').prop('checked', true); }
});

function LoadDeliveryOrderInfo() {
    const soId = parseInt($('#salesOrderID').val() || '0', 10);
    if (!soId) { $('#deliveryOrderSection').hide(); return; }
    $.get('/DeliveryOrder/List', function (list) {
        const data = normalizeListResult(list);
        const doData = data.find(d => (d.salesOrderID || d.SalesOrderID) === soId);
        if (!doData) { $('#deliveryOrderSection').hide(); return; }
        $('#deliveryOrderSection').show();
        $('#deliveryOrderNo').text(doData.no || doData.No);
        const sId = doData.statusID || doData.StatusID;
        const sTxt = DOStatus[sId] || '-';
        const $b = $('#deliveryOrderStatusBadge');
        $b.text(sTxt).removeClass('bg-secondary bg-info bg-warning bg-success bg-danger');
        if (sId === 1) $b.addClass('bg-secondary');
        else if (sId === 2) $b.addClass('bg-info');
        else if (sId === 3) $b.addClass('bg-warning');
        else if (sId === 4) $b.addClass('bg-success');
        else $b.addClass('bg-danger');
        $('#btnViewDO').removeClass('d-none').off('click').on('click', function () { DeliveryOrderModal.Open(doData.id || doData.ID); });
    });
}

let ButtonSalesOrder = {
    Init: function () {
        $('#buttonSave').click(function (event) {
            event.preventDefault();
            let table = $('#tableProduct').DataTable();
            if (table.rows().count() <= 0) { toastr.info('Insert at least 1 product', 'Cannot save'); return; }
            FormSalesOrder.Save(false);
        });
        $('#buttonSearch').click(function () { Table.FillGridSearch(); });
        $('#buttonNew').click(function () { FormSalesOrder.Reset(); });
        $(document).on('click', '#btnCreateDO', function () {
            const soId = parseInt($('#salesOrderID').val() || '0', 10); if (!soId) { toastr.info('Save SO first'); return; }
            $(this).prop('disabled', true).text('Processing...');
            $.post('/DeliveryOrder/CreateFromSO', { soId: soId }, function (res) {
                if (res.success) { toastr.success('Delivery Order created'); LoadDeliveryOrderInfo(); $('#btnCreateDO').addClass('d-none'); }
                else toastr.error(res.result || 'Failed create DO');
            }).fail(() => toastr.error('Error create DO')).always(() => $('#btnCreateDO').prop('disabled', false).html('<i class="fa fa-truck"></i> Create Delivery Order'));
        });
        // Create Invoice from SO
        $(document).on('click', '#btnCreateInvoice', function () {
            const soId = parseInt($('#salesOrderID').val() || '0', 10);
            if (!soId) { toastr.info('Save SO first'); return; }
            const $btn = $(this);
            const original = $btn.html();
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...');
            $.post('/SalesInvoice/CreateFromSO', { soId: soId }, function (res) {
                if (res && res.success) {
                    toastr.success('Invoice created' + (res.no ? ` (${res.no})` : ''));
                    // hide button after created
                    $('#btnCreateInvoice').addClass('d-none');
                } else {
                    toastr.error((res && res.result) || 'Failed create invoice');
                }
            }).fail(() => toastr.error('Error create invoice'))
                .always(() => $btn.prop('disabled', false).html(original));
        });
        // Save & Pay opens the payment modal (no auto-save of SO here)
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
            if (remaining <= 0) { toastr.info('Already fully paid'); return; }
            PaymentIn.openFromSO(so);
        });
        $(document).on('so:payment:updated', function (e, res) {
            if (res && res.paymentStatusID) { $('#salesOrderStatusID').val(res.paymentStatusID); UpdateStatusBadge(res.paymentStatusID); TogglePaymentButton(res.paymentStatusID); }
        });
    }
}

// Enhanced modal with progress + actions
const DeliveryOrderModal = {
    Open: function (id) {
        $.get('/DeliveryOrder/Get', { id: id }, function (data) {
            const status = data.statusID || data.StatusID;
            const driverNameFromApi = data.driverName || data.DriverName || null;
            const driverId = data.driverUserID || data.DriverUserID || null;
            const steps = [1, 2, 3, 4];
            const stepHtml = steps.map(s => { const active = status >= s ? 'active-step' : ''; const label = DOStatus[s]; return `<div class="do-step ${active}"><div class='circle'>${s}</div><div class='label small'>${label}</div></div>`; }).join('<div class="do-line"></div>');
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
            <div class='mb-2'><strong>Status:</strong> ${DOStatus[status]} &nbsp; <strong>Driver:</strong> <span id='doDriverLabel'>${driverNameFromApi || '-'}</span></div>
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
            <div class='mt-3 d-flex justify-content-end flex-wrap gap-2' id='doActionContainer'></div>
        </div>`;
            let actionBtns = '';
            if (status === 1) { actionBtns += `<button class='btn btn-sm btn-outline-primary me-2' id='btnAssignDriver'><i class='fa fa-user'></i> Assign Driver</button>`; }
            if (status === 2) { actionBtns += `<button class='btn btn-sm btn-outline-warning me-2' id='btnOutForDelivery'><i class='fa fa-truck'></i> Out For Delivery</button>`; }
            if (status === 3) { actionBtns += `<button class='btn btn-sm btn-outline-success me-2' id='btnMarkDelivered'><i class='fa fa-check'></i> Mark Delivered</button>`; }
            Swal.fire({ title: 'Delivery Order', html: modalHtml, width: 720, showConfirmButton: false, showCloseButton: true });
            if (actionBtns) $('#doActionContainer').html(actionBtns);
            // populate driver select and resolve driver label if only ID provided
            DeliveryOrderModal.LoadDrivers(function (users) {
                if (!driverNameFromApi && driverId) {
                    const found = (users || []).find(u => (u.id || u.ID) == driverId);
                    if (found) {
                        const name = found.name || found.Name || found.userName || found.UserName;
                        $('#doDriverLabel').text(name);
                    }
                }
            });
            DeliveryOrderModal.BindActions(id, status);
        });
    },
    LoadDrivers: function (callback) { $.get('/User/GetUserList', function (list) { let data = list; if (list && list.result) data = list.result; const sel = $('#selectDriver'); if (!sel.length) { if (typeof callback === 'function') callback(data); return; } sel.empty().append(`<option value=''>-- Select driver --</option>`); (data || []).forEach(u => sel.append(`<option value='${u.id || u.ID}'>${u.name || u.Name || u.userName || u.UserName}</option>`)); if (typeof callback === 'function') callback(data); }); },
    BindActions: function (id, status) {
        $(document).off('click', '#btnAssignDriver').on('click', '#btnAssignDriver', function () { $('#assignDriverContainer').removeClass('d-none'); });
        $(document).off('click', '#btnCancelAssign').on('click', '#btnCancelAssign', function () { $('#assignDriverContainer').addClass('d-none'); });
        $(document).off('click', '#btnSaveAssign').on('click', '#btnSaveAssign', function () { const driverID = $('#selectDriver').val(); if (!driverID) { toastr.info('Select driver'); return; } $('#btnSaveAssign').prop('disabled', true).text('Saving...'); $.post('/DeliveryOrder/AssignDriver', { id: id, driverUserID: driverID }, function (res) { if (res.success) { toastr.success('Driver assigned'); Swal.close(); LoadDeliveryOrderInfo(); } else toastr.error(res.result || 'Assign failed'); }).fail(() => toastr.error('Error assign driver')).always(() => $('#btnSaveAssign').prop('disabled', false).text('Save')); });
        $(document).off('click', '#btnOutForDelivery').on('click', '#btnOutForDelivery', function () { DeliveryOrderModal.UpdateStatus(id, 3); });
        $(document).off('click', '#btnMarkDelivered').on('click', '#btnMarkDelivered', function () { DeliveryOrderModal.UpdateStatus(id, 4); });
    },
    UpdateStatus: function (id, newStatus) {
        $.post('/DeliveryOrder/UpdateStatus', { id: id, newStatus: newStatus }, function (res) { if (res.success) { toastr.success('Status updated'); Swal.close(); LoadDeliveryOrderInfo(); } else toastr.error(res.result || 'Update failed'); }).fail(() => toastr.error('Error update status'));
    }
};

let Table = {
    FillGridProduct: function (id, isReset) {
        let tableID = '#tableProduct';
        let $table = $(tableID);
        if (isReset && $.fn.DataTable.isDataTable(tableID)) {
            $table.DataTable().clear().destroy();
        }
        let dataList = [];
        if (id != undefined && id != 0) {
            let resp = Common.GetData.Get('/SalesOrder/GetDetailListById?id=' + id);
            if (resp && resp.result) resp = resp.result;
            dataList = resp || [];
        }
        // Normalize each row to satisfy expected columns to avoid DataTables unknown parameter warnings
        dataList = (dataList || []).map(r => ({
            id: r.id || r.ID || 0,
            productID: r.productID || r.ProductID || 0,
            supplierID: r.supplierID || r.SupplierID || 0,
            stockQuantity: r.stockQuantity || r.StockQuantity || null,
            product: r.product || r.Product || r.productName || r.ProductName || '-',
            supplier: r.supplier || r.Supplier || '-',
            quantity: r.quantity || r.Quantity || 0,
            unit: r.unit || r.Unit || '-',
            unitPrice: r.unitPrice || r.UnitPrice || 0,
            subTotal: r.subTotal || r.SubTotal || ((r.unitPrice || r.UnitPrice || 0) * (r.quantity || r.Quantity || 0))
        }));

        const statusID = parseInt($('#salesOrderStatusID').val() || '1', 10);
        const canEditItems = (statusID === 1); // only Draft editable

        let columns = [
            { data: 'productID', visible: false },
            { data: 'supplierID', visible: false },
            { data: 'stockQuantity', visible: false },
            { data: 'product' },
            { data: 'supplier' },
            canEditItems
                ? { data: 'quantity', render: function (data, type) { return type === 'display' ? `<input type="number" class="form-control quantity" value="${data}" min="1" />` : data; } }
                : { data: 'quantity', render: $.fn.dataTable.render.number(',', '.', 0) },
            { data: 'unit' },
            { data: 'unitPrice', render: $.fn.dataTable.render.number(',', '.', 2) },
            { data: 'subTotal', render: $.fn.dataTable.render.number(',', '.', 2) },
            // always include action column to match header count; render empty when not editable
            { data: null, render: function () { return canEditItems ? `<a class="btn btn-danger delete"><i class="fa fa-trash"></i></a>` : ''; }, orderable: false }
        ];

        let table = $table.DataTable({
            deferRender: true,
            processing: true,
            serverSide: false,
            destroy: true,
            filter: true,
            searching: false,
            responsive: true,
            columns: columns,
            decimal: ',',
            thousands: '.',
            data: dataList.length > 0 ? dataList : null
        });

        $(tableID + ' tbody').unbind();
        $(tableID).off('change');

        if (canEditItems) {
            $(tableID).on('change', 'input[type="number"]', function () {
                let table = $(tableID).DataTable();
                let rowIndex = table.cell($(this).closest('td')).index().row;
                let row = table.row(rowIndex).data();
                if (!row) return;
                let newQuantity = parseInt($(this).val(), 10);
                if (isNaN(newQuantity) || newQuantity < 1) newQuantity = 1;
                if (row.stockQuantity != null && newQuantity > row.stockQuantity) {
                    toastr.info('Quantity reach stock quantity');
                    newQuantity = row.stockQuantity;
                }
                row.quantity = newQuantity;
                let unitPrice = parseFloat(row.unitPrice) || 0;
                row.subTotal = newQuantity * unitPrice;
                table.row(rowIndex).data(row).invalidate();
                table.draw(false);
                ControlSalesOrder.CalculateGrandTotal();
            });
            $(tableID + ' tbody').on('click', '.delete', function () {
                let row = table.row($(this).parents('tr')).data();
                if (row.id) {
                    Swal.fire({
                        title: 'Are you sure?',
                        text: "You won't be able to revert this!",
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Yes, delete it',
                        showLoaderOnConfirm: true,
                        preConfirm: () => {
                            return fetch(`/SalesOrder/DeleteItem?id=${row.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                                .then(response => {
                                    toastr.options.onShown = function () { Table.FillGridProduct(id); }
                                    response.ok ? toastr.success('Data has been deleted') : toastr.error('Data not deleted');
                                })
                                .catch(error => { Swal.showValidationMessage(`Request failed: ${error}`); });
                        },
                        allowOutsideClick: () => !Swal.isLoading()
                    });
                } else {
                    table.row($(this).parents('tr')).remove().draw();
                }
            });
        }
    },
    FillGridSearch: function () {
        let tableID = $('#tableSearch');
        let data = Common.GetData.Get('/SalesOrder/FillGrid');
        let columns = [
            { data: 'no' },
            { data: 'date' },
            { data: 'amount' },
            { data: null, render: function (_data, _type, row) { const s = row && (row.statusID || row.StatusID || row.status || row.Status); return TradeStatus[s] || (s || ''); } },
            { data: 'customerName' },
            { data: 'createdBy' },
            { data: 'updatedBy' },
            {
                data: null,
                render: function (data, type, row) {
                    return `<div class="btn-group" role="group">
                                <a class="btn btn-warning edit" href="#"><i class="fa fa-pencil"></i> Edit</a>
                                <a class="btn btn-danger delete"><i class="fa fa-trash"></i> Delete</a>
                                <a class="btn btn-success print-bill" href="/SalesOrder/Bill/${row.id}" target="_blank"><i class="fa fa-print"></i> Print</a>
                            </div>`;
                },
                orderable: false
            }
        ];
        let table = $(tableID).DataTable({
            deferRender: true,
            processing: true,
            serverSide: false,
            destroy: true,
            filter: true,
            searching: false,
            responsive: true,
            data: data,
            columns: columns
        });
        tableID.find('tbody').unbind();
        tableID.find('tbody').on('click', '.edit', function () {
            let row = table.row($(this).parents('tr')).data();
            FormSalesOrder.FillForm(row.id, true);
            $('#searchModal').modal('hide');
        });
        tableID.find('tbody').on('click', '.delete', function () {
            let row = table.row($(this).parents('tr')).data();
            Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, delete it',
                showLoaderOnConfirm: true,
                preConfirm: () => {
                    return fetch(`/SalesOrder/Delete?id=${row.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                        .then(response => {
                            toastr.options.onShown = function () { Table.FillGridSearch(); Form.Reset(); }
                            response.ok ? toastr.success('Data has been deleted') : toastr.error('Data not deleted');
                        })
                        .catch(error => { Swal.showValidationMessage(`Request failed: ${error}`); });
                },
                allowOutsideClick: () => !Swal.isLoading()
            });
        });
    }
}
let ControlSalesOrder = {
    SelectProduct: function () {
        let id = '#selectProduct';
        $(id).select2({
            placeholder: 'Type product name below',
            minimumInputLength: 3,
            ajax: {
                url: '/Product/GetProductComboList',
                dataType: 'json',
                delay: 250,
                data: function (params) { return { name: params.term }; },
                processResults: function (data) {
                    return {
                        results: $.map(data.result, function (item) {
                            return {
                                id: item.id,
                                text: item.name + ' - ' + item.supplierName,
                                supplierID: item.supplierID,
                                name: item.name,
                                supplierName: item.supplierName,
                                unitPrice: item.unitPrice,
                                unit: item.unit,
                                stockQuantity: item.stockQuantity,
                            };
                        })
                    };
                },
                cache: true
            },
            templateResult: function (data) { return data.text; },
            templateSelection: function (data) { return data.text; }
        });
    },
    ProductSelect: function () {
        $('#selectProduct').on('select2:select', function (e) {
            let data = e.params.data;
            ControlSalesOrder.CheckProduct(data);
            $(this).val(null).trigger('change');
            $(this).select2('close');
        });
    },
    AddRow: function (productID, supplierID, stockQuantity, productName, supplier, quantity, unit, unitPrice) {
        let table = $('#tableProduct').DataTable();
        table.row.add({
            productID: productID,
            supplierID: supplierID,
            stockQuantity: stockQuantity,
            product: productName,
            supplier: supplier,
            quantity: quantity,
            unit: unit,
            unitPrice: unitPrice,
            subTotal: quantity * unitPrice,
        }).draw();
    },
    Init: function () {
        ControlSalesOrder.ProductSelect();
        ControlSalesOrder.SelectProduct();
    },
    CheckProduct: function (selectedProduct) {
        // If stock is zero, notify and stop
        if (selectedProduct.stockQuantity === 0) {
            toastr.info('Stock is empty');
            return; // do not add or increase
        }
        let table = $('#tableProduct').DataTable();
        let exists = false;
        let rows = table.rows().nodes();
        $(rows).each(function () {
            let rowData = table.row(this).data();
            if (rowData.productID == selectedProduct.id) {
                exists = true;
                let newQuantity = parseInt(rowData.quantity) + 1;
                if (newQuantity > selectedProduct.stockQuantity) { return toastr.info('Quantity reach stock quantity'); }
                rowData.quantity = newQuantity;
                rowData.subTotal = newQuantity * rowData.unitPrice;
                table.row(this).data(rowData).invalidate();
            }
        });
        if (!exists) {
            ControlSalesOrder.AddRow(selectedProduct.id, selectedProduct.supplierID, selectedProduct.stockQuantity, selectedProduct.name, selectedProduct.supplierName, 1, selectedProduct.unit, selectedProduct.unitPrice, selectedProduct.stockQuantity);
        }
        table.draw(false);
        this.CalculateGrandTotal();
    },
    CalculateGrandTotal() {
        let totalSum = 0;
        let table = $('#tableProduct').DataTable();
        let rows = table.rows().nodes();
        $(rows).each(function () {
            let rowData = table.row(this).data();
            let subTotal = (parseFloat(rowData.unitPrice) || 0) * (parseInt(rowData.quantity) || 0);
            totalSum += subTotal;
        });
        $('#total').text(totalSum.toFixed(2));
    }
}
let FormSalesOrder = {
    FillForm: function (id, isReset = false) {
        $.ajax({
            url: '/SalesOrder/FillForm',
            type: 'POST',
            data: { id: id },
            success: function (result) {
                $('#salesOrderHeaderBody').html(result);
                // update status badge based on hidden field
                const statusVal = parseInt($('#salesOrderStatusID').val() || '1', 10);
                UpdateStatusBadge(statusVal);
                ControlSalesOrder.SelectProduct();
                Table.FillGridProduct(id, isReset);
                ControlSalesOrder.CalculateGrandTotal();
                // refresh DO related UI after DOM update
                setTimeout(() => { ShowOrHideCreateDOButton(); ShowCreateInvoiceButton(); LoadDeliveryOrderInfo(); TogglePaymentButton(statusVal); }, 200);
            },
            error: function (error) { toastr.error(error, 'Error load data'); }
        });
    },
    Save: function (isPay) {
        let postData = {
            ID: parseInt($('#salesOrderID').val() || '0', 10),
            Date: $('#salesOrderDate').val(),
            No: $('#salesOrderNumber').val(),
            CustomerID: $('#selectCustomer').val(),
            Note: $('#salesOrderNote').val(),
            SalesOrderDetails: [],
            IsPaid: !!isPay
        };
        let table = $('#tableProduct').DataTable();
        table.rows().every(function () {
            let r = this.data();
            if (r && r.productID && r.quantity) {
                postData.SalesOrderDetails.push({
                    ProductID: r.productID,
                    Quantity: r.quantity,
                    ID: r.id == undefined ? 0 : r.id,
                    Subtotal: r.subTotal
                });
            }
        });
        // disable save button while processing
        const $btn = $('#buttonSave');
        const originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...');
        $.ajax({ url: '/SalesOrder/Save', type: 'POST', data: postData })
            .done(result => {
                if (result && result.success) {
                    toastr.success('Data saved');
                    if (result.id) {
                        // reload form to reflect generated numbers, status, and persisted item IDs
                        FormSalesOrder.FillForm(result.id, true);
                    }
                } else {
                    toastr.error((result && result.result) || 'Data not saved');
                }
            })
            .fail(err => { toastr.error(err.responseText || err.statusText || 'Error', 'Data not saved'); })
            .always(() => { $btn.prop('disabled', false).html(originalHtml); });
    },
    Reset: function () { FormSalesOrder.FillForm(0, true); }
};