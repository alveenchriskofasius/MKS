$(document).ready(function () { ProfitLossPage.init(); });

const ProfitLossPage = {
    fmt(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); },

    init() {
        const now = new Date();
        $('#plFrom').val(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
        $('#plTo').val(now.toISOString().slice(0, 10));
        $('#btnGenerate').on('click', () => this.load());
        this.load();
    },

    async load() {
        const from = $('#plFrom').val();
        const to = $('#plTo').val();
        const params = new URLSearchParams();
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        try {
            const r = await Common.Api.get('/ProfitLoss/GetReport?' + params.toString());
            this.render(r);
        } catch (e) {
            toastr.error('Failed to load report');
        }
    },

    render(r) {
        $('#plRevenue').text(this.fmt(r.revenue));
        $('#plCost').text(this.fmt(r.cogs + r.expenses));

        const isProfit = r.netProfit >= 0;
        $('#plNet').text(this.fmt(r.netProfit)).css('color', isProfit ? '#16a34a' : '#dc2626');
        $('#plNetIcon').css('background', isProfit ? '#16a34a' : '#dc2626');

        const $body = $('#plBody').empty();

        // Revenue section
        $body.append(`<tr class="table-success"><td class="fw-bold">Revenue</td><td class="text-end fw-bold">${this.fmt(r.revenue)}</td></tr>`);
        (r.revenueLines || []).forEach(l => {
            $body.append(`<tr><td class="ps-4">${l.category}</td><td class="text-end">${this.fmt(l.amount)}</td></tr>`);
        });

        // COGS
        $body.append(`<tr class="table-warning"><td class="fw-bold">Cost of Goods Sold (COGS)</td><td class="text-end fw-bold text-danger">(${this.fmt(r.cogs)})</td></tr>`);

        // Gross Profit
        $body.append(`<tr class="table-light"><td class="fw-bold">Gross Profit</td><td class="text-end fw-bold">${this.fmt(r.grossProfit)}</td></tr>`);

        // Expenses
        $body.append(`<tr class="table-danger"><td class="fw-bold">Operating Expenses</td><td class="text-end fw-bold text-danger">(${this.fmt(r.expenses)})</td></tr>`);
        (r.expenseLines || []).forEach(l => {
            $body.append(`<tr><td class="ps-4">${l.category}</td><td class="text-end">${this.fmt(l.amount)}</td></tr>`);
        });

        // Net Profit
        const netClass = r.netProfit >= 0 ? 'text-success' : 'text-danger';
        $body.append(`<tr class="table-primary"><td class="fw-bold fs-5">Net Profit</td><td class="text-end fw-bold fs-5 ${netClass}">${this.fmt(r.netProfit)}</td></tr>`);
    }
};
