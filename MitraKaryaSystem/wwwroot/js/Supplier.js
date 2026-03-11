$(document).ready(function () { SupplierPage.init(); });

const SupplierPage = {
    currentId: null,
    allSuppliers: [],

    init() {
        this.loadSuppliers();
        this.initButtons();
    },

    initButtons() {
        $('#buttonAdd').off('click').on('click', () => this.loadForm(0));
        $('#supplierSearch').on('input', () => this.renderList());
    },

    async loadSuppliers() {
        try {
            const res = await Common.Api.get('/Supplier/GetList');
            this.allSuppliers = Array.isArray(res) ? res : (res && res.result) ? res.result : [];
            this.renderList();
        } catch (e) {
            toastr.error(e.message || 'Failed load suppliers');
        }
    },

    renderList() {
        const q = ($('#supplierSearch').val() || '').toLowerCase();
        let list = this.allSuppliers;
        if (q) list = list.filter(c => (c.supplierName || c.SupplierName || '').toLowerCase().includes(q) || (c.contactPerson || c.ContactPerson || '').toLowerCase().includes(q));

        const $ul = $('#supplierList').empty();
        if (!list.length) {
            $ul.html('<li class="text-center text-muted py-4"><small>No suppliers found</small></li>');
            return;
        }
        list.forEach(c => {
            const id = c.id || c.ID;
            const name = c.supplierName || c.SupplierName || '';
            const phone = c.contactNumber || c.ContactNumber || '';
            const initials = name.split(' ').map(w => (w[0] || '')).join('').substring(0, 2);
            const isActive = id === SupplierPage.currentId;

            $ul.append(
                `<li class="cust-list-item${isActive ? ' active' : ''}" data-id="${id}">
                    <div class="cust-avatar">${initials}</div>
                    <div class="cust-info">
                        <div class="cust-name text-truncate">${name}</div>
                        <div class="cust-detail text-truncate">${phone || '\u2014'}</div>
                    </div>
                    <span class="cust-badge"><span class="badge bg-info" style="font-size:.65rem">Supplier</span></span>
                </li>`
            );
        });

        $ul.off('click', '.cust-list-item').on('click', '.cust-list-item', function () {
            SupplierPage.loadForm($(this).data('id'));
        });
    },

    async loadForm(id) {
        this.currentId = id;
        $('.cust-list-item').removeClass('active');
        $(`.cust-list-item[data-id="${id}"]`).addClass('active');

        try {
            const html = await Common.Api.post('/Supplier/FillForm', { id: id });
            const formHtml = typeof html === 'string' ? html : (html && html.html) || '<div class="text-danger">Unexpected response</div>';
            $('#supplierFormPanel').html(`
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <h6 class="mb-0 fw-bold"><i class="fa fa-truck me-2 text-primary"></i>${id ? 'Edit Supplier' : 'New Supplier'}</h6>
                    <div class="d-flex gap-2">
                        ${id ? '<button class="btn btn-sm btn-outline-danger" id="btnDeleteSupplier" data-id="' + id + '"><i class="fa fa-trash me-1"></i>Delete</button>' : ''}
                        <button class="btn btn-sm btn-outline-secondary" id="btnCancelEdit"><i class="fa fa-times me-1"></i>Cancel</button>
                    </div>
                </div>
                <div id="supplierFormBody">${formHtml}</div>
                <div class="d-flex justify-content-end mt-3 pt-3 border-top">
                    <button class="btn btn-primary" id="buttonSave">
                        <span class="spinner-border spinner-border-sm d-none"></span>
                        <i class="fa fa-save me-1"></i>Save
                    </button>
                </div>
            `);
            this.bindFormEvents();
        } catch (e) {
            toastr.error(e.message || 'Error loading form');
        }
    },

    bindFormEvents() {
        $('#buttonSave').off('click').on('click', function (e) {
            e.preventDefault();
            const form = $('#supplierForm')[0];
            if (form && !form.checkValidity()) {
                form.classList.add('was-validated');
                return;
            }
            SupplierPage.save();
        });

        $('#btnDeleteSupplier').off('click').on('click', function () {
            SupplierPage.deleteSupplier($(this).data('id'));
        });

        $('#btnCancelEdit').off('click').on('click', function () {
            SupplierPage.resetPanel();
        });
    },

    async save() {
        const formData = $('#supplierForm').serializeArray().reduce((acc, cur) => { acc[cur.name] = cur.value; return acc; }, {});
        const $btn = $('#buttonSave');
        $btn.prop('disabled', true).find('.spinner-border').removeClass('d-none');

        try {
            const result = await Common.Api.post('/Supplier/Save', formData);
            const ok = result && (result.success || (result.result && result.result.success));
            if (ok) {
                toastr.success('Data saved');
                await this.loadSuppliers();
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

    deleteSupplier(id) {
        if (!id) return;
        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it',
            showLoaderOnConfirm: true,
            preConfirm: () => Common.Api.post('/Supplier/Delete', { id })
                .then(() => {
                    toastr.success('Supplier deleted');
                    this.resetPanel();
                    this.loadSuppliers();
                })
                .catch(e => Swal.showValidationMessage(e.message || 'Delete failed'))
        });
    },

    resetPanel() {
        this.currentId = null;
        $('.cust-list-item').removeClass('active');
        $('#supplierFormPanel').html(
            '<div class="empty-state"><i class="fa fa-truck"></i><p>Select a supplier to edit or create a new one</p></div>'
        );
    }
};
