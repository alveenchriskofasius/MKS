$(document).ready(function () { dashboard.init(); });

const dashboard = (function () {
    function setHtml(selector, html) { $(selector).html(html); }

    async function loadSalesToday() {
        $.get('/Home/SalesToday', function (res) {
            if (!res || !res.success) { setHtml('#salesTodayContainer', 'Error load'); return; }
            // Prefer server-calculated total; fall back to client calculation
            if (res.total !== undefined && res.total !== null) {
                setHtml('#salesTodayContainer', `<h3>${Number(res.total).toFixed(2)}</h3><small>Total sales today</small>`);
                return;
            }
            const data = Array.isArray(res.result) ? res.result : (Array.isArray(res) ? res : []);
            const today = new Date().toISOString().slice(0,10);
            const sum = data.reduce((acc, r) => {
                const dateStr = (r.date || r.Date || '').toString().slice(0,10);
                if (dateStr === today) return acc + parseFloat(r.amount || r.Amount ||0);
                return acc;
            },0);
            setHtml('#salesTodayContainer', `<h3>${sum.toFixed(2)}</h3><small>Total sales today</small>`);
        }).fail(function () { setHtml('#salesTodayContainer', 'Error load'); });
    }

    function loadStockAlerts() {
        $.get('/Home/StockAlerts', function (res) {
            if (!res || !res.success) { setHtml('#stockAlertsContainer', 'Error load'); return; }
            const data = Array.isArray(res.result) ? res.result : (Array.isArray(res) ? res : []);
            if (!data.length) { setHtml('#stockAlertsContainer', '<span class="text-muted">No low stock alerts</span>'); return; }
            const items = data.map(p => {
                const name = p.name || p.Name;
                const qty = p.stockQuantity ?? p.StockQuantity ?? 0;
                const thr = p.lowStockThreshold ?? p.LowStockThreshold ?? 5;
                const cls = qty === 0 ? 'text-danger fw-bold' : 'text-warning';
                return `<li class="${cls}">${name} — <strong>${qty}</strong> / ${thr}</li>`;
            }).join('');
            setHtml('#stockAlertsContainer', `<ul class="list-unstyled mb-0">${items}</ul>`);
        }).fail(function () { setHtml('#stockAlertsContainer', 'Error load'); });
    }

    function loadPendingDO() {
        $.get('/Home/PendingDeliveryOrders', function (res) {
            if (!res || !res.success) { setHtml('#pendingDOContainer', 'Error'); return; }
            const rows = res.result || [];
            const items = rows.map(d => `<li>${d.no || d.No} - SO:${d.salesOrderID || d.SalesOrderID}</li>`).join('');
            setHtml('#pendingDOContainer', `<ul class="list-unstyled mb-0">${items}</ul>`);
        }).fail(function () { setHtml('#pendingDOContainer', 'Error'); });
    }

    function loadPendingPO() {
        $.get('/Home/PendingPurchaseOrders', function (res) {
            if (!res || !res.success) { setHtml('#pendingPOContainer', 'Error'); return; }
            const count = res.count || 0;
            if (count === 0) { setHtml('#pendingPOContainer', '<span class="text-muted">No pending approvals</span>'); return; }
            setHtml('#pendingPOContainer', `<h3>${count}</h3><small>Purchase Orders awaiting approval</small>`);
        }).fail(function () { setHtml('#pendingPOContainer', 'Error'); });
    }

    function init() {
        loadSalesToday();
        loadStockAlerts();
        loadPendingPO();
        loadPendingDO();
    }

    return { init };
})();
