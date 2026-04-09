$(document).ready(function () { ComplaintCreatePage.init(); });

const ComplaintCreatePage = {
    orderId: 0,

    init() {
        this.orderId = parseInt($('#hdnOrderId').val()) || 0;
        if (!this.orderId) {
            $('#orderInfo').html('<p class="text-danger">Order tidak valid.</p>').show();
            return;
        }
        this.loadOrderInfo();
        this.bindEvents();
    },

    bindEvents() {
        $('#btnSubmitComplaint').on('click', function () {
            ComplaintCreatePage.submitComplaint();
        });
    },

    async loadOrderInfo() {
        try {
            var order = await Common.Api.get('/Order/GetOrderDetail?id=' + this.orderId);
            $('#orderInfo').hide();

            if (!order || !order.orderNo) {
                $('#orderInfo')
                    .html('<p class="text-danger">Pesanan tidak ditemukan.</p>')
                    .show();
                return;
            }

            var dateStr = new Date(order.date).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });

            $('#formOrderNo').text(order.orderNo);
            $('#formOrderDate').text(dateStr);
            $('#formOrderAmount').text(Common.formatRupiah(order.amount));
            $('#complaintForm').show();
        } catch (e) {
            console.error('Failed loading order', e);
            $('#orderInfo')
                .html('<p class="text-danger">Gagal memuat data pesanan.</p>')
                .show();
        }
    },

    async submitComplaint() {
        var reason = $('#complaintReason').val().trim();
        if (reason.length < 10) {
            $('#formError').text('Alasan komplain minimal 10 karakter.').show();
            return;
        }
        $('#formError').hide();

        var $btn = $('#btnSubmitComplaint');
        var $spinner = $('#submitSpinner');
        $btn.prop('disabled', true);
        $spinner.show();

        try {
            var res = await Common.Api.post('/Complaint/Submit', {
                OrderID: this.orderId,
                Reason: reason
            });

            if (res.success) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Berhasil',
                    text: res.message,
                    confirmButtonColor: '#00AA5B'
                });
                window.location.href = '/Complaint';
            } else {
                if (res.message && res.message.indexOf('sudah pernah') >= 0) {
                    $('#complaintForm').hide();
                    $('#alreadyExists').show();
                } else {
                    $('#formError').text(res.message).show();
                }
            }
        } catch (e) {
            console.error('Submit failed', e);
            $('#formError').text('Terjadi kesalahan, silakan coba lagi.').show();
        } finally {
            $btn.prop('disabled', false);
            $spinner.hide();
        }
    }
};
