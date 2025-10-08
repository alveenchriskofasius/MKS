$(document).ready(function () { POControl.Init(); POButtons.Init(); });

const POStatus = { 1: 'Draft', 2: 'Approved', 3: 'Closed' };
function UpdatePOStatusBadge(statusID) { const $b = $('#purchaseOrderStatus'); const txt = POStatus[statusID] || 'Draft'; $b.text(txt); $b.removeClass('text-bg-warning text-bg-success text-bg-secondary'); if (statusID === 2) $b.addClass('text-bg-success'); else if (statusID === 3) $b.addClass('text-bg-secondary'); else $b.addClass('text-bg-warning'); }

let POButtons = { Init: function () { $('#buttonSave').click(function (e) { e.preventDefault(); let table = $('#tablePurchaseOrderProduct').DataTable(); if (table.rows().count() <= 0) { toastr.info('Insert at least 1 product', 'Cannot save'); return; } PurchaseOrderForm.Save(); }); $('#buttonNew').click(function () { PurchaseOrderForm.Reset(); }); $('#buttonSearch').click(function () { POTable.Search(); }); } };

let POTable = {
    Init: function (dataList) {
        let tableID = $('#tablePurchaseOrderProduct');
        let columns = [
            { data: 'productID', visible: false },
            { data: 'product' },
            { data: 'quantity', render: (d, t) => t === 'display' ? `<input type="number" class="form-control po-qty" value="${d}" min="1" />` : d },
            { data: 'unitPrice', render: $.fn.dataTable.render.number(',', '.', 2) },
            { data: 'subTotal', render: $.fn.dataTable.render.number(',', '.', 2) },
            { data: null, orderable: false, render: () => `<a class='btn btn-danger po-delete'><i class='fa fa-trash'></i></a>` }
        ];
        let table = tableID.DataTable({ deferRender: true, processing: true, serverSide: false, destroy: true, filter: true, searching: false, responsive: true, columns: columns, decimal: ',', thousands: '.', data: dataList && dataList.length > 0 ? dataList : null });
        tableID.find('tbody').unbind();
        // Normalize id property for all existing rows (if coming as ID from SP)
        table.rows().every(function(){ let r=this.data(); if(r && r.ID && !r.id){ r.id = r.ID; this.data(r); } });
        // Enter = blur behaviour
        tableID.on('keydown', 'input.po-qty', function (e) { if (e.key === 'Enter') { e.preventDefault(); $(this).blur(); } });
        // Ganti handler quantity supaya mirip StockIn.js (hindari error DataTables saat input/arrow)
        tableID.off('change', 'input.po-qty');
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
        // Stable row removal helper (avoid DOM reference issues)
        function removeRowByPersistentId(persistedId){
            table.rows(function(idx, data){ return (data.id||data.ID) === persistedId; }).remove();
            table.draw(false);
            POControl.CalcTotal();
        }
        tableID.on('mousedown', '.po-delete', function(e){ // capture before blur modifies DOM
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
            { data: 'no' }, { data: 'date' }, { data: 'amount' }, { data: 'supplierName' }, { data: 'createdBy' }, { data: 'updatedBy' },
            { data: null, orderable: false, render: () => `<div class="btn-group" role="group"><a class="btn btn-warning po-edit"><i class="fa fa-pencil"></i> Edit</a><a class="btn btn-danger po-delete-row"><i class="fa fa-trash"></i> Delete</a></div>` }
        ];
        let table = tableID.DataTable({ deferRender: true, processing: true, serverSide: false, destroy: true, filter: true, searching: false, responsive: true, data: data, columns: columns });
        tableID.find('tbody').unbind();
        tableID.find('tbody').on('click', '.po-edit', function () { let row = table.row($(this).parents('tr')).data(); PurchaseOrderForm.Fill(row.id || row.ID); $('#searchModal').modal('hide'); });
        tableID.find('tbody').on('click', '.po-delete-row', function () { let row = table.row($(this).parents('tr')).data(); const rowId = row.id || row.ID; Swal.fire({ title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', showLoaderOnConfirm: true, preConfirm: () => fetch(`/PurchaseOrder/Delete?id=${rowId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).then(r => r.json()).then(j => { if (!j.success) throw new Error(j.result || 'Delete failed'); return j; }).catch(err => Swal.showValidationMessage(`Request failed: ${err.message}`)), allowOutsideClick: () => !Swal.isLoading() }).then(res => { if (res.isConfirmed && res.value && res.value.success) { toastr.success('Data has been deleted'); POTable.Search(); } }); });
    }
};

let POControl = {
    Init: function () { this.LoadForm(0); this.SelectProduct(); this.ProductSelect(); POTable.Init(); },
    LoadForm: function (id) {
        $('#purchaseOrderHeaderBody').html('<div class="text-center p-2"><div class="spinner-border"></div></div>');
        $.get('/PurchaseOrder/FillForm', { id: id || 0 }, function (html) { $('#purchaseOrderHeaderBody').html(html); let statusID = parseInt($('#purchaseOrderStatusID').val() || '1'); UpdatePOStatusBadge(statusID); });
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
    SelectProduct: function () { $('#selectProduct').select2({ placeholder: 'Type product name below', minimumInputLength: 3, ajax: { url: '/Product/GetProductComboList', dataType: 'json', delay: 250, data: params => ({ name: params.term }), processResults: data => ({ results: $.map(data.result, item => ({ id: item.id, text: item.name + ' - ' + item.supplierName, name: item.name, unitPrice: item.unitPrice, supplierName: item.supplierName, stockQuantity: item.stockQuantity })) }) }, templateResult: d => d.text, templateSelection: d => d.text }); },
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
        for (let i = 0; i < dataArray.length; i++) { let r = dataArray[i].row; formData[`PurchaseOrderDetails[${i}].ID`] = r.id || r.ID || 0; formData[`PurchaseOrderDetails[${i}].ProductID`] = r.productID; formData[`PurchaseOrderDetails[${i}].Quantity`] = r.quantity; formData[`PurchaseOrderDetails[${i}].UnitPrice`] = r.unitPrice; formData[`PurchaseOrderDetails[${i}].Subtotal`] = r.subTotal; }
        $('#buttonSave').prop('disabled', true); $('#buttonSave .spinner-border').show();
        $.ajax({ url: '/PurchaseOrder/Save', type: 'POST', data: formData }).done(result => { if (result.success) { toastr.success('Data saved'); if (result.id) $('#purchaseOrderID').val(result.id); if (result.no) $('#purchaseOrderNumber').val(result.no); if (result.statusID) UpdatePOStatusBadge(result.statusID); if (result.id) { POControl.LoadDetails(result.id); } } else { toastr.error(result.result || 'Data not saved'); } }).fail(err => toastr.error(err.responseText || err.statusText || 'Error', 'Data not saved')).always(() => { $('#buttonSave').prop('disabled', false); $('#buttonSave .spinner-border').hide(); });
    },
    Reset: function () { POControl.LoadForm(0); let table = $('#tablePurchaseOrderProduct').DataTable(); table.clear().draw(); $('#poTotal').text('0.00'); UpdatePOStatusBadge(1); }
};