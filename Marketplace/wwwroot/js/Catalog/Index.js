$(document).ready(function () { CatalogPage.init(); });

const CatalogPage = {
    selectedCategory: null,
    searchQuery: '',

    init() {
        this.parseUrlParams();
        this.loadCategories();
        this.loadProducts();
        this.bindEvents();
    },

    parseUrlParams() {
        var params = new URLSearchParams(window.location.search);
        var catId = params.get('categoryId');
        this.selectedCategory = catId ? parseInt(catId) : null;
        this.searchQuery = params.get('q') || '';
        if (this.searchQuery) {
            $('#searchInput').val(this.searchQuery);
            $('#searchTerm').text('"' + this.searchQuery + '"');
            $('#searchInfo').show();
        }
    },

    bindEvents() {
        $(document).on('click', '.cat-filter', function (e) {
            e.preventDefault();
            $('.cat-filter').removeClass('active');
            $(this).addClass('active');
            var id = $(this).data('id');
            CatalogPage.selectedCategory = id || null;
            CatalogPage.loadProducts();
        });
    },

    async loadCategories() {
        try {
            var categories = await Common.Api.get('/Catalog/GetCategoryList');
            var html = '<a href="#" class="list-group-item list-group-item-action cat-filter' +
                (!this.selectedCategory ? ' active' : '') + '" data-id="">Semua Produk</a>';
            categories.forEach(function (cat) {
                html += '<a href="#" class="list-group-item list-group-item-action cat-filter' +
                    (CatalogPage.selectedCategory === cat.id ? ' active' : '') +
                    '" data-id="' + cat.id + '">' + cat.name + '</a>';
            });
            $('#categorySidebar').html(html);
        } catch (e) {
            console.error('Failed loading categories', e);
        }
    },

    async loadProducts() {
        try {
            $('#catalogLoading').show();
            $('#productGrid').empty();
            $('#emptyState').hide();

            var url = '/Catalog/GetProductList?';
            if (this.selectedCategory) url += 'categoryId=' + this.selectedCategory + '&';
            if (this.searchQuery) url += 'q=' + encodeURIComponent(this.searchQuery);

            var products = await Common.Api.get(url);
            $('#catalogLoading').hide();

            if (!products || !products.length) {
                $('#emptyState').show();
                return;
            }

            var $grid = $('#productGrid');
            products.forEach(function (p) {
                $grid.append(Common.buildProductCard(p));
            });
        } catch (e) {
            $('#catalogLoading').hide();
            console.error('Failed loading products', e);
        }
    }
};
