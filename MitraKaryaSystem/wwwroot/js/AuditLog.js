$(document).ready(function () {
    loadAuditLog();
    $('#btnSearch').on('click', function () { loadAuditLog(); });
});

function loadAuditLog() {
    var params = {
        entity: $('#filterEntity').val() || '',
        action: $('#filterAction').val() || '',
        user: $('#filterUser').val() || '',
        from: $('#filterFrom').val() || '',
        to: $('#filterTo').val() || ''
    };
    $.get('/AuditLog/GetList', params, function (data) {
        var list = Array.isArray(data) ? data : (data && data.result ? data.result : []);
        var table = $('#tableAuditLog');
        if ($.fn.DataTable.isDataTable('#tableAuditLog')) {
            table.DataTable().destroy();
        }
        table.DataTable({
            data: list,
            destroy: true,
            processing: true,
            responsive: true,
            order: [[0, 'desc']],
            columns: [
                { data: 'createdAt' },
                { data: 'entityName' },
                { data: 'action' },
                { data: 'entityId', defaultContent: '-' },
                { data: 'userName' },
                { data: 'ipAddress', defaultContent: '-' },
                {
                    data: 'changes', defaultContent: '-', render: function (d) {
                        if (!d) return '-';
                        if (d.length > 80) return '<span title="' + $('<span>').text(d).html() + '">' + $('<span>').text(d.substring(0, 80)).html() + '...</span>';
                        return $('<span>').text(d).html();
                    }
                }
            ]
        });
    }).fail(function () {
        toastr.error('Failed to load audit logs');
    });
}
