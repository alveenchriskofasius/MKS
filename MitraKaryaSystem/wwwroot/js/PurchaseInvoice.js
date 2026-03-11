$(document).ready(function () { PurchaseInvoicePage.init(); });

const PurchaseInvoicePage = {
    init() {
        this.loadSuppliers();
        this.loadList();
        this.initButtons();
    },

    initButtons() {
        $('#btnSearch').off('click').on('click', () => this.loadList());
        $('#btnReset').off('click').on('click', () => {
            $('#filterSupplier').val('');
            $('#filterFrom').val('');
            $('#filterTo').val('');
            $('#filterStatus').val('');
            this.loadList();
        });
    },

    async loadSuppliers() {
        try {
            const list = await Common.Api.get('/Product/GetSupplierList');
            const suppliers = Array.isArray(list) ? list : (list && list.result) ? list.result : [];
            suppliers.forEach(s => {
                const id = s.id || s.ID;
                const name = s.supplierName || s.SupplierName || s.name || s.Name || '';
                $('#filterSupplier').append($('<option>').val(id).text(name));
            });
        } catch (e) { /* ignore */ }
    },

    async loadList() {
        const params = new URLSearchParams();
        const sup = $('#filterSupplier').val(); if (sup) params.append('supplierId', sup);
        const from = $('#filterFrom').val(); if (from) params.append('from', from);
        const to = $('#filterTo').val(); if (to) params.append('to', to);
        const st = $('#filterStatus').val(); if (st) params.append('statusId', st);

        try {
            const list = await Common.Api.get('/PurchaseInvoice/List?' + params.toString());
            const rows = Array.isArray(list) ? list : [];
            const $tbody = $('#tablePurchaseInvoice tbody').empty();
            if (!rows.length) {
                $tbody.html('<tr><td colspan="7" class="text-center text-muted py-3">No invoices found</td></tr>');
                return;
            }
            rows.forEach(r => {
                const statusBadge = this.statusBadge(r.statusID);
                $tbody.append(
                    `<tr>
                        <td>${r.no || ''}</td>
                        <td>${r.date || ''}</td>
                        <td>${r.supplierName || '-'}</td>
                        <td class="text-end">${Number(r.amount || 0).toLocaleString('id-ID')}</td>
                        <td class="text-end">${Number(r.paidAmount || 0).toLocaleString('id-ID')}</td>
                        <td>${statusBadge}</td>
                        <td>
                            ${r.statusID === 1 ? '<button class="btn btn-sm btn-outline-info btn-issue" data-id="' + r.id + '"><i class="fa fa-paper-plane"></i></button>' : ''}
                            ${r.statusID === 1 ? '<button class="btn btn-sm btn-outline-danger btn-cancel" data-id="' + r.id + '"><i class="fa fa-xmark"></i></button>' : ''}
                        </td>
                    </tr>`
                );
            });

            $tbody.off('click', '.btn-issue').on('click', '.btn-issue', async function () {
                const id = $(this).data('id');
                try {
                    const res = await Common.Api.post('/PurchaseInvoice/Issue', { id });
                    if (res && res.success) { toastr.success('Invoice issued'); PurchaseInvoicePage.loadList(); }
                    else toastr.error((res && res.result) || 'Failed');
                } catch (e) { toastr.error(e.message); }
            });

            $tbody.off('click', '.btn-cancel').on('click', '.btn-cancel', async function () {
                const id = $(this).data('id');
                Swal.fire({
                    title: 'Cancel Invoice?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes',
                    preConfirm: () => Common.Api.post('/PurchaseInvoice/Cancel', { id })
                        .then(res => { if (res && res.success) { toastr.success('Canceled'); PurchaseInvoicePage.loadList(); } else toastr.error(res.result || 'Failed'); })
                        .catch(e => Swal.showValidationMessage(e.message))
                });
            });
        } catch (e) {
            toastr.error(e.message || 'Failed load invoices');
        }
    },

    statusBadge(s) {
        const map = {
            1: '<span class="badge bg-secondary">Draft</span>',
            2: '<span class="badge bg-info">Issued</span>',
            3: '<span class="badge bg-warning text-dark">Partially Paid</span>',
            4: '<span class="badge bg-success">Paid</span>',
            9: '<span class="badge bg-danger">Canceled</span>'
        };
        return map[s] || '<span class="badge bg-light text-dark">Unknown</span>';
    }
};
