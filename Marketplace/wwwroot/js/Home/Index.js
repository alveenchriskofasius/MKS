$(document).ready(function () { HomePage.init(); });

const HomePage = {
    wishlistIds: [],
    allProductsSkip: 0,
    allProductsLoading: false,
    allProductsHasMore: true,
    PAGE_SIZE: 12,

    init() {
        this.loadWishlist();
        this.loadData();
        this.loadAllProducts();
        this.bindScrollEvent();
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

    async loadData() {
        try {
            const data = await Common.Api.get('/Home/GetHomeData');

            // Hero
            if (data.storeName) $('#heroStoreName').text(data.storeName);
            if (data.storeAddress) {
                $('#heroAddress span').text(data.storeAddress);
                $('#heroAddress').show();
            }
            if (data.storePhone) {
                $('#heroPhone span').text(data.storePhone);
                $('#heroPhone').show();
            }

            // Discounted
            if (data.discounted && data.discounted.length) {
                var discHtml = '';
                var self = this;
                data.discounted.forEach(function (p) {
                    discHtml += Common.buildProductCard(p, self.isWishlisted(p.id));
                });
                $('#discountedList').html(discHtml);
                $('#sectionDiscounted').show();
            }

            // Popular
            if (data.popular && data.popular.length) {
                var popHtml = '';
                var self = this;
                data.popular.forEach(function (p) {
                    popHtml += Common.buildProductCard(p, self.isWishlisted(p.id));
                });
                $('#popularList').html(popHtml);
                $('#sectionPopular').show();
            }
        } catch (e) {
            console.error('Failed loading home data', e);
        }
    },

    async loadAllProducts() {
        if (this.allProductsLoading || !this.allProductsHasMore) return;
        this.allProductsLoading = true;
        $('#loadMoreSpinner').show();

        try {
            var res = await Common.Api.get('/Home/GetProducts?skip=' + this.allProductsSkip + '&take=' + this.PAGE_SIZE);
            var products = res.products || [];
            var self = this;
            var html = '';
            products.forEach(function (p) {
                html += Common.buildProductCard(p, self.isWishlisted(p.id));
            });
            $('#allProductsList').append(html);
            this.allProductsSkip += products.length;
            this.allProductsHasMore = res.hasMore;

            if (!this.allProductsHasMore) {
                $('#noMoreProducts').show();
            }
        } catch (e) {
            console.error('Failed loading products', e);
        } finally {
            this.allProductsLoading = false;
            $('#loadMoreSpinner').hide();
        }
    },

    bindScrollEvent() {
        var self = this;
        $(window).on('scroll', function () {
            if (self.allProductsLoading || !self.allProductsHasMore) return;
            var scrollBottom = $(window).scrollTop() + $(window).height();
            var docHeight = $(document).height();
            if (scrollBottom >= docHeight - 300) {
                self.loadAllProducts();
            }
        });
    }
};
