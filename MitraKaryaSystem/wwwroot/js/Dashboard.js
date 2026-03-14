$(document).ready(function () { dashboard.init(); });

const dashboard = (function () {
    function setHtml(selector, html) { $(selector).html(html); }

    function fmtCurrency(val) {
        return 'Rp ' + Number(val).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    function fmtDate(val) {
        if (!val) return '-';
        const d = new Date(val);
        const day = ('0' + d.getDate()).slice(-2);
        const month = ('0' + (d.getMonth() + 1)).slice(-2);
        return day + '-' + month + '-' + d.getFullYear();
    }

    function emptyState(icon, text) {
        return `<div class="empty-state"><i class="fa-solid ${icon}"></i><p>${text}</p></div>`;
    }

    function loadSalesToday() {
        $.get('/Home/SalesToday', function (res) {
            if (!res || !res.success) {
                setHtml('#kpiSalesTotal', '<span class="text-muted">–</span>');
                setHtml('#salesTodayContainer', emptyState('fa-cash-register', 'Unable to load sales data'));
                return;
            }

            const data = Array.isArray(res.result) ? res.result : [];
            const today = new Date().toISOString().slice(0, 10);

            // Filter today's orders
            const todayOrders = data.filter(r => {
                const dateStr = (r.date || r.Date || '').toString().slice(0, 10);
                return dateStr === today;
            });

            // Total
            const total = res.total !== undefined && res.total !== null
                ? Number(res.total)
                : todayOrders.reduce((acc, r) => acc + parseFloat(r.amount || r.Amount || 0), 0);

            setHtml('#kpiSalesTotal', fmtCurrency(total));

            if (!todayOrders.length) {
                setHtml('#salesTodayContainer', emptyState('fa-receipt', 'No sales orders today'));
                return;
            }

            // Build table
            let rows = todayOrders.slice(0, 10).map(r => {
                const no = r.no || r.No || '-';
                const customer = r.customerName || r.CustomerName || r.customer || '-';
                const amt = parseFloat(r.amount || r.Amount || 0);
                const statusId = r.statusID ?? r.StatusID ?? 0;
                const statusBadge = getSalesStatusBadge(statusId);
                return `<tr>
                    <td class="ps-3"><span class="fw-semibold text-primary">${no}</span></td>
                    <td>${customer}</td>
                    <td class="text-end">${fmtCurrency(amt)}</td>
                    <td class="text-center">${statusBadge}</td>
                </tr>`;
            }).join('');

            const html = `<div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead><tr>
                        <th class="ps-3">Order No</th>
                        <th>Customer</th>
                        <th class="text-end">Amount</th>
                        <th class="text-center">Status</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                    ${todayOrders.length > 10 ? `<tfoot><tr><td colspan="4" class="text-center text-muted small">Showing 10 of ${todayOrders.length} orders</td></tr></tfoot>` : ''}
                </table></div>`;
            setHtml('#salesTodayContainer', html);
        }).fail(function () {
            setHtml('#kpiSalesTotal', '<span class="text-muted">–</span>');
            setHtml('#salesTodayContainer', emptyState('fa-circle-exclamation', 'Failed to load sales data'));
        });
    }

    function getSalesStatusBadge(statusId) {
        const map = {
            1: ['Draft', 'badge-draft'],
            2: ['Submitted', 'badge-submitted'],
            3: ['Approved', 'badge-approved'],
            4: ['Rejected', 'badge-rejected'],
            5: ['Completed', 'badge-completed'],
            6: ['Canceled', 'badge-canceled']
        };
        const [label, cls] = map[statusId] || ['Unknown', 'badge-draft'];
        return `<span class="badge-status ${cls}">${label}</span>`;
    }

    function loadStockAlerts() {
        $.get('/Home/StockAlerts', function (res) {
            if (!res || !res.success) {
                setHtml('#kpiStockAlerts', '<span class="text-muted">–</span>');
                setHtml('#stockAlertsContainer', emptyState('fa-circle-exclamation', 'Unable to load stock data'));
                return;
            }
            const data = Array.isArray(res.result) ? res.result : [];
            setHtml('#kpiStockAlerts', data.length);

            if (!data.length) {
                setHtml('#stockAlertsContainer', emptyState('fa-check-circle', 'All stock levels are healthy'));
                return;
            }

            const items = data.slice(0, 8).map(p => {
                const name = p.name || p.Name;
                const qty = p.stockQuantity ?? p.StockQuantity ?? 0;
                const thr = p.lowStockThreshold ?? p.LowStockThreshold ?? 5;
                const pct = thr > 0 ? Math.min(Math.round((qty / thr) * 100), 100) : 0;
                const barColor = qty === 0 ? 'bg-danger' : pct <= 50 ? 'bg-warning' : 'bg-info';
                const qtyClass = qty === 0 ? 'text-danger fw-bold' : 'text-warning';
                return `<div class="dash-stock-item">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="dash-stock-name">${name}</span>
                        <span class="${qtyClass} small fw-semibold">${qty} / ${thr}</span>
                    </div>
                    <div class="progress dash-stock-progress">
                        <div class="progress-bar ${barColor}" style="width:${pct}%"></div>
                    </div>
                </div>`;
            }).join('');

            setHtml('#stockAlertsContainer', `<div class="dash-stock-list p-3">${items}</div>`);
        }).fail(function () {
            setHtml('#kpiStockAlerts', '<span class="text-muted">–</span>');
            setHtml('#stockAlertsContainer', emptyState('fa-circle-exclamation', 'Failed to load stock data'));
        });
    }

    function loadPendingPO() {
        $.get('/Home/PendingPurchaseOrders', function (res) {
            if (!res || !res.success) {
                setHtml('#kpiPendingPO', '<span class="text-muted">–</span>');
                setHtml('#pendingPOContainer', emptyState('fa-circle-exclamation', 'Unable to load data'));
                return;
            }
            const count = res.count || 0;
            setHtml('#kpiPendingPO', count);

            if (count === 0) {
                setHtml('#pendingPOContainer', emptyState('fa-circle-check', 'No pending approvals'));
                return;
            }

            // Show pending POs from result
            const data = Array.isArray(res.result) ? res.result : [];
            const pendingRows = data.filter(r => {
                const sid = r.statusID ?? r.StatusID ?? 0;
                return sid === 2;
            }).slice(0, 8);

            if (!pendingRows.length) {
                setHtml('#pendingPOContainer', `<div class="p-3 text-center"><span class="badge-status badge-warning fs-6">${count}</span><p class="text-muted small mt-2">Purchase Orders awaiting approval</p></div>`);
                return;
            }

            let rows = pendingRows.map(r => {
                const no = r.no || r.No || '-';
                const supplier = r.supplierName || r.SupplierName || r.supplier || '-';
                const amt = parseFloat(r.amount || r.Amount || 0);
                return `<tr>
                    <td class="ps-3"><span class="fw-semibold text-primary">${no}</span></td>
                    <td>${supplier}</td>
                    <td class="text-end">${fmtCurrency(amt)}</td>
                    <td class="text-center"><span class="badge-status badge-pending">Pending</span></td>
                </tr>`;
            }).join('');

            const html = `<div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead><tr>
                        <th class="ps-3">PO No</th>
                        <th>Supplier</th>
                        <th class="text-end">Amount</th>
                        <th class="text-center">Status</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table></div>`;
            setHtml('#pendingPOContainer', html);
        }).fail(function () {
            setHtml('#kpiPendingPO', '<span class="text-muted">–</span>');
            setHtml('#pendingPOContainer', emptyState('fa-circle-exclamation', 'Failed to load data'));
        });
    }

    function loadPendingDO() {
        $.get('/Home/PendingDeliveryOrders', function (res) {
            if (!res || !res.success) {
                setHtml('#kpiPendingDO', '<span class="text-muted">–</span>');
                setHtml('#pendingDOContainer', emptyState('fa-circle-exclamation', 'Unable to load data'));
                return;
            }
            const data = Array.isArray(res.result) ? res.result : [];
            setHtml('#kpiPendingDO', data.length);

            if (!data.length) {
                setHtml('#pendingDOContainer', emptyState('fa-circle-check', 'No pending deliveries'));
                return;
            }

            let rows = data.slice(0, 8).map(d => {
                const no = d.no || d.No || '-';
                const soNo = d.salesOrderNo || d.SalesOrderNo || d.salesOrderID || d.SalesOrderID || '-';
                const customer = d.customerName || d.CustomerName || d.customer || '-';
                const statusId = d.statusID ?? d.StatusID ?? 0;
                const statusBadge = getDOStatusBadge(statusId);
                return `<tr>
                    <td class="ps-3"><span class="fw-semibold text-primary">${no}</span></td>
                    <td>${soNo}</td>
                    <td>${customer}</td>
                    <td class="text-center">${statusBadge}</td>
                </tr>`;
            }).join('');

            const html = `<div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead><tr>
                        <th class="ps-3">DO No</th>
                        <th>SO Ref</th>
                        <th>Customer</th>
                        <th class="text-center">Status</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table></div>`;
            setHtml('#pendingDOContainer', html);
        }).fail(function () {
            setHtml('#kpiPendingDO', '<span class="text-muted">–</span>');
            setHtml('#pendingDOContainer', emptyState('fa-circle-exclamation', 'Failed to load data'));
        });
    }

    function getDOStatusBadge(statusId) {
        const map = {
            1: ['Pending', 'badge-pending'],
            2: ['Assigned', 'badge-assigned'],
            3: ['Out for Delivery', 'badge-outfordelivery'],
            4: ['Delivered', 'badge-delivered'],
            5: ['Canceled', 'badge-canceled']
        };
        const [label, cls] = map[statusId] || ['Pending', 'badge-pending'];
        return `<span class="badge-status ${cls}">${label}</span>`;
    }

    function setDate() {
        const now = new Date();
        const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        $('#dashboardDate').text(now.toLocaleDateString('id-ID', opts));
    }

    function init() {
        setDate();
        const role = (window.__dashRole || '').toLowerCase();
        if (role === 'kasir') {
            loadSalesToday();
        } else if (role === 'driver') {
            loadPendingDO();
        } else {
            // admin / other – load everything
            loadSalesToday();
            loadStockAlerts();
            loadPendingPO();
            loadPendingDO();
        }
    }

    return { init };
})();
