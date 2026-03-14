$(document).ready(function () { CustomerDepositPage.init(); });

const CustomerDepositPage = {
    init() {
        this.loadList();
        this.loadSuppliers();
        this.initButtons();
    },

    initButtons() {
        $('#btnSaveAdjust').off('click').on('click', () => this.saveAdjust());
    },

    async loadSuppliers() {
        try {
            const list = await Common.Api.get('/CustomerDeposit/GetSupplierList');
            const suppliers = Array.isArray(list) ? list : (list && list.result) ? list.result : [];
            const $sel = $('#adjustSupplier');
            $sel.find('option:not(:first)').remove();
            suppliers.forEach(s => {
                const id = s.id || s.ID;
                const name = s.supplierName || s.SupplierName || s.name || s.Name || '';
                $sel.append($('<option>').val(id).text(name));
            });
        } catch (e) { /* ignore */ }
    },

    async loadList() {
        try {
            const res = await Common.Api.get('/CustomerDeposit/GetList');
            const list = Array.isArray(res) ? res : [];
            const $tbody = $('#tableDeposit tbody').empty();
            if (!list.length) {
                $tbody.html('<tr><td colspan="6" class="text-center text-muted py-3">No deposit records</td></tr>');
                return;
            }
            list.forEach(r => {
                $tbody.append(
                    `<tr>
                        <td><i class="fa fa-truck me-1 text-muted"></i>${r.supplierName || '-'}</td>
                        <td class="text-end fw-bold ${r.amount > 0 ? 'text-success' : ''}">${Number(r.amount || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}</td>
                        <td>${r.createdBy || '-'}</td>
                        <td>${r.createdAt ? Common.Format.Date(r.createdAt) : '-'}</td>
                        <td>${r.updatedBy || '-'}</td>
                        <td>${r.updatedAt ? Common.Format.Date(r.updatedAt) : '-'}</td>
                    </tr>`
                );
            });
        } catch (e) {
            toastr.error(e.message || 'Failed load deposits');
        }
    },

    async saveAdjust() {
        const form = $('#adjustForm')[0];
        if (form && !form.checkValidity()) { form.classList.add('was-validated'); return; }

        const supplierId = $('#adjustSupplier').val();
        const amount = $('#adjustAmount').val();
        if (!supplierId) { toastr.warning('Select a supplier'); return; }

        const $btn = $('#btnSaveAdjust');
        $btn.prop('disabled', true).find('.spinner-border').removeClass('d-none');

        try {
            const res = await Common.Api.post('/CustomerDeposit/Adjust', { supplierId, amount });
            if (res && res.success) {
                toastr.success('Balance updated');
                bootstrap.Modal.getInstance(document.getElementById('adjustModal'))?.hide();
                form.reset();
                form.classList.remove('was-validated');
                await this.loadList();
            } else {
                toastr.error((res && res.result) || 'Failed');
            }
        } catch (e) {
            toastr.error(e.message || 'Error');
        } finally {
            $btn.prop('disabled', false).find('.spinner-border').addClass('d-none');
        }
    }
};
