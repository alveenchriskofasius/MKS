$(document).ready(() => PurchaseReturnPage.Init());

const PRStatus = { 1: 'Draft', 2: 'Submitted', 3: 'Approved', 4: 'Rejected' };
const PRStatusBadge = { 1: 'badge-draft', 2: 'badge-submitted', 3: 'badge-approved', 4: 'badge-rejected' };

function UpdatePRStatusBadge(statusID) {
    const $b = $('#prStatusBadge');
    const txt = PRStatus[statusID] || 'Draft';
    $b.text(txt).attr('class', 'badge-status ' + (PRStatusBadge[statusID] || 'badge-draft'));
    $('#prStatusID').val(statusID);
    // Update workflow bar
    $('#prWorkflowBar .wf-step').each(function () {
        const step = parseInt($(this).data('step'));
        $(this).removeClass('active done');
        if (statusID === 4) {
            if (step === 1) $(this).addClass('done');
        } else if (step < statusID) {
            $(this).addClass('done');
        } else if (step === statusID) {
            $(this).addClass('active');
        }
    });
    // Toggle action buttons
    const id = parseInt($('#prID').val() || '0', 10);
    const hasId = id > 0;
    const isLocked = statusID === 2 || statusID === 3;
    $('#prSubmit').toggleClass('d-none', !(hasId && (statusID === 1 || statusID === 4)));
    $('#prApprove').toggleClass('d-none', !(hasId && statusID === 2));
    $('#prReject').toggleClass('d-none', !(hasId && statusID === 2));
    // Lock editing when submitted or approved
    $('#prSave').prop('disabled', isLocked);
    $('#prProduct').prop('disabled', isLocked);
    $('#prPurchaseOrderID').prop('disabled', isLocked);
    if (isLocked) {
        $('#tablePurchaseReturnItems').find('input.pr-qty').prop('disabled', true);
        $('#tablePurchaseReturnItems').find('.pr-del').prop('disabled', true);
    } else {
        $('#tablePurchaseReturnItems').find('input.pr-qty').prop('disabled', false);
        $('#tablePurchaseReturnItems').find('.pr-del').prop('disabled', false);
    }
}

const PurchaseReturnPage = {
    _search: null,
    Init() {
        this.Bind();
        this.LoadForm(0);
        this.InitTable();
    },
    Bind() {
        $('#prNew').click(() => this.LoadForm(0));
        $('#prSave').click(() => this.Save());
        $('#prSearch').click(() => this.Search());
        $('#prPrint').click(() => {
            const id = parseInt($('#prID').val() || '0', 10);
            if (!id) { toastr.info('Save Purchase Return first'); return; }
            try { MksPrint.purchaseReturn(); } catch (e) { console.error('Print failed', e); toastr.error('Print failed'); }
        });
        $('#prSubmit').click(() => this.ChangeStatus('Submit'));
        $('#prApprove').click(() => this.ChangeStatus('Approve'));
        $('#prReject').click(async () => {
            const { value: reason } = await Swal.fire({ title: 'Reject Purchase Return', input: 'text', inputPlaceholder: 'Reason', showCancelButton: true });
            if (reason == null) return;
            this.ChangeStatus('Reject', reason);
        });
    },
    async ChangeStatus(action, reason) {
        const id = parseInt($('#prID').val() || '0', 10);
        if (!id) { toastr.info('Save Purchase Return first'); return; }
        const url = `/PurchaseReturn/${action}?id=${encodeURIComponent(id)}` + (reason ? `&reason=${encodeURIComponent(reason)}` : '');
        try {
            const res = await Common.Api.fetchJson(url, { method: 'POST' });
            if (res && res.success) {
                if (res.statusID) UpdatePRStatusBadge(res.statusID);
                toastr.success('Success');
            } else {
                toastr.error(res && (res.result || res.error) ? (res.result || res.error) : 'Failed');
            }
        } catch (e) { toastr.error(e && e.message ? e.message : 'Request failed'); }
    },
    LoadPOItems(poId) {
        const t = $('#tablePurchaseReturnItems').DataTable();
        if (!poId) { t.clear().draw(); this.RefreshTotal(); return; }
        $.get('/PurchaseReturn/GetPOItemsForReturn', { poId: poId }, res => {
            const list = Array.isArray(res) ? res : (res && res.result ? res.result : []);
            t.clear();
            t.rows.add(list);
            t.draw();
            this.RefreshTotal();
        }).fail(() => toastr.error('Failed to load PO items'));
    },
    LoadForm(id) {
        $('#prHeader').html('<div class="p-2 text-center"><div class="spinner-border spinner-border-sm"></div></div>');
        $.get('/PurchaseReturn/FillForm', { id: id || 0 }, html => {
            $('#prHeader').html(html);
            const statusID = parseInt($('#prFormStatusID').val() || '1', 10);
            UpdatePRStatusBadge(statusID);
            this.LoadApprovedPOs();
            this.LoadDetails(id);
        });
    },
    LoadApprovedPOs() {
        const savedID = $('#prFormPurchaseOrderID').val();
        $.get('/PurchaseReturn/GetApprovedPOsForReturn', function (data) {
            const list = Array.isArray(data) ? data : (data && data.result ? data.result : []);
            const $sel = $('#prPurchaseOrderID');
            $sel.empty().append('<option value="">-- Select Purchase Order --</option>');
            list.forEach(function (po) {
                $sel.append('<option value="' + po.id + '">' + po.no + ' – ' + po.supplierName + '</option>');
            });
            if (savedID && savedID !== '0') $sel.val(savedID);
        });
        $('#prPurchaseOrderID').off('change.poItems').on('change.poItems', () => {
            const poId = parseInt($('#prPurchaseOrderID').val() || '0', 10);
            const prId = parseInt($('#prID').val() || '0', 10);
            if (prId > 0) return;
            this.LoadPOItems(poId);
        });
    },
    InitTable() {
        $('#tablePurchaseReturnItems').DataTable({
            deferRender: true, processing: false, serverSide: false, destroy: true,
            searching: false, paging: false, info: false,
            columns: [
                { data: 'productID', visible: false },
                { data: 'variantID', visible: false, defaultContent: '' },
                {
                    data: 'product',
                    render: function (data, type, row) {
                        if (type !== 'display') return data;
                        var vn = row.variantName || row.VariantName;
                        return vn
                            ? (data + ' <span class="badge text-bg-secondary ms-1">' + $('<span>').text(vn).html() + '</span>')
                            : data;
                    }
                },
                { data: 'quantity', className: 'text-end', render: (d, t) => t === 'display' ? `<input type="number" class="form-control form-control-sm pr-qty" value="${d}" min="1" />` : d },
                { data: 'unitPrice', className: 'text-end', render: $.fn.dataTable.render.number(',', '.', 2) },
                { data: 'subTotal', className: 'text-end', render: $.fn.dataTable.render.number(',', '.', 2) },
                { data: null, orderable: false, render: () => `<button class='btn btn-sm btn-outline-danger pr-del'><i class='fa fa-trash'></i></button>` }
            ],
            data: []
        });
        const tbl = $('#tablePurchaseReturnItems');
        tbl.on('change', 'input.pr-qty', function () {
            const t = $('#tablePurchaseReturnItems').DataTable();
            const idx = t.cell($(this).closest('td')).index();
            if (!idx) return;
            const row = t.row(idx.row).data();
            let q = parseInt($(this).val(), 10);
            if (isNaN(q) || q < 1) q = 1;
            const maxStock = row.stockQuantity || 0;
            if (maxStock > 0 && q > maxStock) {
                q = maxStock;
                $(this).val(q);
                toastr.info('Quantity limited to available stock (' + maxStock + ')');
            }
            row.quantity = q;
            row.subTotal = row.unitPrice * q;
            t.row(idx.row).data(row).invalidate();
            PurchaseReturnPage.RefreshTotal();
        });
        tbl.on('click', '.pr-del', function () {
            const t = $('#tablePurchaseReturnItems').DataTable();
            const r = t.row($(this).closest('tr'));
            const d = r.data();
            if (d.id > 0) {
                Swal.fire({ title: 'Delete item?', icon: 'warning', showCancelButton: true }).then(rs => {
                    if (rs.isConfirmed) {
                        $.get('/PurchaseReturn/DeleteItem', { id: d.id }, res => {
                            if (res.success) { r.remove().draw(); PurchaseReturnPage.RefreshTotal(); }
                            else toastr.error(res.result || 'Delete failed');
                        });
                    }
                });
            } else { r.remove().draw(); PurchaseReturnPage.RefreshTotal(); }
        });
    },
    LoadDetails(id) {
        const t = $('#tablePurchaseReturnItems').DataTable();
        if (!id) { t.clear().draw(); this.RefreshTotal(); return; }
        $.get('/PurchaseReturn/GetDetailList', { id: id }, res => {
            const list = Array.isArray(res) ? res : (res && res.result ? res.result : []);
            t.clear();
            t.rows.add(list);
            t.draw();
            this.RefreshTotal();
        });
    },
    Collect() {
        const t = $('#tablePurchaseReturnItems').DataTable();
        const arr = [];
        t.rows().every(function () {
            const r = this.data();
            arr.push({
                ID: r.id || 0,
                ProductID: r.productID,
                VariantID: r.variantID || 0,
                Quantity: r.quantity,
                UnitPrice: r.unitPrice
            });
        });
        return arr;
    },
    Save() {
        const poID = parseInt($('#prPurchaseOrderID').val() || '0', 10);
        if (!poID) { toastr.warning('Please select a Purchase Order'); return; }
        const model = {
            ID: $('#prID').val(), Date: $('#prDate').val(), No: $('#prNo').val(),
            Note: $('#prNote').val(),
            PurchaseOrderID: poID,
            Details: this.Collect()
        };
        $('#prSave').prop('disabled', true);
        $('#prSave .spinner-border').removeClass('d-none');
        $.ajax({ url: '/PurchaseReturn/Save', type: 'POST', data: model })
            .done(res => {
                if (res.success) { toastr.success('Saved'); $('#prID').val(res.id); $('#prNo').val(res.no); UpdatePRStatusBadge(1); }
                else toastr.error(res.result || 'Save failed');
            })
            .fail(err => toastr.error(err.responseText || 'Error'))
            .always(() => { $('#prSave').prop('disabled', false); $('#prSave .spinner-border').addClass('d-none'); });
    },
    RefreshTotal() {
        const t = $('#tablePurchaseReturnItems').DataTable();
        let tot = 0;
        t.rows().every(function () { const r = this.data(); tot += (parseFloat(r.subTotal) || 0); });
        $('#prTotal').text(tot.toFixed(2));
    },
    Search() {
        const modal = new bootstrap.Modal(document.getElementById('prSearchModal'));
        modal.show();
        const tb = $('#tablePurchaseReturnSearch').DataTable({
            deferRender: true, destroy: true, searching: false,
            columns: [
                { data: 'no' },
                { data: 'date', render: d => Common.Format.Date(d) },
                { data: 'supplier' },
                { data: 'statusID', render: d => { const s = PRStatus[d] || 'Draft'; const cls = PRStatusBadge[d] || 'badge-draft'; return `<span class="badge-status ${cls}">${s}</span>`; } },
                { data: 'amount', className: 'text-end', render: $.fn.dataTable.render.number(',', '.', 2) },
                { data: null, orderable: false, render: () => `<div class="btn-group btn-group-sm"><button class='btn btn-outline-primary pr-edit'><i class='fa fa-edit'></i></button> <button class='btn btn-outline-danger pr-del2'><i class='fa fa-trash'></i></button></div>` }
            ]
        });
        $.get('/PurchaseReturn/GetSearchList', function (data) {
            const list = Array.isArray(data) ? data : (data && data.result ? data.result : []);
            tb.clear().rows.add(list).draw();
        });
        $('#tablePurchaseReturnSearch').off('click.edit').on('click.edit', '.pr-edit', function () {
            const row = tb.row($(this).closest('tr')).data();
            PurchaseReturnPage.LoadForm(row.id);
            modal.hide();
        });
        $('#tablePurchaseReturnSearch').off('click.del').on('click.del', '.pr-del2', function () {
            const row = tb.row($(this).closest('tr')).data();
            Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true }).then(r => {
                if (r.isConfirmed) {
                    $.get('/PurchaseReturn/Delete', { id: row.id }, res => {
                        if (res.success) { toastr.success('Deleted'); PurchaseReturnPage.LoadForm(0); PurchaseReturnPage.Search(); }
                        else toastr.error(res.result || 'Delete failed');
                    });
                }
            });
        });
    }
};
