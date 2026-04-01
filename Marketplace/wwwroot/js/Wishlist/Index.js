$(document).ready(function () { WishlistPage.init(); });

const WishlistPage = {
    init() {
        this.loadItems();
    },

    async loadItems() {
        try {
            var items = await Common.Api.get('/Wishlist/GetWishlistItems');
            $('#wishlistLoading').hide();

            if (!items || !items.length) {
                $('#wishlistEmpty').show();
                return;
            }

            var html = '';
            items.forEach(function (p) {
                html += WishlistPage.buildCard(p);
            });
            $('#wishlistGrid').html(html);
            $('#wishlistContent').show();

            // Bind remove buttons
            $(document).off('click', '.btn-remove-wish').on('click', '.btn-remove-wish', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var productId = $(this).data('id');
                WishlistPage.removeItem(productId);
            });

            // Bind add-to-cart buttons
            $(document).off('click', '.btn-wish-cart').on('click', '.btn-wish-cart', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var productId = $(this).data('id');
                WishlistPage.addToCart(productId);
            });
        } catch (e) {
            console.error('Failed loading wishlist', e);
            $('#wishlistLoading').html('<p class="text-danger">Gagal memuat wishlist.</p>');
        }
    },

    buildCard(p) {
        var imageHtml = p.imageUrl
            ? '<img src="' + p.imageUrl + '" class="card-img-top" alt="' + p.name + '" style="height:200px;object-fit:cover;" />'
            : '<div class="card-img-top bg-light d-flex align-items-center justify-content-center" style="height:200px;"><i class="bi bi-box-seam" style="font-size:3rem;color:#ccc;"></i></div>';

        var priceHtml = '';
        if (p.hasDiscount) {
            priceHtml =
                '<small class="text-muted text-decoration-line-through">' + Common.formatRupiah(p.unitPrice) + '</small>' +
                '<div class="fw-bold text-danger">' + Common.formatRupiah(p.finalPrice) + '</div>';
        } else {
            priceHtml = '<div class="fw-bold">' + Common.formatRupiah(p.unitPrice) + '</div>';
        }

        return '<div class="col" id="wish-item-' + p.id + '">' +
            '<div class="card h-100 product-card shadow-sm border-0 rounded-3 overflow-hidden">' +
            '  <div class="position-relative">' + imageHtml +
            '    <button class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 rounded-circle btn-remove-wish" data-id="' + p.id + '" title="Hapus dari wishlist">' +
            '      <i class="bi bi-heart-fill"></i>' +
            '    </button>' +
            '  </div>' +
            '  <div class="card-body d-flex flex-column">' +
            '    <span class="badge bg-light text-dark border mb-1">' + (p.categoryName || '') + '</span>' +
            '    <h6 class="card-title mb-1">' +
            '      <a href="/Catalog/Detail/' + p.id + '" class="text-decoration-none text-dark">' + p.name + '</a>' +
            '    </h6>' +
            '    <div class="mt-auto">' + priceHtml +
            '      <button class="btn btn-warning btn-sm w-100 mt-2 btn-wish-cart" data-id="' + p.id + '">' +
            '        <i class="bi bi-cart-plus"></i> Keranjang' +
            '      </button>' +
            '    </div>' +
            '  </div>' +
            '</div>' +
            '</div>';
    },

    async removeItem(productId) {
        try {
            var res = await Common.Api.post('/Wishlist/Remove', { productId: productId });
            if (res.success) {
                $('#wish-item-' + productId).fadeOut(300, function () {
                    $(this).remove();
                    Common.updateWishlistBadge(res.count);
                    if ($('#wishlistGrid').children(':visible').length === 0) {
                        $('#wishlistContent').hide();
                        $('#wishlistEmpty').show();
                    }
                });
                Common.showToast('Dihapus dari wishlist.');
            }
        } catch (e) {
            Common.showToast('Gagal menghapus dari wishlist.', true);
        }
    },

    async addToCart(productId) {
        try {
            var res = await Common.Api.post('/Cart/Add', { productId: productId, quantity: 1 });
            if (res.success) {
                Common.updateCartBadge(res.cartCount);
                Common.showToast('Ditambahkan ke keranjang!');
            } else {
                Common.showToast(res.message || 'Gagal menambahkan.', true);
            }
        } catch (e) {
            Common.showToast('Gagal menambahkan ke keranjang.', true);
        }
    }
};
