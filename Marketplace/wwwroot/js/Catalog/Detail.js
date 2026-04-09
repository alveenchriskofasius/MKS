$(document).ready(function () { DetailPage.init(); });

const DetailPage = {
    product: null,
    selectedVariant: null,

    init() {
        this.loadProduct();
        this.bindEvents();
    },

    bindEvents() {
        $('#btnQtyMinus').on('click', function () {
            var val = parseInt($('#qtyInput').val()) || 1;
            if (val > 1) $('#qtyInput').val(val - 1);
        });

        $('#btnQtyPlus').on('click', function () {
            var val = parseInt($('#qtyInput').val()) || 1;
            var max;
            if (DetailPage.selectedVariant) {
                max = DetailPage.selectedVariant.stockQuantity;
            } else if (DetailPage.product && !DetailPage.product.hasVariants) {
                max = DetailPage.product.stockQuantity;
            } else {
                max = 0; // must pick variant first
            }
            if (val < max) $('#qtyInput').val(val + 1);
        });

        $('#btnAddToCart').on('click', function () {
            if (!DetailPage.product) return;

            if (DetailPage.product.hasVariants
                && DetailPage.product.variants
                && DetailPage.product.variants.length > 0
                && !DetailPage.selectedVariant) {
                $('#variantWarning').show();
                return;
            }

            Common.Api.get('/Account/WhoAmI').then(function (who) {
                if (!who.loggedIn) {
                    window.location.href = '/Account/Login';
                    return;
                }
                var qty = parseInt($('#qtyInput').val()) || 1;
                var variantId = DetailPage.selectedVariant
                    ? DetailPage.selectedVariant.id
                    : null;
                var variantName = DetailPage.selectedVariant
                    ? DetailPage.selectedVariant.name
                    : null;
                DetailPage.addToCart(
                    DetailPage.product.id,
                    qty,
                    variantId,
                    variantName
                );
            }).catch(function () {
                window.location.href = '/Account/Login';
            });
        });

        $('#btnWishlist').on('click', function () {
            if (!DetailPage.product) return;
            Common.toggleWishlist(DetailPage.product.id, $(this));
        });

        $(document).on('click', '.variant-option', function () {
            var $btn = $(this);
            $('.variant-option').removeClass('active btn-success').addClass('btn-outline-secondary');
            $btn.removeClass('btn-outline-secondary').addClass('active btn-success');
            var variantStock = parseInt($btn.data('stock'), 10) || 0;
            DetailPage.selectedVariant = {
                id: parseInt($btn.data('id')),
                name: $btn.data('name'),
                stockQuantity: variantStock
            };
            $('#variantWarning').hide();
            // Update qty max and stock display to reflect chosen variant
            $('#qtyInput').attr('max', variantStock).val(1);
            if (variantStock > 0) {
                $('#detailStock').html('Stok: <span class="text-success fw-bold">Tersedia (' + variantStock + ')</span>');
                $('#addToCartSection').show();
            } else {
                $('#detailStock').html('Stok: <span class="text-danger fw-bold">Habis</span>');
            }
        });
    },

    async loadProduct() {
        try {
            var data = await Common.Api.get('/Catalog/GetProductDetail?id=' + __productId);
            if (!data) {
                $('#productLoading').html('<p class="text-muted">Produk tidak ditemukan.</p>');
                return;
            }

            this.product = data;

            $('#bcProductName').text(data.name);
            $('#detailName').text(data.name);
            $('#detailCategory').text(data.categoryName);
            $('#detailUnit').text(data.unitName);

            // Show product image if available
            if (data.imageUrl) {
                $('#detailImagePlaceholder').hide();
                $('#detailImage').attr('src', data.imageUrl).show();
            }

            if (data.hasDiscount) {
                $('#discountBadge').text('DISKON ' + data.discountPercentage + '%');
                $('#originalPrice').text(Common.formatRupiah(data.unitPrice));
                $('#discountSection').show();
                $('#detailPrice').addClass('text-danger').text(Common.formatRupiah(data.finalPrice));
                // Show promo info
                if (data.promoName) {
                    var promoInfo = '<i class="bi bi-lightning-fill text-warning"></i> <strong>' + data.promoName + '</strong>';
                    if (data.promoEndDate) {
                        var end = new Date(data.promoEndDate);
                        promoInfo += ' <small class="text-muted">(s/d ' + end.toLocaleDateString('id-ID') + ')</small>';
                    }
                    $('#promoInfo').html(promoInfo).show();
                }
            } else {
                $('#detailPrice').text(Common.formatRupiah(data.unitPrice));
            }

            if (data.description) {
                $('#detailDescription').text(data.description).show();
            }

            if (data.inStock) {
                $('#detailStock').html('Stok: <span class="text-success fw-bold">Tersedia (' + data.stockQuantity + ')</span>');
                $('#qtyInput').attr('max', data.stockQuantity);
                $('#addToCartSection').show();
            } else {
                $('#detailStock').html('Stok: <span class="text-danger fw-bold">Habis</span>');
            }

            if (data.hasVariants && data.variants && data.variants.length > 0) {
                var html = '';
                data.variants.forEach(function (v) {
                    var safeName = $('<span>').text(v.name).html();
                    var stockLabel = v.stockQuantity > 0
                        ? ' <small class="text-muted">(stok: ' + v.stockQuantity + ')</small>'
                        : ' <small class="text-danger">(habis)</small>';
                    html += '<button type="button"'
                        + ' class="btn btn-sm btn-outline-secondary variant-option"'
                        + ' data-id="' + v.id + '"'
                        + ' data-name="' + safeName + '"'
                        + ' data-stock="' + v.stockQuantity + '">'  
                        + safeName + stockLabel
                        + '</button>';
                });
                $('#variantOptions').html(html);
                $('#variantSection').show();
                // Hide addToCartSection until a variant is chosen
                $('#addToCartSection').hide();
                $('#detailStock').html('Stok: <span class="text-muted">Pilih varian untuk melihat stok</span>');
            }

            $('#productLoading').hide();
            $('#productContent').show();

            // Check wishlist state
            Common.Api.get('/Wishlist/IsInWishlist?productId=' + data.id).then(function (w) {
                if (w.inWishlist) {
                    $('#btnWishlist').find('i').removeClass('bi-heart').addClass('bi-heart-fill');
                    $('#btnWishlist').addClass('active');
                }
            }).catch(function () { });
        } catch (e) {
            console.error('Failed loading product detail', e);
            $('#productLoading').html('<p class="text-danger">Gagal memuat detail produk.</p>');
        }
    },

    async addToCart(productId, qty, variantId, variantName) {
        try {
            var payload = {
                productId: productId,
                quantity: qty
            };
            if (variantId) {
                payload.variantId = variantId;
                payload.variantName = variantName;
            }
            var res = await Common.Api.post('/Cart/Add', payload);
            if (res.success) {
                Common.updateCartBadge(res.cartCount);
                Common.showToast('Produk ditambahkan ke keranjang!');
            } else {
                Common.showToast(res.message || 'Gagal menambahkan produk.', true);
            }
        } catch (e) {
            Common.showToast('Gagal menambahkan produk.', true);
        }
    }
};
