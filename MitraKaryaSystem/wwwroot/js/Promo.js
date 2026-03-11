$(document).ready(function () { PromoPage.init(); });

const PromoPage = {
    fmt(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); },
    dt: null,

    init() {
        this.loadList();
        this.loadDropdowns();
        this.bindEvents();
    },

    bindEvents() {
        $('#btnNewPromo').on('click', () => this.resetForm());
        $('#btnSavePromo').on('click', () => this.save());
        $('#promoApplyTo').on('change', function () {
            const v = $(this).val();
            $('#promoCategoryWrap').toggleClass('d-none', v !== 'Category');
            $('#promoProductWrap').toggleClass('d-none', v !== 'Product');
        });
    },

    async loadDropdowns() {
        try {
            const cats = await Common.Api.get('/Promo/GetCategories');
            const $cat = $('#promoCategory').empty();
            const arr = Array.isArray(cats) ? cats : (cats && cats.result ? cats.result : []);
            arr.forEach(c => $cat.append(`<option value="${c.id || c.ID}">${c.categoryName || c.name || c.Name}</option>`));
        } catch (_) {}
        try {
            const prods = await Common.Api.get('/Promo/GetProducts');
            const $prod = $('#promoProduct').empty();
            const arr = Array.isArray(prods) ? prods : (prods && prods.result ? prods.result : []);
            arr.forEach(p => $prod.append(`<option value="${p.id || p.ID}">${p.name || p.Name}</option>`));
        } catch (_) {}
    },

    async loadList() {
        try {
            const list = await Common.Api.get('/Promo/GetList');
            const arr = Array.isArray(list) ? list : [];
            if (this.dt) { this.dt.clear().destroy(); }
            this.dt = $('#tablePromo').DataTable({
                data: arr,
                deferRender: true, destroy: true, searching: true,
                order: [[0, 'asc']],
                columns: [
                    { data: 'name', render: d => `<span class="fw-semibold">${d}</span>` },
                    { data: 'discountPct', className: 'text-center', render: d => `<span class="badge text-bg-success fs-6">-${d}%</span>` },
                    { data: null, render: (_, __, row) => `${Common.Format.Datetime(row.startDate)}<br><small class="text-muted">to ${Common.Format.Datetime(row.endDate)}</small>` },
                    { data: 'applyTo' },
                    { data: 'targetName' },
                    { data: 'status', className: 'text-center', render: d => {
                        const cls = d === 'Active' ? 'text-bg-success' : d === 'Scheduled' ? 'text-bg-info' : d === 'Expired' ? 'text-bg-secondary' : 'text-bg-warning';
                        return `<span class="badge ${cls}">${d}</span>`;
                    }},
                    { data: 'createdBy' },
                    { data: null, orderable: false, className: 'text-center', render: (_, __, row) => {
                        let html = `<button class="btn btn-sm btn-outline-primary me-1 promo-edit" data-id="${row.id}" title="Edit"><i class="fa fa-pen-to-square"></i></button>`;
                        if (row.isActive && row.status === 'Active') {
                            html += `<button class="btn btn-sm btn-outline-success me-1 promo-apply" data-id="${row.id}" title="Apply to Products"><i class="fa fa-check"></i></button>`;
                            html += `<button class="btn btn-sm btn-outline-warning me-1 promo-deactivate" data-id="${row.id}" title="Deactivate"><i class="fa fa-pause"></i></button>`;
                        }
                        html += `<button class="btn btn-sm btn-outline-danger promo-delete" data-id="${row.id}" title="Delete"><i class="fa fa-trash"></i></button>`;
                        return html;
                    }}
                ]
            });

            $('#tablePromo').off('click', '.promo-edit').on('click', '.promo-edit', function () { PromoPage.edit($(this).data('id')); });
            $('#tablePromo').off('click', '.promo-delete').on('click', '.promo-delete', function () { PromoPage.remove($(this).data('id')); });
            $('#tablePromo').off('click', '.promo-apply').on('click', '.promo-apply', function () { PromoPage.apply($(this).data('id')); });
            $('#tablePromo').off('click', '.promo-deactivate').on('click', '.promo-deactivate', function () { PromoPage.deactivate($(this).data('id')); });
        } catch (e) { toastr.error('Failed to load promos'); }
    },

    resetForm() {
        $('#promoId').val(0);
        $('#promoModalTitle').text('New Promo');
        $('#promoName').val('');
        $('#promoDiscount').val('');
        const now = new Date();
        $('#promoStart').val(now.toISOString().slice(0, 10));
        $('#promoEnd').val(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10));
        $('#promoApplyTo').val('All').trigger('change');
        $('#promoActive').prop('checked', true);
    },

    async edit(id) {
        try {
            const p = await Common.Api.get('/Promo/Get?id=' + id);
            if (!p) { toastr.error('Not found'); return; }
            $('#promoId').val(p.id);
            $('#promoModalTitle').text('Edit Promo');
            $('#promoName').val(p.name);
            $('#promoDiscount').val(p.discountPct);
            $('#promoStart').val(p.startDate ? p.startDate.slice(0, 10) : '');
            $('#promoEnd').val(p.endDate ? p.endDate.slice(0, 10) : '');
            $('#promoApplyTo').val(p.applyTo).trigger('change');
            if (p.categoryId) $('#promoCategory').val(p.categoryId);
            if (p.productId) $('#promoProduct').val(p.productId);
            $('#promoActive').prop('checked', p.isActive);
            new bootstrap.Modal(document.getElementById('promoModal')).show();
        } catch (e) { toastr.error('Failed'); }
    },

    async save() {
        const applyTo = $('#promoApplyTo').val();
        const data = {
            Id: parseInt($('#promoId').val()) || 0,
            Name: $('#promoName').val(),
            DiscountPct: parseFloat($('#promoDiscount').val()) || 0,
            StartDate: $('#promoStart').val(),
            EndDate: $('#promoEnd').val(),
            ApplyTo: applyTo,
            IsActive: $('#promoActive').is(':checked')
        };
        // Only include CategoryId/ProductId when relevant (avoid sending "null" string)
        if (applyTo === 'Category') {
            const catVal = parseInt($('#promoCategory').val());
            if (!isNaN(catVal) && catVal > 0) data.CategoryId = catVal;
        } else if (applyTo === 'Product') {
            const prodVal = parseInt($('#promoProduct').val());
            if (!isNaN(prodVal) && prodVal > 0) data.ProductId = prodVal;
        }
        try {
            const r = await Common.Api.post('/Promo/Save', data);
            if (r && r.success) {
                toastr.success('Saved');
                bootstrap.Modal.getInstance(document.getElementById('promoModal'))?.hide();
                this.loadList();
            } else {
                toastr.error(r?.result || 'Failed');
            }
        } catch (e) { toastr.error('Failed to save'); }
    },

    async remove(id) {
        const result = await Swal.fire({ title: 'Delete promo?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc3545' });
        if (!result.isConfirmed) return;
        try {
            const r = await Common.Api.post('/Promo/Delete', { id });
            if (r && r.success) { toastr.success('Deleted'); this.loadList(); }
            else toastr.error(r?.result || 'Failed');
        } catch (e) { toastr.error('Failed'); }
    },

    async apply(id) {
        const result = await Swal.fire({ title: 'Apply promo discounts to products?', text: 'This will update product discount percentages.', icon: 'question', showCancelButton: true, confirmButtonText: 'Apply' });
        if (!result.isConfirmed) return;
        try {
            const r = await Common.Api.post('/Promo/Apply', { id });
            if (r && r.success) { toastr.success(r.result || 'Applied'); this.loadList(); }
            else toastr.error(r?.result || 'Failed');
        } catch (e) { toastr.error('Failed'); }
    },

    async deactivate(id) {
        const result = await Swal.fire({ title: 'Deactivate promo?', text: 'This will remove discounts from affected products.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Deactivate', confirmButtonColor: '#f59e0b' });
        if (!result.isConfirmed) return;
        try {
            const r = await Common.Api.post('/Promo/Deactivate', { id });
            if (r && r.success) { toastr.success('Deactivated'); this.loadList(); }
            else toastr.error(r?.result || 'Failed');
        } catch (e) { toastr.error('Failed'); }
    }
};
