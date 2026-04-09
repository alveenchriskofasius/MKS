$(document).ready(function () { ComplaintIndexPage.init(); });

const ComplaintIndexPage = {
    init() {
        this.loadComplaints();
    },

    getStatusBadge(status) {
        var map = {
            'Pending': { cls: 'bg-warning text-dark', icon: 'bi-clock', text: 'Menunggu' },
            'InProgress': { cls: 'bg-info text-white', icon: 'bi-arrow-repeat', text: 'Diproses' },
            'Resolved': { cls: 'bg-success', icon: 'bi-check-circle', text: 'Selesai' },
            'Rejected': { cls: 'bg-danger', icon: 'bi-x-circle', text: 'Ditolak' }
        };
        var info = map[status] || { cls: 'bg-secondary', icon: 'bi-question-circle', text: status };
        return '<span class="badge ' + info.cls + '"><i class="bi ' + info.icon + ' me-1"></i>' + info.text + '</span>';
    },

    async loadComplaints() {
        try {
            var list = await Common.Api.get('/Complaint/GetMyComplaints');
            $('#complaintLoading').hide();

            if (!list || !list.length) {
                $('#complaintEmpty').show();
                return;
            }

            var html = '';
            var self = this;
            list.forEach(function (c) {
                var dateStr = new Date(c.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
                var resolvedStr = c.resolvedAt
                    ? new Date(c.resolvedAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    })
                    : '-';

                html += '<div class="card shadow-sm mb-3">';
                html += '  <div class="card-body">';
                html += '    <div class="d-flex justify-content-between align-items-start mb-2">';
                html += '      <div>';
                html += '        <h6 class="fw-bold mb-0">Order ' + c.orderNo + '</h6>';
                html += '        <small class="text-muted">' + dateStr + '</small>';
                html += '      </div>';
                html += '      ' + self.getStatusBadge(c.status);
                html += '    </div>';
                html += '    <p class="mb-2">' + $('<span>').text(c.reason).html() + '</p>';

                if (c.adminNote) {
                    html += '    <div class="alert alert-info small mb-0 py-2">';
                    html += '      <i class="bi bi-chat-dots me-1"></i> <strong>Balasan Admin:</strong> ';
                    html += '      ' + $('<span>').text(c.adminNote).html();
                    html += '    </div>';
                }

                html += '  </div>';
                html += '</div>';
            });

            $('#complaintCards').html(html);
            $('#complaintContent').show();
        } catch (e) {
            console.error('Failed loading complaints', e);
            $('#complaintLoading')
                .html('<p class="text-danger">Gagal memuat data komplain.</p>')
                .show();
        }
    }
};
