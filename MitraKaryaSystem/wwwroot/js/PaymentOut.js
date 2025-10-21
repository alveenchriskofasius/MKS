(function () {
    'use strict';

    function parseNullableInt(val) {
        return (val === undefined || val === null || val === '') ? null : Number(val);
    }

    async function getDepositBalance(supplierId) {
        try {
            const resp = await fetch(`/PaymentOut/GetDepositBalance?supplierId=${supplierId}`);
            if (!resp.ok) return 0;
            const j = await resp.json();
            return Number(j || 0);
        } catch (ex) {
            return 0;
        }
    }

    async function getPODetailsTotal(purchaseOrderId) {
        try {
            const resp = await fetch(`/PurchaseOrder/GetDetailListById?id=${purchaseOrderId}`);
            if (!resp.ok) return null;
            const j = await resp.json();
            const list = (j && j.result && Array.isArray(j.result)) ? j.result : (Array.isArray(j) ? j : []);
            let total = 0;
            list.forEach(d => {
                const sub = d.subTotal ?? d.SubTotal ?? ((d.unitPrice || d.UnitPrice || 0) * (d.quantity || d.Quantity || 0));
                total += Number(sub || 0);
            });
            return total;
        } catch (ex) {
            return null;
        }
    }

    async function getPaidForPO(purchaseOrderId) {
        try {
            const resp = await fetch(`/PaymentOut/RelatedByPO?purchaseOrderId=${purchaseOrderId}`);
            if (!resp.ok) return 0;
            const j = await resp.json();
            const list = (j && j.result && Array.isArray(j.result)) ? j.result : (Array.isArray(j) ? j : []);
            let paid = 0;
            list.forEach(p => {
                if ((p.statusID || p.StatusID) == 2) paid += Number(p.amount || p.Amount || 0);
            });
            return paid;
        } catch (ex) {
            return 0;
        }
    }

    function readAmountFromInput($input) {
        const raw = ($input.val() || '').toString().replace(/,/g, '').trim();
        const v = parseFloat(raw);
        return isNaN(v) ? 0 : v;
    }

    function getPoTotalFallback() {
        const d = $('#paymentOutModal').data('poTotal');
        if (d != null) return Number(d);
        const txt = $('#poTotal').text();
        if (txt) return Number(txt.replace(/,/g, '').trim()) || null;
        return null;
    }

    // Bind to purchaseorder:saved so modal can be prefilled
    $(document).off('purchaseorder:saved').on('purchaseorder:saved', function (e, payload) {
        try {
            if (!payload) return;
            if (payload.supplierID) {
                $('#selectSupplier').val(payload.supplierID.toString());
            }
            if (payload.id) {
                $('#selectSupplier').trigger('change');
                setTimeout(function () { $('#selectPO').val(payload.id.toString()); }, 600);
            }
            window.lastSavedPO = payload;
            $(document).trigger('purchaseorder:refreshed', payload);
        } catch (ex) { console.warn('purchaseorder:saved handler failed', ex); }
    });

    $(document).off('purchaseorder:saved:internal').on('purchaseorder:saved:internal', function () { /* reserved */ });

    window.showPaymentOutModal = async function (supplierId, supplierName, defaultDate, purchaseOrderId) {
        try {
            const last = window.lastSavedPO || null;
            if (last && last.id && (!purchaseOrderId || purchaseOrderId == 0)) {
                purchaseOrderId = last.id;
                supplierId = supplierId || last.supplierID;
                supplierName = supplierName || last.supplierName;
            }

            $('#paymentOutModal').removeData('poTotal').removeData('poOutstanding');

            if (purchaseOrderId) {
                try {
                    const poResp = await fetch(`/PurchaseOrder/Get?id=${purchaseOrderId}`);
                    if (poResp.ok) {
                        const po = await poResp.json();
                        supplierId = supplierId || (po && (po.supplierID || po.SupplierID || po.SupplierId));
                        supplierName = supplierName || (po && (po.supplierName || po.SupplierName || ''));

                        const poTotalFromHeader = po && (po.amount || po.Amount) ? Number(po.amount || po.Amount) : null;
                        const total = await getPODetailsTotal(purchaseOrderId);
                        const paid = await getPaidForPO(purchaseOrderId);
                        const totalVal = total !== null ? total : poTotalFromHeader;
                        const outstanding = totalVal != null ? Math.max(0, Number(totalVal) - Number(paid || 0)) : null;

                        if (totalVal != null) $('#paymentOutModal').data('poTotal', Number(totalVal));
                        if (outstanding != null) {
                            $('#paymentOutModal').data('poOutstanding', Number(outstanding));
                            $('#poAmount').val(outstanding.toFixed(2));
                        } else if (poTotalFromHeader != null) {
                            $('#paymentOutModal').data('poOutstanding', Number(poTotalFromHeader));
                        }

                        const currentAmount = readAmountFromInput($('#poAmount'));
                        const cmpTotal = getPoTotalFallback();
                        if (cmpTotal != null) {
                            const eps = 0.005;
                            if (Math.abs(currentAmount - Number(cmpTotal)) <= eps) {
                                $('input[name="poType"][value="Payment"]').prop('checked', true);
                            } else {
                                $('input[name="poType"][value="Deposit"]').prop('checked', true);
                            }
                        }
                    }
                } catch (err) { console.warn('Failed fetch PO header', err); }
            }

            $('#poSupplierName').text(supplierName || '-');
            $('#poSupplierId').val(supplierId || '');
            $('#poPurchaseOrderId').val(purchaseOrderId || '');
            $('#poDate').val(defaultDate || new Date().toISOString().slice(0, 10));
            $('#poMethod').val('Cash');
            $('input[name="poType"][value="Payment"]').prop('checked', true);
            $('#poReferenceNo').val('');
            if (!purchaseOrderId) $('#poAmount').val('0.00');
            $('#poNote').val('');

            $('#poReferenceWrap').hide();
            $('#poDepositBalanceWrap').hide();

            $('#paymentOutModal').modal('show');
            try { toggleTypeByAmount(); } catch (ignore) { }
        } catch (ex) {
            toastr.error('Failed open payment dialog');
        }
    };

    $(document).off('change', '#poMethod').on('change', '#poMethod', async function () {
        const m = ($(this).val() || '').toString();
        if (m.toLowerCase() === 'transfer') {
            $('#poReferenceWrap').show();
            $('#poDepositBalanceWrap').hide();
        } else if (m.toLowerCase() === 'deposit') {
            $('#poReferenceWrap').hide();
            $('#poDepositBalanceWrap').show();
            const supplierId = parseNullableInt($('#poSupplierId').val());
            if (supplierId) {
                const bal = await getDepositBalance(supplierId);
                $('#poDepositBalance').text(bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            } else {
                $('#poDepositBalance').text('0.00');
            }
        } else {
            $('#poReferenceWrap').hide();
            $('#poDepositBalanceWrap').hide();
        }
    });

    function toggleTypeByAmount() {
        try {
            const cmpTotal = getPoTotalFallback();
            if (cmpTotal == null) return;
            const val = readAmountFromInput($('#poAmount'));
            const eps = 0.005;
            if (Math.abs(val - Number(cmpTotal)) <= eps) {
                $('input[name="poType"][value="Payment"]').prop('checked', true);
            } else {
                $('input[name="poType"][value="Deposit"]').prop('checked', true);
            }
        } catch (ex) { console.warn('poAmount change handler failed', ex); }
    }

    $(document).off('input change blur', '#poAmount').on('input change blur', '#poAmount', toggleTypeByAmount);

    $(document).off('click', '#btnSavePaymentOut').on('click', '#btnSavePaymentOut', async function (e) {
        e.preventDefault();
        const btn = $(this);
        btn.prop('disabled', true);
        const payload = {
            date: $('#poDate').val(),
            supplierID: parseNullableInt($('#poSupplierId').val()),
            purchaseOrderID: parseNullableInt($('#poPurchaseOrderId').val()),
            method: ($('#poMethod').val() || '').toString(),
            // fixed selector: correctly get the checked radio input value
            type: $('input[name="poType"]:checked').val() || '',
            amount: Number(($('#poAmount').val() || '0').toString().replace(/,/g, '')),
            note: $('#poNote').val(),
            submit: true,
            referenceNo: $('#poReferenceNo').val()
        };

        try {
            const res = await fetch('/PaymentOut/Create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const j = await res.json();
            if (j && (j.success === true || j.success === 'true')) {
                toastr.success('Payment saved');
                $('#paymentOutModal').modal('hide');
                // notify listeners, include purchaseOrderID so PO page can refresh
                $(document).trigger('paymentout:saved', { paymentId: j.id, purchaseOrderID: payload.purchaseOrderID, result: j });
            } else {
                toastr.error(j.message || j.result || 'Failed to save payment');
            }
        } catch (err) {
            console.error('PaymentOut save failed', err);
            toastr.error('Network error');
        } finally {
            btn.prop('disabled', false);
        }
    });

    $(document).off('purchaseorder:refreshed').on('purchaseorder:refreshed', function (e, payload) {
        try {
            if ($('#purchaseOrderID').length && Number(payload && payload.id) === Number($('#purchaseOrderID').val())) {
                POControl.LoadForm(Number(payload.id));
                POControl.LoadDetails(Number(payload.id));
            }
        } catch (ex) { }
    });

})();
