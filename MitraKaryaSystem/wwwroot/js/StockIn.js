$(document).ready(function () {
    ControlStockIn.Init();
    ButtonStockIn.Init();
    FormStockIn.FillForm(0, true);
});
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
                toastr.info('Insert at least 1 product', "Cannot save");
                return;
            }
            FormStockIn.Save();
        });
        $('#buttonNew').click(function (event) {
            FormStockIn.ResetProductForm();
            FormStockIn.Reset();
        });
        $('#buttonSearch').click(function (event) {
            TableStockIn.FillGridSearch();
        });
    }
}
let TableStockIn = {
    FillGridProduct: function (id, isReset) {
        let tableID = $("#tableProduct");
        if (isReset) {
            tableID.DataTable().clear().draw();

        }
        let dataList = [];
        if (id != undefined && id != 0) {
            dataList = Common.GetData.Get('/StockIn/GetDetailListById?id=' + id);
        }
        let columns = [
            { data: 'productID', visible: false },
            { data: 'product' },
            {
                data: 'quantity',
                render: function (data, type, row) {
                    return type == 'display' ? `<input type="number" class="form-control change" value="${data}" min="1" />` : data;
                }
            },
            {
                data: 'unitPrice',
                render: $.fn.dataTable.render.number(',', '.', 2)
            },
            { data: 'supplierID', visible: false },
            { data: 'barcode', visible: false },
            { data: 'supplier' },
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
            let rowIndex = table.cell($(this).closest('td')).index().row;
            let newData = parseInt($(this).val());
            table.cell(rowIndex, 2).data(newData).draw();
            ControlStockIn.UpdateSummary();
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
                        return fetch(`/StockIn/DeleteItem?id=${row.id}`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            }
                        })
                            .then(response => {
                                toastr.options.onShown = function () {
                                    TableStockIn.FillGridProduct(id);
                                    ControlStockIn.UpdateSummary();
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
                ControlStockIn.UpdateSummary();
            }
        });
        // Update summary after table is loaded
        ControlStockIn.UpdateSummary();
    },
    FillGridSearch: function () {
        let tableID = $("#tableSearch");
        let data = Common.GetData.Get('/StockIn/GetStockInList');
        let columns = [
            { data: 'no' },
            { data: 'date' },
            { data: 'amount' },
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
            FormStockIn.FillForm(row.id, true);
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
                    return fetch(`/StockIn/Delete?id=${row.id}`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        }
                    })
                        .then(response => {
                            toastr.options.onShown = function () {
                                Table.FillGridSearch();
                                FormStockIn.ResetProductForm();
                                FormStockIn.Reset();
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
let ControlStockIn = {
    Init: function () {
        $('.js-example-basic-single').select2({ width: '100%' });
        ControlStockIn.Product();
        ControlStockIn.ProductSelect();
        ControlStockIn.Barcode();
        ControlStockIn.Quantity();

    },
    Quantity: function () {
        $('#quantity').keypress(function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                ControlStockIn.AddProduct();
                $('#quantity').blur();
            }
        });
    },
    Barcode: function () {
        $('#barcode').keypress(function (event) {
            if (event.keyCode === 13) {
                event.preventDefault();
                let barcodeValue = $(this).val();
                ControlStockIn.CheckProduct(barcodeValue, true);
                FormStockIn.ResetProductForm();
            }
        });
    },
    CheckProduct: function (result, isScan) {
        let table = $("#tableProduct").DataTable();
        let rows = table.rows().nodes();
        let barcodeFound = false; // Initialize flag variable
        let quantity = parseInt($('#quantity').val());
        $(rows).each(function () {
            let rowData = table.row(this).data();
            if (parseInt(rowData.barcode) == result) {
                let updatedQuantity = 0;
                if (isScan) {
                    // If the product already exists, update the quantity
                    updatedQuantity = parseInt(rowData.quantity) + 1;
                    table.cell(this, 2).data(updatedQuantity).draw();
                } else {
                    updatedQuantity = parseInt(rowData.quantity) + quantity;
                }
                table.cell(this, 2).data(updatedQuantity).draw();
                barcodeFound = true; // Set flag to true if product is found
                ControlStockIn.UpdateSummary();
                return false; // Exit the loop early
            }
        });

        if (!barcodeFound) {
            $.ajax({
                url: '/StockIn/ScanBarcode',
                type: 'POST',
                data: { barcode: result },
                success: function (result) {
                    if (result == undefined || result == null) {
                        return toastr.error('Data not found', "Cannot add product");
                    }
                    ControlStockIn.AddRow(result.id, result.name, isScan ? 1 : quantity, result.unitPrice, result.barcode, result.supplierID, result.supplierName);
                    ControlStockIn.UpdateSummary();
                },
                error: function (error) {
                    toastr.error(error, 'Error scan barcode');
                }
            });
        }
    },
    AddRow: function (productID, productName, quantity, unitPrice, barcode, supplierID, supplier) {
        let table = $("#tableProduct").DataTable();
        table.row.add({
            productID: productID,
            product: productName,
            quantity: quantity,
            unitPrice: unitPrice,
            supplierID: supplierID,
            barcode: barcode,
            supplier: supplier
        }).draw();
        ControlStockIn.UpdateSummary();
    },
    Product: function () {
        let id = '#selectProduct';
        let data = Common.GetData.Get('/Product/GetProductComboList');
        $(id).html('');
        $(id).append('<option selected value="">' + 'Select product' + '</option>');
        if (data.result != null && data.result.length > 0) {
            $.each(data.result, function (i, item) {
                $(id).append('<option value="' + item.id + '" data-barcode="' + item.barcode + '">' + item.name + '</option>');
            });
        }
    },
    ProductSelect: function () {
        $('#selectProduct').on('select2:select', function (e) {
            let data = e.params.data;
            FormStockIn.FillFormProductBySelect(data);
        });
    },
    AddProduct: function () {
        var form = $('#stockInDetailForm')[0];
        var selectedProduct = $('#selectProduct');
        var quantityInput = $('#quantity');

        // Manually trigger the product selection validation
        if (!selectedProduct.val()) {
            selectedProduct.addClass('is-invalid');
            return;
        } else {
            selectedProduct.removeClass('is-invalid');
        }

        // Manually trigger the quantity input validation
        if (!quantityInput.val()) {
            quantityInput.addClass('is-invalid');
            return;
        } else {
            quantityInput.removeClass('is-invalid');
        }

        // Manually trigger the form validation if form exists
        if (form && !form.checkValidity()) {
            event.preventDefault();
            event.stopPropagation();
            form.classList.add('was-validated');
            return;
        }

        // If the form is valid, continue with adding a row to the DataTable
        event.preventDefault();
        event.stopPropagation();

        let barcode = selectedProduct.find('option:selected').data('barcode');
        ControlStockIn.CheckProduct(barcode, false);
        // Remove 'was-validated' class to reset validation styling
        if (form) form.classList.remove('was-validated');
        FormStockIn.ResetProductForm()
    },

    UpdateSummary: function () {
        let table = $("#tableProduct").DataTable();
        let data = table.rows().data();
        let totalQty = 0;
        let totalValue = 0;
        for (let i = 0; i < data.length; i++) {
            let qty = parseInt(data[i].quantity) || 0;
            let price = parseFloat(data[i].unitPrice) || 0;
            totalQty += qty;
            totalValue += qty * price;
        }
        $('#totalQty').text(totalQty);
        $('#totalUnitPrice').text(totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }

}


let FormStockIn = {
    FillFormProductBySelect: function (product) {
        $.ajax({
            url: '/StockIn/FillFormProduct',
            type: 'POST',
            data: { id: product.id },
            success: function (result) {
                $('#stockInDetailForm').html(result);
                ControlStockIn.Quantity();
                ControlStockIn.UpdateSummary();
            },
            error: function (error) {
                toastr.error(error, 'Error loading user data');
            }
        });
    },
    ResetProductForm: function () {
        $('#barcode').val('');
        $('#selectProduct').val('');
        $('#selectProduct').trigger('change');
        var selectedProduct = $('#selectProduct');
        var quantityInput = $('#quantity').val(0);
        quantityInput.removeClass('is-invalid');
        selectedProduct.removeClass('is-invalid');
    },
    Reset: function () {
        FormStockIn.FillForm(0, true);
        ControlStockIn.UpdateSummary();
    },
    Save: function () {

        // Create an object to store the form data and detail data
        var postData = {
            ID: $('#stockInID').val(),
            Date: $('#stockInDate').val(),
            No: $('#stockInNumber').val(),
            StockInDetails: []
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
                postData.StockInDetails.push({ productID: productID, quantity: quantity, ID: id });
            }
        });

        // Show loading indicator
        $('#buttonSave').prop('disabled', true); // Disable the button
        $('#buttonSave .spinner-border').show(); // Show the spinner
        $.ajax({
            url: '/StockIn/Save',
            type: 'POST',
            data: postData,
            success: function (result) {
                toastr.options.onShown = function () {
                    FormStockIn.ResetProductForm();
                    FormStockIn.Reset();
                }
                result.success ? toastr.success('Data saved') : toastr.error('Data not saved');
                // Close loading indicator
                $('#buttonSave').prop('disabled', false); // Enable the button
                $('#buttonSave .spinner-border').hide(); // Hide the spinner
            },
            error: function (error) {
                toastr.error(error, 'Data not saved');
                // Close loading indicator
                $('#buttonSave').prop('disabled', false); // Enable the button
                $('#buttonSave .spinner-border').hide(); // Hide the spinner
            }
        });
    },
    FillForm: function (id, isReset = false) {
        $.ajax({
            url: '/StockIn/FillForm',
            type: 'POST',
            data: { id: id },
            success: function (result) {
                $('#stockInHeaderBody').html(result);
                TableStockIn.FillGridProduct(id, isReset);
            },
            error: function (error) {
                toastr.error(error, 'Error load data');
            }
        });
    }
}