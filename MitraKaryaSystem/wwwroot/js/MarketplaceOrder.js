$(document).ready(function () {
    MOPage.init();
});

const moStatusMap = {
    1: { text: 'Draft', cls: 'bg-secondary' },
    2: { text: 'Paid', cls: 'bg-success' },
    3: { text: 'Debt', cls: 'bg-warning text-dark' },
    8: { text: 'Completed', cls: 'bg-primary' },
    9: { text: 'Cancelled', cls: 'bg-danger' }
};

const payMethodMap = { qris: 'QRIS', virtual_account: 'Virtual Account', bank_transfer: 'Transfer Bank' };
const delMethodMap = { pickup: 'Pick Up', delivery: 'Delivery' };

const MOPage = {
    dt: null,
    allData: [],

    init() {
        this.loadGrid();
        this.bindEvents();
    },

    bindEvents() {
        $('#btnRefresh').on('click', () => this.loadGrid());
        $('#moStatusFilter').on('change', () => this.applyFilter());
        $('#btnCloseDetail').on('click', () => $('#moDetailPanel').slideUp());
    },

    loadGrid() {
        const self = this;
        $.get('/MarketplaceOrder/FillGrid', function (data) {
            self.allData = Array.isArray(data) ? data : (data && data.result ? data.result : []);
            self.renderTable(self.allData);
        }).fail(() => toastr.error('Failed to load marketplace orders'));
    },

    applyFilter() {
        const statusVal = $('#moStatusFilter').val();
        let filtered = this.allData;
        if (statusVal) {
            const s = parseInt(statusVal);
            filtered = this.allData.filter(d => (d.statusID || d.StatusID) === s);
        }
        this.renderTable(filtered);
    },

    renderTable(data) {
        const $table = $('#tableMO');
        if (this.dt) {
            this.dt.clear().destroy();
        }

        this.dt = $table.DataTable({
            deferRender: true,
            processing: false,
            serverSide: false,
            destroy: true,
            searching: true,
            responsive: true,
            order: [[0, 'desc']],
            data: data,
            columns: [
                { data: 'no' },
                { data: 'date', render: d => Common.Format.Date(d) },
                {
                    data: 'amount',
                    className: 'text-end',
                    render: d => Number(d || 0).toLocaleString('id-ID', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                    })
                },
                {
                    data: 'statusID',
                    render: d => {
                        const s = moStatusMap[d] || { text: d, cls: 'bg-secondary' };
                        return `<span class="badge ${s.cls}">${s.text}</span>`;
                    }
                },
                {
                    data: 'paymentMethod',
                    render: d => payMethodMap[d] || d || '-'
                },
                {
                    data: 'deliveryMethod',
                    render: d => {
                        if (d === 'delivery') return '<span class="badge bg-info text-dark"><i class="fa fa-truck"></i> Delivery</span>';
                        if (d === 'pickup') return '<span class="badge bg-light text-dark border"><i class="fa fa-store"></i> Pick Up</span>';
                        return d || '-';
                    }
                },
                { data: 'customerName' },
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: (_d, _t, row) => {
                        const sid = row.statusID || row.StatusID;
                        const dm = (row.deliveryMethod || '').toLowerCase();
                        let btns = `<button class="btn btn-sm btn-outline-primary mo-view" title="View Detail">
                            <i class="fa fa-eye"></i>
                        </button>`;
                        if (sid === 1) {
                            btns += ` <button class="btn btn-sm btn-outline-success mo-pay" title="Mark as Paid">
                                <i class="fa fa-check"></i>
                            </button>`;
                            btns += ` <button class="btn btn-sm btn-outline-danger mo-cancel" title="Cancel Order">
                                <i class="fa fa-times"></i>
                            </button>`;
                        }
                        if (sid === 2 && dm === 'pickup') {
                            btns += ` <button class="btn btn-sm btn-outline-info mo-pickup" title="Tandai Sudah Diambil">
                                <i class="fa fa-box"></i> Picked Up
                            </button>`;
                        }
                        return `<div class="btn-group btn-group-sm flex-wrap">${btns}</div>`;
                    }
                }
            ]
        });

        $table.find('tbody').off('click');

        $table.find('tbody').on('click', '.mo-view', function () {
            const row = MOPage.dt.row($(this).closest('tr')).data();
            if (row) MOPage.showDetail(row.id || row.ID);
        });

        $table.find('tbody').on('click', '.mo-pay', function () {
            const row = MOPage.dt.row($(this).closest('tr')).data();
            if (row) MOPage.confirmPay(row.id || row.ID, row.no);
        });

        $table.find('tbody').on('click', '.mo-cancel', function () {
            const row = MOPage.dt.row($(this).closest('tr')).data();
            if (row) MOPage.confirmCancel(row.id || row.ID, row.no);
        });

        $table.find('tbody').on('click', '.mo-pickup', function () {
            const row = MOPage.dt.row($(this).closest('tr')).data();
            if (row) MOPage.confirmPickup(row.id || row.ID, row.no);
        });
    },

    showDetail(id) {
        const $panel = $('#moDetailPanel');
        const $body = $('#moDetailBody');
        $body.html('<div class="text-center p-4"><div class="spinner-border"></div></div>');
        $panel.slideDown();
        $('html, body').animate({ scrollTop: $panel.offset().top - 80 }, 300);

        $.get('/MarketplaceOrder/GetDetail', { id: id }, function (items) {
            const list = Array.isArray(items) ? items : (items && items.result ? items.result : []);
            if (!list.length) {
                $body.html('<div class="text-center text-muted py-4">No items found</div>');
                return;
            }

            let total = 0;
            const rows = list.map(item => {
                const sub = (item.unitPrice || item.UnitPrice || 0) * (item.quantity || item.Quantity || 0);
                total += sub;
                const varName = item.variantName || item.VariantName || '';
                const varBadge = varName
                    ? `<span class="badge bg-info text-dark ms-1">${varName}</span>`
                    : '';
                return `<tr>
                    <td>${item.product || item.Product || item.productName || item.ProductName || '-'}${varBadge}</td>
                    <td class="text-center">${item.quantity || item.Quantity || 0}</td>
                    <td class="text-end">${Number(item.unitPrice || item.UnitPrice || 0).toLocaleString('id-ID')}</td>
                    <td class="text-end">${Number(sub).toLocaleString('id-ID')}</td>
                </tr>`;
            }).join('');

            $body.html(`
                <table class="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th class="text-center">Qty</th>
                            <th class="text-end">Price</th>
                            <th class="text-end">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr>
                            <th colspan="3" class="text-end">Total</th>
                            <th class="text-end fs-5 text-primary">${Number(total).toLocaleString('id-ID')}</th>
                        </tr>
                    </tfoot>
                </table>
            `);
        }).fail(() => {
            $body.html('<div class="text-center text-danger py-4">Failed to load order detail</div>');
        });
    },

    confirmPay(id, no) {
        Swal.fire({
            title: 'Konfirmasi Pembayaran',
            html: `<p>Tandai order <strong>${no}</strong> sebagai <b>sudah dibayar</b>?</p>
                   <p class="text-muted small">Stok akan dikurangi sesuai item order.</p>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '<i class="fa fa-check"></i> Ya, Bayar',
            cancelButtonText: 'Batal',
            showLoaderOnConfirm: true,
            preConfirm: () => {
                return $.post('/MarketplaceOrder/MarkPaid', { id: id })
                    .then(res => {
                        if (res && res.success) return res;
                        throw new Error((res && res.message) || 'Gagal');
                    })
                    .catch(err => {
                        Swal.showValidationMessage(err.message || 'Request failed');
                    });
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then(result => {
            if (result.isConfirmed) {
                toastr.success('Order berhasil dibayar');
                MOPage.loadGrid();
            }
        });
    },

    confirmCancel(id, no) {
        Swal.fire({
            title: 'Batalkan Order?',
            html: `<p>Batalkan order <strong>${no}</strong>?</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '<i class="fa fa-times"></i> Ya, Batalkan',
            cancelButtonText: 'Tidak',
            showLoaderOnConfirm: true,
            preConfirm: () => {
                return $.post('/MarketplaceOrder/Cancel', { id: id })
                    .then(res => {
                        if (res && res.success) return res;
                        throw new Error((res && res.message) || 'Gagal');
                    })
                    .catch(err => {
                        Swal.showValidationMessage(err.message || 'Request failed');
                    });
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then(result => {
            if (result.isConfirmed) {
                toastr.success('Order berhasil dibatalkan');
                MOPage.loadGrid();
            }
        });
    },

    confirmPickup(id, no) {
        Swal.fire({
            title: 'Konfirmasi Pick Up',
            html: `<p>Tandai order <strong>${no}</strong> sebagai <b>sudah diambil</b>?</p>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '<i class="fa fa-box"></i> Ya, Sudah Diambil',
            cancelButtonText: 'Batal',
            showLoaderOnConfirm: true,
            preConfirm: () => {
                return $.post('/MarketplaceOrder/MarkPickedUp', { id: id })
                    .then(res => {
                        if (res && res.success) return res;
                        throw new Error((res && res.message) || 'Gagal');
                    })
                    .catch(err => {
                        Swal.showValidationMessage(err.message || 'Request failed');
                    });
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then(result => {
            if (result.isConfirmed) {
                toastr.success('Order ditandai sudah diambil');
                MOPage.loadGrid();
            }
        });
    }
};
