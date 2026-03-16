$(document).ready(function () { CustomerAgingPage.init(); });

const CustomerAgingPage = {
    fmt(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); },
    dt: null,

    init() {
        // default to today
        $('#agingDate').val(new Date().toISOString().slice(0, 10));
        $('#btnAgingGenerate').on('click', () => this.load());
    },

    async load() {
        const asOf = $('#agingDate').val();
        const params = new URLSearchParams();
        if (asOf) params.append('asOfDate', asOf);
        try {
            const r = await Common.Api.get('/CustomerAging/GetAging?' + params.toString());
            this.render(r);
        } catch (e) {
            toastr.error('Failed to load aging report');
        }
    },

    render(r) {
        // Summary cards
        $('#agingSummaryRow').removeClass('d-none');
        $('#agTotal').text(this.fmt(r.totalOutstanding));
        $('#agCurrent').text(this.fmt(r.totalCurrent));
        $('#ag3160').text(this.fmt(r.total31_60));
        $('#ag6190').text(this.fmt(r.total61_90));
        $('#agOver90').text(this.fmt(r.totalOver90));

        const rows = r.rows || [];
        if (this.dt) { this.dt.clear().destroy(); }
        this.dt = $('#tableAging').DataTable({
            data: rows,
            deferRender: true, destroy: true, paging: true, pageLength: 25, info: true,
            order: [[5, 'desc']],
            columns: [
                { data: 'customerName', render: d => `<span class="fw-semibold">${d}</span>` },
                { data: 'current', className: 'text-end', render: d => d > 0 ? `<span class="text-success">${this.fmt(d)}</span>` : '-' },
                { data: 'days31_60', className: 'text-end', render: d => d > 0 ? `<span class="text-info">${this.fmt(d)}</span>` : '-' },
                { data: 'days61_90', className: 'text-end', render: d => d > 0 ? `<span class="text-warning">${this.fmt(d)}</span>` : '-' },
                { data: 'over90', className: 'text-end', render: d => d > 0 ? `<span class="text-danger">${this.fmt(d)}</span>` : '-' },
                { data: 'total', className: 'text-end fw-semibold', render: d => this.fmt(d) },
                { data: 'invoiceCount', className: 'text-center', render: d => `<span class="badge text-bg-secondary">${d}</span>` },
                { data: 'oldestInvoiceDate', render: d => Common.Format.Datetime(d) }
            ]
        });
    }
};
