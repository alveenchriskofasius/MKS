$(document).ready(function () { POControl.Init(); POButtons.Init(); });

const POStatus = { 1: 'Draft', 2: 'Approved', 3: 'Closed' };
function UpdatePOStatusBadge(statusID) { const $b = $('#purchaseOrderStatus'); const txt = POStatus[statusID] || 'Draft'; $b.text(txt); $b.removeClass('text-bg-warning text-bg-success text-bg-secondary'); if (statusID === 2) $b.addClass('text-bg-success'); else if (statusID === 3) $b.addClass('text-bg-secondary'); else $b.addClass('text-bg-warning'); }

let POButtons = { Init: function () { $('#buttonSave').click(function (e) { e.preventDefault(); let table = $('#tablePurchaseOrderProduct').DataTable(); if (table.rows().count() <= 0) { toastr.info('Insert at least 1 product', 'Cannot save'); return; } PurchaseOrderForm.Save(); }); $('#buttonNew').click(function () { PurchaseOrderForm.Reset(); }); $('#buttonSearch').click(function () { POTable.Search(); }); } };

let POTable = {
    Init: function (dataList) {
        let tableID = $('#tablePurchaseOrderProduct');
        // determine current PO status to decide column renderers
        const statusID = parseInt($('#purchaseOrderStatusID').val() || '1', 10);
        const isLocked = (statusID === 2 || statusID === 3); // PartialPaid or Paid
        let columns = [
            { data: 'productID', visible: false },
            { data: 'product' },
            // quantity: editable only when not locked
            isLocked ? { data: 'quantity', render: $.fn.dataTable.render.number(',', '.', 0) }
                : { data: 'quantity', render: (d, t) => t === 'display' ? `<input type="number" class="form-control po-qty" value="${d}" min="1" />` : d },
            { data: 'unitPrice', render: $.fn.dataTable.render.number(',', '.', 2) },
            { data: 'subTotal', render: $.fn.dataTable.render.number(',', '.', 2) },
            { data: null, orderable: false, render: () => isLocked ? '' : `<a class='btn btn-danger po-delete'><i class='fa fa-trash'></i></a>` }
        ];
        // Diagnostic: log header th count vs defined columns
        try {
            const thCount = tableID.find('thead tr th').length;
            console.log('POTable.Init: header th count =', thCount, 'columns defined =', columns.length);
        } catch (e) { console.warn('POTable.Init: failed to compute header th count', e); }
        let table = tableID.DataTable({ deferRender: true, processing: true, serverSide: false, destroy: true, filter: true, searching: false, responsive: true, columns: columns, decimal: ',', thousands: '.', data: dataList && dataList.length > 0 ? dataList : null });
        tableID.find('tbody').unbind();
        // Normalize id property for all existing rows (if coming as ID from SP)
        table.rows().every(function () { let r = this.data(); if (r && r.ID && !r.id) { r.id = r.ID; this.data(r); } });
        // Enter = blur behaviour
        tableID.on('keydown', 'input.po-qty', function (e) { if (e.key === 'Enter') { e.preventDefault(); $(this).blur(); } });
        // Ganti handler quantity supaya mirip StockIn.js (hindari error DataTables saat input/arrow)
        tableID.off('change', 'input.po-qty');
        if (!isLocked) {
            tableID.on('change', 'input.po-qty', function () {
                let $td = $(this).closest('td');
                let cellIdx = table.cell($td).index();
                if (!cellIdx) return; // safety
                let rowIndex = cellIdx.row;
                let rowData = table.row(rowIndex).data();
                if (!rowData) return;
                let newQty = parseInt($(this).val(), 10);
                if (isNaN(newQty) || newQty < 1) newQty = 1;
                rowData.quantity = newQty;
                rowData.subTotal = newQty * parseFloat(rowData.unitPrice || 0);
                table.row(rowIndex).data(rowData).invalidate();
                POControl.CalcTotal();
            });
        }
        // Stable row removal helper (avoid DOM reference issues)
        function removeRowByPersistentId(persistedId) {
            table.rows(function (idx, data) { return (data.id || data.ID) === persistedId; }).remove();
            table.draw(false);
            POControl.CalcTotal();
        }
        tableID.on('mousedown', '.po-delete', function (e) { // capture before blur modifies DOM
            e.preventDefault();
        });
        tableID.on('click', '.po-delete', function (e) {
            e.preventDefault();
            let $btn = $(this);
            if (document.activeElement) document.activeElement.blur();
            let $tr = $btn.closest('tr');
            let rowApi = table.row($tr);
            let row = rowApi.data();
            if (!row) return;
            const persistedId = row.id || row.ID || 0;
            if (persistedId > 0) {
                Swal.fire({
                    title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', showLoaderOnConfirm: true,
                    preConfirm: () => fetch(`/PurchaseOrder/DeleteItem?id=${persistedId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                        .then(r => r.json())
                        .then(j => { if (!j.success) throw new Error(j.result || 'Delete failed'); return j; })
                        .catch(err => { Swal.showValidationMessage(`Request failed: ${err.message}`); }),
                    allowOutsideClick: () => !Swal.isLoading()
                }).then(res => { if (res.isConfirmed && res.value && res.value.success) { removeRowByPersistentId(persistedId); toastr.success('Item deleted'); } });
            } else { // unsaved row
                rowApi.remove();
                table.draw(false);
                POControl.CalcTotal();
            }
        });
    },
    Search: function () {
        let tableID = $('#tableSearchPO');
        let data = Common.GetData.Get('/PurchaseOrder/FillGrid');
        if (data && data.result && Array.isArray(data.result)) data = data.result;
        let columns = [
            { data: 'no' }, { data: 'date' }, { data: 'amount' },
            // status column (robust renderer)
            { data: null, render: function (_data, _type, row) {
                const raw = row && (row.statusID ?? row.StatusID ?? row.status ?? row.Status);
                const sid = raw != null && raw !== '' ? Number(raw) : 0;
                const txt = POStatus[sid] || (raw || '');
                const cls = (sid === 2) ? 'bg-success' : (sid === 3 ? 'bg-secondary' : 'bg-warning');
                return `<span class="badge ${cls}">${txt}</span>`;
            } },
             { data: 'supplierName' }, { data: 'createdBy' }, { data: 'updatedBy' },
             { data: null, orderable: false, render: () => `<div class="btn-group" role="group"><a class="btn btn-warning po-edit"><i class="fa fa-pencil"></i> Edit</a><a class="btn btn-danger po-delete-row"><i class="fa fa-trash"></i> Delete</a></div>` }
        ];
        try {
            const thCount = $('#tableSearchPO').find('thead tr th').length;
            console.log('POTable.Search: tableSearchPO header th count =', thCount, 'columns defined =', columns.length);
        } catch (e) { console.warn('POTable.Search: failed to compute header th count', e); }
        let table = tableID.DataTable({ deferRender: true, processing: true, serverSide: false, destroy: true, filter: true, searching: false, responsive: true, data: data, columns: columns });
        tableID.find('tbody').unbind();
        tableID.find('tbody').on('click', '.po-edit', function () { let row = table.row($(this).parents('tr')).data(); PurchaseOrderForm.Fill(row.id || row.ID); $('#searchModal').modal('hide'); });
        tableID.find('tbody').on('click', '.po-delete-row', function () { let row = table.row($(this).parents('tr')).data(); const rowId = row.id || row.ID; Swal.fire({ title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', showLoaderOnConfirm: true, preConfirm: () => fetch(`/PurchaseOrder/Delete?id=${rowId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).then(r => r.json()).then(j => { if (!j.success) throw new Error(j.result || 'Delete failed'); return j; }).catch(err => Swal.showValidationMessage(`Request failed: ${err.message}`)), allowOutsideClick: () => !Swal.isLoading() }).then(res => { if (res.isConfirmed && res.value && res.value.success) { toastr.success('Data has been deleted'); POTable.Search(); } }); });
    }
};

let POControl = {
    Init: function () {
        this.LoadForm(0); this.SelectProduct(); this.ProductSelect(); POTable.Init(); // wire page-level filterSupplier into form submission
        // store previous supplier value for cancel behavior
        const $filter = $('#filterSupplier');
        $filter.data('prev', $filter.val());
        $filter.on('change', function () {
            // copy selected supplier into hidden form field so server receives it on save
            var v = $(this).val();
            // if PO is new (no id) and there are items in table, confirm clearing
            try {
                const poId = parseInt($('#purchaseOrderID').val() || '0', 10);
                if ((!poId || poId === 0) && $.fn.DataTable.isDataTable('#tablePurchaseOrderProduct')) {
                    const table = $('#tablePurchaseOrderProduct').DataTable();
                    if (table.rows().count() > 0) {
                        // warn user that products will be removed when supplier changes
                        Swal.fire({
                            title: 'Ganti supplier',
                            html: "<p>Mengganti supplier akan mengosongkan daftar produk pada PO. Lanjutkan?</p>",
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: 'Ya, ganti supplier',
                            cancelButtonText: 'Batal'
                        }).then(res => {
                            if (res.isConfirmed) {
                                // clear table and apply new supplier
                                table.clear().draw();
                                POControl.CalcTotal();
                                if ($('#purchaseOrderSupplierID').length) {
                                    $('#purchaseOrderSupplierID').val(v);
                                } else {
                                    $('<input>').attr({ type: 'hidden', id: 'purchaseOrderSupplierID', name: 'SupplierID', value: v }).appendTo('#purchaseOrderForm');
                                }
                                $filter.data('prev', v);
                            } else {
                                // revert selection
                                const prev = $filter.data('prev');
                                $filter.val(prev).trigger('change.select2');
                            }
                        });
                        return;
                    }
                }
            } catch (e) { console.warn('filterSupplier change handler', e); }

            if ($('#purchaseOrderSupplierID').length) {
                $('#purchaseOrderSupplierID').val(v);
            } else {
                // create hidden if missing
                $('<input>').attr({ type: 'hidden', id: 'purchaseOrderSupplierID', name: 'SupplierID', value: v }).appendTo('#purchaseOrderForm');
            }
            $filter.data('prev', v);
        });
    },
    LoadForm: function (id) {
        $('#purchaseOrderHeaderBody').html('<div class="text-center p-2"><div class="spinner-border"></div></div>');
        $.get('/PurchaseOrder/FillForm', { id: id || 0 }, function (html) {
            $('#purchaseOrderHeaderBody').html(html); let statusID = parseInt($('#purchaseOrderStatusID').val() || '1'); UpdatePOStatusBadge(statusID);
            // apply UI locking: hide delete buttons and make qty read-only when status is Paid or PartialPaid accordingly
            setTimeout(function () {
                const stat = parseInt($('#purchaseOrderStatusID').val() || '1');
                const $table = $('#tablePurchaseOrderProduct');
                if ($.fn.DataTable.isDataTable('#tablePurchaseOrderProduct')) {
                    const tb = $table.DataTable();
                    // iterate rows to update quantity cell and action
                    $table.find('tbody tr').each(function () {
                        const row = tb.row(this).data();
                        if (!row) return;
                        const $qtyInput = $(this).find('input.po-qty');
                        const $delBtn = $(this).find('.po-delete');
                        // When PartialPaid (2) or Paid (3) -> lock quantity and remove delete action
                        if (stat === 2 || stat === 3) {
                            if ($qtyInput.length) { $qtyInput.prop('readonly', true).addClass('form-control-plaintext').removeClass('form-control'); }
                            if ($delBtn.length) { $delBtn.closest('td').html(''); }
                        } else {
                            // draft: ensure editable
                            if ($qtyInput.length) { $qtyInput.prop('readonly', false).addClass('form-control').removeClass('form-control-plaintext'); }
                        }
                    });
                }
            }, 200);
        });
        if (id && id > 0) { this.LoadDetails(id); } else { POTable.Init(); $('#poTotal').text('0.00'); }
    },
    LoadDetails: function (id) {
        let details = Common.GetData.Get('/PurchaseOrder/GetDetailListById?id=' + id);
        if (details && details.result && Array.isArray(details.result)) details = details.result; // unwrap if wrapped
        let mapped = (details || []).map(d => ({
            id: d.id || d.ID,
            productID: d.productID || d.ProductID,
            product: d.product || d.Product || d.productName || d.ProductName,
            quantity: d.quantity || d.Quantity,
            unitPrice: d.unitPrice || d.UnitPrice,
            subTotal: d.subTotal || d.SubTotal || ((d.unitPrice || d.UnitPrice || 0) * (d.quantity || d.Quantity || 0))
        }));
        POTable.Init(mapped); POControl.CalcTotal();
    },
    SelectProduct: function () {
        $('#selectProduct').select2({
            placeholder: 'Type product name below',
            minimumInputLength: 3,
            ajax: {
                url: '/Product/GetProductComboList',
                dataType: 'json',
                delay: 250,
                data: params => ({ name: params.term, supplierId: $('#filterSupplier').val() || null }),
                processResults: data => ({ results: $.map(data.result, item => ({ id: item.id, text: item.name + ' - ' + item.supplierName, name: item.name, unitPrice: item.unitPrice, supplierName: item.supplierName, stockQuantity: item.stockQuantity })) })
            },
            templateResult: d => d.text,
            templateSelection: d => d.text
        });
    },
    ProductSelect: function () { $('#selectProduct').on('select2:select', function (e) { let data = e.params.data; POControl.AddOrIncrease(data); $(this).val(null).trigger('change'); $(this).select2('close'); }); },
    AddOrIncrease: function (prod) { let table = $('#tablePurchaseOrderProduct').DataTable(); let exists = false; let rows = table.rows().nodes(); $(rows).each(function () { let rowData = table.row(this).data(); if (rowData.productID == prod.id) { exists = true; let newQuantity = parseInt(rowData.quantity) + 1; rowData.quantity = newQuantity; rowData.subTotal = newQuantity * rowData.unitPrice; table.row(this).data(rowData).invalidate(); } }); if (!exists) { table.row.add({ productID: prod.id, product: prod.name, quantity: 1, unitPrice: prod.unitPrice, subTotal: prod.unitPrice, id: 0 }).draw(); } table.draw(false); this.CalcTotal(); },
    CalcTotal: function () { let table = $('#tablePurchaseOrderProduct').DataTable(); let total = 0; table.rows().every(function () { let r = this.data(); total += (parseFloat(r.unitPrice) || 0) * (parseInt(r.quantity) || 0); }); $('#poTotal').text(total.toFixed(2)); }
};

let PurchaseOrderForm = {
    Fill: function (id) { POControl.LoadForm(id); },
    Save: function () {
        let table = $('#tablePurchaseOrderProduct').DataTable(); if (!$.fn.DataTable.isDataTable('#tablePurchaseOrderProduct')) return;
        let dataArray = []; let idx = 0; table.rows().every(function () { let r = this.data(); if (r && r.productID && r.quantity) { dataArray.push({ index: idx, row: r }); idx++; } }); if (dataArray.length === 0) { toastr.info('No detail'); return; }
        let formData = {}; formData['ID'] = $('#purchaseOrderID').val(); formData['Date'] = $('#purchaseOrderDate').val(); formData['No'] = $('#purchaseOrderNumber').val(); formData['Note'] = $('#purchaseOrderNote').val();
        // Ensure SupplierID is included when saving Purchase Order (several possible element ids)
        // normalize supplier id: treat 0/empty as null so server doesn't store 0
        var supVal = $('#purchaseOrderSupplierID').val() || $('#supplierId').val() || $('#selectSupplier').val() || $('#filterSupplier').val();
        if (supVal === undefined || supVal === null || supVal === '' || String(supVal) === '0') {
            formData['SupplierID'] = null;
        } else {
            formData['SupplierID'] = Number(supVal);
        }
        for (let i = 0; i < dataArray.length; i++) { let r = dataArray[i].row; formData[`PurchaseOrderDetails[${i}].ID`] = r.id || r.ID || 0; formData[`PurchaseOrderDetails[${i}].ProductID`] = r.productID; formData[`PurchaseOrderDetails[${i}].Quantity`] = r.quantity; formData[`PurchaseOrderDetails[${i}].UnitPrice`] = r.unitPrice; formData[`PurchaseOrderDetails[${i}].Subtotal`] = r.subTotal; }
        $('#buttonSave').prop('disabled', true); $('#buttonSave .spinner-border').show();
        $.ajax({ url: '/PurchaseOrder/Save', type: 'POST', data: formData }).done(result => {
            if (result.success) {
                toastr.success('Data saved'); if (result.id) {
                    $('#purchaseOrderID').val(result.id); if (result.no) $('#purchaseOrderNumber').val(result.no); if (result.statusID) UpdatePOStatusBadge(result.statusID); // Reload header form so supplier and other header fields reflect saved values
                    POControl.LoadForm(result.id);
                    POControl.LoadDetails(result.id);
                    // Trigger global event so other UI (PaymentOut) can react and prefill
                    try {
                        const supplierId = Number(formData['SupplierID']) || Number($('#purchaseOrderSupplierID').val() || 0) || null;
                        const payload = { id: result.id, supplierID: supplierId, amount: result.amount || 0, supplierName: ($('#purchaseOrderHeaderBody').find('#selectSupplier option:selected').text() || $('#purchaseOrderHeaderBody').find('#purchaseOrderSupplierID').val() || '') };
                        $(document).trigger('purchaseorder:saved', payload);
                    } catch (e) { console.warn('purchaseorder:saved trigger failed', e); }
                }
            } else { toastr.error(result.result || 'Data not saved'); }
        }).fail(err => toastr.error(err.responseText || err.statusText || 'Error', 'Data not saved')).always(() => { $('#buttonSave').prop('disabled', false); $('#buttonSave .spinner-border').hide(); });
    },
    Reset: function () { POControl.LoadForm(0); let table = $('#tablePurchaseOrderProduct').DataTable(); table.clear().draw(); $('#poTotal').text('0.00'); UpdatePOStatusBadge(1); }
};

// Refresh related payments table helper
function refreshRelatedPaymentsTable(poId) {
    try {
        if (!poId) return;
        $.get('/PaymentOut/RelatedByPO', { purchaseOrderId: poId }, function (list) {
            let rows = (list || []).map(p => `<tr><td>${p.no || ''}</td><td>${(p.date || '').toString().substring(0, 10)}</td><td class="text-end">${(Number(p.amount || 0)).toFixed(2)}</td><td>${p.method || ''}</td><td>${p.type || ''}</td><td>${p.statusID == 2 ? '<span class="badge bg-success">Submitted</span>' : '<span class="badge bg-secondary">Draft</span>'}</td></tr>`).join('');
            $('#tablePaymentOutRelated tbody').html(rows || '<tr><td colspan="6" class="text-center text-muted">No payments</td></tr>');
        }).fail(() => $('#tablePaymentOutRelated tbody').html('<tr><td colspan="6" class="text-center text-muted">Failed load</td></tr>'));
    } catch (e) { console.error('refreshRelatedPaymentsTable failed', e); }
}

// Listen for payments made from PaymentOut modal and refresh PO if it matches
$(document).on('paymentout:saved', function (e, payload) {
    try {
        if(!payload) return;
        const poId = Number(payload.purchaseOrderID || payload.purchaseOrderId || (payload.result && payload.result.purchaseOrderID));
        const current = Number($('#purchaseOrderID').val() || 0);
        if (poId && current && poId === current) {
            // reload form and details to reflect updated paid amount/status
            POControl.LoadForm(current);
            POControl.LoadDetails(current);
            // also refresh the related payments table immediately
            refreshRelatedPaymentsTable(current);
            toastr.success('Purchase Order updated after payment');
        }
    } catch (err) {
        console.error('Failed handling paymentout:saved', err);
    }
});