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
    setTimeout(ApplyLockState,50);
}

// After UpdateStatusBadge definition add helper
function ApplyLockState(){
  const statusID = parseInt($('#salesOrderStatusID').val()||'0',10);
  const forcedLocked = ($('#salesOrderIsLocked').val()||'').toString().toLowerCase()==='true';
  const lockedStatuses = [2,4,5,6,7,8];
  const isLocked = forcedLocked || lockedStatuses.includes(statusID);
  const $form = $('#salesOrderHeaderBody');
  if(isLocked){
    $form.find('input,textarea,select').prop('disabled',true);
    $('#selectProduct').prop('disabled',true).trigger('change.select2');
    $('#buttonSave,#buttonPay,#btnCreateDO').addClass('d-none');
  } else {
    $form.find('input,textarea,select').prop('disabled',false);
    $('#selectProduct').prop('disabled',false);
    $('#buttonSave,#buttonPay').removeClass('d-none');
  }
}

function ShowOrHideCreateDOButton() {
    const soId = parseInt($('#salesOrderID').val() || '0', 10);
    const statusID = parseInt($('#salesOrderStatusID').val() || '1', 10);
    if (soId > 0 && statusID >= 2) { // allow from status 2 and above
        // Check if DO exists
        $.get('/DeliveryOrder/List', { statusID: null }, function (list) {
            const exists = (list || []).some(d => (d.salesOrderID || d.SalesOrderID) === soId);
            if (!exists) $('#btnCreateDO').removeClass('d-none'); else $('#btnCreateDO').addClass('d-none');
        });
    } else { $('#btnCreateDO').addClass('d-none'); }
}

function LoadDeliveryOrderInfo() {
    const soId = parseInt($('#salesOrderID').val() || '0', 10);
    if (!soId) { $('#deliveryOrderSection').hide(); return; }
    $.get('/DeliveryOrder/List', function (list) {
        const doData = (list || []).find(d => (d.salesOrderID || d.SalesOrderID) === soId);
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
        $('#btnViewDO').removeClass('d-none').off('click').on('click', function(){ DeliveryOrderModal.Open(doData.id || doData.ID); });
    });
}

let ButtonSalesOrder = {
    Init: function () {
        $('#buttonSave').click(function (event) {
            event.preventDefault();
            let table = $('#tableProduct').DataTable();
            if (table.rows().count() <= 0) {
                toastr.info('Insert at least 1 product', 'Cannot save');
                return;
            }
            FormSalesOrder.Save(false);
        });
        $('#buttonPay').click(function (event) {
            event.preventDefault();
            let table = $('#tableProduct').DataTable();
            if (table.rows().count() <= 0) {
                toastr.info('Insert at least 1 product', 'Cannot save');
                return;
            }
            FormSalesOrder.Save(true);
        });
        $('#buttonSearch').click(function () { Table.FillGridSearch(); });
        $('#buttonNew').click(function () { FormSalesOrder.Reset(); });
        $(document).on('click', '#btnCreateDO', function(){
            const soId = parseInt($('#salesOrderID').val()||'0',10); if(!soId){ toastr.info('Save SO first'); return; }
            $(this).prop('disabled',true).text('Processing...');
            $.post('/DeliveryOrder/CreateFromSO',{ soId: soId }, function(res){
                if(res.success){ toastr.success('Delivery Order created'); LoadDeliveryOrderInfo(); $('#btnCreateDO').addClass('d-none'); }
                else toastr.error(res.result||'Failed create DO');
            }).fail(()=> toastr.error('Error create DO')).always(()=> $('#btnCreateDO').prop('disabled',false).html('<i class="fa fa-truck"></i> Create Delivery Order'));
        });
    }
}

// Enhanced modal with progress + actions
const DeliveryOrderModal = {
  Open: function(id){
    $.get('/DeliveryOrder/Get',{id:id}, function(data){
        const status = data.statusID || data.StatusID; const driver = data.driverUserID || data.DriverUserID; const soId = data.salesOrderID || data.SalesOrderID;
        const steps = [1,2,3,4];
        const stepHtml = steps.map(s=>{ const active = status>=s ? 'active-step' : ''; const label = DOStatus[s]; return `<div class="do-step ${active}"><div class='circle'>${s}</div><div class='label small'>${label}</div></div>`; }).join('<div class="do-line"></div>');
        const items = (data.items||data.Items||[]).map(i=> `<tr><td>${i.productID||i.ProductID}</td><td>${i.quantity||i.Quantity}</td></tr>`).join('');
        let actionBtns = '';
        if(status===1){ actionBtns += `<button class='btn btn-sm btn-outline-primary me-2' id='btnAssignDriver'><i class='fa fa-user'></i> Assign Driver</button>`; }
        if(status===2){ actionBtns += `<button class='btn btn-sm btn-outline-warning me-2' id='btnOutForDelivery'><i class='fa fa-truck'></i> Out For Delivery</button>`; }
        if(status===3){ actionBtns += `<button class='btn btn-sm btn-outline-success me-2' id='btnMarkDelivered'><i class='fa fa-check'></i> Mark Delivered</button>`; }
        const modalHtml = `<div class='text-start'>
            <div class='do-progress d-flex align-items-center justify-content-between mb-3 flex-wrap'>${stepHtml}</div>
            <div class='mb-2'><strong>DO No:</strong> ${data.no||data.No} &nbsp; <strong>SO ID:</strong> ${soId}</div>
            <div class='mb-2'><strong>Status:</strong> ${DOStatus[status]} &nbsp; <strong>Driver:</strong> <span id='doDriverLabel'>${driver||'-'}</span></div>
            <div class='mb-2'><strong>Address:</strong> ${(data.deliveryAddress||data.DeliveryAddress)||'-'}</div>
            <div class='border rounded p-2 mb-2'><div class='fw-bold mb-1'>Items</div><table class='table table-sm mb-0'><thead><tr><th>ProductID</th><th>Qty</th></tr></thead><tbody>${items}</tbody></table></div>
            <div class='mt-3 d-flex justify-content-end flex-wrap gap-2' id='doActionContainer'>${actionBtns}</div>
            <div id='assignDriverContainer' class='mt-3 d-none'>
                <div class='input-group input-group-sm' style='max-width:320px;'>
                    <select id='selectDriver' class='form-select'><option value=''>-- pick driver --</option></select>
                    <button class='btn btn-outline-primary' id='btnSaveAssign'>Save</button>
                    <button class='btn btn-outline-secondary' id='btnCancelAssign'>Cancel</button>
                </div>
            </div>
        </div>`;
        Swal.fire({ title:'Delivery Order', html: modalHtml, width: 720, showConfirmButton:false, showCloseButton:true });
        DeliveryOrderModal.LoadDrivers();
        DeliveryOrderModal.BindActions(id,status);
    });
  },
  LoadDrivers: function(){ $.get('/User/GetUserList', function(list){ let data=list; if(list && list.result) data=list.result; const sel=$('#selectDriver'); if(!sel.length) return; (data||[]).forEach(u=> sel.append(`<option value='${u.id||u.ID}'>${u.userName||u.UserName}</option>`)); }); },
  BindActions: function(id,status){
    $(document).off('click','#btnAssignDriver').on('click','#btnAssignDriver', function(){ $('#assignDriverContainer').removeClass('d-none'); });
    $(document).off('click','#btnCancelAssign').on('click','#btnCancelAssign', function(){ $('#assignDriverContainer').addClass('d-none'); });
    $(document).off('click','#btnSaveAssign').on('click','#btnSaveAssign', function(){ const driverID = $('#selectDriver').val(); if(!driverID){ toastr.info('Select driver'); return; } $('#btnSaveAssign').prop('disabled',true).text('Saving...'); $.post('/DeliveryOrder/AssignDriver',{ id:id, driverUserID: driverID }, function(res){ if(res.success){ toastr.success('Driver assigned'); Swal.close(); LoadDeliveryOrderInfo(); } else toastr.error(res.result||'Assign failed'); }).fail(()=> toastr.error('Error assign driver')).always(()=> $('#btnSaveAssign').prop('disabled',false).text('Save')); });
    $(document).off('click','#btnOutForDelivery').on('click','#btnOutForDelivery', function(){ DeliveryOrderModal.UpdateStatus(id,3); });
    $(document).off('click','#btnMarkDelivered').on('click','#btnMarkDelivered', function(){ DeliveryOrderModal.UpdateStatus(id,4); });
  },
  UpdateStatus: function(id,newStatus){
    $.post('/DeliveryOrder/UpdateStatus',{ id:id, newStatus:newStatus }, function(res){ if(res.success){ toastr.success('Status updated'); Swal.close(); LoadDeliveryOrderInfo(); } else toastr.error(res.result||'Update failed'); }).fail(()=> toastr.error('Error update status')); }
};

let Table = {
    FillGridProduct: function (id, isReset) {
        let tableID = $('#tableProduct');
        if (isReset && $.fn.DataTable.isDataTable('#tableProduct')) {
            tableID.DataTable().clear().destroy();
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
        let columns = [
            { data: 'productID', visible: false },
            { data: 'supplierID', visible: false },
            { data: 'stockQuantity', visible: false },
            { data: 'product' },
            { data: 'supplier' },
            {
                data: 'quantity',
                render: function (data, type) {
                    return type === 'display' ? `<input type="number" class="form-control quantity" value="${data}" min="1" />` : data;
                }
            },
            { data: 'unit' },
            { data: 'unitPrice', render: $.fn.dataTable.render.number(',', '.', 2) },
            { data: 'subTotal', render: $.fn.dataTable.render.number(',', '.', 2) },
            {
                data: null,
                render: function () { return `<a class="btn btn-danger delete"><i class="fa fa-trash"></i></a>`; },
                orderable: false
            },
        ];
        let table = tableID.DataTable({
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
        tableID.find('tbody').unbind();
        $('#tableProduct').off('change');
        $('#tableProduct').on('change', 'input[type="number"]', function () {
            let table = $('#tableProduct').DataTable();
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
        tableID.find('tbody').on('click', '.delete', function () {
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
    },
    FillGridSearch: function () {
        let tableID = $('#tableSearch');
        let data = Common.GetData.Get('/SalesOrder/FillGrid');
        let columns = [
            { data: 'no' },
            { data: 'date' },
            { data: 'amount' },
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
        let table = tableID.DataTable({
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
                setTimeout(()=>{ ShowOrHideCreateDOButton(); LoadDeliveryOrderInfo(); }, 200);
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
        const doAjaxSave = () => {
            const btnSelector = isPay ? '#buttonPay' : '#buttonSave';
            const $btn = $(btnSelector).prop('disabled',true);
            $btn.find('.spinner-border').show();
            return $.ajax({
                url: '/SalesOrder/Save',
                type: 'POST',
                data: postData
            }).done(result => {
                if (result.success) {
                    toastr.success('Data saved');
                    if (result.id) $('#salesOrderID').val(result.id);
                    if (result.no) $('#salesOrderNumber').val(result.no);
                    if (result.statusID) { UpdateStatusBadge(result.statusID); $('#salesOrderStatusID').val(result.statusID); }
                    setTimeout(()=>{ ShowOrHideCreateDOButton(); LoadDeliveryOrderInfo(); },300);
                } else {
                    toastr.error(result.result || 'Data not saved');
                }
            }).fail(error => {
                toastr.error(error.responseText || error.statusText || 'Error', 'Data not saved');
            }).always(() => {
                const $b = $(btnSelector);
                $b.prop('disabled', false);
                $b.find('.spinner-border').hide();
            });
        };
        if (isPay) {
            Swal.fire({
                title: 'Confirm Payment',
                text: 'Are you sure you want to mark this Sales Order as paid?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, Pay',
                cancelButtonText: 'Cancel',
                showLoaderOnConfirm: true,
                preConfirm: () => doAjaxSave(),
                allowOutsideClick: () => !Swal.isLoading()
            });
        } else {
            doAjaxSave();
        }
    },
    Reset: function () { FormSalesOrder.FillForm(0, true); }
};