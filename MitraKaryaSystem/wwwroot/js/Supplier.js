$(document).ready(function () { SupplierPage.init(); });

const SupplierPage = {
    currentId: null,
    allSuppliers: [],
    salesPersons: [],

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
        if (q) list = list.filter(c => (c.supplierName || c.SupplierName || '').toLowerCase().includes(q) || (c.contactPerson || c.ContactPerson || '').toLowerCase().includes(q) || (c.address || c.Address || '').toLowerCase().includes(q));

        const $ul = $('#supplierList').empty();
        if (!list.length) {
            $ul.html('<li class="text-center text-muted py-4"><small>No suppliers found</small></li>');
            return;
        }
        list.forEach(c => {
            const id = c.id || c.ID;
            const name = c.supplierName || c.SupplierName || '';
            const phone = c.contactNumber || c.ContactNumber || '';
            const person = c.contactPerson || c.ContactPerson || '';
            const initials = name.split(' ').map(w => (w[0] || '')).join('').substring(0, 2);
            const isActive = id === SupplierPage.currentId;

            $ul.append(
                `<li class="cust-list-item${isActive ? ' active' : ''}" data-id="${id}">
                    <div class="cust-avatar">${initials}</div>
                    <div class="cust-info">
                        <div class="cust-name text-truncate">${name}</div>
                        <div class="cust-detail text-truncate">${person ? person + ' · ' : ''}${phone || '\u2014'}</div>
                    </div>
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
            let panelHtml = `
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
                </div>`;

            // Sales Team section (only for existing suppliers)
            if (id) {
                panelHtml += `
                <hr class="my-3" />
                <div id="salesTeamSection">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <h6 class="mb-0 fw-semibold"><i class="fa fa-briefcase me-2 text-warning"></i>Sales Team</h6>
                        <button class="btn btn-sm btn-success" id="btnAddSP"><i class="fa fa-plus me-1"></i>Add</button>
                    </div>
                    <div id="spAddForm" style="display:none" class="border rounded p-2 mb-2 bg-light">
                        <div class="row g-2">
                            <div class="col-md-4">
                                <input type="text" class="form-control form-control-sm" id="spName" placeholder="Name *" />
                            </div>
                            <div class="col-md-3">
                                <input type="text" class="form-control form-control-sm" id="spCompany" placeholder="Company" />
                            </div>
                            <div class="col-md-3">
                                <input type="text" class="form-control form-control-sm" id="spContact" placeholder="Contact" />
                            </div>
                            <div class="col-md-2 d-flex gap-1">
                                <input type="hidden" id="spEditId" value="0" />
                                <button class="btn btn-sm btn-primary flex-fill" id="btnSaveSP"><i class="fa fa-check"></i></button>
                                <button class="btn btn-sm btn-outline-secondary flex-fill" id="btnCancelSP"><i class="fa fa-times"></i></button>
                            </div>
                        </div>
                    </div>
                    <div id="spList"><div class="text-center text-muted py-2"><small>Loading…</small></div></div>
                </div>`;
            }

            $('#supplierFormPanel').html(panelHtml);
            this.bindFormEvents();
            if (id) this.loadSalesPersons(id);
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

        // Sales Person inline form
        $('#btnAddSP').off('click').on('click', () => {
            $('#spEditId').val(0);
            $('#spName').val('');
            $('#spCompany').val('');
            $('#spContact').val('');
            $('#spAddForm').slideDown(150);
            $('#spName').focus();
        });
        $('#btnCancelSP').off('click').on('click', () => {
            $('#spAddForm').slideUp(150);
        });
        $('#btnSaveSP').off('click').on('click', () => this.saveSalesPerson());
    },

    // ===== Sales Person CRUD =====
    async loadSalesPersons(supplierId) {
        try {
            const list = await Common.Api.get('/Supplier/GetSalesPersons?supplierId=' + supplierId);
            this.salesPersons = Array.isArray(list) ? list : [];
            this.renderSalesPersons();
        } catch (e) {
            $('#spList').html('<div class="text-danger small py-2">Failed to load</div>');
        }
    },

    renderSalesPersons() {
        const $el = $('#spList').empty();
        if (!this.salesPersons.length) {
            $el.html('<div class="text-center text-muted py-2"><small>No sales persons yet</small></div>');
            return;
        }
        this.salesPersons.forEach(sp => {
            const name = sp.name || sp.Name || '';
            const company = sp.company || sp.Company || '';
            const contact = sp.contact || sp.Contact || '';
            const id = sp.id || sp.ID;
            $el.append(`
                <div class="d-flex align-items-center p-2 border rounded mb-2 sp-row" data-id="${id}">
                    <div class="flex-grow-1">
                        <div class="fw-semibold small">${this.esc(name)}</div>
                        <div class="text-muted" style="font-size:.75rem">
                            ${company ? '<i class="fa fa-building me-1"></i>' + this.esc(company) + ' · ' : ''}
                            ${contact ? '<i class="fa fa-phone me-1"></i>' + this.esc(contact) : '<span class="text-muted">—</span>'}
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="SupplierPage.editSalesPerson(${id},'${this.esc(name)}','${this.esc(company)}','${this.esc(contact)}')" title="Edit"><i class="fa fa-pen"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="SupplierPage.deleteSalesPerson(${id})" title="Delete"><i class="fa fa-trash"></i></button>
                </div>`);
        });
    },

    esc(s) { return (s || '').replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/>/g, '&gt;'); },

    editSalesPerson(id, name, company, contact) {
        $('#spEditId').val(id);
        $('#spName').val(name.replace(/\\'/g, "'"));
        $('#spCompany').val(company.replace(/\\'/g, "'"));
        $('#spContact').val(contact.replace(/\\'/g, "'"));
        $('#spAddForm').slideDown(150);
        $('#spName').focus();
    },

    async saveSalesPerson() {
        const name = $('#spName').val().trim();
        if (!name) { toastr.warning('Name is required'); return; }
        const data = {
            ID: parseInt($('#spEditId').val()) || 0,
            SupplierID: this.currentId,
            Name: name,
            Company: $('#spCompany').val().trim(),
            Contact: $('#spContact').val().trim(),
            IsActive: true
        };
        try {
            const res = await Common.Api.post('/Supplier/SaveSalesPerson', data);
            if (res?.success) {
                toastr.success('Sales person saved');
                $('#spAddForm').slideUp(150);
                this.loadSalesPersons(this.currentId);
            } else { toastr.error(res?.error || 'Failed'); }
        } catch (e) { toastr.error(e.message || 'Failed'); }
    },

    deleteSalesPerson(id) {
        Swal.fire({
            title: 'Delete sales person?', icon: 'warning',
            showCancelButton: true, confirmButtonText: 'Yes, delete',
            showLoaderOnConfirm: true,
            preConfirm: () => Common.Api.post('/Supplier/DeleteSalesPerson', { id })
                .then(r => { if (r?.success) { toastr.success('Deleted'); this.loadSalesPersons(this.currentId); } else Swal.showValidationMessage(r?.error || 'Failed'); })
                .catch(e => Swal.showValidationMessage(e.message || 'Failed'))
        });
    },

    // ===== Supplier CRUD =====
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
