/* ========================================================================
   MksPrint – Shared print utility for document printing
   Opens a new window with formatted print-ready content
   ======================================================================== */
const MksPrint = (function () {
    const companyName = 'Mitra Karya System';

    function buildStyles(theme) {
        var t = theme || {};
        var accent = t.accent || '#1e3a5f';
        var highlight = t.highlight || '#2563eb';
        return `
        <style>
            @page { margin: 15mm 12mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 0; }
            .print-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${accent}; padding-bottom: 10px; margin-bottom: 15px; }
            .print-header .company { font-size: 18px; font-weight: 700; color: ${accent}; }
            .print-header .doc-title { font-size: 16px; font-weight: 700; color: ${highlight}; text-align: right; }
            .print-header .doc-no { font-size: 11px; color: #666; }
            .print-info { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 15px; }
            .print-info .info-group { min-width: 180px; }
            .print-info .info-label { font-size: 10px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: .5px; }
            .print-info .info-value { font-size: 12px; font-weight: 500; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            th { background: #f0f4f8; color: #334155; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; padding: 6px 8px; border-bottom: 2px solid #cbd5e1; text-align: left; }
            td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
            .text-end { text-align: right; }
            .text-center { text-align: center; }
            tfoot td { font-weight: 700; border-top: 2px solid #cbd5e1; background: #f8fafc; }
            .print-footer { margin-top: 30px; display: flex; justify-content: space-between; }
            .print-footer .sign-box { text-align: center; min-width: 150px; }
            .print-footer .sign-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 4px; font-size: 10px; color: #666; }
            .print-note { margin-top: 10px; padding: 8px; background: #f8fafc; border-left: 3px solid ${highlight}; font-size: 11px; color: #555; }
            .print-date { font-size: 10px; color: #999; text-align: right; margin-top: 8px; }
            .print-summary { margin-top: 10px; text-align: right; }
            .print-summary .summary-row { display: flex; justify-content: flex-end; gap: 20px; margin-bottom: 2px; }
            .print-summary .summary-label { font-size: 11px; color: #666; min-width: 100px; text-align: right; }
            .print-summary .summary-value { font-size: 12px; font-weight: 600; min-width: 120px; text-align: right; }
            .print-summary .summary-total { font-size: 14px; font-weight: 700; color: ${accent}; border-top: 2px solid ${accent}; padding-top: 4px; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>`;
    }

    function formatMoney(val) {
        const num = parseFloat(val || 0);
        return num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(val) {
        if (!val) return '-';
        const dt = new Date(val);
        if (isNaN(dt)) return val;
        return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function openPrintWindow(html, theme) {
        const w = window.open('', '_blank', 'width=800,height=600');
        if (!w) { toastr.error('Popup blocked. Please allow popups.'); return; }
        w.document.write('<!DOCTYPE html><html><head><title>Print</title>' + buildStyles(theme) + '</head><body>' + html + '</body></html>');
        w.document.close();
        w.focus();
        setTimeout(function () { w.print(); }, 400);
    }

    function buildInfoSection(fields) {
        let html = '<div class="print-info">';
        fields.forEach(function (f) {
            html += '<div class="info-group"><div class="info-label">' + f.label + '</div><div class="info-value">' + (f.value || '-') + '</div></div>';
        });
        html += '</div>';
        return html;
    }

    function buildTable(columns, rows, showTotal, totalLabel, totalValue) {
        let html = '<table><thead><tr>';
        columns.forEach(function (c) {
            html += '<th class="' + (c.align || '') + '">' + c.title + '</th>';
        });
        html += '</tr></thead><tbody>';
        rows.forEach(function (r, i) {
            html += '<tr>';
            columns.forEach(function (c) {
                const val = typeof c.render === 'function' ? c.render(r, i) : (r[c.field] || '');
                html += '<td class="' + (c.align || '') + '">' + val + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody>';
        if (showTotal) {
            html += '<tfoot><tr><td colspan="' + (columns.length - 1) + '" class="text-end">' + (totalLabel || 'Total') + '</td><td class="text-end">' + (totalValue || '') + '</td></tr></tfoot>';
        }
        html += '</table>';
        return html;
    }

    function buildSignature(labels) {
        let html = '<div class="print-footer">';
        (labels || ['Prepared by', 'Approved by']).forEach(function (l) {
            html += '<div class="sign-box"><div class="sign-line">' + l + '</div></div>';
        });
        html += '</div>';
        return html;
    }

    // ---- Document-specific print functions ----

    function printPurchaseOrder() {
        const no = $('#purchaseOrderNumber').val() || '-';
        const date = $('#purchaseOrderDate').val();
        const note = $('#purchaseOrderNote').val();
        const supplier = $('#filterSupplier option:selected').text() || '-';
        const status = $('#purchaseOrderStatus').text() || 'Draft';
        const total = $('#poTotal').text() || '0.00';

        const table = $('#tablePurchaseOrderProduct').DataTable();
        const rows = [];
        table.rows().every(function () { rows.push(this.data()); });

        let html = '<div class="print-header"><div><div class="company">' + companyName + '</div></div><div><div class="doc-title">PURCHASE ORDER</div><div class="doc-no">' + no + '</div></div></div>';
        html += buildInfoSection([
            { label: 'Date', value: formatDate(date) },
            { label: 'Supplier', value: supplier },
            { label: 'Status', value: status }
        ]);
        html += buildTable(
            [
                { title: '#', align: 'text-center', render: function (r, i) { return i + 1; } },
                { title: 'Product', field: 'product' },
                { title: 'Qty', align: 'text-center', field: 'quantity' },
                { title: 'Unit Price', align: 'text-end', render: function (r) { return formatMoney(r.unitPrice); } },
                { title: 'Subtotal', align: 'text-end', render: function (r) { return formatMoney(r.subTotal); } }
            ],
            rows, true, 'Total', formatMoney(total.replace(/,/g, ''))
        );
        if (note) html += '<div class="print-note"><strong>Note:</strong> ' + note + '</div>';
        html += buildSignature(['Prepared by', 'Approved by', 'Received by']);
        html += '<div class="print-date">Printed: ' + new Date().toLocaleString('id-ID') + '</div>';
        openPrintWindow(html, { accent: '#e67e22', highlight: '#c2410c' });
    }

    function printSalesOrder() {
        const no = $('#salesOrderNumber').val() || '-';
        const date = $('#salesOrderDate').val();
        const note = $('#salesOrderNote').val();
        const customer = $('#selectCustomer option:selected').text() || 'Umum';
        const customerAddress = $('#selectCustomer option:selected').data('address') || '';
        const status = $('#salesOrderStatus').text() || 'Draft';
        const paidAmount = Number($('#salesOrderPaidAmount').val() || 0);

        const table = $('#tableProduct').DataTable();
        const rows = [];
        let grandTotal = 0;
        table.rows().every(function () {
            const r = this.data();
            rows.push(r);
            grandTotal += parseFloat(r.subTotal || r.subtotal || 0);
        });

        var itemsHtml = '';
        rows.forEach(function (r, i) {
            var name = r.product || r.productName || r.name || '';
            var qty = r.quantity || r.qty || 0;
            var unit = r.unit || r.Unit || '-';
            var price = parseFloat(r.unitPrice || r.price || 0);
            var sub = parseFloat(r.subTotal || r.subtotal || 0);
            itemsHtml += '<tr><td style="text-align:center;">' + (i + 1) + '</td><td>' + name + '</td><td style="text-align:center;">' + qty + '</td><td style="text-align:center;">' + unit + '</td><td style="text-align:right;">' + formatMoney(price) + '</td><td style="text-align:right;">' + formatMoney(sub) + '</td></tr>';
        });

        var outstanding = grandTotal - paidAmount;
        var dpLine = paidAmount > 0 ? '<div class="summary-line"><span>Uang Muka</span><span>' + formatMoney(paidAmount) + '</span></div>' : '';
        var outstandingLine = outstanding > 0 ? '<div class="summary-line debt"><span>Sisa</span><span>' + formatMoney(outstanding) + '</span></div>' : '';
        var noteLine = note ? '<div class="so-note"><strong>Catatan:</strong> ' + note + '</div>' : '';

        var soHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sales Order - ' + no + '</title>'
            + '<style>'
            + '@page { size: A4; margin: 16mm 20mm; }'
            + '* { margin:0; padding:0; box-sizing:border-box; }'
            + 'body { font-family: "Segoe UI", Arial, sans-serif; font-size: 13px; color: #000; max-width: 720px; margin: 0 auto; padding: 20px; }'
            + '.so-title { text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 24px; }'
            + '.so-company { text-align: left; margin-bottom: 16px; }'
            + '.so-company .company-name { font-size: 16px; font-weight: 700; color: #1b2a4a; margin-bottom: 2px; }'
            + '.info-section { margin-bottom: 16px; }'
            + '.info-section .info-line { margin-bottom: 4px; font-size: 13px; }'
            + '.info-section .info-line strong { display: inline-block; min-width: 130px; }'
            + 'table { width: 100%; border-collapse: collapse; margin: 16px 0; }'
            + 'thead th { background: #1b2a4a; color: #fff; font-size: 12px; font-weight: 600; padding: 8px 10px; }'
            + 'tbody td { padding: 7px 10px; border-bottom: 1px solid #ddd; font-size: 12px; }'
            + 'tbody tr:last-child td { border-bottom: 2px solid #1b2a4a; }'
            + '.summary-section { display: flex; justify-content: flex-end; margin-top: 12px; }'
            + '.summary-inner { width: 280px; }'
            + '.summary-line { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }'
            + '.summary-line.grand { font-size: 16px; font-weight: 700; border-top: 2px solid #000; padding-top: 6px; margin-top: 4px; }'
            + '.summary-line.debt { color: #c00; font-weight: 600; }'
            + '.so-note { margin-top: 16px; padding: 8px 10px; background: #f8fafc; border-left: 3px solid #1b2a4a; font-size: 12px; color: #555; }'
            + '.signatures { display: flex; justify-content: space-between; margin-top: 60px; }'
            + '.sig-box { text-align: center; width: 200px; }'
            + '.sig-box .sig-label { font-size: 13px; font-weight: 600; margin-bottom: 80px; }'
            + '.sig-box .sig-name { border-top: 1px solid #000; padding-top: 4px; font-size: 13px; }'
            + '.so-footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; }'
            + '@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'
            + '</style></head><body>'
            + '<div class="so-title">Sales Order</div>'
            + '<div class="so-company"><div class="company-name">' + companyName + '</div></div>'
            + '<div class="info-section">'
            + '<div class="info-line"><strong>Tanggal:</strong> ' + formatDate(date) + '</div>'
            + '<div class="info-line"><strong>No:</strong> ' + no + '</div>'
            + '<div class="info-line"><strong>Customer:</strong> ' + customer + '</div>'
            + (customerAddress ? '<div class="info-line"><strong>Alamat:</strong> ' + customerAddress + '</div>' : '')
            + '<div class="info-line"><strong>Status:</strong> ' + status + '</div>'
            + '</div>'
            + '<table>'
            + '<thead><tr><th style="text-align:center;width:40px;">No</th><th style="text-align:left;">Deskripsi</th><th style="text-align:center;width:60px;">Unit</th><th style="text-align:center;width:60px;">Satuan</th><th style="text-align:right;width:130px;">Harga Satuan</th><th style="text-align:right;width:130px;">Jumlah</th></tr></thead>'
            + '<tbody>' + itemsHtml + '</tbody>'
            + '</table>'
            + '<div class="summary-section"><div class="summary-inner">'
            + '<div class="summary-line grand"><span>Total</span><span>' + formatMoney(grandTotal) + '</span></div>'
            + dpLine
            + outstandingLine
            + '</div></div>'
            + noteLine
            + '<div class="signatures">'
            + '<div class="sig-box"><div class="sig-label">Penerima</div><div class="sig-name">' + customer + '</div></div>'
            + '<div class="sig-box"><div class="sig-label">Pemilik Usaha</div><div class="sig-name">Mitra Karya</div></div>'
            + '</div>'
            + '<div class="so-footer">Printed: ' + new Date().toLocaleString('id-ID') + '</div>'
            + '</body></html>';

        var w = window.open('', '_blank', 'width=800,height=900');
        if (!w) { toastr.error('Popup blocked. Please allow popups.'); return; }
        w.document.write(soHtml);
        w.document.close();
        w.focus();
        setTimeout(function () { w.print(); }, 400);
    }

    function printStockIn() {
        const no = $('#stockInNumber').val() || $('#stockInNo').val() || '-';
        const date = $('#stockInDate').val();
        const note = $('#stockInNote').val();
        const status = $('#stockInStatus').text() || 'Draft';

        const table = $('#tableProduct').DataTable();
        const rows = [];
        table.rows().every(function () { rows.push(this.data()); });

        let html = '<div class="print-header"><div><div class="company">' + companyName + '</div></div><div><div class="doc-title">STOCK IN</div><div class="doc-no">' + no + '</div></div></div>';
        html += buildInfoSection([
            { label: 'Date', value: formatDate(date) },
            { label: 'Status', value: status }
        ]);
        html += buildTable(
            [
                { title: '#', align: 'text-center', render: function (r, i) { return i + 1; } },
                { title: 'Product', render: function (r) { return r.product || r.productName || r.name || ''; } },
                { title: 'Qty', align: 'text-center', render: function (r) { return r.quantity || r.qty || 0; } }
            ],
            rows, false
        );
        if (note) html += '<div class="print-note"><strong>Note:</strong> ' + note + '</div>';
        html += buildSignature(['Prepared by', 'Verified by']);
        html += '<div class="print-date">Printed: ' + new Date().toLocaleString('id-ID') + '</div>';
        openPrintWindow(html, { accent: '#4f46e5', highlight: '#6366f1' });
    }

    function printPurchaseReturn() {
        const table = $('#tablePurchaseReturnItems').DataTable();
        const rows = [];
        let total = 0;
        table.rows().every(function () {
            const r = this.data();
            rows.push(r);
            total += parseFloat(r.subtotal || r.subTotal || 0);
        });
        const no = $('#prNo').val() || '-';
        const date = $('#prDate').val();
        const supplier = $('#prSupplierID option:selected').text() || $('#prSupplierName').text() || '-';

        let html = '<div class="print-header"><div><div class="company">' + companyName + '</div></div><div><div class="doc-title">PURCHASE RETURN</div><div class="doc-no">' + no + '</div></div></div>';
        html += buildInfoSection([
            { label: 'Date', value: formatDate(date) },
            { label: 'Supplier', value: supplier }
        ]);
        html += buildTable(
            [
                { title: '#', align: 'text-center', render: function (r, i) { return i + 1; } },
                { title: 'Product', render: function (r) { return r.product || r.productName || r.name || ''; } },
                { title: 'Qty', align: 'text-center', render: function (r) { return r.quantity || r.qty || 0; } },
                { title: 'Unit Price', align: 'text-end', render: function (r) { return formatMoney(r.unitPrice || r.price || 0); } },
                { title: 'Subtotal', align: 'text-end', render: function (r) { return formatMoney(r.subtotal || r.subTotal || 0); } }
            ],
            rows, true, 'Total', formatMoney(total)
        );
        html += buildSignature(['Prepared by', 'Supplier']);
        html += '<div class="print-date">Printed: ' + new Date().toLocaleString('id-ID') + '</div>';
        openPrintWindow(html, { accent: '#991b1b', highlight: '#dc2626' });
    }

    function printSalesReturn() {
        const table = $('#tableSalesReturnItems').DataTable();
        const rows = [];
        let total = 0;
        table.rows().every(function () {
            const r = this.data();
            rows.push(r);
            total += parseFloat(r.subtotal || r.subTotal || 0);
        });
        const no = $('#srNo').val() || '-';
        const date = $('#srDate').val();
        const customer = $('#srCustomer option:selected').text() || $('#srCustomerName').text() || '-';
        const refund = $('#lblSummaryRefund').text() || '0.00';

        let html = '<div class="print-header"><div><div class="company">' + companyName + '</div></div><div><div class="doc-title">SALES RETURN</div><div class="doc-no">' + no + '</div></div></div>';
        html += buildInfoSection([
            { label: 'Date', value: formatDate(date) },
            { label: 'Customer', value: customer }
        ]);
        html += buildTable(
            [
                { title: '#', align: 'text-center', render: function (r, i) { return i + 1; } },
                { title: 'Product', render: function (r) { return r.product || r.productName || r.name || ''; } },
                { title: 'Qty', align: 'text-center', render: function (r) { return r.quantity || r.qty || 0; } },
                { title: 'Unit Price', align: 'text-end', render: function (r) { return formatMoney(r.unitPrice || r.price || 0); } },
                { title: 'Subtotal', align: 'text-end', render: function (r) { return formatMoney(r.subtotal || r.subTotal || 0); } }
            ],
            rows, true, 'Total Return', formatMoney(total)
        );
        html += '<div class="print-summary"><div class="summary-row"><span class="summary-label">Refund Amount:</span><span class="summary-value summary-total">' + refund + '</span></div></div>';
        html += buildSignature(['Prepared by', 'Customer']);
        html += '<div class="print-date">Printed: ' + new Date().toLocaleString('id-ID') + '</div>';
        openPrintWindow(html, { accent: '#c2410c', highlight: '#ea580c' });
    }

    function printStockCount() {
        const table = $('#tableStockCountItems').DataTable();
        const rows = [];
        table.rows().every(function () { rows.push(this.data()); });
        const no = $('#scNo').val() || '-';
        const date = $('#scDate').val();
        const note = $('#scNote').val();
        const totalDiff = $('#totalDiffValue').text() || '0.00';

        let html = '<div class="print-header"><div><div class="company">' + companyName + '</div></div><div><div class="doc-title">STOCK COUNT</div><div class="doc-no">' + no + '</div></div></div>';
        html += buildInfoSection([
            { label: 'Date', value: formatDate(date) },
            { label: 'Total Diff Value', value: totalDiff }
        ]);
        html += buildTable(
            [
                { title: '#', align: 'text-center', render: function (r, i) { return i + 1; } },
                { title: 'Product', render: function (r) { return r.product || r.productName || r.name || ''; } },
                { title: 'System Qty', align: 'text-end', render: function (r) { return r.systemQty || r.systemQuantity || 0; } },
                { title: 'Physical Qty', align: 'text-end', render: function (r) { return r.physicalQty || r.physicalQuantity || 0; } },
                { title: 'Diff', align: 'text-end', render: function (r) { return r.diff || r.difference || 0; } },
                { title: 'Unit Price', align: 'text-end', render: function (r) { return formatMoney(r.unitPrice || r.price || 0); } },
                { title: 'Diff Value', align: 'text-end', render: function (r) { return formatMoney(r.diffValue || r.differenceValue || 0); } }
            ],
            rows, false
        );
        if (note) html += '<div class="print-note"><strong>Note:</strong> ' + note + '</div>';
        html += buildSignature(['Counted by', 'Verified by']);
        html += '<div class="print-date">Printed: ' + new Date().toLocaleString('id-ID') + '</div>';
        openPrintWindow(html, { accent: '#92400e', highlight: '#d97706' });
    }

    function printPosReceipt(saleData) {
        // POS receipt: compact format
        const items = saleData.items || [];
        const customer = saleData.customer || 'Umum';
        const paymentType = saleData.paymentType || 'Full';
        const subtotal = saleData.subtotal || 0;
        const tax = saleData.tax || 0;
        const total = saleData.total || 0;
        const tender = saleData.tender || 0;
        const change = saleData.change || 0;

        let html = '<div style="max-width:300px; margin:0 auto; font-family:monospace; font-size:12px;">';
        html += '<div style="text-align:center; border-bottom:1px dashed #333; padding-bottom:8px; margin-bottom:8px;">';
        html += '<div style="font-size:16px; font-weight:bold;">' + companyName + '</div>';
        html += '<div style="font-size:10px; color:#666;">SALES RECEIPT</div>';
        html += '<div style="font-size:10px;">' + new Date().toLocaleString('id-ID') + '</div>';
        html += '</div>';
        html += '<div style="margin-bottom:6px; font-size:11px;">Customer: ' + customer + '</div>';
        html += '<div style="border-bottom:1px dashed #333; margin-bottom:6px;"></div>';

        items.forEach(function (item) {
            html += '<div style="display:flex; justify-content:space-between;">';
            html += '<span>' + (item.name || item.product || '') + '</span>';
            html += '</div>';
            html += '<div style="display:flex; justify-content:space-between; padding-left:10px; font-size:11px; color:#555;">';
            html += '<span>' + (item.qty || item.quantity || 0) + ' x ' + formatMoney(item.price || item.unitPrice || 0) + '</span>';
            html += '<span>' + formatMoney(item.total || item.subtotal || 0) + '</span>';
            html += '</div>';
        });

        html += '<div style="border-top:1px dashed #333; margin-top:8px; padding-top:6px;">';
        html += '<div style="display:flex; justify-content:space-between;"><span>Subtotal</span><span>' + formatMoney(subtotal) + '</span></div>';
        html += '<div style="display:flex; justify-content:space-between;"><span>Tax (10%)</span><span>' + formatMoney(tax) + '</span></div>';
        html += '<div style="display:flex; justify-content:space-between; font-weight:bold; font-size:14px; border-top:1px solid #333; margin-top:4px; padding-top:4px;"><span>Total</span><span>' + formatMoney(total) + '</span></div>';
        if (paymentType === 'Full') {
            html += '<div style="display:flex; justify-content:space-between; margin-top:4px;"><span>Cash</span><span>' + formatMoney(tender) + '</span></div>';
            html += '<div style="display:flex; justify-content:space-between;"><span>Change</span><span>' + formatMoney(change) + '</span></div>';
        } else {
            html += '<div style="display:flex; justify-content:space-between; margin-top:4px;"><span>Payment</span><span>' + paymentType + '</span></div>';
        }
        html += '</div>';
        html += '<div style="text-align:center; margin-top:16px; font-size:10px; color:#999;">Thank you for your purchase!</div>';
        html += '</div>';
        openPrintWindow(html);
    }

    function printDeliveryOrder(data) {
        const d = data || {};
        let html = '<div class="print-header"><div><div class="company">' + companyName + '</div></div><div><div class="doc-title">DELIVERY ORDER</div><div class="doc-no">' + (d.no || '-') + '</div></div></div>';
        html += buildInfoSection([
            { label: 'Sales Order', value: d.salesOrderNo || '-' },
            { label: 'Driver', value: d.driverName || '-' },
            { label: 'Address', value: d.address || '-' },
            { label: 'Status', value: d.status || '-' }
        ]);
        if (d.items && d.items.length) {
            html += buildTable(
                [
                    { title: '#', align: 'text-center', render: function (r, i) { return i + 1; } },
                    { title: 'Product', render: function (r) { return r.product || r.productName || ''; } },
                    { title: 'Qty', align: 'text-center', render: function (r) { return r.quantity || r.qty || 0; } }
                ],
                d.items, false
            );
        }
        html += buildSignature(['Prepared by', 'Driver', 'Received by']);
        html += '<div class="print-date">Printed: ' + new Date().toLocaleString('id-ID') + '</div>';
        openPrintWindow(html, { accent: '#0d9488', highlight: '#14b8a6' });
    }

    function printPaymentIn(data) {
        const d = data || {};
        let html = '<div class="print-header"><div><div class="company">' + companyName + '</div></div><div><div class="doc-title">PAYMENT RECEIPT</div><div class="doc-no">' + (d.no || '-') + '</div></div></div>';
        html += buildInfoSection([
            { label: 'Date', value: formatDate(d.date) },
            { label: 'Customer', value: d.customerName || '-' },
            { label: 'Sales Order', value: d.salesOrderNo || '-' },
            { label: 'Method', value: d.method || '-' },
            { label: 'Amount', value: formatMoney(d.amount) }
        ]);
        html += buildSignature(['Cashier', 'Customer']);
        html += '<div class="print-date">Printed: ' + new Date().toLocaleString('id-ID') + '</div>';
        openPrintWindow(html, { accent: '#15803d', highlight: '#16a34a' });
    }

    function printPaymentOut(data) {
        const d = data || {};
        let html = '<div class="print-header"><div><div class="company">' + companyName + '</div></div><div><div class="doc-title">PAYMENT VOUCHER</div><div class="doc-no">' + (d.no || '-') + '</div></div></div>';
        html += buildInfoSection([
            { label: 'Date', value: formatDate(d.date) },
            { label: 'Supplier', value: d.supplierName || '-' },
            { label: 'Purchase Order', value: d.purchaseOrderNo || '-' },
            { label: 'Method', value: d.method || '-' },
            { label: 'Type', value: d.type || '-' },
            { label: 'Amount', value: formatMoney(d.amount) }
        ]);
        html += buildSignature(['Prepared by', 'Approved by']);
        html += '<div class="print-date">Printed: ' + new Date().toLocaleString('id-ID') + '</div>';
        openPrintWindow(html, { accent: '#991b1b', highlight: '#dc2626' });
    }

    function printSalesInvoice(data) {
        const d = data || {};
        let html = '<div class="print-header"><div><div class="company">' + companyName + '</div></div><div><div class="doc-title">SALES INVOICE</div><div class="doc-no">' + (d.no || '-') + '</div></div></div>';
        html += buildInfoSection([
            { label: 'Date', value: formatDate(d.date) },
            { label: 'Customer', value: d.customerName || '-' },
            { label: 'Status', value: d.status || '-' },
            { label: 'Amount', value: formatMoney(d.amount) },
            { label: 'Paid', value: formatMoney(d.paid) }
        ]);
        if (d.items && d.items.length) {
            html += buildTable(
                [
                    { title: '#', align: 'text-center', render: function (r, i) { return i + 1; } },
                    { title: 'Product', render: function (r) { return r.product || r.productName || ''; } },
                    { title: 'Qty', align: 'text-center', render: function (r) { return r.quantity || r.qty || 0; } },
                    { title: 'Unit Price', align: 'text-end', render: function (r) { return formatMoney(r.unitPrice || r.price || 0); } },
                    { title: 'Subtotal', align: 'text-end', render: function (r) { return formatMoney(r.subtotal || r.subTotal || 0); } }
                ],
                d.items, true, 'Total', formatMoney(d.amount)
            );
        }
        html += buildSignature(['Cashier', 'Customer']);
        html += '<div class="print-date">Printed: ' + new Date().toLocaleString('id-ID') + '</div>';
        openPrintWindow(html, { accent: '#047857', highlight: '#10b981' });
    }

    function printReport() {
        var salesRows = [];
        $('#tableSalesReport tbody tr').each(function () {
            var cells = $(this).find('td');
            if (cells.length >= 5) {
                salesRows.push({ no: cells.eq(0).text(), date: cells.eq(1).text(), customer: cells.eq(2).text(), amount: cells.eq(3).text(), status: cells.eq(4).text() });
            }
        });
        var purchaseRows = [];
        $('#tablePurchaseReport tbody tr').each(function () {
            var cells = $(this).find('td');
            if (cells.length >= 5) {
                purchaseRows.push({ no: cells.eq(0).text(), date: cells.eq(1).text(), supplier: cells.eq(2).text(), amount: cells.eq(3).text(), status: cells.eq(4).text() });
            }
        });
        var lowStockRows = [];
        $('#tableLowStock tbody tr').each(function () {
            var cells = $(this).find('td');
            if (cells.length >= 3) {
                lowStockRows.push({ product: cells.eq(0).text(), stock: cells.eq(1).text(), min: cells.eq(2).text() });
            }
        });

        var totalSales = $('#totalSales').text() || '-';
        var totalPurchases = $('#totalPurchases').text() || '-';
        var totalPaymentIn = $('#totalPaymentIn').text() || '-';
        var totalPaymentOut = $('#totalPaymentOut').text() || '-';

        var html = '<div class="print-header"><div><div class="company">' + companyName + '</div></div><div><div class="doc-title">REPORT SUMMARY</div></div></div>';

        html += '<div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;">';
        html += '<div style="flex:1;min-width:140px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;"><div style="font-size:10px;color:#999;text-transform:uppercase;">Total Sales</div><div style="font-size:16px;font-weight:700;color:#2563eb;">' + totalSales + '</div></div>';
        html += '<div style="flex:1;min-width:140px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;"><div style="font-size:10px;color:#999;text-transform:uppercase;">Total Purchases</div><div style="font-size:16px;font-weight:700;color:#d97706;">' + totalPurchases + '</div></div>';
        html += '<div style="flex:1;min-width:140px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;"><div style="font-size:10px;color:#999;text-transform:uppercase;">Payment In</div><div style="font-size:16px;font-weight:700;color:#16a34a;">' + totalPaymentIn + '</div></div>';
        html += '<div style="flex:1;min-width:140px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;"><div style="font-size:10px;color:#999;text-transform:uppercase;">Payment Out</div><div style="font-size:16px;font-weight:700;color:#dc2626;">' + totalPaymentOut + '</div></div>';
        html += '</div>';

        if (salesRows.length) {
            html += '<h3 style="font-size:13px;color:#1e3a5f;margin:16px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Sales Orders</h3>';
            html += buildTable(
                [
                    { title: 'No', field: 'no' },
                    { title: 'Date', field: 'date' },
                    { title: 'Customer', field: 'customer' },
                    { title: 'Amount', align: 'text-end', field: 'amount' },
                    { title: 'Status', field: 'status' }
                ],
                salesRows, false
            );
        }

        if (purchaseRows.length) {
            html += '<h3 style="font-size:13px;color:#1e3a5f;margin:16px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Purchase Orders</h3>';
            html += buildTable(
                [
                    { title: 'No', field: 'no' },
                    { title: 'Date', field: 'date' },
                    { title: 'Supplier', field: 'supplier' },
                    { title: 'Amount', align: 'text-end', field: 'amount' },
                    { title: 'Status', field: 'status' }
                ],
                purchaseRows, false
            );
        }

        if (lowStockRows.length) {
            html += '<h3 style="font-size:13px;color:#d97706;margin:16px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">&#9888; Low Stock Products</h3>';
            html += buildTable(
                [
                    { title: 'Product', field: 'product' },
                    { title: 'Stock', align: 'text-end', field: 'stock' },
                    { title: 'Min Stock', align: 'text-end', field: 'min' }
                ],
                lowStockRows, false
            );
        }

        html += '<div class="print-date">Printed: ' + new Date().toLocaleString('id-ID') + '</div>';
        openPrintWindow(html, { accent: '#334155', highlight: '#475569' });
    }

    // Public API
    return {
        purchaseOrder: printPurchaseOrder,
        salesOrder: printSalesOrder,
        salesInvoice: printSalesInvoice,
        deliveryOrder: printDeliveryOrder,
        stockIn: printStockIn,
        stockCount: printStockCount,
        purchaseReturn: printPurchaseReturn,
        salesReturn: printSalesReturn,
        paymentIn: printPaymentIn,
        paymentOut: printPaymentOut,
        posReceipt: printPosReceipt,
        report: printReport,
        custom: openPrintWindow,
        formatMoney: formatMoney,
        formatDate: formatDate
    };
})();
