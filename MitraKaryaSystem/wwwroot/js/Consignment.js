$(document).ready(function () { ConPage.init(); });

const ConStatus = { 1: 'Active', 2: 'Settled', 3: 'Returned' };
const ConStatusClass = { 1: 'bg-success', 2: 'bg-secondary', 3: 'bg-warning' };

const ConPage = {
    currentId: null,
    allItems: [],
    statusFilter: 'all',
    products: [],

    init() {
        this.loadList();
        this.loadSuppliers();
        this.loadProducts();
        this.bindEvents();
    },

    fmt(n) { return Number(n || 0).toLocaleString('id-ID'); },

    bindEvents() {
        $('#btnNewConsignment').on('click', () => this.openNewModal());
        $('#btnSaveCon').on('click', () => this.saveCon());
        $('#btnAddItem').on('click', () => this.saveItem());
        $('#btnRecord').on('click', () => this.confirmRecord());
        $('#conSearch').on('input', () => this.renderList());
        $(document).on('click', '.con-status-filter', function () {
            $('.con-status-filter').removeClass('active btn-primary btn-success btn-secondary')
                .addClass(function () { return 'btn-outline-' + ($(this).data('status') === 'all' ? 'primary' : $(this).data('status') == 1 ? 'success' : 'secondary'); });
            $(this).addClass('active').removeClass('btn-outline-primary btn-outline-success btn-outline-secondary')
                .addClass($(this).data('status') === 'all' ? 'btn-primary' : $(this).data('status') == 1 ? 'btn-success' : 'btn-secondary');
            ConPage.statusFilter = $(this).data('status');
            ConPage.renderList();
        });
    },

    async loadSuppliers() {
        try {
            const list = await Common.Api.get('/Consignment/GetSuppliers');
            const $s = $('#conSupplier').find('option:not(:first)').remove().end();
            (Array.isArray(list) ? list : []).forEach(s => $s.append(`<option value="${s.id || s.ID}">${s.supplierName || s.SupplierName}</option>`));
        } catch (e) { console.error(e); }
    },

    async loadProducts() {
        try {
            const list = await Common.Api.get('/Product/FillGrid');
            this.products = Array.isArray(list) ? list : (list && list.result ? list.result : []);
            const $p = $('#itemProduct').find('option:not(:first)').remove().end();
            this.products.forEach(p => $p.append(`<option value="${p.id || p.ID}" data-price="${p.unitPrice || p.UnitPrice || 0}">${p.name || p.Name}</option>`));
            $('#noProductHint').toggle(this.products.length === 0);
            // auto-fill sell price on select
            $('#itemProduct').off('change').on('change', function () {
                const price = $(this).find(':selected').data('price') || 0;
                $('#itemSellPrice').val(price);
            });
        } catch (e) { console.error(e); }
    },

    async loadList() {
        try {
            const list = await Common.Api.get('/Consignment/GetList');
            this.allItems = Array.isArray(list) ? list : [];
            this.renderList();
        } catch (e) { toastr.error(e.message || 'Failed'); }
    },

    renderList() {
        const q = ($('#conSearch').val() || '').toLowerCase();
        let list = this.allItems;
        if (this.statusFilter !== 'all') list = list.filter(c => c.statusID == this.statusFilter);
        if (q) list = list.filter(c => (c.no || '').toLowerCase().includes(q) || (c.supplierName || '').toLowerCase().includes(q) || (c.salesPersonName || '').toLowerCase().includes(q));

        const $ul = $('#conList').empty();
        if (!list.length) {
            $ul.html('<li class="text-center text-muted py-4"><small>No consignments found</small></li>');
            return;
        }
        list.forEach(c => {
            const isActive = c.id === this.currentId;
            const statusBadge = `<span class="badge ${ConStatusClass[c.statusID] || 'bg-secondary'}" style="font-size:.65rem">${ConStatus[c.statusID] || '?'}</span>`;
            const pct = c.totalItems > 0 ? Math.round((c.soldItems / c.totalItems) * 100) : 0;
            $ul.append(`
                <li class="cust-list-item${isActive ? ' active' : ''}" data-id="${c.id}">
                    <div class="cust-avatar" style="background:${c.statusID === 1 ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#6b7280,#9ca3af)'}; color:#fff; font-size:.7rem">${c.statusID === 1 ? '<i class="fa fa-box-open"></i>' : '<i class="fa fa-check"></i>'}</div>
                    <div class="cust-info" style="min-width:0">
                        <div class="cust-name text-truncate">${c.no} ${statusBadge}</div>
                        <div class="cust-detail text-truncate">${c.supplierName} · ${c.salesPersonName || '-'}</div>
                        <div class="progress mt-1" style="height:3px"><div class="progress-bar bg-success" style="width:${pct}%"></div></div>
                    </div>
                </li>`);
        });
        $ul.off('click', '.cust-list-item').on('click', '.cust-list-item', function () {
            ConPage.loadDetail($(this).data('id'));
        });
    },

    async loadDetail(id) {
        this.currentId = id;
        $('.cust-list-item').removeClass('active');
        $(`.cust-list-item[data-id="${id}"]`).addClass('active');
        try {
            const c = await Common.Api.get('/Consignment/Get?id=' + id);
            if (!c || !c.id) { toastr.error('Not found'); return; }
            const items = c.items || [];
            const totalQty = items.reduce((s, i) => s + i.quantity, 0);
            const soldQty = items.reduce((s, i) => s + i.soldQuantity, 0);
            const returnedQty = items.reduce((s, i) => s + i.returnedQuantity, 0);
            const remainingQty = totalQty - soldQty - returnedQty;
            const profit = items.reduce((s, i) => s + (i.sellingPrice - i.unitPrice) * i.soldQuantity, 0);
            const totalValue = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
            const soldValue = items.reduce((s, i) => s + i.unitPrice * i.soldQuantity, 0);
            const pct = totalQty > 0 ? Math.round((soldQty / totalQty) * 100) : 0;
            const isActive = c.statusID === 1;

            let html = `
            <div class="d-flex align-items-center justify-content-between mb-3">
                <div>
                    <h6 class="mb-0 fw-bold"><i class="fa fa-handshake me-2 text-primary"></i>${c.no}
                        <span class="badge ${ConStatusClass[c.statusID]} ms-2">${ConStatus[c.statusID]}</span>
                    </h6>
                    <small class="text-muted">${c.date ? Common.Format.Date(c.date) : ''}</small>
                </div>
                <div class="d-flex gap-2">
                    ${isActive ? `<button class="btn btn-sm btn-outline-primary" onclick="ConPage.editCon(${c.id})"><i class="fa fa-pen me-1"></i>Edit</button>` : ''}
                    ${isActive ? `<button class="btn btn-sm btn-outline-danger" onclick="ConPage.deleteCon(${c.id})"><i class="fa fa-trash me-1"></i>Delete</button>` : ''}
                </div>
            </div>

            <!-- Info Cards -->
            <div class="row g-2 mb-3">
                <div class="col-6 col-md-3">
                    <div class="card border-0 shadow-sm text-center py-2">
                        <div class="text-muted small">Supplier</div>
                        <div class="fw-bold text-truncate px-2" id="conDetailSupplier">${c.supplierName || '-'}</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card border-0 shadow-sm text-center py-2">
                        <div class="text-muted small">Sales Person</div>
                        <div class="fw-bold text-truncate px-2">${c.salesPersonName || '-'}</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card border-0 shadow-sm text-center py-2">
                        <div class="text-muted small">Total Value</div>
                        <div class="fw-bold text-primary">Rp ${this.fmt(totalValue)}</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card border-0 shadow-sm text-center py-2">
                        <div class="text-muted small">Profit</div>
                        <div class="fw-bold text-success">Rp ${this.fmt(profit)}</div>
                    </div>
                </div>
            </div>

            <!-- Progress -->
            <div class="card border-0 shadow-sm mb-3">
                <div class="card-body py-2">
                    <div class="d-flex justify-content-between small mb-1">
                        <span><i class="fa fa-boxes-stacked me-1 text-primary"></i>Total: <b>${totalQty}</b></span>
                        <span class="text-success"><i class="fa fa-check me-1"></i>Sold: <b>${soldQty}</b></span>
                        <span class="text-warning"><i class="fa fa-rotate-left me-1"></i>Returned: <b>${returnedQty}</b></span>
                        <span class="text-muted"><i class="fa fa-clock me-1"></i>Remaining: <b>${remainingQty}</b></span>
                    </div>
                    <div class="progress" style="height:8px;border-radius:4px">
                        <div class="progress-bar bg-success" style="width:${totalQty > 0 ? (soldQty/totalQty*100) : 0}%" title="Sold"></div>
                        <div class="progress-bar bg-warning" style="width:${totalQty > 0 ? (returnedQty/totalQty*100) : 0}%" title="Returned"></div>
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <div class="d-flex align-items-center justify-content-between mb-2">
                <span class="fw-semibold"><i class="fa fa-list me-1 text-muted"></i>Items</span>
                ${isActive ? `<button class="btn btn-sm btn-success" onclick="ConPage.openAddItem(${c.id})"><i class="fa fa-plus me-1"></i>Add Item</button>` : ''}
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-hover align-middle">
                    <thead class="table-light">
                        <tr>
                            <th>Product</th>
                            <th class="text-center">Qty</th>
                            <th class="text-center">Sold</th>
                            <th class="text-center">Returned</th>
                            <th class="text-center">Remaining</th>
                            <th class="text-end">Buy</th>
                            <th class="text-end">Sell</th>
                            <th class="text-end">Profit</th>
                            ${isActive ? '<th class="text-center">Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>`;

            if (!items.length) {
                html += `<tr><td colspan="${isActive ? 9 : 8}" class="text-center text-muted py-3">No items yet</td></tr>`;
            } else {
                items.forEach(i => {
                    const rem = i.quantity - i.soldQuantity - i.returnedQuantity;
                    const itemProfit = (i.sellingPrice - i.unitPrice) * i.soldQuantity;
                    const itemPct = i.quantity > 0 ? Math.round((i.soldQuantity / i.quantity) * 100) : 0;
                    html += `<tr>
                        <td>
                            <div class="fw-semibold">${i.productName}</div>
                            <div class="progress mt-1" style="height:3px"><div class="progress-bar bg-success" style="width:${itemPct}%"></div></div>
                        </td>
                        <td class="text-center">${i.quantity}</td>
                        <td class="text-center"><span class="badge bg-success">${i.soldQuantity}</span></td>
                        <td class="text-center"><span class="badge bg-warning text-dark">${i.returnedQuantity}</span></td>
                        <td class="text-center"><span class="badge ${rem > 0 ? 'bg-info' : 'bg-light text-dark'}">${rem}</span></td>
                        <td class="text-end">Rp ${this.fmt(i.unitPrice)}</td>
                        <td class="text-end">Rp ${this.fmt(i.sellingPrice)}</td>
                        <td class="text-end fw-semibold ${itemProfit > 0 ? 'text-success' : ''}">${itemProfit > 0 ? '+' : ''}Rp ${this.fmt(itemProfit)}</td>`;
                    if (isActive) {
                        html += `<td class="text-center text-nowrap">`;
                        if (rem > 0) {
                            html += `<button class="btn btn-sm btn-outline-success me-1" title="Record Sale" onclick="ConPage.openRecord(${i.id}, 'sale', ${rem})"><i class="fa fa-cart-plus"></i></button>`;
                            html += `<button class="btn btn-sm btn-outline-warning me-1" title="Record Return" onclick="ConPage.openRecord(${i.id}, 'return', ${rem})"><i class="fa fa-rotate-left"></i></button>`;
                        }
                        if (i.soldQuantity === 0 && i.returnedQuantity === 0) {
                            html += `<button class="btn btn-sm btn-outline-danger" title="Remove" onclick="ConPage.removeItem(${i.id})"><i class="fa fa-xmark"></i></button>`;
                        }
                        html += `</td>`;
                    }
                    html += `</tr>`;
                });
            }

            html += `</tbody></table></div>`;

            // Settlement button
            if (isActive && items.length > 0 && remainingQty === 0) {
                html += `<div class="d-flex justify-content-end mt-3 pt-3 border-top">
                    <button class="btn btn-primary" onclick="ConPage.settle(${c.id})">
                        <i class="fa fa-check-double me-1"></i>Settle Consignment
                    </button>
                </div>`;
            } else if (isActive && remainingQty > 0) {
                html += `<div class="text-muted small mt-3 pt-3 border-top text-end">
                    <i class="fa fa-info-circle me-1"></i>All items must be sold or returned before settling.
                </div>`;
            }

            if (c.note) {
                html += `<div class="mt-2"><small class="text-muted"><i class="fa fa-sticky-note me-1"></i>${c.note}</small></div>`;
            }

            $('#conDetailPanel').html(html);
        } catch (e) {
            toastr.error(e.message || 'Error loading detail');
        }
    },

    // ===== Consignment CRUD =====
    openNewModal() {
        $('#conID').val(0);
        $('#conDate').val(new Date().toISOString().slice(0, 10));
        $('#conSupplier').val('');
        $('#conSalesPerson').val('');
        $('#conNote').val('');
        $('#conModalTitle').html('<i class="fa fa-handshake me-2"></i>New Consignment');
        $('#conForm').removeClass('was-validated');
        new bootstrap.Modal(document.getElementById('conModal')).show();
    },

    async editCon(id) {
        const c = await Common.Api.get('/Consignment/Get?id=' + id);
        $('#conID').val(c.id);
        $('#conDate').val((c.date || '').toString().slice(0, 10));
        $('#conSupplier').val(c.supplierID);
        $('#conSalesPerson').val(c.salesPersonName);
        $('#conNote').val(c.note);
        $('#conModalTitle').html('<i class="fa fa-pen me-2"></i>Edit Consignment');
        new bootstrap.Modal(document.getElementById('conModal')).show();
    },

    async saveCon() {
        const form = document.getElementById('conForm');
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
        const data = {
            ID: parseInt($('#conID').val()) || 0,
            Date: $('#conDate').val(),
            SupplierID: parseInt($('#conSupplier').val()) || 0,
            SalesPersonName: $('#conSalesPerson').val(),
            Note: $('#conNote').val()
        };
        const $btn = $('#btnSaveCon');
        $btn.prop('disabled', true).find('.spinner-border').removeClass('d-none');
        try {
            const res = await Common.Api.post('/Consignment/Save', data);
            if (res && res.success) {
                toastr.success('Saved');
                bootstrap.Modal.getInstance(document.getElementById('conModal'))?.hide();
                await this.loadList();
                this.loadDetail(res.id);
            } else { toastr.error(res?.error || 'Failed'); }
        } catch (e) { toastr.error(e.message || 'Failed'); }
        finally { $btn.prop('disabled', false).find('.spinner-border').addClass('d-none'); }
    },

    deleteCon(id) {
        Swal.fire({
            title: 'Delete consignment?', text: "This can't be undone.", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Yes, delete',
            showLoaderOnConfirm: true,
            preConfirm: () => Common.Api.post('/Consignment/Delete', { id })
                .then(r => { if (r?.success) { toastr.success('Deleted'); this.currentId = null; this.resetPanel(); this.loadList(); } else Swal.showValidationMessage(r?.error || 'Failed'); })
                .catch(e => Swal.showValidationMessage(e.message || 'Failed'))
        });
    },

    // ===== Item Management =====
    openAddItem(conId) {
        $('#itemConID').val(conId);
        $('#itemProduct').val('');
        $('#itemQty').val(1);
        $('#itemBuyPrice').val('');
        $('#itemSellPrice').val('');
        $('#addItemForm').removeClass('was-validated');
        new bootstrap.Modal(document.getElementById('addItemModal')).show();
    },

    async saveItem() {
        const form = document.getElementById('addItemForm');
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
        const data = {
            ConsignmentID: parseInt($('#itemConID').val()),
            ProductID: parseInt($('#itemProduct').val()),
            Quantity: parseInt($('#itemQty').val()),
            UnitPrice: parseFloat($('#itemBuyPrice').val()) || 0,
            SellingPrice: parseFloat($('#itemSellPrice').val()) || 0
        };
        const $btn = $('#btnAddItem');
        $btn.prop('disabled', true).find('.spinner-border').removeClass('d-none');
        try {
            const res = await Common.Api.post('/Consignment/AddItem', data);
            if (res?.success) {
                toastr.success('Item added');
                bootstrap.Modal.getInstance(document.getElementById('addItemModal'))?.hide();
                this.loadDetail(data.ConsignmentID);
                this.loadList();
            } else { toastr.error(res?.error || 'Failed'); }
        } catch (e) { toastr.error(e.message || 'Failed'); }
        finally { $btn.prop('disabled', false).find('.spinner-border').addClass('d-none'); }
    },

    removeItem(itemId) {
        Swal.fire({
            title: 'Remove item?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Remove',
            showLoaderOnConfirm: true,
            preConfirm: () => Common.Api.post('/Consignment/RemoveItem', { itemId })
                .then(r => { if (r?.success) { toastr.success('Removed'); this.loadDetail(this.currentId); this.loadList(); } else Swal.showValidationMessage(r?.error || 'Failed'); })
                .catch(e => Swal.showValidationMessage(e.message || 'Failed'))
        });
    },

    // ===== Record Sale / Return =====
    openRecord(itemId, action, available) {
        $('#recordItemID').val(itemId);
        $('#recordAction').val(action);
        $('#recordAvailable').text(available);
        $('#recordQty').val(1).attr('max', available);
        if (action === 'sale') {
            $('#recordModalTitle').html('<i class="fa fa-cart-plus me-2"></i>Record Sale');
            $('#recordModalHeader').css('background', 'linear-gradient(135deg,#065f46,#10b981)');
            $('#btnRecord').removeClass('btn-warning').addClass('btn-success').html('<i class="fa fa-check me-1"></i>Record Sale');
        } else {
            $('#recordModalTitle').html('<i class="fa fa-rotate-left me-2"></i>Record Return');
            $('#recordModalHeader').css('background', 'linear-gradient(135deg,#92400e,#f59e0b)');
            $('#btnRecord').removeClass('btn-success').addClass('btn-warning').html('<i class="fa fa-rotate-left me-1"></i>Record Return');
        }
        new bootstrap.Modal(document.getElementById('recordModal')).show();
    },

    async confirmRecord() {
        const action = $('#recordAction').val();
        const data = {
            ConsignmentItemID: parseInt($('#recordItemID').val()),
            Quantity: parseInt($('#recordQty').val())
        };
        try {
            const url = action === 'sale' ? '/Consignment/RecordSale' : '/Consignment/RecordReturn';
            const res = await Common.Api.post(url, data);
            if (res?.success) {
                toastr.success(action === 'sale' ? 'Sale recorded' : 'Return recorded');
                bootstrap.Modal.getInstance(document.getElementById('recordModal'))?.hide();
                this.loadDetail(this.currentId);
                this.loadList();
            } else { toastr.error(res?.error || 'Failed'); }
        } catch (e) { toastr.error(e.message || 'Failed'); }
    },

    // ===== Settlement =====
    settle(id) {
        Swal.fire({
            title: 'Settle Consignment?',
            text: 'All items have been accounted for. Mark this consignment as settled?',
            icon: 'question', showCancelButton: true, confirmButtonText: 'Yes, settle',
            showLoaderOnConfirm: true,
            preConfirm: () => Common.Api.post('/Consignment/Settle', { id })
                .then(r => { if (r?.success) { toastr.success('Settled!'); this.loadDetail(id); this.loadList(); } else Swal.showValidationMessage(r?.error || 'Failed'); })
                .catch(e => Swal.showValidationMessage(e.message || 'Failed'))
        });
    },

    resetPanel() {
        $('#conDetailPanel').html('<div class="empty-state"><i class="fa fa-handshake"></i><p>Select a consignment or create a new one</p></div>');
    }
};
