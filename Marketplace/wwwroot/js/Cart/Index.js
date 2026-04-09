$(document).ready(function () { CartPage.init(); });

const CartPage = {
    init() {
        this.loadCart();
        this.bindEvents();
    },

    bindEvents() {
        $(document).on('click', '.btn-cart-minus', function () {
            var row = $(this).closest('tr');
            var input = row.find('.cart-qty');
            var val = parseInt(input.val()) || 1;
            if (val > 1) {
                input.val(val - 1);
                CartPage.updateItem(
                    row.data('product-id'),
                    val - 1,
                    row.data('variant-id') || null
                );
            }
        });

        $(document).on('click', '.btn-cart-plus', function () {
            var row = $(this).closest('tr');
            var input = row.find('.cart-qty');
            var val = parseInt(input.val()) || 1;
            var max = parseInt(row.data('stock')) || 999;
            if (val >= max) {
                Common.showToast('Stok tidak mencukupi (tersedia: ' + max + ')', true);
                return;
            }
            input.val(val + 1);
            CartPage.updateItem(
                row.data('product-id'),
                val + 1,
                row.data('variant-id') || null
            );
        });

        $(document).on('change', '.cart-qty', function () {
            var row = $(this).closest('tr');
            var val = parseInt($(this).val()) || 1;
            var max = parseInt(row.data('stock')) || 999;
            if (val < 1) val = 1;
            if (val > max) {
                val = max;
                Common.showToast('Stok tidak mencukupi (tersedia: ' + max + ')', true);
            }
            $(this).val(val);
            CartPage.updateItem(
                row.data('product-id'),
                val,
                row.data('variant-id') || null
            );
        });

        $(document).on('click', '.btn-cart-remove', function () {
            var row = $(this).closest('tr');
            CartPage.removeItem(
                row.data('product-id'),
                row.data('variant-id') || null
            );
        });

        $(document).on('click', '.cart-product-cell', function () {
            var productId = $(this).closest('tr').data('product-id');
            if (productId) window.location.href = '/Catalog/Detail/' + productId;
        });
    },

    async loadCart() {
        try {
            var data = await Common.Api.get('/Cart/GetCartItems');
            $('#cartLoading').hide();

            if (!data.items || !data.items.length) {
                $('#cartEmpty').show();
                $('#cartContent').hide();
                return;
            }

            this.renderCart(data.items, data.total);
            $('#cartEmpty').hide();
            $('#cartContent').show();
        } catch (e) {
            console.error('Failed loading cart', e);
            $('#cartLoading').html('<p class="text-danger">Gagal memuat keranjang.</p>');
        }
    },

    renderCart(items, total) {
        var html = '';
        items.forEach(function (item) {
            var stockQty = item.stockQuantity || 0;
            var variantAttr = item.variantID
                ? ' data-variant-id="' + item.variantID + '"'
                : '';
            var variantLabel = item.variantName
                ? '<small class="text-muted d-block">Varian: ' + $('<span>').text(item.variantName).html() + '</small>'
                : '';
            var imgHtml = item.imageUrl
                ? '<img src="' + item.imageUrl + '" class="cart-item-img rounded" />'
                : '<div class="cart-item-img-placeholder rounded"><i class="bi bi-box-seam"></i></div>';
            html += '<tr data-product-id="' + item.productID + '"' + variantAttr + ' data-stock="' + stockQty + '">' +
                '<td class="cart-product-cell" style="cursor:pointer;">' +
                '  <div class="d-flex align-items-center gap-2">' +
                '    ' + imgHtml +
                '    <div>' +
                '      <a href="/Catalog/Detail/' + item.productID + '" class="fw-semibold text-decoration-none text-dark">' + item.productName + '</a>' +
                variantLabel +
                '      <small class="text-muted">Stok: ' + stockQty + '</small>' +
                '    </div>' +
                '  </div>' +
                '</td>' +
                '<td class="text-nowrap">' + Common.formatRupiah(item.unitPrice) + '</td>' +
                '<td>' +
                '  <div class="input-group input-group-sm" style="width:120px;">' +
                '    <button class="btn btn-outline-secondary btn-cart-minus" type="button">−</button>' +
                '    <input type="number" class="form-control text-center cart-qty" value="' + item.quantity + '" min="1" max="' + stockQty + '" />' +
                '    <button class="btn btn-outline-secondary btn-cart-plus" type="button">+</button>' +
                '  </div>' +
                '</td>' +
                '<td class="fw-semibold text-nowrap">' + Common.formatRupiah(item.subtotal) + '</td>' +
                '<td><button class="btn btn-sm btn-outline-danger btn-cart-remove" title="Hapus"><i class="bi bi-trash"></i></button></td>' +
                '</tr>';
        });
        $('#cartBody').html(html);
        $('#cartTotal').text(Common.formatRupiah(total));
    },

    async updateItem(productId, quantity, variantId) {
        try {
            var payload = {
                productId: productId,
                quantity: quantity
            };
            if (variantId) payload.variantId = variantId;
            var res = await Common.Api.post('/Cart/Update', payload);
            if (res.success) {
                Common.updateCartBadge(res.cartCount);
                this.loadCart();
            } else {
                Common.showToast(res.message || 'Gagal mengupdate keranjang.', true);
                this.loadCart();
            }
        } catch (e) {
            Common.showToast('Gagal mengupdate keranjang.', true);
        }
    },

    async removeItem(productId, variantId) {
        try {
            var payload = { productId: productId };
            if (variantId) payload.variantId = variantId;
            var res = await Common.Api.post('/Cart/Remove', payload);
            if (res.success) {
                Common.updateCartBadge(res.cartCount);
                this.loadCart();
            }
        } catch (e) {
            Common.showToast('Gagal menghapus item.', true);
        }
    }
};
