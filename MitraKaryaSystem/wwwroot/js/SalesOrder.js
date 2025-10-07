$(document).ready(function () {
    $('.js-example-basic-responsive').select2({
        width: 'resolve' // need to override the changed default
    });
    FormSalesOrder.FillForm(0, true);
    ControlSalesOrder.Init();
    ButtonSalesOrder.Init();
});

const TradeStatus = { 1: 'Draft', 2: 'Paid', 3: 'Debt' };

// utility to update main status badge
function UpdateStatusBadge(statusID) {
    const $badge = $('#salesOrderStatus');
    const text = TradeStatus[statusID] || 'Draft';
    $badge.text(text);
    $badge.removeClass('text-bg-warning text-bg-success text-bg-secondary');
    if (statusID === 2) $badge.addClass('text-bg-success');
    else if (statusID === 3) $badge.addClass('text-bg-warning');
    else $badge.addClass('text-bg-secondary');
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
    }
}

let Table = {
    FillGridProduct: function (id, isReset) {
        let tableID = $('#tableProduct');
        if (isReset) {
            tableID.DataTable().clear().draw();
        }
        let dataList = [];
        if (id != undefined && id != 0) {
            dataList = Common.GetData.Get('/SalesOrder/GetDetailListById?id=' + id);
        }
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
                render: function () {
                    return `<a class="btn btn-danger delete"><i class="fa fa-trash"></i></a>`;
                },
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
                        return fetch(`/SalesOrder/DeleteItem?id=${row.id}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        })
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
            const $btn = $(btnSelector);
            $btn.prop('disabled', true);
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
                    if (result.statusID) { UpdateStatusBadge(result.statusID); }
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
}