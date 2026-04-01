$(document).ready(function () { OrderDetailPage.init(); });

const OrderDetailPage = {
    _pollTimer: null,
    _paymentMethod: null,

    init() {
        this.loadDetail();
    },

    async loadDetail() {
        try {
            var order = await Common.Api.get('/Order/GetOrderDetail?id=' + __orderId);
            $('#detailLoading').hide();

            if (!order || !order.orderNo) {
                $('#detailLoading').html('<p class="text-danger">Order tidak ditemukan.</p>');
                return;
            }

            this._paymentMethod = order.paymentMethod || 'qris';

            $('#bcOrderNo').text(order.orderNo);
            $('#detailNo').text(order.orderNo);
            $('#detailDate').text(new Date(order.date).toLocaleDateString('id-ID'));

            var statusBadge, statusText;
            if (order.isCancelled) {
                statusBadge = 'bg-secondary';
                statusText = 'Dibatalkan';
            } else if (order.isPaid) {
                statusBadge = 'bg-success';
                statusText = 'Dibayar';
            } else {
                statusBadge = 'bg-warning text-dark';
                statusText = 'Belum Bayar';
            }
            $('#detailStatus').addClass(statusBadge).text(statusText);

            // Show payment method badge
            if (order.paymentMethod) {
                var methodLabel = { qris: 'QRIS', bank_transfer: 'Transfer Bank', virtual_account: 'Virtual Account' };
                var badge = '<span class="badge bg-info ms-2">' + (methodLabel[order.paymentMethod] || order.paymentMethod) + '</span>';
                $('#detailStatus').after(badge);
            }

            var html = '';
            if (order.items) {
                order.items.forEach(function (item) {
                    html += '<tr>' +
                        '<td>' + item.productName + '</td>' +
                        '<td>' + item.quantity + '</td>' +
                        '<td>' + Common.formatRupiah(item.unitPrice) + '</td>' +
                        '<td>' + Common.formatRupiah(item.subtotal) + '</td>' +
                        '</tr>';
                });
            }
            $('#detailItems').html(html);
            $('#detailTotal').text(Common.formatRupiah(order.amount));
            $('#detailContent').show();

            // Show pay button for unpaid, non-cancelled orders
            if (!order.isPaid && !order.isCancelled) {
                // Show bank info for bank_transfer orders
                if (order.paymentMethod === 'bank_transfer') {
                    $('#bankPayInfo').show();
                }

                $('#btnPayOrder').show().off('click').on('click', function () {
                    OrderDetailPage.startPayment(
                        order.orderID || __orderId, order.orderNo);
                });
                $('#btnCancelOrder').show().off('click').on('click', function () {
                    OrderDetailPage.confirmCancel(
                        order.orderID || __orderId, order.orderNo);
                });
            }
        } catch (e) {
            console.error('Failed loading order detail', e);
            $('#detailLoading').html('<p class="text-danger">Gagal memuat detail pesanan.</p>');
        }
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
                location.reload();
            } else {
                Common.showToast(res.message || 'Gagal membatalkan order.', true);
            }
        } catch (e) {
            Common.showToast('Gagal membatalkan order.', true);
        }
    },

    async startPayment(orderId, orderNo) {
        var method = this._paymentMethod || 'qris';
        var $btn = $('#btnPayOrder');
        $btn.prop('disabled', true);

        if (method === 'qris') {
            $btn.html('<span class="spinner-border spinner-border-sm"></span> Generating QRIS...');
            try {
                var res = await Common.Api.post('/Checkout/GenerateQris', { orderId: orderId });
                if (res.success) {
                    $btn.hide();
                    $('#qrisOrderNo').text(orderNo);
                    $('#qrisAmount').text(Common.formatRupiah(res.amount));
                    $('#qrisImage').attr('src', res.qrCodeUrl);
                    $('#qrisPaySection').show();
                    this.startPolling(orderId, res.orderId);
                } else {
                    Common.showToast(res.message || 'Gagal generate QRIS.', true);
                    $btn.prop('disabled', false).html('<i class="bi bi-credit-card"></i> Bayar Sekarang');
                }
            } catch (e) {
                Common.showToast('Gagal generate QRIS.', true);
                $btn.prop('disabled', false).html('<i class="bi bi-credit-card"></i> Bayar Sekarang');
            }
        } else if (method === 'virtual_account') {
            $btn.html('<span class="spinner-border spinner-border-sm"></span> Generating VA...');
            try {
                var res = await Common.Api.post('/Checkout/GenerateVA', { orderId: orderId, bank: 'bca' });
                if (res.success) {
                    $btn.hide();
                    $('#vaPayOrderNo').text(orderNo);
                    $('#vaPayAmount').text(Common.formatRupiah(res.amount));
                    $('#vaPayBankName').text(res.bankName);
                    $('#vaPayNumber').text(res.vaNumber);
                    $('#vaPaySection').show();
                    this.startPolling(orderId, res.midtransOrderId);
                } else {
                    Common.showToast(res.message || 'Gagal membuat VA.', true);
                    $btn.prop('disabled', false).html('<i class="bi bi-credit-card"></i> Bayar Sekarang');
                }
            } catch (e) {
                Common.showToast('Gagal membuat VA.', true);
                $btn.prop('disabled', false).html('<i class="bi bi-credit-card"></i> Bayar Sekarang');
            }
        } else {
            // bank_transfer: show bank info
            $('#bankPayInfo').show();
            $btn.hide();
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
                    $('#qrisPayStatus, #vaDetailPayStatus').removeClass('alert-info').addClass('alert-success')
                        .html('<i class="bi bi-check-circle"></i> Pembayaran berhasil!');
                    setTimeout(function () { location.reload(); }, 2000);
                }
            } catch (e) { /* keep polling */ }
        }, 5000);
    }
};
