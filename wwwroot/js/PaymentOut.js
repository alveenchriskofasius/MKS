$(function(){
    var paymentOutModalEl = document.getElementById('paymentOutModal');
    var paymentOutModal = null;
    if (paymentOutModalEl) paymentOutModal = new bootstrap.Modal(paymentOutModalEl, { backdrop: 'static', keyboard: false });

    $('#poMethod').on('change', function(){
        var m = $(this).val();
        if(m === 'Transfer') $('#poReferenceWrap').show(); else $('#poReferenceWrap').hide();
    });

    $('input[name="poType"]').on('change', function(){
        var t = $('input[name="poType"]:checked').val();
        if(t === 'Deposit') {
            $('#poDepositBalanceWrap').show();
            var supplierId = $('#poSupplierId').val();
            if(supplierId) {
                $.get('/PaymentOut/GetDepositBalance?supplierId=' + supplierId, function(res){
                    // endpoint returns numeric value
                    var val = 0;
                    if (res !== null && res !== undefined) {
                        // if response is object { success:..., message:..., id:... } fallback
                        if (typeof res === 'number') val = res;
                        else if (!isNaN(parseFloat(res))) val = parseFloat(res);
                    }
                    $('#poDepositBalance').text('Rp ' + Number(val).toFixed(2));
                });
            }
        } else {
            $('#poDepositBalanceWrap').hide();
        }
    });

    $('#btnSavePaymentOut').on('click', function(){
        var req = {
            Date: $('#poDate').val(),
            SupplierID: parseInt($('#poSupplierId').val()||0) || null,
            PurchaseOrderID: parseInt($('#poPurchaseOrderId').val()||0) || null,
            Method: $('#poMethod').val(),
            Type: $('input[name="poType"]:checked').val(),
            Amount: parseFloat($('#poAmount').val()||0),
            Note: $('#poNote').val(),
            ReferenceNo: $('#poReferenceNo').val(),
            Submit: true
        };
        $.ajax({ url: '/PaymentOut/Create', method: 'POST', contentType: 'application/json', data: JSON.stringify(req) })
            .done(function(res){ if(res && res.success) { Swal.fire('Success','Payment saved','success'); if(paymentOutModal) paymentOutModal.hide(); $('#paymentOutModal').on('hidden.bs.modal', function(){ location.reload(); }); } else { Swal.fire('Error', res.message || 'Save failed', 'error'); } })
            .fail(function(){ Swal.fire('Error','Save failed','error'); });
    });

    // Expose show function for external callers (e.g., from Razor page list)
    window.showPaymentOutModal = function(supplierId, supplierName, defaultDate, purchaseOrder){
        $('#poSupplierId').val(supplierId || '');
        $('#poSupplierName').text(supplierName || '-');
        $('#poDate').val(defaultDate || new Date().toISOString().substr(0,10));
        $('#poPurchaseOrderId').val(purchaseOrder ? (purchaseOrder.id || purchaseOrder.ID || '') : '');
        // reset fields
        $('#poMethod').val('Cash');
        $('input[name="poType"][value="Payment"]').prop('checked', true).trigger('change');
        $('#poReferenceNo').val('');
        $('#poAmount').val('');
        $('#poNote').val('');

        // If purchase order provided, populate default amount as remaining
        if(purchaseOrder) {
            var remaining = (Number(purchaseOrder.amount) || 0) - (Number(purchaseOrder.paidAmount) || 0);
            $('#poAmount').val((remaining>0?remaining:0).toFixed(2));
        }

        if(paymentOutModal) paymentOutModal.show();
    };
});
