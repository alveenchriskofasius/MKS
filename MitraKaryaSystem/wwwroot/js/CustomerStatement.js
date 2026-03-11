$(document).ready(function () { CustomerStatementPage.init(); });

const CustomerStatementPage = {
    fmt(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); },
    dt: null,

    init() {
        this.loadCustomers();
        $('#btnCsGenerate').on('click', () => this.load());
    },

    async loadCustomers() {
        try {
            const list = await Common.Api.get('/CustomerStatement/GetCustomers');
            const arr = Array.isArray(list) ? list : (list && list.result ? list.result : []);
            const $sel = $('#csCustomer').empty().append('<option value="">— Select Customer —</option>');
            arr.forEach(c => $sel.append(`<option value="${c.id || c.ID}">${c.name || c.Name}</option>`));
        } catch (_) { /* ignore */ }
    },

    async load() {
        const customerId = $('#csCustomer').val();
        if (!customerId) { toastr.info('Please select a customer'); return; }
        const from = $('#csFrom').val();
        const to = $('#csTo').val();
        const params = new URLSearchParams({ customerId });
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        try {
            const r = await Common.Api.get('/CustomerStatement/GetStatement?' + params.toString());
            this.render(r);
        } catch (e) {
            toastr.error('Failed to load statement');
        }
    },

    render(r) {
        $('#csSummaryRow').removeClass('d-none');
        $('#csTotalInvoiced').text(this.fmt(r.totalInvoiced));
        $('#csTotalPaid').text(this.fmt(r.totalPaid));
        $('#csTotalDeposit').text(this.fmt(r.totalDeposit));
        $('#csOutstanding').text(this.fmt(r.outstandingBalance));

        const lines = r.lines || [];
        if (this.dt) { this.dt.clear().destroy(); }
        this.dt = $('#tableStatement').DataTable({
            data: lines,
            deferRender: true, destroy: true, searching: false, paging: false, info: false,
            order: [[0, 'asc']],
            columns: [
                { data: 'date', render: d => Common.Format.Datetime(d) },
                { data: 'no', render: d => `<span class="fw-semibold text-primary">${d}</span>` },
                { data: 'type', render: d => {
                    const cls = d === 'Invoice' ? 'text-bg-primary' : d === 'Payment' ? 'text-bg-success' : 'text-bg-info';
                    return `<span class="badge ${cls}">${d}</span>`;
                }},
                { data: 'description' },
                { data: 'debit', className: 'text-end', render: d => d > 0 ? this.fmt(d) : '-' },
                { data: 'credit', className: 'text-end', render: d => d > 0 ? `<span class="text-success">${this.fmt(d)}</span>` : '-' },
                { data: 'balance', className: 'text-end fw-semibold', render: d => {
                    const cls = d > 0 ? 'text-danger' : d < 0 ? 'text-success' : '';
                    return `<span class="${cls}">${this.fmt(d)}</span>`;
                }}
            ]
        });
    }
};
