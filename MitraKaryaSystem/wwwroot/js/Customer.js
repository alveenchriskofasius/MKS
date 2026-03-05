$(document).ready(function () {
    customerButtons.init();
    customerTable.fillGrid();
    customerControl.init();
});

const customerTable = {
    fillGrid: async function () {
        try {
            await SharedTable.init({
                table: '#tableCustomer',
                columns: [
                    { data: 'name' },
                    { data: 'contactPerson' },
                    { data: 'contactNumber' },
                    { data: 'isSupplier' },
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
            </div>`;
                        },
                        orderable: false
                    }
                ],
                // lazily load data so we can refresh easily
                load: async () => {
                    try {
                        const res = await Common.Api.get('/Customer/GetList');
                        return Array.isArray(res) ? res : (res && res.result) ? res.result : [];
                    } catch (e) {
                        toastr.error(e.message || 'Failed load customers');
                        return [];
                    }
                },
                options: {
                    dom: 'lBfrtip',
                    columnDefs: [{ targets: [0, 1, 2, 3, 4], className: 'text-left' }]
                },
                actions: {
                    editSelector: '.edit',
                    onEdit: function (row) {
                        if (!row) return;
                        customerForms.fillForm(row.id || row.ID);
                        $('#userModal').modal('show');
                    },
                    delete: {
                        apiUrl: '/Customer/Delete',
                        payload: (r) => ({ id: r && (r.id || r.ID) }),
                        title: 'Are you sure?',
                        text: "You won't be able to revert this!",
                        confirmText: 'Yes, delete it',
                        onSuccess: function () {
                            toastr.options.onShown = function () { $('#customerModal').modal('hide'); };
                        }
                    },
                    refresh: () => customerTable.fillGrid()
                }
            });
        } catch (e) {
            toastr.error(e.message || 'Failed initialize table');
        }
    }
};

const customerButtons = {
    init: function () {
        $('#buttonAdd').off().on('click', function () { customerForms.fillForm(0); });
        $('#buttonSave').off().on('click', function (event) {
            const form = $('#customerForm')[0];
            if (form.checkValidity()) {
                // If the form is valid, save the product and reset the form
                event.preventDefault(); event.stopPropagation(); customerForms.save(); form.classList.remove('was-validated');
            } else {
                // If the form is invalid, add 'was-validated' class to apply Bootstrap validation styling
                event.preventDefault(); event.stopPropagation(); form.classList.add('was-validated');
            }
        });
    }
};

const customerForms = {
    save: function () {
        // Serialize the form data
        const formData = $('#customerForm').serializeArray().reduce((acc, cur) => { acc[cur.name] = cur.value; return acc; }, {});
        // Show loading indicator
        $('#buttonSave').prop('disabled', true);
        $('#buttonClose').prop('disabled', true);
        $('#buttonSave .spinner-border').show();
        Common.Api.post('/Customer/Save', formData)
            .then(function (result) {
                toastr.options.onShown = function () { $('#customerModal').modal('hide'); customerTable.fillGrid(); };
                (result && result.result && result.result.success) ? toastr.success('Data saved') : toastr.error('Data not saved');
            })
            .catch(function (error) { toastr.error(error.message || 'Data not saved'); })
            .finally(function () {
                $('#buttonSave').prop('disabled', false);
                $('#buttonClose').prop('disabled', false);
                $('#buttonSave .spinner-border').hide();
            });
    },

    fillForm: function (id) {
        Common.Api.post('/Customer/FillForm', { id: id })
            .then(function (result) {
                $('#bodyModal').html(result);
                customerControl.visibility();
                $('#customerModal').modal('show');
            })
            .catch(function (error) { toastr.error(error.message || 'Error load data'); });
    }
};

const customerControl = {
    init: function () { $(document).off('change', '#isSupplier').on('change', '#isSupplier', function () { customerControl.visibility(); }); },
    visibility: function () {
        const isSupplierChecked = $('#isSupplier').prop('checked');
        const $contactPerson = $('#contactPerson');
        // Function to update validation state based on input value
        function updateValidationState() {
            if ($contactPerson.val() === '') {
                // If input value is empty, add required attribute and show invalid feedback
                $contactPerson.prop('required', true).addClass('is-invalid');
                $contactPerson.next('.invalid-feedback').show();
            } else {
                // If input value is not empty, remove required attribute and hide invalid feedback
                $contactPerson.prop('required', false).removeClass('is-invalid');
                $contactPerson.next('.invalid-feedback').hide();
            }
        }

        // Update validation state when the "Is Supplier" checkbox is changed
        if (isSupplierChecked) {
            $('#contactPersonFormGroup').show();
            updateValidationState();
        } else {
            $('#contactPersonFormGroup').hide();
            // Reset validation state when hiding the form group
            $contactPerson.prop('required', false).removeClass('is-invalid');
            $contactPerson.next('.invalid-feedback').hide();
        }

        // Update validation state when the input field value changes
        $contactPerson.off('input').on('input', updateValidationState);
    }
};