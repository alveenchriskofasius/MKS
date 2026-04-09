$(document).ready(function () { ComplaintPage.init(); });

const ComplaintPage = {
    table: null,
    allData: [],

    init() {
        this.initTable();
        this.loadData();
        this.bindEvents();
    },

    initTable() {
        this.table = $('#tableComplaint').DataTable({
            columns: [
                { data: 'orderNo' },
                { data: 'customerName' },
                {
                    data: 'reason',
                    render: function (d) {
                        var short = d.length > 60 ? d.substring(0, 60) + '...' : d;
                        return '<span title="' + $('<span>').text(d).html() + '">' +
                            $('<span>').text(short).html() + '</span>';
                    }
                },
                {
                    data: 'status',
                    render: function (d) {
                        return ComplaintPage.getStatusBadge(d);
                    }
                },
                {
                    data: 'createdAt',
                    render: function (d) {
                        return new Date(d).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        });
                    }
                },
                {
                    data: null,
                    className: 'text-center',
                    orderable: false,
                    render: function (d) {
                        return '<button class="btn btn-xs btn-info btn-detail" data-id="' + d.id + '">' +
                            '<i class="fa fa-eye"></i></button>';
                    }
                }
            ],
            order: [[4, 'desc']],
            pageLength: 15,
            language: { emptyTable: 'Belum ada komplain.' }
        });
    },

    getStatusBadge(status) {
        var map = {
            'Pending': 'badge bg-warning text-dark',
            'InProgress': 'badge bg-info',
            'Resolved': 'badge bg-success',
            'Rejected': 'badge bg-danger'
        };
        var labels = {
            'Pending': 'Pending',
            'InProgress': 'Diproses',
            'Resolved': 'Selesai',
            'Rejected': 'Ditolak'
        };
        var cls = map[status] || 'badge bg-secondary';
        var label = labels[status] || status;
        return '<span class="' + cls + '">' + label + '</span>';
    },

    async loadData() {
        try {
            var data = await Common.Api.get('/Complaint/GetAll');
            this.allData = data || [];
            this.applyFilter();
        } catch (e) {
            console.error('Failed loading complaints', e);
            toastr.error('Gagal memuat data komplain.');
        }
    },

    applyFilter() {
        var filter = $('#filterStatus').val();
        var filtered = this.allData;
        if (filter) {
            filtered = filtered.filter(function (c) { return c.status === filter; });
        }
        this.table.clear().rows.add(filtered).draw();
    },

    bindEvents() {
        var self = this;

        $('#btnRefresh').on('click', function () {
            self.loadData();
            $('#detailPanel').slideUp();
        });

        $('#filterStatus').on('change', function () {
            self.applyFilter();
        });

        $(document).on('click', '.btn-detail', function () {
            var id = $(this).data('id');
            self.showDetail(id);
        });

        $('#btnCloseDetail').on('click', function () {
            $('#detailPanel').slideUp();
        });

        $('#btnUpdateStatus').on('click', function () {
            self.updateStatus();
        });
    },

    async showDetail(id) {
        try {
            var detail = await Common.Api.get('/Complaint/GetDetail?id=' + id);
            if (!detail) {
                toastr.error('Komplain tidak ditemukan.');
                return;
            }

            var dateStr = new Date(detail.createdAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            $('#detComplaintId').val(detail.id);
            $('#detOrderNo').text(detail.orderNo);
            $('#detCustomer').text(detail.customerName);
            $('#detDate').text(dateStr);
            $('#detStatus').html(this.getStatusBadge(detail.status));
            $('#detReason').text(detail.reason);
            $('#detNewStatus').val(detail.status);
            $('#detAdminNote').val(detail.adminNote || '');

            $('#detailPanel').slideDown();
            $('html, body').animate({
                scrollTop: $('#detailPanel').offset().top - 80
            }, 300);
        } catch (e) {
            console.error('Failed loading detail', e);
            toastr.error('Gagal memuat detail komplain.');
        }
    },

    async updateStatus() {
        var id = parseInt($('#detComplaintId').val());
        var status = $('#detNewStatus').val();
        var adminNote = $('#detAdminNote').val().trim();

        try {
            var res = await Common.Api.post('/Complaint/UpdateStatus', {
                id: id,
                status: status,
                adminNote: adminNote
            });

            if (res.success) {
                toastr.success(res.message);
                this.loadData();
                $('#detailPanel').slideUp();
            } else {
                toastr.error(res.message);
            }
        } catch (e) {
            console.error('Update failed', e);
            toastr.error('Gagal memperbarui status.');
        }
    }
};
