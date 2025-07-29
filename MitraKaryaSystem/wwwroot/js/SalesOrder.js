$(document).ready(function () {
    $('.js-example-basic-responsive').select2({
        width: 'resolve' // need to override the changed default
    });
    FormSalesOrder.FillForm(0, true);
    ControlSalesOrder.Init();
    ButtonSalesOrder.Init();
});

let ButtonSalesOrder = {
    Init: function () {
        $('#buttonSave').click(function (event) {
            event.preventDefault();
            let table = $('#tableProduct').DataTable();
            if (table.rows().count() <= 0) {
                toastr.info('Insert at least 1 product', "Cannot save");
                return;
            }
            Form.Save(false);
        });
        $('#buttonPay').click(function (event) {
            event.preventDefault();
            let table = $('#tableProduct').DataTable();
            if (table.rows().count() <= 0) {
                toastr.info('Insert at least 1 product', "Cannot save");
                return;
            }
            Form.Save(true);
        });
        $('#buttonSearch').click(function (event) {
            Table.FillGridSearch();
        });
        $('#buttonNew').click(function (event) {
            Form.Reset();
        });
    }
}

let Table = {
    FillGridProduct: function (id, isReset) {
        let tableID = $("#tableProduct");
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
                render: function (data, type, row) {
                    return type == 'display' ? `<input type="number" class="form-control  quantity" value="${data}" min="1" />` : data;
                }
            },
            { data: 'unit' },
            {
                data: 'unitPrice',
                render: $.fn.dataTable.render.number(',', '.', 2)
            },
            {
                data: 'subTotal',
                render: $.fn.dataTable.render.number(',', '.', 2)
            },
            {
                data: null,
                render: function () {
                    return `
                <a class="btn btn-danger delete">
                    <i class="fa fa-trash"></i> 
                </a>
            `;
                },
                "orderable": false
            },
        ];
        let table = tableID.DataTable({
            "deferRender": true,
            "processing": true,
            "serverSide": false,
            "destroy": true,
            "filter": true,
            "searching": false,
            "responsive": true,
            "columns": columns,
            "decimal": ",",
            "thousands": ".",
            "data": dataList.length > 0 ? dataList : null
        });
        tableID.find('tbody').unbind();
        $('#tableProduct').off('change');

        // Event listener for quantity input change
        $('#tableProduct').on('change', 'input[type="number"]', function () {
            let table = $('#tableProduct').DataTable();

            // Get the row index of the changed input field
            let rowIndex = table.cell($(this).closest('td')).index().row;

            // Get the current row data
            let row = table.row(rowIndex).data();

            // Get the updated quantity from the input field
            let newQuantity = parseInt($(this).val());
            if (newQuantity > row.stockQuantity) { return toastr.info('Quantity reach stock quantity'); }

            // Update the quantity in the row data
            table.cell(rowIndex, 3).data(newQuantity).draw(); // Assuming column 5 is quantity

            // Get the unit price from the row data (which is read-only)
            let unitPrice = parseFloat(row.unitPrice); // unitPrice should already be part of the row data

            // Check if the newQuantity and unitPrice are valid numbers
            if (!isNaN(newQuantity) && !isNaN(unitPrice)) {
                // Calculate the new subTotal
                let subTotal = newQuantity * unitPrice;

                // Update the subTotal column in the table (assuming subTotal is in column 8)
                table.cell(rowIndex, 5).data(subTotal).draw();
            }
            Control.CalculateGrandTotal();

        });

        tableID.find('tbody').on('click', '.delete', function (e) {
            let row = table.row($(this).parents('tr')).data();
            if (row.id) {

                // Show a confirmation dialog
                Swal.fire({
                    title: 'Are you sure?',
                    text: "You won't be able to revert this!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, delete it',
                    showLoaderOnConfirm: true,
                    preConfirm: () => {
                        return fetch(`/SalesOrder/DeleteItem?id=${row.id}`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            }
                        })
                            .then(response => {
                                toastr.options.onShown = function () {
                                    Table.FillGridProduct(id);
                                }
                                response.ok ? toastr.success('Data has been deleted') : toastr.error('Data not deleted');
                            })
                            .catch(error => {
                                Swal.showValidationMessage(`Request failed: ${error}`);
                            });
                    },
                    allowOutsideClick: () => !Swal.isLoading()
                });
            } else {
                table.row($(this).parents('tr')).remove().draw();
            }
        });
    },
    FillGridSearch: function () {
        let tableID = $("#tableSearch");
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
                render: function () {
                    return `
            <div class="btn-group" role="group" aria-label="Action Buttons">
                <a class="btn btn-warning edit" href="#" role="button">
                    <i class="fa fa-pencil"></i> Edit
                </a>
                <a class="btn btn-danger delete" role="button">
                    <i class="fa fa-trash"></i> Delete
                </a>
            </div>
        `;
                },
                orderable: false
            }

        ];
        let table = tableID.DataTable({
            "deferRender": true,
            "processing": true,
            "serverSide": false,
            "destroy": true,
            "filter": true,
            "searching": false,
            "responsive": true,
            "data": data,
            "columns": columns
        });
        tableID.find('tbody').unbind();

        tableID.find('tbody').on('click', '.edit', function (e) {
            let row = table.row($(this).parents('tr')).data();
            Form.FillForm(row.id, true);
            $('#searchModal').modal('hide');
        });
        tableID.find('tbody').on('click', '.delete', function (e) {
            let row = table.row($(this).parents('tr')).data();
            // Show a confirmation dialog
            Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, delete it',
                showLoaderOnConfirm: true,
                preConfirm: () => {
                    return fetch(`/SalesOrder/Delete?id=${row.id}`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        }
                    })
                        .then(response => {
                            toastr.options.onShown = function () {
                                Table.FillGridSearch();
                                Form.Reset();
                            }
                            response.ok ? toastr.success('Data has been deleted') : toastr.error('Data not deleted');
                        })
                        .catch(error => {
                            Swal.showValidationMessage(`Request failed: ${error}`);
                        });
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
            minimumInputLength: 3, // Minimum 3 characters to trigger the search
            ajax: {
                url: '/Product/GetProductComboList',
                dataType: 'json',
                delay: 250, // Optional: delay before triggering the request
                data: function (params) {
                    return {
                        name: params.term // Search term from the input
                    };
                },
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
            templateResult: function (data) {
                return data.text; // Display the text
            },
            templateSelection: function (data) {
                return data.text; // Selected item display
            }
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
        let table = $("#tableProduct").DataTable();
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
    // Check if the selected product is already in the table
    CheckProduct: function (selectedProduct) {
        let table = $("#tableProduct").DataTable();
        let exists = false;
        let rows = table.rows().nodes();

        // Loop through the table rows to find if the product is already there
        $(rows).each(function () {
            let rowData = table.row(this).data();
            // If productID matches, update the quantity
            if (rowData.productID == selectedProduct.id) {
                exists = true;
                let newQuantity = parseInt(rowData.quantity) + 1; // Increment quantity by 1
                if (newQuantity > selectedProduct.stockQuantity) { return toastr.info('Quantity reach stock quantity'); }
                table.cell(this, 5).data(newQuantity).draw(); // Update quantity in the table
                table.cell(this, 8).data(newQuantity * rowData.unitPrice).draw(); // Update subTotal
            }
        });
        // If the product doesn't exist in the table, add a new row with default quantity 1
        if (!exists) {
            ControlSalesOrder.AddRow(selectedProduct.id, selectedProduct.supplierID, selectedProduct.stockQuantity, selectedProduct.name, selectedProduct.supplierName, 1, selectedProduct.unit, selectedProduct.unitPrice, selectedProduct.stockQuantity);
        }
        this.CalculateGrandTotal();
    },
    CalculateGrandTotal() {
        let totalSum = 0;
        let table = $("#tableProduct").DataTable();
        let rows = table.rows().nodes();

        $(rows).each(function () {
            let rowData = table.row(this).data();
            let subTotal = parseFloat(rowData.unitPrice) * parseInt(rowData.quantity);
            totalSum += subTotal;
        });
        $('#total').text(totalSum.toFixed(2)); // Update the footer with the calculated grand total
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
                ControlSalesOrder.SelectProduct();
                Table.FillGridProduct(id, isReset);
                ControlSalesOrder.CalculateGrandTotal();
            },
            error: function (error) {
                toastr.error(error, 'Error load data');
            }
        });
    },
    Save: function (isPay) {

        // Create an object to store the form data and detail data
        var postData = {
            ID: $('#salesOrderID').val(),
            Date: $('#salesOrderDate').val(),
            No: $('#salesOrderNumber').val(),
            StatusID: $('#salesOrderStatus').val(),
            CustomerID: $('#selectCustomer').val(),
            Note: $('#salesOrderNote').val(),
            SalesOrderDetails: []
        };

        // Iterate over each row in the DataTable and extract productID and quantity
        $('#tableProduct tbody tr').each(function (index) {
            var table = $('#tableProduct').DataTable(); // Get the DataTable instance
            var rowData = table.row(index).data(); // Get the data for the current row
            var productID = rowData.productID;
            var quantity = rowData.quantity;
            var id = rowData.id == undefined ? 0 : rowData.id;
            if (productID && quantity) { // Check if both productID and quantity exist
                // Push an object containing productID and quantity to the detailData array
                postData.SalesOrderDetails.push({ productID: productID, quantity: quantity, ID: id, subTotal: rowData.subTotal });
            }
        });
        if (isPay) {
            Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, pay it',
                showLoaderOnConfirm: true,

                allowOutsideClick: () => !Swal.isLoading()
            });
            // Show loading indicator
            let buttonName = isPay ? 'buttonPay' : 'buttonSave';
            $(buttonName).prop('disabled', true); // Disable the button
            $(buttonName + ' .spinner-border').show(); // Show the spinner
            $.ajax({
                url: '/SalesOrder/Save',
                type: 'POST',
                data: postData,
                success: function (result) {
                    toastr.options.onShown = function () {
                    }
                    result.success ? toastr.success('Data saved') : toastr.error('Data not saved');
                    // Close loading indicator
                    $(buttonName).prop('disabled', false); // Enable the button
                    $(buttonName + ' .spinner-border').hide(); // Hide the spinner
                },
                error: function (error) {
                    toastr.error(error, 'Data not saved');
                    // Close loading indicator
                    $(buttonName).prop('disabled', false); // Enable the button
                    $(buttonName + ' .spinner-border').hide(); // Hide the spinner
                }
            });
        }
    },
    Reset: function () {
        Form.FillForm(0, true);
    }
}