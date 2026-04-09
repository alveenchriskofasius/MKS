/* ========================================================================
   Common – Shared utilities for Marketplace (mirrors backoffice Common.js)
   ======================================================================== */
var Common = {
    Api: {
        async get(url) {
            const res = await fetch(url, { method: 'GET', credentials: 'same-origin', headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error(res.statusText || 'Request failed');
            return await res.json();
        },

        async post(url, data) {
            const params = new URLSearchParams(data);
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
                body: params.toString()
            });
            if (!res.ok) throw new Error(res.statusText || 'Request failed');
            return await res.json();
        }
    },

    formatRupiah(value) {
        return 'Rp ' + Number(value || 0).toLocaleString('id-ID');
    },

    showToast(message, isError) {
        var id = 'toast-' + Date.now();
        var bg = isError ? 'bg-danger' : 'bg-success';
        var html =
            '<div id="' + id + '" class="toast align-items-center text-white ' + bg + ' border-0 position-fixed bottom-0 end-0 m-3" role="alert" style="z-index:9999;">' +
            '  <div class="d-flex">' +
            '    <div class="toast-body">' + message + '</div>' +
            '    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>' +
            '  </div>' +
            '</div>';
        $('body').append(html);
        var toastEl = document.getElementById(id);
        var toast = new bootstrap.Toast(toastEl, { delay: 2500 });
        toast.show();
        $(toastEl).on('hidden.bs.toast', function () { $(this).remove(); });
    },

    updateCartBadge(count) {
        var badge = $('#cart-badge');
        if (count > 0) {
            badge.text(count).show();
        } else {
            badge.hide();
        }
    },

    updateWishlistBadge(count) {
        var badge = $('#wishlist-badge');
        if (count > 0) {
            badge.text(count).show();
        } else {
            badge.hide();
        }
    },

    updateNotifBadge(count) {
        var badge = $('#notif-badge');
        if (count > 0) {
            badge.text(count).show();
        } else {
            badge.hide();
        }
    },

    buildProductCard(p, wishlisted) {
        var priceHtml = '';
        if (p.hasDiscount) {
            priceHtml =
                '<small class="text-muted text-decoration-line-through">' + Common.formatRupiah(p.unitPrice) + '</small>' +
                '<div class="fw-bold text-danger">' + Common.formatRupiah(p.finalPrice) + '</div>';
        } else {
            priceHtml = '<div class="fw-bold">' + Common.formatRupiah(p.unitPrice) + '</div>';
        }

        var discountBadge = '';
        if (p.hasDiscount) {
            discountBadge = '<span class="badge bg-danger">-' + p.discountPercentage + '%</span>';
        }

        var promoHtml = '';
        if (p.promoName) {
            promoHtml = '<div class="promo-ribbon"><i class="bi bi-lightning-fill"></i> ' + p.promoName + '</div>';
        }
        if (p.promoEndDate) {
            var endDate = new Date(p.promoEndDate);
            var now = new Date();
            var diffMs = endDate - now;
            var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays > 0 && diffDays <= 7) {
                promoHtml += '<small class="text-danger d-block"><i class="bi bi-clock"></i> Berakhir ' + diffDays + ' hari lagi</small>';
            } else if (diffDays > 7) {
                promoHtml += '<small class="text-muted d-block"><i class="bi bi-clock"></i> s/d ' + endDate.toLocaleDateString('id-ID') + '</small>';
            }
        }

        var imageHtml = p.imageUrl
            ? '<img src="' + p.imageUrl + '" class="card-img-top" alt="' + p.name + '" style="height:200px;object-fit:cover;" />'
            : '<div class="card-img-top bg-light d-flex align-items-center justify-content-center" style="height:200px;"><i class="bi bi-box-seam" style="font-size:3rem;color:#ccc;"></i></div>';

        var heartClass = wishlisted ? 'bi-heart-fill' : 'bi-heart';
        var activeClass = wishlisted ? ' active' : '';
        var wishBtn = '<button class="btn btn-sm btn-wish-toggle position-absolute top-0 end-0 m-2 rounded-circle' + activeClass + '" ' +
            'data-id="' + p.id + '" title="Wishlist" style="z-index:3;">' +
            '<i class="bi ' + heartClass + '"></i></button>';

        return '<div class="col">' +
            '<div class="card h-100 product-card shadow-sm border-0 rounded-3 overflow-hidden">' +
            '  <div class="position-relative">' + imageHtml + wishBtn + (promoHtml ? '<div class="promo-overlay">' + promoHtml + '</div>' : '') + '</div>' +
            '  <div class="card-body d-flex flex-column">' +
            '    <div class="d-flex justify-content-between align-items-start mb-2">' +
            '      <span class="badge bg-light text-dark border">' + (p.categoryName || '') + '</span>' +
            '      ' + discountBadge +
            '    </div>' +
            '    <h6 class="card-title mb-1">' +
            '      <a href="/Catalog/Detail/' + p.id + '" class="text-decoration-none text-dark stretched-link">' + p.name + '</a>' +
            '    </h6>' +
            '    <p class="text-muted small mb-2">' + (p.unitName || '') + '</p>' +
            '    <div class="mt-auto">' +
            '      ' + priceHtml +
            '      <small class="text-muted">Stok: ' + p.stockQuantity + '</small>' +
            '    </div>' +
            '  </div>' +
            '</div>' +
            '</div>';
    },

    async toggleWishlist(productId, $btn) {
        try {
            var who = await Common.Api.get('/Account/WhoAmI');
            if (!who.loggedIn) {
                window.location.href = '/Account/Login';
                return;
            }
            var res = await Common.Api.post('/Wishlist/Toggle', { productId: productId });
            if (res.success) {
                var $icon = $btn.find('i');
                if (res.added) {
                    $icon.removeClass('bi-heart').addClass('bi-heart-fill');
                    $btn.addClass('active');
                    Common.showToast('Ditambahkan ke wishlist!');
                } else {
                    $icon.removeClass('bi-heart-fill').addClass('bi-heart');
                    $btn.removeClass('active');
                    Common.showToast('Dihapus dari wishlist.');
                }
                Common.updateWishlistBadge(res.count);
            }
        } catch (e) {
            Common.showToast('Gagal memperbarui wishlist.', true);
        }
    }
};

// Global: load cart badge, auth state, search form
$(function () {
    // Auth state – toggle navbar guest/user and load user-specific badges
    Common.Api.get('/Account/WhoAmI').then(function (res) {
        if (res.loggedIn) {
            $('#navUserName').text(res.name);
            $('#navUser').show();
            $('#navWishlist').show();
            $('#navNotification').show();

            // Load cart badge only when authenticated
            Common.Api.get('/Cart/GetCartCount').then(function (c) {
                Common.updateCartBadge(c.count);
            }).catch(function () { });

            // Load wishlist badge
            Common.Api.get('/Wishlist/GetCount').then(function (w) {
                Common.updateWishlistBadge(w.count);
            }).catch(function () { });

            // Load notification badge
            Common.Api.get('/Notification/GetUnreadCount').then(function (n) {
                Common.updateNotifBadge(n.count);
            }).catch(function () { });
        } else {
            $('#navGuest').show();
        }
    }).catch(function () {
        $('#navGuest').show();
    });

    $('#searchForm').on('submit', function (e) {
        e.preventDefault();
        var q = $('#searchInput').val().trim();
        window.location.href = '/?q=' + encodeURIComponent(q);
    });

    // Wishlist toggle on product cards
    $(document).on('click', '.btn-wish-toggle', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var productId = $(this).data('id');
        Common.toggleWishlist(productId, $(this));
    });

    // Load footer store profile
    $.get('/Home/GetStoreProfile', function (p) {
        if (p.storeName) $('#footerStoreName').text(p.storeName);
        if (p.address) $('#footerAddress').text(p.address);
        if (p.phone) $('#footerPhone').text(p.phone);
        if (p.schedule) {
            var lines = p.schedule.split('\n').filter(function (l) { return l.trim(); });
            var html = lines.map(function (line) {
                return '<p class="text-muted small mb-1"><i class="bi bi-clock me-1"></i> ' +
                    $('<span>').text(line).html() + '</p>';
            }).join('');
            $('#footerSchedule').html(html);
        }
    });
});
