/* ========================================================================
   MksThermalPrinter – Shared thermal printer utility
   Supports 58mm (Panda PRJ-CX58B etc.) and 80mm thermal printers.
   Settings are stored in localStorage for per-browser persistence.
   ======================================================================== */
const MksThermalPrinter = (function () {
    const STORAGE_KEY = 'mks_thermal_printer';

    const defaults = {
        paperWidth: 58,       // 58 or 80 (mm)
        autoPrint: true,      // skip print dialog and print immediately
        autoClose: true,      // close print window after printing
        fontSize: 11          // base font size (px)
    };

    function getSettings() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) return Object.assign({}, defaults, JSON.parse(stored));
        } catch (e) { console.warn('ThermalPrinter: failed to read settings', e); }
        return Object.assign({}, defaults);
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) { console.warn('ThermalPrinter: failed to save settings', e); }
    }

    function getContentWidth() {
        const s = getSettings();
        // printable area after margins
        return s.paperWidth === 80 ? '72mm' : '48mm';
    }

    function getPageSize() {
        const s = getSettings();
        return s.paperWidth === 80 ? '80mm' : '58mm';
    }

    /** Get store profile from global module (falls back to defaults) */
    function getStoreProfile() {
        if (typeof MksStoreProfile !== 'undefined') return MksStoreProfile.get();
        return {};
    }

    /** Build receipt HTML for thermal printer */
    function buildReceiptHtml(data) {
        const s = getSettings();
        const sp = getStoreProfile();
        const w = getContentWidth();
        const pageW = getPageSize();
        const fs = s.fontSize;

        const is58 = s.paperWidth !== 80;
        var itemsHtml;
        if (is58) {
            // Stacked layout for 58mm: name on line 1, qty x price / total on line 2
            itemsHtml = (data.items || []).map(function (i) {
                const name = i.name || '';
                const unit = i.unit ? ' /' + i.unit : '';
                const qty = i.qty || 0;
                const price = i.price || 0;
                const total = price * qty;
                return '<div class="item">'
                    + '<div class="item-name">' + name + unit + '</div>'
                    + '<div class="item-detail">'
                    + '<span>' + qty + ' x ' + fmtMoney(price) + '</span>'
                    + '<span>' + fmtMoney(total) + '</span>'
                    + '</div></div>';
            }).join('');
        } else {
            // Table layout for 80mm
            itemsHtml = (data.items || []).map(function (i) {
                const name = i.name || '';
                const unit = i.unit ? ' /' + i.unit : '';
                const qty = i.qty || 0;
                const price = i.price || 0;
                const total = price * qty;
                return '<tr>'
                    + '<td style="text-align:left;width:40%;">' + name + unit + '</td>'
                    + '<td style="text-align:center;width:10%;">' + qty + '</td>'
                    + '<td style="text-align:right;width:25%;">' + fmtMoney(price) + '</td>'
                    + '<td style="text-align:right;width:25%;">' + fmtMoney(total) + '</td>'
                    + '</tr>';
            }).join('');
        }

        const paidLine = data.paid != null
            ? '<div class="line"><span>Bayar</span><span>' + fmtMoney(data.paid) + '</span></div>' : '';
        const changeLine = data.changeAmt != null && data.changeAmt > 0
            ? '<div class="line change"><span>Kembalian</span><span>' + fmtMoney(data.changeAmt) + '</span></div>' : '';
        const debtLine = data.paid != null && data.total != null && data.paid < data.total
            ? '<div class="line debt"><span>Sisa Hutang</span><span>' + fmtMoney(data.total - data.paid) + '</span></div>' : '';

        var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title>'
            + '<style>'
            + '@page { size: ' + pageW + ' auto; margin: 2mm; }'
            + '* { margin:0; padding:0; box-sizing:border-box; }'
            + 'body { font-family: "Consolas", "Courier New", monospace; font-size: ' + fs + 'px; color: #000; width: ' + w + '; margin: 0 auto; }'
            + '.receipt { padding: 2mm 0; }'
            + '.header { text-align: center; margin-bottom: 6px; }'
            + '.header h2 { font-size: ' + (fs + 4) + 'px; margin-bottom: 2px; font-weight: 700; }'
            + '.header .sub { font-size: ' + (fs - 2) + 'px; color: #555; }'
            + '.divider { border: none; border-top: 1px dashed #333; margin: 4px 0; }'
            + '.info { font-size: ' + (fs - 1) + 'px; margin-bottom: 2px; }'
            + 'table { width: 100%; border-collapse: collapse; margin: 3px 0; table-layout: fixed; }'
            + 'th { font-size: ' + (fs - 1) + 'px; font-weight: 700; border-bottom: 1px solid #333; padding: 2px 1px; }'
            + 'td { font-size: ' + fs + 'px; padding: 2px 1px; vertical-align: top; }'
            + '.summary { margin-top: 3px; }'
            + '.summary .line { display: flex; justify-content: space-between; font-size: ' + fs + 'px; padding: 1px 0; }'
            + '.summary .line.grand { font-size: ' + (fs + 2) + 'px; font-weight: 700; margin-top: 3px; padding: 3px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; }'
            + '.summary .line.change { font-weight: 600; }'
            + '.summary .line.debt { color: #000; font-weight: 600; }'
            + '.footer { text-align: center; margin-top: 8px; font-size: ' + (fs - 2) + 'px; color: #555; }'
            + '.item { margin-bottom: 2px; padding-bottom: 2px; }'
            + '.item-name { overflow-wrap: break-word; font-weight: 600; font-size: ' + fs + 'px; }'
            + '.item-detail { display: flex; justify-content: space-between; padding-left: 8px; font-size: ' + (fs - 1) + 'px; }'
            + '.cut-line { margin-top: 10px; border-top: 1px dashed #999; }'
            + '@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'
            + '</style></head><body>'
            + '<div class="receipt">'
            + '  <div class="header">'
            + '    <h2>' + (sp.storeName || 'Mitra Karya') + '</h2>'
            + (sp.receiptHeader ? '    <div class="sub">' + sp.receiptHeader + '</div>' : '')
            + (data.headerSub ? '    <div class="sub">' + data.headerSub + '</div>' : '')
            + '  </div>'
            + '  <hr class="divider">'
            + '  <div class="info"><strong>No:</strong> ' + (data.no || '-') + '</div>'
            + '  <div class="info"><strong>Tgl:</strong> ' + (data.date || formatNow()) + '</div>'
            + (data.customer ? '  <div class="info"><strong>Customer:</strong> ' + data.customer + '</div>' : '')
            + (data.payType ? '  <div class="info"><strong>Bayar:</strong> ' + data.payType + '</div>' : '')
            + (data.cashier ? '  <div class="info"><strong>Kasir:</strong> ' + data.cashier + '</div>' : '')
            + '  <hr class="divider">'
            + (is58
                ? '  <div class="items">' + itemsHtml + '</div>'
                : '  <table>'
                + '    <thead><tr>'
                + '      <th style="text-align:left;width:40%;">Item</th>'
                + '      <th style="text-align:center;width:10%;">Qty</th>'
                + '      <th style="text-align:right;width:25%;">Harga</th>'
                + '      <th style="text-align:right;width:25%;">Total</th>'
                + '    </tr></thead>'
                + '    <tbody>' + itemsHtml + '</tbody>'
                + '  </table>')
            + '  <hr class="divider">'
            + '  <div class="summary">'
            + (data.subtotal != null ? '    <div class="line"><span>Subtotal</span><span>' + fmtMoney(data.subtotal) + '</span></div>' : '')
            + (data.tax != null ? '    <div class="line"><span>Pajak</span><span>' + fmtMoney(data.tax) + '</span></div>' : '')
            + '    <div class="line grand"><span>Total</span><span>' + fmtMoney(data.total || 0) + '</span></div>'
            + paidLine
            + changeLine
            + debtLine
            + '  </div>'
            + '  <hr class="divider">'
            + '  <div class="footer">' + (sp.receiptFooter || 'Terima kasih atas kunjungan Anda!') + '</div>'
            + '  <div class="cut-line"></div>'
            + '</div>'
            + '</body></html>';
        return html;
    }

    /** Print receipt using a hidden iframe for a seamless experience.
     *  Falls back to window.open when iframe approach is not available. */
    function printReceipt(data) {
        var s = getSettings();
        var html = buildReceiptHtml(data);

        if (s.autoPrint) {
            // Use hidden iframe – no popup window, feels much faster
            var frameId = 'mks-print-frame';
            var existing = document.getElementById(frameId);
            if (existing) existing.remove();

            var iframe = document.createElement('iframe');
            iframe.id = frameId;
            iframe.name = frameId;
            iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
            document.body.appendChild(iframe);

            var doc = iframe.contentWindow || iframe.contentDocument;
            if (doc.document) doc = doc.document;
            doc.open();
            doc.write(html);
            doc.close();

            iframe.onload = function () {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } catch (e) {
                    console.warn('ThermalPrinter: iframe print failed, falling back to window', e);
                    printViaWindow(html, s);
                }
                if (s.autoClose) {
                    setTimeout(function () { try { iframe.remove(); } catch (e) { } }, 2000);
                }
            };
        } else {
            printViaWindow(html, s);
        }
    }

    /** Fallback: open a new window for manual printing */
    function printViaWindow(html, s) {
        var winWidth = s.paperWidth === 80 ? 350 : 280;
        var w = window.open('', '_blank', 'width=' + winWidth + ',height=600');
        if (!w) {
            toastr.warning('Pop-up diblokir. Izinkan pop-up untuk mencetak.');
            return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.onload = function () {
            w.focus();
            w.print();
            if (s.autoClose) {
                setTimeout(function () { try { w.close(); } catch (e) { } }, 1000);
            }
        };
    }

    /** Build settings modal HTML – printer-specific settings only.
     *  Store profile (name, footer, etc.) is managed in Master Settings > Store Profile. */
    function openSettingsModal() {
        var s = getSettings();
        var html = '<div class="text-start">'
            + '<div class="mb-3">'
            + '  <label class="form-label fw-semibold">Lebar Kertas</label>'
            + '  <select id="tpPaperWidth" class="form-select form-select-sm">'
            + '    <option value="58"' + (s.paperWidth === 58 ? ' selected' : '') + '>58mm (Panda CX58B, dll)</option>'
            + '    <option value="80"' + (s.paperWidth === 80 ? ' selected' : '') + '>80mm</option>'
            + '  </select>'
            + '</div>'
            + '<div class="mb-3">'
            + '  <label class="form-label fw-semibold">Ukuran Font (px)</label>'
            + '  <input type="number" id="tpFontSize" class="form-control form-control-sm" value="' + s.fontSize + '" min="8" max="16" />'
            + '</div>'
            + '<div class="form-check form-switch mb-2">'
            + '  <input class="form-check-input" type="checkbox" id="tpAutoPrint"' + (s.autoPrint ? ' checked' : '') + '>'
            + '  <label class="form-check-label" for="tpAutoPrint">Auto Print (via hidden iframe)</label>'
            + '</div>'
            + '<div class="form-check form-switch mb-2">'
            + '  <input class="form-check-input" type="checkbox" id="tpAutoClose"' + (s.autoClose ? ' checked' : '') + '>'
            + '  <label class="form-check-label" for="tpAutoClose">Auto Close setelah print</label>'
            + '</div>'
            + '<hr />'
            + '<div class="small text-muted"><i class="fa fa-info-circle me-1"></i>Nama toko, header & footer struk diatur di <strong>Master Data &gt; Master Settings &gt; Store Profile</strong>.</div>'
            + '</div>';

        Swal.fire({
            title: '<i class="fa fa-print me-2"></i>Pengaturan Thermal Printer',
            html: html,
            showCancelButton: true,
            confirmButtonText: '<i class="fa fa-save me-1"></i> Simpan',
            cancelButtonText: 'Batal',
            customClass: { confirmButton: 'btn btn-primary', cancelButton: 'btn btn-secondary ms-2' },
            preConfirm: function () {
                return {
                    paperWidth: parseInt($('#tpPaperWidth').val()) || 58,
                    fontSize: parseInt($('#tpFontSize').val()) || 11,
                    autoPrint: $('#tpAutoPrint').is(':checked'),
                    autoClose: $('#tpAutoClose').is(':checked')
                };
            }
        }).then(function (result) {
            if (result.isConfirmed && result.value) {
                saveSettings(result.value);
                toastr.success('Pengaturan printer disimpan');
            }
        });
    }

    /** Test print – prints a small test receipt */
    function testPrint() {
        printReceipt({
            no: 'TEST-001',
            date: formatNow(),
            customer: 'Test Customer',
            payType: 'Full',
            headerSub: '--- Test Print ---',
            items: [
                { name: 'Product Test A', qty: 2, price: 15000, unit: 'Pcs' },
                { name: 'Product Test B', qty: 1, price: 25000, unit: 'Box' }
            ],
            subtotal: 55000,
            tax: 6050,
            total: 61050,
            paid: 100000,
            changeAmt: 38950
        });
    }

    function fmtMoney(val) {
        return (Number(val) || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    function formatNow() {
        return new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    return {
        getSettings: getSettings,
        saveSettings: saveSettings,
        buildReceiptHtml: buildReceiptHtml,
        printReceipt: printReceipt,
        openSettingsModal: openSettingsModal,
        testPrint: testPrint
    };
})();
