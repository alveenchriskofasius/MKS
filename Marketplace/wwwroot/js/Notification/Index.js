$(document).ready(function () { NotifPage.init(); });

const NotifPage = {
    init() {
        this.loadNotifications();
    },

    async loadNotifications() {
        try {
            var items = await Common.Api.get('/Notification/GetNotifications');
            $('#notifLoading').hide();

            if (!items || !items.length) {
                $('#notifEmpty').show();
                return;
            }

            var html = '';
            items.forEach(function (n) {
                var dateStr = new Date(n.date).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                html += '<a href="/Order/Detail/' + n.orderId + '" class="list-group-item list-group-item-action d-flex align-items-start gap-3 py-3">' +
                    '  <i class="bi ' + n.icon + ' ' + n.badgeClass + ' fs-4 mt-1"></i>' +
                    '  <div class="flex-grow-1">' +
                    '    <div class="fw-semibold">' + n.message + '</div>' +
                    '    <small class="text-muted">' + dateStr + '</small>' +
                    '  </div>' +
                    '  <i class="bi bi-chevron-right text-muted"></i>' +
                    '</a>';
            });
            $('#notifList').html(html);
            $('#notifContent').show();
        } catch (e) {
            console.error('Failed loading notifications', e);
            $('#notifLoading').html('<p class="text-danger">Gagal memuat notifikasi.</p>');
        }
    }
};
