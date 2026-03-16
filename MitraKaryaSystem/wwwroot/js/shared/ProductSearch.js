/* ========================================================================
   MksProductSearch – POS-style product search with type-ahead suggestions
   Usage: MksProductSearch.attach('#inputId', { onSelect: fn })
   Input must be inside a container with class .mks-search-wrap
   ======================================================================== */
const MksProductSearch = (function () {
    const fmt = n => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    function attach(inputSelector, options) {
        const $input = $(inputSelector);
        if (!$input.length) return { destroy: function () { } };
        const $wrap = $input.closest('.mks-search-wrap');
        if (!$wrap.length) { console.warn('MksProductSearch: input must be inside .mks-search-wrap'); return { destroy: function () { } }; }

        let suggestIndex = -1;
        let typingTimer = null;
        const opts = Object.assign({ showPrice: true, showStock: true, blockZeroStock: false, onSelect: function () { } }, options || {});

        function destroySuggest() { suggestIndex = -1; $wrap.find('.mks-suggest').remove(); }

        function highlightMatch(text, query) {
            if (!query) return text;
            const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return text.replace(new RegExp(esc, 'ig'), function (m) { return '<span class="match">' + m + '</span>'; });
        }

        function setActive() {
            const $items = $wrap.find('.mks-suggest-item:not(.disabled)');
            $items.removeClass('active');
            if (suggestIndex >= 0 && suggestIndex < $items.length) {
                $($items[suggestIndex]).addClass('active');
                try { $items[suggestIndex].scrollIntoView({ block: 'nearest' }); } catch (e) { }
            }
        }

        function buildSuggest(list, query) {
            const $box = $('<div class="mks-suggest shadow-sm" />');
            if (list.length === 0) {
                $box.append('<div class="text-center text-muted small p-3"><i class="fa fa-box-open me-1"></i>No products found</div>');
                return $box;
            }
            list.slice(0, 10).forEach(function (p, i) {
                var name = p.name || p.Name || '';
                var supplier = p.supplierName || p.SupplierName || '';
                var price = Number(p.unitPrice || p.UnitPrice || 0);
                var stockRaw = p.stockQuantity != null ? p.stockQuantity : p.StockQuantity;
                var stock = (stockRaw != null && stockRaw !== '') ? Number(stockRaw) : null;
                var highlighted = highlightMatch(name, query);
                var isOut = stock != null && !isNaN(stock) && stock <= 0;

                var stockBadge = '';
                if (opts.showStock && stock != null && !isNaN(stock)) {
                    if (stock <= 0) stockBadge = '<span class="badge text-bg-danger ms-1">Habis</span>';
                    else if (stock <= 5) stockBadge = '<span class="badge text-bg-warning ms-1">' + stock + '</span>';
                }

                var priceHtml = opts.showPrice ? '<div class="ms-2 text-nowrap fw-semibold small text-primary">' + fmt(price) + '</div>' : '';
                var $row = $('<div class="mks-suggest-item' + (isOut && opts.blockZeroStock ? ' disabled' : '') + '" data-idx="' + i + '">' +
                    '<div class="d-flex justify-content-between align-items-center">' +
                    '<div class="text-truncate">' + highlighted + ' <small class="text-muted ms-1">' + supplier + '</small>' + stockBadge + '</div>' +
                    priceHtml +
                    '</div></div>');

                $row.on('click', function () {
                    if (isOut && opts.blockZeroStock) { if (typeof MksSound !== 'undefined') MksSound.error(); toastr.warning('Stok habis'); return; }
                    opts.onSelect({
                        id: p.id || p.ID,
                        name: name,
                        unitPrice: price,
                        supplierID: p.supplierID || p.SupplierID,
                        supplierName: supplier,
                        stockQuantity: stock,
                        unit: p.unit || p.Unit,
                        barcode: p.barcode || p.Barcode
                    });
                    if (typeof MksSound !== 'undefined') MksSound.success();
                    destroySuggest();
                    $input.val('').focus();
                });
                $box.append($row);
            });
            return $box;
        }

        function searchProducts(query) {
            var isBarcode = /^\d{3,}$/.test(query);
            var supId = typeof opts.supplierId === 'function' ? opts.supplierId() : (opts.supplierId || null);
            var url = '/Product/GetProductComboList?name=' + encodeURIComponent(query);
            if (supId) url += '&supplierId=' + encodeURIComponent(supId);
            var p1 = $.get(url).catch(function () { return []; });
            var p2 = isBarcode ? $.get('/StockIn/ScanBarcode?barcode=' + encodeURIComponent(query)).catch(function () { return null; }) : Promise.resolve(null);
            return Promise.all([p1, p2]).then(function (results) {
                var list = results[0], barcodeRes = results[1];
                var arr = Array.isArray(list) ? list : (list && list.result) ? list.result : [];
                if (supId) {
                    var numSup = Number(supId);
                    arr = arr.filter(function (x) { return Number(x.supplierID || x.SupplierID || 0) === numSup; });
                }
                if (barcodeRes && (barcodeRes.id || barcodeRes.ID)) {
                    var bid = barcodeRes.id || barcodeRes.ID;
                    if (!arr.find(function (x) { return (x.id || x.ID) === bid; })) arr.unshift(barcodeRes);
                }
                var seen = {};
                return arr.filter(function (p) {
                    var id = p.id || p.ID;
                    if (!id || seen[id]) return false;
                    seen[id] = true;
                    return true;
                });
            });
        }

        $input.on('input', function () {
            clearTimeout(typingTimer);
            destroySuggest();
            var q = this.value.trim();
            if (q.length < 2) return;
            typingTimer = setTimeout(function () {
                searchProducts(q).then(function (list) {
                    destroySuggest();
                    $wrap.append(buildSuggest(list, q));
                    suggestIndex = -1;
                });
            }, 200);
        });

        $input.on('keydown', function (e) {
            var $items = $wrap.find('.mks-suggest-item:not(.disabled)');
            if (e.key === 'ArrowDown' && $items.length) {
                e.preventDefault(); suggestIndex = (suggestIndex + 1) % $items.length; setActive();
            } else if (e.key === 'ArrowUp' && $items.length) {
                e.preventDefault(); suggestIndex = suggestIndex <= 0 ? $items.length - 1 : suggestIndex - 1; setActive();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if ($items.length && suggestIndex >= 0) { $items.eq(suggestIndex).trigger('click'); return; }
                var q = this.value.trim();
                if (!q) return;
                var self = this;
                searchProducts(q).then(function (list) {
                    if (list.length > 0) {
                        var p = list[0];
                        opts.onSelect({
                            id: p.id || p.ID, name: p.name || p.Name,
                            unitPrice: Number(p.unitPrice || p.UnitPrice || 0),
                            supplierID: p.supplierID || p.SupplierID,
                            supplierName: p.supplierName || p.SupplierName,
                            stockQuantity: p.stockQuantity != null ? p.stockQuantity : p.StockQuantity,
                            unit: p.unit || p.Unit, barcode: p.barcode || p.Barcode
                        });
                        if (typeof MksSound !== 'undefined') MksSound.success();
                        $(self).val('').focus();
                    } else { if (typeof MksSound !== 'undefined') MksSound.error(); toastr.warning('Product not found'); }
                });
            } else if (e.key === 'Escape') { destroySuggest(); }
        });

        $input.on('blur', function () { setTimeout(destroySuggest, 200); });

        return {
            destroy: function () {
                destroySuggest();
                $input.off('input keydown blur');
            }
        };
    }

    return { attach: attach };
})();
