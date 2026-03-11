$(document).ready(function () { ReportPage.init(); });

const ReportPage = {
    init() {
        this.loadSales();
        this.loadPurchases();
        this.loadPayments();
        this.loadProducts();
    },

    fmt(n) {
        return Number(n || 0).toLocaleString('id-ID');
    },

    async loadSales() {
        try {
            const res = await Common.Api.get('/Report/SalesData');
            const list = Array.isArray(res) ? res : (res && res.result && Array.isArray(res.result)) ? res.result : [];
            const total = list.reduce((s, r) => s + Number(r.amount || 0), 0);
            $('#totalSales').text(this.fmt(total));

            const $tbody = $('#tableSalesReport tbody').empty();
            if (!list.length) { $tbody.html('<tr><td colspan="5" class="text-center text-muted py-3">No data</td></tr>'); return; }
            list.slice(0, 20).forEach(r => {
                $tbody.append(`<tr>
                    <td>${r.no || ''}</td>
                    <td>${r.date || ''}</td>
                    <td>${r.customerName || '-'}</td>
                    <td class="text-end">${this.fmt(r.amount)}</td>
                    <td>${r.status || ''}</td>
                </tr>`);
            });
            if (list.length > 20) $tbody.append(`<tr><td colspan="5" class="text-center text-muted">… and ${list.length - 20} more</td></tr>`);
        } catch (e) { $('#totalSales').text('Error'); }
    },

    async loadPurchases() {
        try {
            const res = await Common.Api.get('/Report/PurchaseData');
            const list = Array.isArray(res) ? res : (res && res.result && Array.isArray(res.result)) ? res.result : [];
            const total = list.reduce((s, r) => s + Number(r.amount || 0), 0);
            $('#totalPurchases').text(this.fmt(total));

            const $tbody = $('#tablePurchaseReport tbody').empty();
            if (!list.length) { $tbody.html('<tr><td colspan="5" class="text-center text-muted py-3">No data</td></tr>'); return; }
            list.slice(0, 20).forEach(r => {
                $tbody.append(`<tr>
                    <td>${r.no || ''}</td>
                    <td>${r.date || ''}</td>
                    <td>${r.supplierName || '-'}</td>
                    <td class="text-end">${this.fmt(r.amount)}</td>
                    <td>${r.status || ''}</td>
                </tr>`);
            });
            if (list.length > 20) $tbody.append(`<tr><td colspan="5" class="text-center text-muted">… and ${list.length - 20} more</td></tr>`);
        } catch (e) { $('#totalPurchases').text('Error'); }
    },

    async loadPayments() {
        try {
            const piRes = await Common.Api.get('/Report/PaymentInData');
            const piList = Array.isArray(piRes) ? piRes : [];
            const piTotal = piList.reduce((s, r) => s + Number(r.amount || 0), 0);
            $('#totalPaymentIn').text(this.fmt(piTotal));
        } catch (e) { $('#totalPaymentIn').text('Error'); }

        try {
            const poRes = await Common.Api.get('/Report/PaymentOutData');
            const poList = Array.isArray(poRes) ? poRes : [];
            const poTotal = poList.reduce((s, r) => s + Number(r.amount || 0), 0);
            $('#totalPaymentOut').text(this.fmt(poTotal));
        } catch (e) { $('#totalPaymentOut').text('Error'); }
    },

    async loadProducts() {
        try {
            const res = await Common.Api.get('/Report/ProductData');
            const list = Array.isArray(res) ? res : (res && res.result && Array.isArray(res.result)) ? res.result : [];
            const low = list.filter(p => {
                const stock = Number(p.stockQuantity || p.StockQuantity || 0);
                const min = Number(p.minimumStock || p.MinimumStock || 0);
                return min > 0 && stock <= min;
            });

            const $tbody = $('#tableLowStock tbody').empty();
            if (!low.length) { $tbody.html('<tr><td colspan="3" class="text-center text-muted py-3">No low stock products</td></tr>'); return; }
            low.forEach(p => {
                const name = p.name || p.Name || p.productName || p.ProductName || '';
                const stock = Number(p.stockQuantity || p.StockQuantity || 0);
                const min = Number(p.minimumStock || p.MinimumStock || 0);
                $tbody.append(`<tr>
                    <td>${name}</td>
                    <td class="text-end"><span class="text-danger fw-bold">${stock}</span></td>
                    <td class="text-end">${min}</td>
                </tr>`);
            });
        } catch (e) { /* ignore */ }
    }
};
