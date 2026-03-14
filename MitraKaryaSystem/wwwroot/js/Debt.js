$(document).ready(function () { DebtPage.init(); });

const DebtPage = {
    _receivables: [],
    _payables: [],

    init() {
        this.loadReceivables();
        this.loadPayables();
        // Refresh lists after a payment is recorded
        $(document).on('so:payment:updated', () => { this.loadReceivables(); this.loadPayables(); });
    },

    fmt(n) {
        return Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 });
    },

    async loadReceivables() {
        try {
            const res = await Common.Api.get('/Debt/Receivables');
            const list = Array.isArray(res) ? res : [];
            this._receivables = list;
            const total = list.reduce((s, r) => s + Number(r.outstanding || 0), 0);
            $('#totalReceivables').text('Rp ' + this.fmt(total));

            const $tbody = $('#tableReceivables tbody').empty();
            if (!list.length) {
                $tbody.html('<tr><td colspan="7" class="text-center text-muted py-3">No outstanding receivables</td></tr>');
                return;
            }
            list.forEach(r => {
                const pct = r.amount > 0 ? Math.round((r.paidAmount / r.amount) * 100) : 0;
                $tbody.append(
                    `<tr>
                        <td>${r.no || ''}</td>
                        <td>${Common.Format.Date(r.date)}</td>
                        <td>${r.customerName || '-'}</td>
                        <td class="text-end">${this.fmt(r.amount)}</td>
                        <td class="text-end">
                            ${this.fmt(r.paidAmount)}
                            <div class="progress mt-1" style="height:4px"><div class="progress-bar bg-success" style="width:${pct}%"></div></div>
                        </td>
                        <td class="text-end fw-bold text-danger">${this.fmt(r.outstanding)}</td>
                        <td class="text-center">
                            ${Common.hasPermission('Payment In') ? `<button class="btn btn-sm btn-outline-success" onclick="DebtPage.payReceivable(${r.tradeID})">
                                <i class="fa fa-hand-holding-dollar"></i> Pay
                            </button>` : ''}
                        </td>
                    </tr>`
                );
            });
        } catch (e) {
            $('#totalReceivables').text('Error');
            toastr.error(e.message || 'Failed load receivables');
        }
    },

    async loadPayables() {
        try {
            const res = await Common.Api.get('/Debt/Payables');
            const list = Array.isArray(res) ? res : [];
            this._payables = list;
            const total = list.reduce((s, r) => s + Number(r.outstanding || 0), 0);
            $('#totalPayables').text('Rp ' + this.fmt(total));

            const $tbody = $('#tablePayables tbody').empty();
            if (!list.length) {
                $tbody.html('<tr><td colspan="7" class="text-center text-muted py-3">No outstanding payables</td></tr>');
                return;
            }
            list.forEach(r => {
                const pct = r.amount > 0 ? Math.round((r.paidAmount / r.amount) * 100) : 0;
                $tbody.append(
                    `<tr>
                        <td>${r.no || ''}</td>
                        <td>${Common.Format.Date(r.date)}</td>
                        <td>${r.customerName || '-'}</td>
                        <td class="text-end">${this.fmt(r.amount)}</td>
                        <td class="text-end">
                            ${this.fmt(r.paidAmount)}
                            <div class="progress mt-1" style="height:4px"><div class="progress-bar bg-info" style="width:${pct}%"></div></div>
                        </td>
                        <td class="text-end fw-bold text-danger">${this.fmt(r.outstanding)}</td>
                        <td class="text-center">
                            ${Common.hasPermission('Payment Out') ? `<button class="btn btn-sm btn-outline-primary" onclick="DebtPage.payPayable(${r.tradeID})">
                                <i class="fa fa-money-bill-wave"></i> Pay
                            </button>` : ''}
                        </td>
                    </tr>`
                );
            });
        } catch (e) {
            $('#totalPayables').text('Error');
            toastr.error(e.message || 'Failed load payables');
        }
    },

    payReceivable(tradeId) {
        const r = this._receivables.find(x => x.tradeID === tradeId);
        if (!r) return;
        PaymentIn.openFromSO({
            id: r.tradeID,
            amount: r.amount,
            paidAmount: r.paidAmount,
            customerName: r.customerName,
            customerID: r.customerID
        });
    },

    payPayable(tradeId) {
        const r = this._payables.find(x => x.tradeID === tradeId);
        if (!r) return;
        showPaymentOutModal(r.customerID, r.customerName, null, r.tradeID);
    }
};
