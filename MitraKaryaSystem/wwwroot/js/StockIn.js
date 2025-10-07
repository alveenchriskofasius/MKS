$(document).ready(function () {
    ControlStockIn.Init();
    ButtonStockIn.Init();
    FormStockIn.FillForm(0, true);
});

const StockInStatus = { 1: 'Draft' };
function UpdateStockInStatusBadge(statusID) {
    const $b = $('#stockInStatus');
    const txt = StockInStatus[statusID] || 'Draft';
    $b.text(txt);
    $b.removeClass('text-bg-warning text-bg-success text-bg-secondary');
    $b.addClass('text-bg-warning');
}

let ButtonStockIn = {
    Init: function () {
        $('#buttonAdd').click(function (event) {
            event.preventDefault();
            ControlStockIn.AddProduct();
        });
        $('#buttonSave').click(function (event) {
            event.preventDefault();
            let table = $('#tableProduct').DataTable();
            if (table.rows().count() <= 0) {
                toastr.info('Insert at least 1 product', 'Cannot save');
                return;
            }
            FormStockIn.Save();
        });
        $('#buttonNew').click(function () {
            FormStockIn.ResetProductForm();
            FormStockIn.Reset();
        });
        $('#buttonSearch').click(function () {
            TableStockIn.FillGridSearch();
        });
    }
}
let TableStockIn = {
    FillGridProduct: function (id, isReset) {
        let tableID = $('#tableProduct');
        if (isReset) { tableID.DataTable().clear().draw(); }
        let dataList = [];
        if (id) { dataList = Common.GetData.Get('/StockIn/GetDetailListById?id=' + id); }
        let columns = [
            { data: 'productID', visible: false },
            { data: 'product' },
            { data: 'quantity', render: (d, t) => t === 'display' ? `<input type="number" class="form-control change" value="${d}" min="1" />` : d },
            { data: 'unitPrice', render: $.fn.dataTable.render.number(',', '.', 2) },
            { data: 'supplierID', visible: false },
            { data: 'barcode', visible: false },
            { data: 'supplier' },
            { data: null, render: () => `<a class="btn btn-danger delete"><i class="fa fa-trash"></i></a>`, orderable: false }
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
            decimal: ',', thousands: '.',
            data: dataList.length > 0 ? dataList : null
        });
        tableID.find('tbody').unbind();
        $('#tableProduct').off('change');
        $('#tableProduct').on('change', 'input[type="number"]', function () {
            let rowIndex = table.cell($(this).closest('td')).index().row;
            let newData = parseInt($(this).val());
            if (isNaN(newData) || newData < 1) newData = 1;
            table.cell(rowIndex, 2).data(newData).draw();
            ControlStockIn.UpdateSummary();
        });
        tableID.find('tbody').on('click', '.delete', function () {
            let row = table.row($(this).parents('tr')).data();
            if (row.id) {
                Swal.fire({
                    title: 'Are you sure?',
                    text: "You won't be able to revert this!",
                    icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', showLoaderOnConfirm: true,
                    preConfirm: () => fetch(`/StockIn/DeleteItem?id=${row.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                        .then(r => {
                            toastr.options.onShown = () => { TableStockIn.FillGridProduct(id); ControlStockIn.UpdateSummary(); };
                            r.ok ? toastr.success('Data has been deleted') : toastr.error('Data not deleted');
                        })
                        .catch(err => Swal.showValidationMessage(`Request failed: ${err}`)),
                    allowOutsideClick: () => !Swal.isLoading()
                });
            } else { table.row($(this).parents('tr')).remove().draw(); ControlStockIn.UpdateSummary(); }
        });
        ControlStockIn.UpdateSummary();
    },
    FillGridSearch: function () {
        let tableID = $('#tableSearch');
        let data = Common.GetData.Get('/StockIn/GetStockInList');
        let columns = [
            { data: 'no' }, { data: 'date' }, { data: 'amount' }, { data: 'createdBy' }, { data: 'updatedBy' },
            { data: null, render: (d,t,row) => `<div class="btn-group" role="group"><a class="btn btn-warning edit"><i class="fa fa-pencil"></i> Edit</a><a class="btn btn-danger delete"><i class="fa fa-trash"></i> Delete</a></div>`, orderable: false }
        ];
        let table = tableID.DataTable({ deferRender: true, processing: true, serverSide: false, destroy: true, filter: true, searching: false, responsive: true, data: data, columns: columns });
        tableID.find('tbody').unbind();
        tableID.find('tbody').on('click', '.edit', function () { let row = table.row($(this).parents('tr')).data(); FormStockIn.FillForm(row.id, true); $('#searchModal').modal('hide'); });
        tableID.find('tbody').on('click', '.delete', function () {
            let row = table.row($(this).parents('tr')).data();
            Swal.fire({
                title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', showLoaderOnConfirm: true,
                preConfirm: () => fetch(`/StockIn/Delete?id=${row.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                    .then(r => { toastr.options.onShown = () => { Table.FillGridSearch(); FormStockIn.ResetProductForm(); FormStockIn.Reset(); }; r.ok ? toastr.success('Data has been deleted') : toastr.error('Data not deleted'); })
                    .catch(err => Swal.showValidationMessage(`Request failed: ${err}`)),
                allowOutsideClick: () => !Swal.isLoading()
            });
        });
    }
};
let ControlStockIn = {
    Init: function () {
        $('#selectProduct').select2({
            placeholder: 'Type product name below', minimumInputLength: 3,
            ajax: {
                url: '/Product/GetProductComboList', dataType: 'json', delay: 250,
                data: params => ({ name: params.term }),
                processResults: data => ({ results: $.map(data.result, item => ({ id: item.id, text: item.name + ' - ' + item.supplierName, supplierID: item.supplierID, name: item.name, supplierName: item.supplierName, unitPrice: item.unitPrice, unit: item.unit, stockQuantity: item.stockQuantity, barcode: item.barcode })) })
            }, templateResult: d => d.text, templateSelection: d => d.text
        });
        ControlStockIn.ProductSelect();
    },
    ProductSelect: function () { $('#selectProduct').on('select2:select', function (e) { let data = e.params.data; ControlStockIn.AddOrIncrease(data); $(this).val(null).trigger('change'); $(this).select2('close'); }); },
    AddOrIncrease: function (selectedProduct) {
        let table = $('#tableProduct').DataTable();
        let exists = false; let rows = table.rows().nodes(); let qtyInput = parseInt($('#quantity').val()) || 1;
        $(rows).each(function () { let rowData = table.row(this).data(); if (rowData.productID == selectedProduct.id) { exists = true; let newQuantity = parseInt(rowData.quantity) + qtyInput; rowData.quantity = newQuantity; table.row(this).data(rowData).invalidate(); } });
        if (!exists) { ControlStockIn.AddRow(selectedProduct.id, selectedProduct.name, qtyInput, selectedProduct.unitPrice, selectedProduct.barcode, selectedProduct.supplierID, selectedProduct.supplierName); }
        table.draw(false); ControlStockIn.UpdateSummary();
    },
    AddRow: function (productID, productName, quantity, unitPrice, barcode, supplierID, supplier) { let table = $('#tableProduct').DataTable(); table.row.add({ productID, product: productName, quantity, unitPrice, supplierID, barcode, supplier }).draw(); },
    AddProduct: function () { let selectedData = $('#selectProduct').select2('data')[0]; if (!selectedData) { toastr.info('Select a product first'); return; } ControlStockIn.AddOrIncrease(selectedData); $('#quantity').val(1); },
    UpdateSummary: function () { let table = $('#tableProduct').DataTable(); let data = table.rows().data(); let totalQty = 0; let totalValue = 0; for (let i = 0; i < data.length; i++) { let qty = parseInt(data[i].quantity) || 0; let price = parseFloat(data[i].unitPrice) || 0; totalQty += qty; totalValue += qty * price; } $('#totalQty').text(totalQty); $('#totalUnitPrice').text(totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }
};

let FormStockIn = {
    ResetProductForm: function () { $('#selectProduct').val(null).trigger('change'); $('#quantity').val(1); },
    Reset: function () { FormStockIn.FillForm(0, true); ControlStockIn.UpdateSummary(); },
    Save: function () {
        var postData = { ID: $('#stockInID').val(), Date: $('#stockInDate').val(), No: $('#stockInNumber').val(), StockInDetails: [] };
        let table = $('#tableProduct').DataTable();
        table.rows().every(function () { let r = this.data(); if (r && r.productID && r.quantity) { postData.StockInDetails.push({ productID: r.productID, quantity: r.quantity, ID: r.id == undefined ? 0 : r.id }); } });
        $('#buttonSave').prop('disabled', true); $('#buttonSave .spinner-border').show();
        $.ajax({ url: '/StockIn/Save', type: 'POST', data: postData }).done(result => {
            if (result.success) { toastr.success('Data saved'); if (result.id) $('#stockInID').val(result.id); if (result.no) $('#stockInNumber').val(result.no); if (result.statusID) UpdateStockInStatusBadge(result.statusID); }
            else { toastr.error(result.result || 'Data not saved'); }
        }).fail(err => { toastr.error(err.responseText || err.statusText || 'Error', 'Data not saved'); })
            .always(() => { $('#buttonSave').prop('disabled', false); $('#buttonSave .spinner-border').hide(); });
    },
    FillForm: function (id, isReset = false) {
        $.ajax({ url: '/StockIn/FillForm', type: 'POST', data: { id: id } }).done(result => {
            $('#stockInHeaderBody').html(result); const statusVal = parseInt($('#stockInStatusID').val() || '1', 10); UpdateStockInStatusBadge(statusVal); TableStockIn.FillGridProduct(id, isReset); }).fail(err => toastr.error(err, 'Error load data'));
    }
};