$(document).ready(function () { CheckoutPage.init(); });

const CheckoutPage = {
    orderId: null,
    midtransOrderId: null,
    pollTimer: null,

    init() {
        this.loadCartForCheckout();
        this.loadProfileAddress();
        this.bindEvents();
    },

    bindEvents() {
        $('#btnPlaceOrder').on('click', function () {
            CheckoutPage.placeOrder();
        });

        // Toggle delivery/pickup sections
        $('input[name="deliveryMethod"]').on('change', function () {
            var val = $(this).val();
            if (val === 'pickup') {
                $('#storeMapSection').show();
                $('#deliveryAddressSection').hide();
            } else {
                $('#storeMapSection').hide();
                $('#deliveryAddressSection').show();
            }
        });

        // Toggle VA bank selection
        $('input[name="paymentMethod"]').on('change', function () {
            if ($(this).val() === 'virtual_account') {
                $('#vaBankSection').show();
            } else {
                $('#vaBankSection').hide();
            }
        });
    },

    async loadProfileAddress() {
        try {
            var res = await Common.Api.get('/Account/GetProfile');
            if (res.success && res.address) {
                $('#deliveryAddress').val(res.address);
            }
        } catch (e) { }
    },

    async loadCartForCheckout() {
        try {
            var data = await Common.Api.get('/Cart/GetCartItems');
            $('#checkoutLoading').hide();

            if (!data.items || !data.items.length) {
                Common.showToast('Keranjang kosong.', true);
                window.location.href = '/Cart';
                return;
            }

            var html = '';
            var total = 0;
            data.items.forEach(function (item) {
                var subtotal = item.unitPrice * item.quantity;
                total += subtotal;
                html += '<tr>' +
                    '<td>' + item.productName + '</td>' +
                    '<td>' + item.quantity + '</td>' +
                    '<td>' + Common.formatRupiah(item.unitPrice) + '</td>' +
                    '<td>' + Common.formatRupiah(subtotal) + '</td>' +
                    '</tr>';
            });
            $('#checkoutItems tbody').html(html);
            $('#checkoutTotal').text(Common.formatRupiah(total));
            $('#checkoutContent').show();
        } catch (e) {
            console.error('Failed loading checkout', e);
            $('#checkoutLoading').html(
                '<p class="text-danger">Gagal memuat data checkout.</p>'
            );
        }
    },

    async placeOrder() {
        var note = $('#orderNote').val().trim();
        var paymentMethod = $('input[name="paymentMethod"]:checked').val();
        var deliveryMethod = $('input[name="deliveryMethod"]:checked').val();

        if (deliveryMethod === 'delivery') {
            var address = $('#deliveryAddress').val().trim();
            if (!address) {
                Common.showToast('Masukkan alamat pengiriman.', true);
                return;
            }
            note = (note ? note + ' | ' : '') + 'Alamat: ' + address;
        }

        this.setLoading(true);

        try {
            var postData = {
                note: note,
                paymentMethod: paymentMethod,
                deliveryMethod: deliveryMethod
            };
            if (paymentMethod === 'virtual_account') {
                postData.vaBank = $('#vaBank').val();
            }

            var res = await Common.Api.post('/Checkout/PlaceOrder', postData);
            if (res.success) {
                Common.showToast('Pesanan berhasil dibuat!');
                Common.updateCartBadge(0);
                this.orderId = res.orderId;
                $('#checkoutContent').hide();

                if (paymentMethod === 'qris') {
                    this.generateQris(res.orderId, res.orderNo);
                } else if (paymentMethod === 'virtual_account') {
                    this.generateVA(res.orderId, res.orderNo, $('#vaBank').val());
                } else {
                    $('#bankOrderNo').text(res.orderNo);
                    $('#bankAmount').text(
                        Common.formatRupiah(res.amount)
                    );
                    $('#bankInfoSection').show();
                }
            } else {
                Common.showToast(
                    res.message || 'Gagal membuat pesanan.',
                    true
                );
            }
        } catch (e) {
            Common.showToast('Terjadi kesalahan.', true);
        } finally {
            this.setLoading(false);
        }
    },

    async generateQris(orderId, orderNo) {
        try {
            var res = await Common.Api.post('/Checkout/GenerateQris', {
                orderId: orderId
            });
            if (res.success) {
                this.midtransOrderId = res.orderId;
                $('#qrisOrderNo').text(orderNo || ('#' + orderId));
                $('#qrisAmount').text(Common.formatRupiah(res.amount));
                $('#qrisImage').attr('src', res.qrCodeUrl);
                $('#qrisSection').show();
                this.startPolling(orderId);
            } else {
                Common.showToast(
                    res.message || 'Gagal generate QRIS.',
                    true
                );
                window.location.href = '/Order/Detail/' + orderId;
            }
        } catch (e) {
            Common.showToast('Gagal generate QRIS.', true);
            window.location.href = '/Order/Detail/' + orderId;
        }
    },

    startPolling(orderId) {
        var self = this;
        this.pollTimer = setInterval(async function () {
            try {
                var url = '/Checkout/CheckPaymentStatus' +
                    '?midtransOrderId=' +
                    encodeURIComponent(self.midtransOrderId) +
                    '&orderId=' + orderId;
                var res = await Common.Api.get(url);
                if (res.success && res.status === 'settlement') {
                    clearInterval(self.pollTimer);
                    $('#qrisStatus, #vaPayStatus')
                        .removeClass('alert-info')
                        .addClass('alert-success')
                        .html(
                            '<i class="bi bi-check-circle"></i> ' +
                            'Pembayaran berhasil!'
                        );
                }
            } catch (e) {
                // keep polling
            }
        }, 5000);
    },

    async generateVA(orderId, orderNo, bank) {
        try {
            var res = await Common.Api.post('/Checkout/GenerateVA', {
                orderId: orderId,
                bank: bank
            });
            if (res.success) {
                this.midtransOrderId = res.midtransOrderId;
                $('#vaOrderNo').text(orderNo || ('#' + orderId));
                $('#vaAmount').text(Common.formatRupiah(res.amount));
                $('#vaBankName').text(res.bankName);
                $('#vaNumber').text(res.vaNumber);
                $('#vaInfoSection').show();
                this.startPolling(orderId);
            } else {
                Common.showToast(
                    res.message || 'Gagal membuat Virtual Account.',
                    true
                );
                window.location.href = '/Order/Detail/' + orderId;
            }
        } catch (e) {
            Common.showToast('Gagal membuat Virtual Account.', true);
            window.location.href = '/Order/Detail/' + orderId;
        }
    },

    setLoading(loading) {
        $('#btnPlaceOrder').prop('disabled', loading);
        $('#orderSpinner').toggle(loading);
    }
};
