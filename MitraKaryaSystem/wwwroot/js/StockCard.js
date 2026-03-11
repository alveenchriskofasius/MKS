$(document).ready(function () { StockCard.init(); });

const StockCard = {
    dt: null,

    async init() {
        await this.loadProducts();
        this.bindEvents();
        // If select2 is available, enhance the dropdown
        if ($.fn.select2) $('#selProduct').select2({ width: '100%', placeholder: '-- Select Product --', allowClear: true });
    },

    bindEvents() {
        $('#btnLoad').on('click', () => this.load());
        $('#selProduct').on('change', () => this.load());
    },

    async loadProducts() {
        try {
            const list = await Common.Api.get('/Stock/ProductList');
            const $sel = $('#selProduct');
            $sel.find('option:not(:first)').remove();
            (Array.isArray(list) ? list : []).forEach(p => {
                $sel.append(`<option value="${p.id}">${p.name} (Stock: ${p.stock})</option>`);
            });
        } catch (_) { toastr.error('Failed to load products'); }
    },

    async load() {
        const productId = $('#selProduct').val();
        if (!productId) { toastr.warning('Please select a product'); return; }

        const from = $('#dateFrom').val();
        const to = $('#dateTo').val();

        // Load summary
        try {
            const s = await Common.Api.get(`/Stock/Summary?productId=${productId}`);
            if (s && s.success) {
                $('#summaryRow').show();
                $('#sumStock').text(s.currentStock);
                $('#sumIn').text('+' + s.totalIn);
                $('#sumOut').text('-' + s.totalOut);
                $('#sumThreshold').text(s.threshold);
            }
        } catch (_) { }

        // Load ledger
        try {
            let url = `/Stock/Card?productId=${productId}`;
            if (from) url += `&from=${from}`;
            if (to) url += `&to=${to}`;
            const rows = await Common.Api.get(url);
            const arr = Array.isArray(rows) ? rows : [];
            if (this.dt) { this.dt.clear().destroy(); }
            this.dt = $('#tblCard').DataTable({
                data: arr,
                deferRender: true,
                destroy: true,
                searching: true,
                pageLength: 50,
                order: [[0, 'desc']],
                columns: [
                    { data: 'date', render: d => Common.Format.Datetime(d) },
                    {
                        data: 'refType', render: d => {
                            const colorMap = {
                                'Sales Order': 'text-bg-primary', 'Purchase Order': 'text-bg-success',
                                'Stock In': 'text-bg-info', 'Stock Count': 'text-bg-warning',
                                'Sales Return': 'text-bg-secondary', 'Purchase Return': 'text-bg-dark',
                                'Consignment': 'text-bg-purple', 'POS': 'text-bg-primary'
                            };
                            const cls = colorMap[d] || 'text-bg-secondary';
                            return `<span class="badge ${cls}">${d || '-'}</span>`;
                        }
                    },
                    { data: 'refNo', render: d => d || '-' },
                    {
                        data: 'qtyChange', className: 'text-end fw-semibold text-success',
                        render: d => d > 0 ? `+${d}` : ''
                    },
                    {
                        data: 'qtyChange', className: 'text-end fw-semibold text-danger',
                        render: d => d < 0 ? `${d}` : ''
                    },
                    { data: 'qtyAfter', className: 'text-end fw-bold' },
                    { data: 'note', render: d => `<span class="text-muted small">${d || '-'}</span>` },
                    { data: 'createdBy', render: d => `<span class="small">${d || '-'}</span>` }
                ]
            });
        } catch (_) { toastr.error('Failed to load stock card'); }
    }
};
