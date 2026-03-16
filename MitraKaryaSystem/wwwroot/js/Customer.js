$(document).ready(function () { CustomerPage.init(); });

const CustomerPage = {
    currentId: null,
    allCustomers: [],

    init() {
        this.loadCustomers();
        this.initButtons();
        customerControl.init();
    },

    initButtons() {
        $('#buttonAdd').off('click').on('click', () => this.loadForm(0));
        $('#customerSearch').on('input', () => this.renderList());
    },

    async loadCustomers() {
        try {
            const res = await Common.Api.get('/Customer/GetList');
            this.allCustomers = Array.isArray(res) ? res : (res && res.result) ? res.result : [];
            this.renderList();
        } catch (e) {
            toastr.error(e.message || 'Failed load customers');
        }
    },

    renderList() {
        const q = ($('#customerSearch').val() || '').toLowerCase();
        let list = this.allCustomers.filter(c => !c.isSupplier && !c.IsSupplier);

        if (q) list = list.filter(c => (c.name || c.Name || '').toLowerCase().includes(q) || (c.contactPerson || c.ContactPerson || '').toLowerCase().includes(q) || (c.contactNumber || c.ContactNumber || '').toLowerCase().includes(q));

        const $ul = $('#customerList').empty();
        if (!list.length) {
            $ul.html('<li class="text-center text-muted py-4"><small>No customers found</small></li>');
            return;
        }
        list.forEach(c => {
            const id = c.id || c.ID;
            const name = c.name || c.Name || '';
            const phone = c.contactNumber || c.ContactNumber || '';
            const initials = name.split(' ').map(w => (w[0] || '')).join('').substring(0, 2);
            const isActive = id === CustomerPage.currentId;

            $ul.append(
                `<li class="cust-list-item${isActive ? ' active' : ''}" data-id="${id}">
                    <div class="cust-avatar">${initials}</div>
                    <div class="cust-info">
                        <div class="cust-name text-truncate">${name}</div>
                        <div class="cust-detail text-truncate">${phone || '—'}</div>
                    </div>
                </li>`
            );
        });

        $ul.off('click', '.cust-list-item').on('click', '.cust-list-item', function () {
            CustomerPage.loadForm($(this).data('id'));
        });
    },

    async loadForm(id) {
        this.currentId = id;
        $('.cust-list-item').removeClass('active');
        $(`.cust-list-item[data-id="${id}"]`).addClass('active');

        try {
            const html = await Common.Api.post('/Customer/FillForm', { id: id });
            const formHtml = typeof html === 'string' ? html : (html && html.html) || '<div class="text-danger">Unexpected response</div>';
            $('#customerFormPanel').html(`
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <h6 class="mb-0 fw-bold"><i class="fa fa-user-pen me-2 text-primary"></i>${id ? 'Edit Customer' : 'New Customer'}</h6>
                    <div class="d-flex gap-2">
                        ${id ? '<button class="btn btn-sm btn-outline-danger" id="btnDeleteCustomer" data-id="' + id + '"><i class="fa fa-trash me-1"></i>Delete</button>' : ''}
                        <button class="btn btn-sm btn-outline-secondary" id="btnCancelEdit"><i class="fa fa-times me-1"></i>Cancel</button>
                    </div>
                </div>
                <div id="customerFormBody">${formHtml}</div>
                <div class="d-flex justify-content-end mt-3 pt-3 border-top">
                    <button class="btn btn-primary" id="buttonSave">
                        <span class="spinner-border spinner-border-sm d-none"></span>
                        <i class="fa fa-save me-1"></i>Save
                    </button>
                </div>
            `);
            this.bindFormEvents();
            customerControl.visibility();
        } catch (e) {
            toastr.error(e.message || 'Error loading form');
        }
    },

    bindFormEvents() {
        $('#buttonSave').off('click').on('click', function (e) {
            e.preventDefault();
            const form = $('#customerForm')[0];
            if (form && !form.checkValidity()) {
                form.classList.add('was-validated');
                return;
            }
            CustomerPage.save();
        });

        $('#btnDeleteCustomer').off('click').on('click', function () {
            CustomerPage.deleteCustomer($(this).data('id'));
        });

        $('#btnCancelEdit').off('click').on('click', function () {
            CustomerPage.currentId = null;
            $('.cust-list-item').removeClass('active');
            $('#customerFormPanel').html(
                '<div class="empty-state"><i class="fa fa-user-group"></i><p>Select a customer to edit or create a new one</p></div>'
            );
        });
    },

    async save() {
        const formData = $('#customerForm').serializeArray().reduce((acc, cur) => { acc[cur.name] = cur.value; return acc; }, {});
        const $btn = $('#buttonSave');
        $btn.prop('disabled', true).find('.spinner-border').removeClass('d-none');

        try {
            const result = await Common.Api.post('/Customer/Save', formData);
            const ok = result && (result.success || (result.result && result.result.success));
            if (ok) {
                toastr.success('Data saved');
                await this.loadCustomers();
                const newId = (result.id || result.ID) || (result.result && (result.result.id || result.result.ID)) || this.currentId;
                if (newId) this.loadForm(newId);
                else this.resetPanel();
            } else {
                toastr.error((result && (result.error || (result.result && result.result.error))) || 'Data not saved');
            }
        } catch (e) {
            toastr.error(e.message || 'Data not saved');
        } finally {
            $btn.prop('disabled', false).find('.spinner-border').addClass('d-none');
        }
    },

    deleteCustomer(id) {
        if (!id) return;
        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it',
            showLoaderOnConfirm: true,
            preConfirm: () => Common.Api.post('/Customer/Delete', { id })
                .then(() => {
                    toastr.success('Customer deleted');
                    this.resetPanel();
                    this.loadCustomers();
                })
                .catch(e => Swal.showValidationMessage(e.message || 'Delete failed'))
        });
    },

    resetPanel() {
        this.currentId = null;
        $('.cust-list-item').removeClass('active');
        $('#customerFormPanel').html(
            '<div class="empty-state"><i class="fa fa-user-group"></i><p>Select a customer to edit or create a new one</p></div>'
        );
    }
};

const customerControl = {
    init: function () {
        $(document).off('click', '.cust-type-btn').on('click', '.cust-type-btn', function () {
            $('.cust-type-btn').removeClass('active');
            $(this).addClass('active');
            const type = $(this).data('type');
            $('#isSupplier').val(type === 'supplier' ? 'true' : 'false');
            customerControl.visibility();
        });
    },
    visibility: function () {
        const isSupplier = $('#isSupplier').val() === 'true';
        const $contactPerson = $('#contactPerson');

        function updateValidationState() {
            if ($contactPerson.val() === '') {
                $contactPerson.prop('required', true).addClass('is-invalid');
                $contactPerson.next('.invalid-feedback').show();
            } else {
                $contactPerson.prop('required', false).removeClass('is-invalid');
                $contactPerson.next('.invalid-feedback').hide();
            }
        }

        if (isSupplier) {
            $('#contactPersonFormGroup').show();
            updateValidationState();
        } else {
            $('#contactPersonFormGroup').hide();
            $contactPerson.prop('required', false).removeClass('is-invalid');
            $contactPerson.next('.invalid-feedback').hide();
        }

        $contactPerson.off('input').on('input', updateValidationState);
    }
};