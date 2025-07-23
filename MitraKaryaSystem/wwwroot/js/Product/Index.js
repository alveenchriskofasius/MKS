$(document).ready(function () {
    Table.FillGrid();
});
let Table = {
    FillGrid: function () {
        let data = Common.GetData.Get('/Product/GetProductList');
        let tableID = $("#tableProduct");

        $(tableID).DataTable({
            "deferRender": true,
            "processing": true,
            "serverSide": false,
            "destroy": true,
            "filter": true,
            "searching": false,
            "responsive": true,
            "destroy": true,
            "columns": [
                { "data": "name" },
                { "data": "categoryName" },
                { "data": "unitName" },
                { "data": "unitPrice" },
                { "data": "stockQuantity" },
                { "data": "supplierName" },
                {
                    data: null,
                    render: function (row) {
                        return `
                    <a class="btn btn-warning edit" href="/Product/Form?id=${row.id}">
                        <i class="fa fa-pencil"></i> 
                    </a>
                    <span style="margin: 0 5px;"></span>
                    <a class="btn btn-danger delete">
                        <i class="fa fa-trash"></i> 
                    </a>
            `;
                    },
                    "orderable": false
                },
            ],
            "buttons": [],
            "dom": 'lBfrtip',
            "columnDefs": [{ "targets": [0, 1, 2, 3, 4, 5], "className": "text-left" }],

            "data": data.result
        });
        let tb = tableID.DataTable();
        tableID.find('tbody').unbind();
        tableID.find('tbody').on('click', '.delete', function (e) {
            let row = tb.row($(this).parents('tr')).data();
            // Show a confirmation dialog
            Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, delete it',
                showLoaderOnConfirm: true,
                preConfirm: () => {
                    return fetch(`/Product/DeleteProduct?id=${row.id}`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        }
                    })
                        .then(response => {
                            if (response.ok) {

                                toastr.options.onShown = function () { Table.FillGrid(); }
                                response.ok ? toastr.success('Data has been deleted') : toastr.error('Failed to delete data');
                            }
                        })

                        .catch(error => {
                            Swal.showValidationMessage(`Request failed: ${error}`);
                        });
                },
                allowOutsideClick: () => !Swal.isLoading()
            });
        });
    },
}