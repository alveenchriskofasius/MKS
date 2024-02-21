﻿let userID = 0;

$(document).ready(function () {
    Table.FillGrid();
    Buttons.Init();
});
let Table = {
    FillGrid: function () {
        let data = Common.GetData.Get('GetUserList');
        let tableID = $("#tableUser");
        // Define an array to store the checked checkbox values
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
                    <a class="btn btn-warning edit" href="#">
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
                    return fetch(`DeleteUser?id=${row.id}`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        }
                    })
                        .then(response => {
                            if (response.ok) {
                                // Show success message
                                Swal.fire({
                                    position: 'center',
                                    icon: 'success',
                                    title: 'Success',
                                    text: 'User has been deleted',
                                    showConfirmButton: false,
                                    timer: 1500,
                                    allowOutsideClick: false
                                }).then(() => {
                                    Table.FillGrid();
                                });
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
    FillGridRequested: function () {
        let tableID = $('#tableRequest');
        let canEdit = (tableID.data("can-edit") === "True"); // Convert to boolean
        let data = Common.GetData.Get('GetRequestedList');
        // Define an array to store the checked checkbox values
        let columns = [
            { data: 'user_ID' },
            { data: 'username' },
        ];
        if (canEdit) {
            columns.push(
                {
                    data: null,
                    render: function (data, type, full, meta) {
                        if (type === 'display') {
                            // Render a select element with a specific class
                            return '<select class="roleSelect form-control" data-initialValue=""></select>';
                        }
                        // Return the data for other types (sorting, filtering, etc.)
                        return data;
                    }
                },
                {
                    data: null,
                    render: function () {
                        return '<button class="btn btn-danger form-control reject">Reject</button>'
                    }
                },
            );
        }
        tableID.DataTable({
            "deferRender": true,
            "processing": true,
            "serverSide": true,
            "destroy": true,
            "filter": true,
            "searching": false,
            "responsive": true,
            "data": data.data,
            "columns": columns,
            "dom": 'lBfrtip',
            "columnDefs": [
                { "targets": [0, 1], "className": "text-left" }
            ],
        });
        let table = tableID.DataTable();
        if (canEdit) {
            $('.roleSelect').each(function () {
                let selectElement = $(this);
                Control.RoleTable(selectElement);
            });
            tableID.on('change', '.roleSelect', function () {
                // Get the value of the clicked checkbox and parse it as an integer
                const roleID = parseInt($(this).val(), 10);
                var row = table.row($(this).parents('tr')).data();
                if (isNaN(roleID)) return;
                Swal.fire({
                    title: 'Assign role confirmation',
                    text: "You won't be able to revert this!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, assign',
                    showLoaderOnConfirm: true,
                    preConfirm: () => {
                        return fetch(`UpdateStatus/?userName=${row.username}&roleID=${roleID}&statusID=${1}`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            }
                        })
                            .then(() => {
                                // Show success message
                                Swal.fire({
                                    position: 'center',
                                    icon: 'success',
                                    title: 'Success',
                                    text: "User Role Assigned Successfully",
                                    showConfirmButton: false,
                                    timer: 1500,
                                    allowOutsideClick: false
                                });
                            }).then(() => {
                                Table.FillGrid();
                                Table.FillGridRequested();
                            })
                            .catch(error => {
                                Swal.showValidationMessage(`Request failed: ${error}`);
                            });
                    },
                    allowOutsideClick: () => !Swal.isLoading()
                }).then((result) => {
                    if (result.isDismissed) { // Check if the user dismissed the dialog (canceled)
                        // Reset the dropdown to the initial selected value
                        $(this).val(""); // Use 'change' here to trigger Select2 change
                    }
                });
            });

            tableID.on('click', '.reject', function (e) {
                let row = table.row($(this).parents('tr')).data();
                Swal.fire({
                    title: 'Reject role confirmation',
                    text: "You won't be able to revert this!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, reject',
                    showLoaderOnConfirm: true,
                    preConfirm: () => {
                        return fetch(`UpdateStatus/?userName=${row.username}&statusID=${3}`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            }
                        })
                            .then(() => {
                                // Show success message
                                Swal.fire({
                                    position: 'center',
                                    icon: 'success',
                                    title: 'Success',
                                    text: "User Rejected Successfully",
                                    showConfirmButton: false,
                                    timer: 1500,
                                    allowOutsideClick: false
                                });
                            }).then(() => {
                                Table.FillGrid();
                                Table.FillGridRequested();
                            })
                            .catch(error => {
                                Swal.showValidationMessage(`Request failed: ${error}`);
                            });
                    },
                    allowOutsideClick: () => !Swal.isLoading()
                });
            });
        }
    },
}
let Buttons = {
    Init: function () {
        $('#buttonAddUser').click(function () {
            Forms.FillForm(0);
        });
        $('#buttonSave').click(function () {
            var form = $('#userForm')[0];
            if (form.checkValidity()) {
                // If the form is valid, save the product and reset the form
                event.preventDefault();
                event.stopPropagation();
                Forms.Save();
                form.classList.remove('was-validated');
            } else {
                // If the form is invalid, add 'was-validated' class to apply Bootstrap validation styling
                event.preventDefault();
                event.stopPropagation();
                form.classList.add('was-validated');
            }
        });
    }
}

let Forms = {
    Save: function () {
        // Serialize the form data
        var formData = $('#userForm').serialize();
        // Show loading indicator
        $('#buttonSave').prop('disabled', true); // Disable the button
        $('#buttonSave .spinner-border').show(); // Show the spinner
        $.ajax({
            url: 'SaveUser',
            type: 'POST',
            data: formData,
            success: function (result) {
                toastr.options.onShown = function () {
                    Table.FillGrid();
                    $('#userModal').modal('hide');
                }
                result.result.success ? toastr.success('Data saved') : toastr.error(result.result.error, 'Data not saved');

                // Close loading indicator
                $('#buttonSave').prop('disabled', false); // Enable the button
                $('#buttonSave .spinner-border').hide(); // Hide the spinner
            },
            error: function (error) {
                // Show error message
                console.error('Saving failed:', error);

                // Close loading indicator
                Swal.close();

                // You can handle errors as needed
            }
        });
    },

    FillForm: function (id) {
        $.ajax({
            url: 'FillForm',
            type: 'POST',
            data: { id: id },
            success: function (result) {

                $('#bodyModal').html(result);


                // Update the modal body with the retrieved partial view

                // Open the modal
                $('#userModal').modal('show');
            },
            error: function (error) {
                // Handle errors if needed
                console.error('Error loading user data:', error);
            }
        });
    }

};