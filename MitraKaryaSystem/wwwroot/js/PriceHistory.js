$(document).ready(function () { PriceHistoryPage.init(); });

const PriceHistoryPage = {
    fmt(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); },
    dtPriceList: null,
    dtHistory: null,

    init() {
        this.loadPriceList();
        this.loadProductDropdown();
        $('#btnHistFilter').on('click', () => this.loadHistory());
        $('a[data-bs-toggle="tab"]').on('shown.bs.tab', e => {
            if (e.target.getAttribute('href') === '#tabHistory' && !this.dtHistory) this.loadHistory();
        });
    },

    async loadProductDropdown() {
        try {
            const list = await Common.Api.get('/PriceHistory/GetPriceList');
            const $sel = $('#histProduct');
            (Array.isArray(list) ? list : []).forEach(p => {
                $sel.append(`<option value="${p.productId}">${p.productName}</option>`);
            });
        } catch (_) { /* ignore */ }
    },

    async loadPriceList() {
        try {
            const list = await Common.Api.get('/PriceHistory/GetPriceList');
            const arr = Array.isArray(list) ? list : [];
            if (this.dtPriceList) { this.dtPriceList.clear().destroy(); }
            this.dtPriceList = $('#tablePriceList').DataTable({
                data: arr,
                deferRender: true, destroy: true, searching: true,
                order: [[0, 'asc']],
                columns: [
                    { data: 'productName' },
                    { data: 'category' },
                    { data: 'supplier' },
                    { data: 'currentPrice', className: 'text-end', render: d => this.fmt(d) },
                    { data: null, className: 'text-center', render: (_, __, row) => row.hasDiscount ? `<span class="badge text-bg-success">-${row.discountPct}%</span>` : '-' },
                    { data: 'effectivePrice', className: 'text-end', render: d => `<span class="fw-semibold">${this.fmt(d)}</span>` },
                    { data: 'stock', className: 'text-end', render: d => d <= 0 ? `<span class="text-danger fw-bold">${d}</span>` : d },
                    { data: 'lastChanged', render: d => d ? Common.Format.Datetime(d) : '-' }
                ]
            });
        } catch (e) { toastr.error('Failed to load price list'); }
    },

    async loadHistory() {
        const productId = $('#histProduct').val();
        const from = $('#histFrom').val();
        const to = $('#histTo').val();
        const params = new URLSearchParams();
        if (productId) params.append('productId', productId);
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        try {
            const list = await Common.Api.get('/PriceHistory/GetHistory?' + params.toString());
            const arr = Array.isArray(list) ? list : [];
            if (this.dtHistory) { this.dtHistory.clear().destroy(); }
            this.dtHistory = $('#tableHistory').DataTable({
                data: arr,
                deferRender: true, destroy: true, searching: true,
                order: [[0, 'desc']],
                columns: [
                    { data: 'changedAt', render: d => Common.Format.Datetime(d) },
                    { data: 'productName' },
                    { data: 'oldPrice', className: 'text-end', render: d => this.fmt(d) },
                    { data: 'newPrice', className: 'text-end', render: d => this.fmt(d) },
                    { data: null, className: 'text-center', render: (_, __, row) => {
                        const diff = row.newPrice - row.oldPrice;
                        if (diff === 0) return '-';
                        const cls = diff > 0 ? 'text-danger' : 'text-success';
                        const icon = diff > 0 ? 'fa-arrow-up' : 'fa-arrow-down';
                        return `<span class="${cls}"><i class="fa ${icon} me-1"></i>${this.fmt(Math.abs(diff))}</span>`;
                    }},
                    { data: 'source', render: d => d ? `<span class="badge text-bg-secondary">${d}</span>` : '-' },
                    { data: 'changedBy' },
                    { data: 'note', render: d => d || '-' }
                ]
            });
        } catch (e) { toastr.error('Failed to load history'); }
    }
};
