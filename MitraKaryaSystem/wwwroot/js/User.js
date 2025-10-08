let userID = 0;

$(document).ready(function () {
    Table.FillGrid();
    Buttons.Init();
});
let Table = {
    FillGrid: function () {
        let data = Common.GetData.Get('/User/GetUserList');
        let tableID = $("#tableUser");
        let columns = [
            { data: 'userName' },
            { data: 'name' },
            { data: 'email' },
            { data: 'ktp' },
            { data: 'active' },
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
                "orderable": false
            },
        ];
        $(tableID).DataTable({
            "deferRender": true,
            "processing": true,
            "serverSide": false,
            "destroy": true,
            "filter": false,
            "searching": false,
            "responsive": true,
            "data": data,
            "columns": columns,
            "buttons": [],
            "dom": 'lBfrtip',
            "columnDefs": [{ "targets": [0, 1, 2, 3, 4], "className": "text-left" }],
        });
        let tb = tableID.DataTable();
        tableID.find('tbody').unbind();
        tableID.find('tbody').on('click', '.edit', function (e) {

            let row = tb.row($(this).parents('tr')).data();
            Forms.FillForm(row.id);
            $('#userModal').modal('show');
        });
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
                    return fetch(`/User/DeleteUser?id=${row.id}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" }
                    })
                        .then(response => {
                            if (response.ok) {
                                toastr.options.onShown = function () { Table.FillGrid(); }
                                toastr.success('Data has been deleted');
                            } else {
                                toastr.error('Data not deleted');
                            }
                        })
                        .catch(error => { Swal.showValidationMessage(`Request failed: ${error}`); });
                },
                allowOutsideClick: () => !Swal.isLoading()
            });
        });
    },
    FillGridRequested: function () { /* unchanged */ }
}
let Buttons = {
    Init: function () {
        $('#buttonAddUser').click(function () { Forms.FillForm(0); });
        $('#buttonSave').click(function (event) {
            var form = $('#userForm')[0];
            if (form.checkValidity()) {
                event.preventDefault(); event.stopPropagation(); Forms.Save(); form.classList.remove('was-validated');
            } else {
                event.preventDefault(); event.stopPropagation(); form.classList.add('was-validated');
            }
        });
    }
}

let Forms = {
    Save: function () {
        var formData = $('#userForm').serialize();
        $('#buttonSave').prop('disabled', true); $('#buttonSave .spinner-border').show();
        $.ajax({
            url: '/User/SaveUser',
            type: 'POST',
            data: formData,
            success: function (result) {
                toastr.options.onShown = function () { Table.FillGrid(); $('#userModal').modal('hide'); };
                (result.result && result.result.success) ? toastr.success('Data saved') : toastr.error('Data not saved');
                $('#buttonSave').prop('disabled', false); $('#buttonSave .spinner-border').hide();
            },
            error: function (error) {
                toastr.error(error.responseText || 'Data not saved');
                $('#buttonSave').prop('disabled', false); $('#buttonSave .spinner-border').hide();
            }
        });
    },
    FillForm: function (id) {
        $.ajax({
            url: '/User/FillForm',
            type: 'POST',
            data: { id: id },
            success: function (result) { $('#bodyModal').html(result); $('#userModal').modal('show'); },
            error: function (error) { toastr.error(error.responseText || 'Error load data'); }
        });
    }
};