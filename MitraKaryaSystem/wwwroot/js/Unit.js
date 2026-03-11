$(document).ready(function () { UnitPage.init(); });

const UnitPage = {
    currentId: null,
    allUnits: [],

    init() {
        this.loadList();
        this.initButtons();
    },

    initButtons() {
        $('#buttonAdd').off('click').on('click', () => this.loadForm(0));
        $('#unitSearch').on('input', () => this.renderTable());
    },

    async loadList() {
        try {
            const res = await Common.Api.get('/Unit/GetList');
            this.allUnits = Array.isArray(res) ? res : (res && res.result) ? res.result : [];
            this.renderTable();
        } catch (e) {
            toastr.error(e.message || 'Failed load units');
        }
    },

    renderTable() {
        const q = ($('#unitSearch').val() || '').toLowerCase();
        let list = this.allUnits;
        if (q) list = list.filter(c => (c.name || c.Name || c.unitName || c.UnitName || '').toLowerCase().includes(q));

        const $tbody = $('#tableUnit tbody').empty();
        if (!list.length) {
            $tbody.html('<tr><td colspan="2" class="text-center text-muted py-3">No units found</td></tr>');
            return;
        }
        list.forEach(c => {
            const id = c.id || c.ID;
            const name = c.name || c.Name || c.unitName || c.UnitName || '';
            const isActive = id === UnitPage.currentId;
            $tbody.append(
                `<tr class="${isActive ? 'table-active' : ''}" style="cursor:pointer" data-id="${id}">
                    <td>${name}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary btn-edit" data-id="${id}"><i class="fa fa-pen"></i></button>
                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${id}"><i class="fa fa-trash"></i></button>
                    </td>
                </tr>`
            );
        });

        $tbody.off('click', '.btn-edit').on('click', '.btn-edit', function (e) {
            e.stopPropagation();
            UnitPage.loadForm($(this).data('id'));
        });
        $tbody.off('click', '.btn-delete').on('click', '.btn-delete', function (e) {
            e.stopPropagation();
            UnitPage.deleteItem($(this).data('id'));
        });
        $tbody.off('click', 'tr').on('click', 'tr', function () {
            const id = $(this).data('id');
            if (id) UnitPage.loadForm(id);
        });
    },

    async loadForm(id) {
        this.currentId = id;
        this.renderTable();

        try {
            const html = await Common.Api.post('/Unit/FillForm', { id: id });
            const formHtml = typeof html === 'string' ? html : '<div class="text-danger">Unexpected response</div>';
            $('#unitFormPanel').html(`
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <span class="fw-bold"><i class="fa fa-ruler me-2 text-primary"></i>${id ? 'Edit Unit' : 'New Unit'}</span>
                        <button class="btn btn-sm btn-outline-secondary" id="btnCancelEdit"><i class="fa fa-times"></i></button>
                    </div>
                    <div class="card-body">${formHtml}</div>
                    <div class="card-footer text-end">
                        <button class="btn btn-primary" id="buttonSave">
                            <span class="spinner-border spinner-border-sm d-none"></span>
                            <i class="fa fa-save me-1"></i>Save
                        </button>
                    </div>
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
            const form = $('#unitForm')[0];
            if (form && !form.checkValidity()) { form.classList.add('was-validated'); return; }
            UnitPage.save();
        });
        $('#btnCancelEdit').off('click').on('click', () => this.resetPanel());
    },

    async save() {
        const formData = $('#unitForm').serializeArray().reduce((acc, cur) => { acc[cur.name] = cur.value; return acc; }, {});
        const $btn = $('#buttonSave');
        $btn.prop('disabled', true).find('.spinner-border').removeClass('d-none');

        try {
            const result = await Common.Api.post('/Unit/Save', formData);
            const ok = result && (result.success || (result.result && result.result.success));
            if (ok) {
                toastr.success('Unit saved');
                await this.loadList();
                this.resetPanel();
            } else {
                toastr.error((result && (result.error || (result.result && result.result.error))) || 'Data not saved');
            }
        } catch (e) {
            toastr.error(e.message || 'Data not saved');
        } finally {
            $btn.prop('disabled', false).find('.spinner-border').addClass('d-none');
        }
    },

    deleteItem(id) {
        if (!id) return;
        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it',
            showLoaderOnConfirm: true,
            preConfirm: () => Common.Api.post('/Unit/Delete', { id })
                .then(() => { toastr.success('Unit deleted'); this.resetPanel(); this.loadList(); })
                .catch(e => Swal.showValidationMessage(e.message || 'Delete failed'))
        });
    },

    resetPanel() {
        this.currentId = null;
        this.renderTable();
        $('#unitFormPanel').html('<div class="empty-state"><i class="fa fa-ruler"></i><p>Select a unit to edit or create a new one</p></div>');
    }
};
