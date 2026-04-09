$(document).ready(function () { HomePage.init(); });

const HomePage = {
    wishlistIds: [],
    selectedCategory: null,
    searchQuery: '',
    skip: 0,
    loading: false,
    hasMore: true,
    PAGE_SIZE: 20,

    init() {
        this.parseUrlParams();
        this.loadWishlist();
        this.loadCategories();
        this.loadProducts(true);
        this.loadPopular();
        this.bindEvents();
        this.bindScrollEvent();
    },

    parseUrlParams() {
        var params = new URLSearchParams(window.location.search);
        var catId = params.get('categoryId');
        this.selectedCategory = catId ? parseInt(catId) : null;
        this.searchQuery = params.get('q') || '';
        if (this.searchQuery) {
            $('#searchInput').val(this.searchQuery);
            $('#searchTerm').text(this.searchQuery);
            $('#searchInfo').show();
            $('#sectionPopular').hide();
        }
    },

    async loadWishlist() {
        try {
            var who = await Common.Api.get('/Account/WhoAmI');
            if (who.loggedIn) {
                var res = await Common.Api.get('/Wishlist/GetWishlistProductIds');
                this.wishlistIds = res.ids || [];
            }
        } catch (e) { }
    },

    isWishlisted(productId) {
        return this.wishlistIds.indexOf(productId) !== -1;
    },

    bindEvents() {
        $(document).on('click', '.cat-filter', function (e) {
            e.preventDefault();
            $('.cat-filter').removeClass('active');
            $(this).addClass('active');
            var id = $(this).data('id');
            HomePage.selectedCategory = id || null;
            HomePage.skip = 0;
            HomePage.hasMore = true;
            if (id) {
                $('#sectionPopular').hide();
            } else if (!HomePage.searchQuery) {
                $('#sectionPopular').show();
            }
            HomePage.loadProducts(true);
        });
    },

    async loadCategories() {
        try {
            var categories = await Common.Api.get('/Catalog/GetCategoryList');
            var self = this;
            var html = '<a href="#" class="list-group-item list-group-item-action cat-filter' +
                (!self.selectedCategory ? ' active' : '') + '" data-id="">' +
                '<i class="bi bi-grid-3x3-gap-fill me-2"></i>Semua Produk</a>';
            categories.forEach(function (cat) {
                html += '<a href="#" class="list-group-item list-group-item-action cat-filter' +
                    (self.selectedCategory === cat.id ? ' active' : '') +
                    '" data-id="' + cat.id + '">' +
                    '<i class="bi bi-tag me-2"></i>' + cat.name + '</a>';
            });
            $('#categorySidebar').html(html);
        } catch (e) {
            console.error('Failed loading categories', e);
        }
    },

    async loadProducts(reset) {
        if (this.loading || (!this.hasMore && !reset)) return;
        if (reset) {
            this.skip = 0;
            this.hasMore = true;
            $('#productGrid').empty();
            $('#noMoreProducts').hide();
            $('#emptyState').hide();
        }
        this.loading = true;
        $('#loadMoreSpinner').show();

        try {
            var url = '/Catalog/GetProductList?skip=' + this.skip + '&take=' + this.PAGE_SIZE;
            if (this.selectedCategory) url += '&categoryId=' + this.selectedCategory;
            if (this.searchQuery) url += '&q=' + encodeURIComponent(this.searchQuery);

            var products = await Common.Api.get(url);
            var self = this;
            var $grid = $('#productGrid');

            if (!products || !products.length) {
                if (reset) $('#emptyState').show();
                this.hasMore = false;
                $('#noMoreProducts').show();
                return;
            }

            products.forEach(function (p) {
                $grid.append(Common.buildProductCard(p, self.isWishlisted(p.id)));
            });

            this.skip += products.length;
            this.hasMore = products.length >= this.PAGE_SIZE;
            if (!this.hasMore) $('#noMoreProducts').show();
        } catch (e) {
            console.error('Failed loading products', e);
        } finally {
            this.loading = false;
            $('#loadMoreSpinner').hide();
        }
    },

    async loadPopular() {
        try {
            var data = await Common.Api.get('/Home/GetHomeData');
            if (data.popular && data.popular.length) {
                var self = this;
                var html = '';
                data.popular.forEach(function (p) {
                    html += '<div class="popular-card flex-shrink-0" style="width:160px;">' +
                        '<a href="/Catalog/Detail/' + p.id + '" class="text-decoration-none">' +
                        '<div class="card border-0 shadow-sm h-100">' +
                        '  <div class="bg-light d-flex align-items-center justify-content-center overflow-hidden" style="height:100px;border-radius:var(--mp-card-radius) var(--mp-card-radius) 0 0;">' +
                        (p.imageUrl ? '<img src="' + p.imageUrl + '" style="width:100%;height:100%;object-fit:cover;" alt="' + p.name + '" />' :
                            '<i class="bi bi-box-seam" style="font-size:2rem;color:#ccc;"></i>') +
                        '  </div>' +
                        '  <div class="card-body p-2">' +
                        '    <p class="mb-0 small fw-semibold text-dark" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + p.name + '">' + p.name + '</p>' +
                        '    <p class="mb-0 small fw-bold" style="color:var(--mp-red);">' + Common.formatRupiah(p.finalPrice || p.unitPrice) + '</p>' +
                        '  </div>' +
                        '</div>' +
                        '</a></div>';
                });
                $('#popularList').html(html);
                if (!self.searchQuery && !self.selectedCategory) {
                    $('#sectionPopular').show();
                }
            }
        } catch (e) {
            console.error('Failed loading popular products', e);
        }
    },

    bindScrollEvent() {
        var self = this;
        $(window).on('scroll.home', function () {
            if (self.loading || !self.hasMore) return;
            var scrollBottom = $(window).scrollTop() + $(window).height();
            var docHeight = $(document).height();
            if (scrollBottom >= docHeight - 400) {
                self.loadProducts(false);
            }
        });
    }
};
