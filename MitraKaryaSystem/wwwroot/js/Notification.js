$(document).ready(function () { NotificationPage.init(); });

const NotificationPage = {
    _alerts: [],
    _filter: 'all',

    init() {
        this.load();
        $('#btnRefresh').on('click', () => this.load());
        $('.btn-group [data-filter]').on('click', function () {
            $('.btn-group [data-filter]').removeClass('active');
            $(this).addClass('active');
            NotificationPage._filter = $(this).data('filter');
            NotificationPage.render();
        });
    },

    async load() {
        $('#alertContainer').html('<div class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm"></div> Loading alerts...</div>');
        try {
            const data = await Common.Api.get('/Notification/GetAlerts');
            this._alerts = Array.isArray(data) ? data : [];
            this.render();
        } catch (e) {
            $('#alertContainer').html('<div class="text-center text-muted py-5"><i class="fa fa-circle-exclamation me-2"></i>Failed to load alerts</div>');
        }
    },

    render() {
        const alerts = this._filter === 'all' ? this._alerts : this._alerts.filter(a => a.type === this._filter);

        const danger = this._alerts.filter(a => a.severity === 'danger').length;
        const warning = this._alerts.filter(a => a.severity === 'warning').length;
        const info = this._alerts.filter(a => a.severity === 'info').length;
        $('#badgeDanger').text(danger + ' Critical');
        $('#badgeWarning').text(warning + ' Warning');
        $('#badgeInfo').text(info + ' Info');

        const $c = $('#alertContainer').empty();
        if (!alerts.length) {
            $c.html('<div class="text-center text-muted py-5"><i class="fa fa-check-circle fa-2x mb-2 text-success"></i><p>No alerts</p></div>');
            return;
        }

        alerts.forEach(a => {
            const severityClass = a.severity === 'danger' ? 'border-danger' : a.severity === 'warning' ? 'border-warning' : 'border-info';
            const iconMap = { LowStock: 'fa-box-open', OverdueDebt: 'fa-clock', PendingApproval: 'fa-hourglass-half', ExpiringConsignment: 'fa-handshake' };
            const colorMap = { danger: 'text-danger', warning: 'text-warning', info: 'text-info' };
            const icon = iconMap[a.type] || 'fa-bell';
            const color = colorMap[a.severity] || 'text-secondary';
            $c.append(`
                <div class="card border-start border-4 ${severityClass} shadow-sm mb-2">
                    <div class="card-body py-2 d-flex align-items-center gap-3">
                        <i class="fa ${icon} fa-lg ${color}"></i>
                        <div class="flex-grow-1">
                            <div class="fw-semibold">${a.title}</div>
                            <div class="small text-muted">${a.message}</div>
                        </div>
                        ${a.link ? `<a href="${a.link}" class="btn btn-sm btn-outline-primary"><i class="fa fa-arrow-right"></i></a>` : ''}
                    </div>
                </div>`);
        });
    }
};
