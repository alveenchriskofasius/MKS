$(document).ready(function () { OrderPage.init(); });

const OrderPage = {
    allOrders: [],
    currentFilter: 'all',

    init() {
        this.loadOrders();
        this.bindFilterEvents();
    },

    bindFilterEvents() {
        $(document).on('click', '.order-filter', function (e) {
            e.preventDefault();
            $('.order-filter').removeClass('active');
            $(this).addClass('active');
            OrderPage.currentFilter = $(this).data('status');
            OrderPage.renderOrders();
        });
    },

    async loadOrders() {
        try {
            var orders = await Common.Api.get('/Order/GetMyOrders');
            $('#orderLoading').hide();

            this.allOrders = orders || [];
            this.renderOrders();
        } catch (e) {
            console.error('Failed loading orders', e);
            $('#orderLoading').html('<p class="text-danger">Gagal memuat pesanan.</p>');
        }
    },

    getStatusInfo(o) {
        if (o.isCancelled) return { text: 'Dibatalkan', cls: 'bg-secondary', icon: 'bi-x-circle' };
        if (o.isCompleted) return { text: 'Selesai', cls: 'bg-primary', icon: 'bi-check2-all' };
        if (o.isPaid) return { text: 'Dibayar', cls: 'bg-success', icon: 'bi-check-circle' };
        return { text: 'Belum Bayar', cls: 'bg-warning text-dark', icon: 'bi-clock' };
    },

    getPaymentLabel(method) {
        var map = { qris: 'QRIS', virtual_account: 'Virtual Account', bank_transfer: 'Transfer Bank' };
        return map[method] || method || '-';
    },

    getDeliveryLabel(method) {
        var map = { pickup: 'Pick Up', delivery: 'Delivery' };
        return map[method] || method || '-';
    },

    getDeliveryIcon(method) {
        return method === 'delivery' ? 'bi-truck' : 'bi-shop';
    },

    renderOrders() {
        var filtered = this.allOrders;
        if (this.currentFilter === 'unpaid') {
            filtered = filtered.filter(function (o) { return !o.isPaid && !o.isCancelled; });
        } else if (this.currentFilter === 'paid') {
            filtered = filtered.filter(function (o) { return o.isPaid && !o.isCompleted; });
        } else if (this.currentFilter === 'completed') {
            filtered = filtered.filter(function (o) { return o.isCompleted; });
        } else if (this.currentFilter === 'cancelled') {
            filtered = filtered.filter(function (o) { return o.isCancelled; });
        }

        if (!filtered.length) {
            var emptyTexts = {
                all: 'Belum ada pesanan.',
                unpaid: 'Tidak ada pesanan yang belum dibayar.',
                paid: 'Tidak ada pesanan yang sudah dibayar.',
                completed: 'Tidak ada pesanan yang selesai.',
                cancelled: 'Tidak ada pesanan yang dibatalkan.'
            };
            $('#orderEmptyText').text(emptyTexts[this.currentFilter] || 'Belum ada pesanan.');
            $('#orderContent').hide();
            $('#orderEmpty').show();
            return;
        }

        var self = this;
        var html = '';
        filtered.forEach(function (o) {
            var st = self.getStatusInfo(o);
            var payLabel = self.getPaymentLabel(o.paymentMethod);
            var delLabel = self.getDeliveryLabel(o.deliveryMethod);
            var delIcon = self.getDeliveryIcon(o.deliveryMethod);
            var dateStr = new Date(o.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

            var actions = '<a href="/Order/Detail/' + o.orderID +
                '" class="btn btn-sm btn-outline-dark"><i class="bi bi-eye"></i> Detail</a>';
            if (!o.isPaid && !o.isCancelled) {
                actions += ' <button class="btn btn-sm btn-warning btn-pay"' +
                    ' data-id="' + o.orderID + '"' +
                    ' data-no="' + o.orderNo + '"' +
                    ' data-amount="' + o.amount + '"' +
                    ' data-method="' + (o.paymentMethod || 'qris') + '">' +
                    '<i class="bi bi-credit-card"></i> Bayar</button>';
                actions += ' <button class="btn btn-sm btn-outline-danger btn-cancel"' +
                    ' data-id="' + o.orderID + '"' +
                    ' data-no="' + o.orderNo + '">' +
                    '<i class="bi bi-x-circle"></i> Batal</button>';
            }

            html += '<div class="card shadow-sm mb-3 order-card">' +
                '  <div class="card-body">' +
                '    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">' +
                '      <div>' +
                '        <h6 class="fw-bold mb-1">' + o.orderNo + '</h6>' +
                '        <small class="text-muted"><i class="bi bi-calendar3"></i> ' + dateStr + '</small>' +
                '      </div>' +
                '      <div class="text-end">' +
                '        <span class="badge ' + st.cls + '"><i class="bi ' + st.icon + '"></i> ' + st.text + '</span>' +
                '      </div>' +
                '    </div>' +
                '    <hr class="my-2" />' +
                '    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">' +
                '      <div class="d-flex gap-3">' +
                '        <span class="text-muted small"><i class="bi bi-wallet2"></i> ' + payLabel + '</span>' +
                '        <span class="text-muted small"><i class="bi ' + delIcon + '"></i> ' + delLabel + '</span>' +
                '      </div>' +
                '      <div class="fw-bold fs-5" style="color:var(--mp-red);">' + Common.formatRupiah(o.amount) + '</div>' +
                '    </div>' +
                '    <div class="d-flex gap-2 mt-2 justify-content-end">' + actions + '</div>' +
                '  </div>' +
                '</div>';
        });
        $('#orderCards').html(html);
        $('#orderEmpty').hide();
        $('#orderContent').show();

        // Bind pay buttons
        $(document).off('click', '.btn-pay').on('click', '.btn-pay', function () {
            var orderId = $(this).data('id');
            var orderNo = $(this).data('no');
            var method = $(this).data('method');
            OrderPage.startPayment(orderId, orderNo, method);
        });

        // Bind cancel buttons
        $(document).off('click', '.btn-cancel').on('click', '.btn-cancel', function () {
            var orderId = $(this).data('id');
            var orderNo = $(this).data('no');
            OrderPage.confirmCancel(orderId, orderNo);
        });
    },

    async confirmCancel(orderId, orderNo) {
        var result = await Swal.fire({
            title: 'Batalkan Pesanan?',
            text: 'Order ' + orderNo + ' akan dibatalkan.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonText: 'Tidak',
            confirmButtonText: 'Ya, Batalkan'
        });
        if (!result.isConfirmed) return;

        try {
            var res = await Common.Api.post('/Order/CancelOrder', {
                orderId: orderId
            });
            if (res.success) {
                Common.showToast(res.message || 'Order dibatalkan.');
                this.loadOrders();
            } else {
                Common.showToast(res.message || 'Gagal membatalkan order.', true);
            }
        } catch (e) {
            Common.showToast('Gagal membatalkan order.', true);
        }
    },

    async startPayment(orderId, orderNo, method) {
        if (method === 'virtual_account') {
            this.startVAPayment(orderId, orderNo);
        } else {
            this.startQrisPayment(orderId, orderNo);
        }
    },

    async startQrisPayment(orderId, orderNo) {
        var modalHtml = '<div class="text-center">' +
            '<p>Order: <strong>' + orderNo + '</strong></p>' +
            '<div id="payQrisLoading"><div class="spinner-border text-secondary" role="status"></div><p class="mt-2 text-muted">Generating QRIS...</p></div>' +
            '<div id="payQrisContent" style="display:none;">' +
            '  <p>Total: <strong id="payQrisAmount" class="text-danger"></strong></p>' +
            '  <img id="payQrisImage" src="" alt="QR Code" class="img-fluid mb-3" style="max-width:250px;" />' +
            '  <p class="text-muted small">Scan QR code di atas untuk membayar</p>' +
            '  <div id="payQrisStatus" class="alert alert-info">Menunggu pembayaran...</div>' +
            '</div>' +
            '</div>';

        Swal.fire({
            title: 'Pembayaran QRIS',
            html: modalHtml,
            width: 420,
            showConfirmButton: false,
            showCloseButton: true,
            didOpen: () => { OrderPage.generateQris(orderId); },
            willClose: () => { if (OrderPage._pollTimer) clearInterval(OrderPage._pollTimer); }
        });
    },

    async startVAPayment(orderId, orderNo) {
        var modalHtml = '<div class="text-center">' +
            '<p>Order: <strong>' + orderNo + '</strong></p>' +
            '<div id="payVALoading"><div class="spinner-border text-secondary" role="status"></div><p class="mt-2 text-muted">Generating Virtual Account...</p></div>' +
            '<div id="payVAContent" style="display:none;">' +
            '  <p>Total: <strong id="payVAAmount" class="text-danger"></strong></p>' +
            '  <div class="border rounded p-3 mb-3">' +
            '    <p class="mb-1 text-muted small">Bank</p>' +
            '    <h5 class="fw-bold mb-2" id="payVABankName"></h5>' +
            '    <p class="mb-1 text-muted small">Nomor Virtual Account</p>' +
            '    <div class="d-flex align-items-center justify-content-center gap-2">' +
            '      <h4 class="fw-bold text-primary mb-0" id="payVANumber"></h4>' +
            '      <button class="btn btn-sm btn-outline-secondary" onclick="navigator.clipboard.writeText(document.getElementById(\'payVANumber\').textContent).then(function(){Common.showToast(\'Nomor VA disalin!\');})" title="Salin nomor VA"><i class="bi bi-clipboard"></i></button>' +
            '    </div>' +
            '  </div>' +
            '  <div id="payVAStatus" class="alert alert-info">Menunggu pembayaran...</div>' +
            '</div>' +
            '</div>';

        Swal.fire({
            title: 'Pembayaran Virtual Account',
            html: modalHtml,
            width: 480,
            showConfirmButton: false,
            showCloseButton: true,
            didOpen: () => { OrderPage.generateVA(orderId); },
            willClose: () => { if (OrderPage._pollTimer) clearInterval(OrderPage._pollTimer); }
        });
    },

    _pollTimer: null,

    async generateQris(orderId) {
        try {
            var res = await Common.Api.post('/Checkout/GenerateQris', { orderId: orderId });
            if (res.success) {
                $('#payQrisLoading').hide();
                $('#payQrisAmount').text(Common.formatRupiah(res.amount));
                $('#payQrisImage').attr('src', res.qrCodeUrl);
                $('#payQrisContent').show();
                OrderPage.startPolling(orderId, res.orderId);
            } else {
                $('#payQrisLoading').html('<p class="text-danger">' + (res.message || 'Gagal generate QRIS.') + '</p>');
            }
        } catch (e) {
            $('#payQrisLoading').html('<p class="text-danger">Gagal generate QRIS.</p>');
        }
    },

    async generateVA(orderId) {
        try {
            var res = await Common.Api.post('/Checkout/GenerateVA', { orderId: orderId, bank: 'bca' });
            if (res.success) {
                $('#payVALoading').hide();
                $('#payVAAmount').text(Common.formatRupiah(res.amount));
                $('#payVABankName').text(res.bankName);
                $('#payVANumber').text(res.vaNumber);
                $('#payVAContent').show();
                OrderPage.startPolling(orderId, res.midtransOrderId);
            } else {
                $('#payVALoading').html('<p class="text-danger">' + (res.message || 'Gagal membuat VA.') + '</p>');
            }
        } catch (e) {
            $('#payVALoading').html('<p class="text-danger">Gagal membuat VA.</p>');
        }
    },

    startPolling(orderId, midtransOrderId) {
        var self = this;
        this._pollTimer = setInterval(async function () {
            try {
                var res = await Common.Api.get('/Checkout/CheckPaymentStatus?midtransOrderId=' +
                    encodeURIComponent(midtransOrderId) + '&orderId=' + orderId);
                if (res.success && res.status === 'settlement') {
                    clearInterval(self._pollTimer);
                    $('#payQrisStatus, #payVAStatus').removeClass('alert-info').addClass('alert-success')
                        .html('<i class="bi bi-check-circle"></i> Pembayaran berhasil!');
                    setTimeout(function () { Swal.close(); self.loadOrders(); }, 1500);
                }
            } catch (e) { /* keep polling */ }
        }, 5000);
    }
};
