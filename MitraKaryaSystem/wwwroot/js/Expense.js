$(document).ready(function () { ExpensePage.init(); });

const ExpensePage = {
    categoryIcons: {
        'BBM / Transportasi': 'fa-gas-pump',
        'Listrik & Air': 'fa-bolt',
        'Gaji Karyawan': 'fa-user-tie',
        'Sewa': 'fa-building',
        'Maintenance': 'fa-wrench',
        'Perlengkapan': 'fa-box',
        'Makan & Minum': 'fa-utensils',
        'Lainnya': 'fa-ellipsis'
    },
    categoryColors: {
        'BBM / Transportasi': '#f59e0b',
        'Listrik & Air': '#3b82f6',
        'Gaji Karyawan': '#8b5cf6',
        'Sewa': '#ec4899',
        'Maintenance': '#ef4444',
        'Perlengkapan': '#14b8a6',
        'Makan & Minum': '#f97316',
        'Lainnya': '#6b7280'
    },

    init() {
        const now = new Date();
        $('#filterFrom').val(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
        $('#filterTo').val(now.toISOString().slice(0, 10));
        $('#expenseDate').val(now.toISOString().slice(0, 10));
        this.loadList();
        this.loadSummary();
        this.bindEvents();
    },

    bindEvents() {
        $('#btnFilter').on('click', () => this.loadList());
        $('#btnReset').on('click', () => {
            const now = new Date();
            $('#filterFrom').val(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
            $('#filterTo').val(now.toISOString().slice(0, 10));
            $('#filterCategory').val('All');
            this.loadList();
        });
        $('#btnNewExpense').on('click', () => this.resetForm());
        $('#btnSaveExpense').on('click', () => this.save());
    },

    fmt(n) { return Number(n || 0).toLocaleString('id-ID'); },

    async loadSummary() {
        try {
            const s = await Common.Api.get('/Expense/Summary');
            $('#sumThisMonth').text('Rp ' + this.fmt(s.totalThisMonth));
            $('#sumLastMonth').text('Rp ' + this.fmt(s.totalLastMonth));
            const cats = s.byCategory || [];
            $('#sumCategories').text(cats.length);

            const $bd = $('#categoryBreakdown').empty();
            const total = cats.reduce((a, c) => a + c.total, 0) || 1;
            cats.forEach(c => {
                const pct = Math.round((c.total / total) * 100);
                const icon = this.categoryIcons[c.category] || 'fa-ellipsis';
                const color = this.categoryColors[c.category] || '#6b7280';
                $bd.append(`
                    <div class="col-md-3 col-6">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body py-2 px-3">
                                <div class="d-flex align-items-center gap-2 mb-1">
                                    <i class="fa ${icon}" style="color:${color}"></i>
                                    <span class="small fw-semibold text-truncate">${c.category}</span>
                                </div>
                                <div class="fw-bold" style="color:${color}">Rp ${this.fmt(c.total)}</div>
                                <div class="progress mt-1" style="height:4px">
                                    <div class="progress-bar" style="width:${pct}%;background:${color}"></div>
                                </div>
                                <div class="text-muted" style="font-size:.7rem">${c.count} transaction(s) · ${pct}%</div>
                            </div>
                        </div>
                    </div>`);
            });
        } catch (e) { console.error(e); }
    },

    async loadList() {
        try {
            const from = $('#filterFrom').val();
            const to = $('#filterTo').val();
            const cat = $('#filterCategory').val();
            const params = new URLSearchParams();
            if (from) params.append('from', from);
            if (to) params.append('to', to);
            if (cat && cat !== 'All') params.append('category', cat);
            const list = await Common.Api.get('/Expense/GetList?' + params.toString());
            const $tbody = $('#tableExpense tbody').empty();
            if (!list || !list.length) {
                $tbody.html('<tr><td colspan="7" class="text-center text-muted py-4">No expenses found</td></tr>');
                return;
            }
            list.forEach(e => {
                const icon = this.categoryIcons[e.category] || 'fa-ellipsis';
                const color = this.categoryColors[e.category] || '#6b7280';
                $tbody.append(`<tr>
                    <td><span class="fw-semibold text-primary">${e.no}</span></td>
                    <td>${e.date}</td>
                    <td><i class="fa ${icon} me-1" style="color:${color}"></i>${e.category}</td>
                    <td class="text-truncate" style="max-width:200px">${e.description || '-'}</td>
                    <td class="text-end fw-semibold">Rp ${this.fmt(e.amount)}</td>
                    <td><small class="text-muted">${e.createdBy || '-'}</small></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="ExpensePage.edit(${e.id})"><i class="fa fa-pen-to-square"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="ExpensePage.remove(${e.id})"><i class="fa fa-trash"></i></button>
                    </td>
                </tr>`);
            });
        } catch (e) {
            toastr.error(e.message || 'Failed to load');
        }
    },

    resetForm() {
        $('#expenseID').val(0);
        $('#expenseDate').val(new Date().toISOString().slice(0, 10));
        $('#expenseCategory').val('');
        $('#expenseDescription').val('');
        $('#expenseAmount').val('');
        $('#expenseModalTitle').html('<i class="fa fa-receipt me-2"></i>New Expense');
        $('#expenseForm').removeClass('was-validated');
    },

    async edit(id) {
        try {
            const e = await Common.Api.get('/Expense/Get?id=' + id);
            $('#expenseID').val(e.id || e.ID);
            $('#expenseDate').val((e.date || '').toString().slice(0, 10));
            $('#expenseCategory').val(e.category);
            $('#expenseDescription').val(e.description);
            $('#expenseAmount').val(e.amount);
            $('#expenseModalTitle').html('<i class="fa fa-pen-to-square me-2"></i>Edit Expense');
            const modal = new bootstrap.Modal(document.getElementById('expenseModal'));
            modal.show();
        } catch (e) { toastr.error(e.message || 'Error'); }
    },

    async save() {
        const form = document.getElementById('expenseForm');
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

        const data = {
            ID: parseInt($('#expenseID').val()) || 0,
            Date: $('#expenseDate').val(),
            Category: $('#expenseCategory').val(),
            Description: $('#expenseDescription').val(),
            Amount: parseFloat($('#expenseAmount').val()) || 0
        };

        const $btn = $('#btnSaveExpense');
        $btn.prop('disabled', true).find('.spinner-border').removeClass('d-none');
        try {
            const res = await Common.Api.post('/Expense/Save', data);
            if (res && res.success) {
                toastr.success('Expense saved');
                bootstrap.Modal.getInstance(document.getElementById('expenseModal'))?.hide();
                this.loadList();
                this.loadSummary();
            } else {
                toastr.error(res?.error || 'Save failed');
            }
        } catch (e) {
            toastr.error(e.message || 'Save failed');
        } finally {
            $btn.prop('disabled', false).find('.spinner-border').addClass('d-none');
        }
    },

    remove(id) {
        Swal.fire({
            title: 'Delete this expense?',
            text: "This can't be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Yes, delete',
            showLoaderOnConfirm: true,
            preConfirm: () => Common.Api.post('/Expense/Delete', { id })
                .then(r => {
                    if (r && r.success) { toastr.success('Deleted'); this.loadList(); this.loadSummary(); }
                    else Swal.showValidationMessage(r?.error || 'Failed');
                })
                .catch(e => Swal.showValidationMessage(e.message || 'Failed'))
        });
    }
};
