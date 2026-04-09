$(document).ready(function () {
    ProductPage.init();
});

const ProductPage = {
    currentId: null,
    allProducts: [],
    categories: [],
    units: [],
    suppliers: [],
    activeCatFilter: '',

    init() {
        this.loadDropdownData();
        this.loadProducts();
        this.bindEvents();
    },

    bindEvents() {
        $('#btnAddProduct').off('click').on('click', () => this.loadForm(0));
        $('#prodSearch').on('input', () => this.renderList());
        $(document).on('click', '.prod-cat-filter', function () {
            $('.prod-cat-filter').removeClass('active');
            $(this).addClass('active');
            ProductPage.activeCatFilter = $(this).data('cat') || '';
            ProductPage.renderList();
        });
        // Category/Unit modal save buttons
        $('#buttonSaveCategory').off('click').on('click', () => this.saveCategory());
        $('#buttonSaveUnit').off('click').on('click', () => this.saveUnit());
    },

    async loadDropdownData() {
        try {
            const [catRes, unitRes, supRes] = await Promise.all([
                Common.Api.get('/Product/GetCategoryList'),
                Common.Api.get('/Product/GetUnitList'),
                Common.Api.get('/Product/GetSupplierList')
            ]);
            this.categories = (catRes && catRes.result) ? catRes.result : catRes || [];
            this.units = (unitRes && unitRes.result) ? unitRes.result : unitRes || [];
            this.suppliers = (supRes && supRes.result) ? supRes.result : supRes || [];
            this.buildCategoryFilters();
        } catch (e) { console.error('Failed loading dropdown data', e); }
    },

    buildCategoryFilters() {
        const $wrap = $('.prod-cat-filter').parent();
        $wrap.find('.prod-cat-filter:not(:first)').remove();
        this.categories.forEach(c => {
            $wrap.append(`<button class="btn btn-sm btn-outline-secondary prod-cat-filter" data-cat="${c.id}">${c.categoryName}</button>`);
        });
    },

    async loadProducts() {
        try {
            const res = await Common.Api.get('/Product/GetProductList');
            this.allProducts = (res && res.result) ? res.result : res || [];
            this.renderList();
        } catch (e) {
            console.error('GetProductList failed', e);
            toastr.error(e.message || 'Failed load products');
        }
    },

    renderList() {
        const q = ($('#prodSearch').val() || '').toLowerCase();
        const catFilter = this.activeCatFilter;
        let list = this.allProducts;

        if (catFilter) list = list.filter(p => String(p.categoryID) === String(catFilter));
        if (q) list = list.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.barcode || '').toLowerCase().includes(q) ||
            (p.supplierName || '').toLowerCase().includes(q)
        );

        // Sort by category then unit then name
        list.sort((a, b) => {
            const ca = (a.categoryName || '').localeCompare(b.categoryName || '');
            if (ca !== 0) return ca;
            const ua = (a.unitName || '').localeCompare(b.unitName || '');
            if (ua !== 0) return ua;
            return (a.name || '').localeCompare(b.name || '');
        });

        const $ul = $('#prodList').empty();
        if (!list.length) {
            $ul.html('<li class="text-center text-muted py-4"><small>No products found</small></li>');
            return;
        }

        let lastGroup = '';
        list.forEach(p => {
            const group = (p.categoryName || 'Uncategorized') + ' · ' + (p.unitName || '-');
            if (group !== lastGroup) {
                $ul.append(`<li class="prod-group-header"><i class="fa fa-tags text-muted"></i>${p.categoryName || 'Uncategorized'} <span class="text-muted mx-1">·</span> <i class="fa fa-ruler text-muted"></i>${p.unitName || '-'}</li>`);
                lastGroup = group;
            }

            const isActive = p.id === this.currentId;
            const avatarHtml = p.imageUrl
                ? `<img src="${p.imageUrl}" class="prod-avatar" style="object-fit:cover;" />`
                : `<div class="prod-avatar">${(p.name || '').substring(0, 2).toUpperCase()}</div>`;
            const stockCls = p.stockQuantity <= 0 ? 'text-danger'
                : p.stockQuantity <= 5 ? 'text-warning' : 'text-muted';

            $ul.append(`
                <li class="prod-list-item${isActive ? ' active' : ''}" data-id="${p.id}">
                    ${avatarHtml}
                    <div class="prod-info">
                        <div class="prod-name text-truncate">${p.name}${p.barcode ? ' <code style="font-size:.65rem">' + p.barcode + '</code>' : ''}</div>
                        <div class="prod-detail text-truncate">Rp ${Number(p.unitPrice || 0).toLocaleString('id-ID')}${p.hasDiscount && p.discountPercentage > 0 ? ' <span class="badge bg-success" style="font-size:.55rem">' + p.discountPercentage + '%</span>' : ''}</div>
                    </div>
                    <span class="prod-stock ${stockCls}">${p.stockQuantity}</span>
                </li>
            `);
        });

        $ul.off('click', '.prod-list-item').on('click', '.prod-list-item', function () {
            ProductPage.loadForm($(this).data('id'));
        });
    },

    async loadForm(id) {
        this.currentId = id;
        $('.prod-list-item').removeClass('active');
        $(`.prod-list-item[data-id="${id}"]`).addClass('active');

        let product = {
            id: 0, name: '', barcode: '', description: '',
            unitPrice: '', purchasePrice: '', categoryID: '',
            unitID: '', supplierID: '', stockQuantity: 0,
            lowStockThreshold: '', hasDiscount: false,
            discountPercentage: 0, imageUrl: ''
        };
        if (id) {
            const found = this.allProducts.find(p => p.id === id);
            if (found) product = found;
        }

        const catOptions = this.categories.map(c => `<option value="${c.id}"${c.id == product.categoryID ? ' selected' : ''}>${c.categoryName}</option>`).join('');
        const unitOptions = this.units.map(u => `<option value="${u.id}"${u.id == product.unitID ? ' selected' : ''}>${u.unitName}</option>`).join('');
        const supOptions = this.suppliers.map(s => `<option value="${s.id}"${s.id == product.supplierID ? ' selected' : ''}>${s.supplierName}</option>`).join('');

        const html = `
            <div class="d-flex align-items-center justify-content-between mb-3">
                <h6 class="mb-0 fw-bold"><i class="fa fa-box-open me-2 text-primary"></i>${id ? 'Edit Product' : 'New Product'}</h6>
                <div class="d-flex gap-2">
                    ${id ? `<button class="btn btn-sm btn-outline-info" id="btnPrintBarcode"><i class="fa fa-barcode me-1"></i>Print Barcode</button>` : ''}
                    ${id ? `<button class="btn btn-sm btn-outline-danger" id="btnDeleteProduct"><i class="fa fa-trash me-1"></i>Delete</button>` : ''}
                    <button class="btn btn-sm btn-outline-secondary" id="btnCancelProduct"><i class="fa fa-times me-1"></i>Cancel</button>
                </div>
            </div>
            <form id="productForm" novalidate>
                <input type="hidden" id="prodID" value="${product.id || 0}" />
                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label fw-semibold small">Name <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="prodName" required value="${this.esc(product.name)}" placeholder="Product name" />
                        <div class="invalid-feedback">Please enter a name.</div>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label fw-semibold small">Barcode</label>
                        <input type="text" class="form-control" id="prodBarcode" value="${this.esc(product.barcode)}" placeholder="Barcode (optional)" />
                    </div>
                    <div class="col-md-12">
                        <label class="form-label fw-semibold small">Description</label>
                        <input type="text" class="form-control" id="prodDescription" value="${this.esc(product.description)}" placeholder="Description" />
                    </div>
                    <div class="col-md-12">
                        <label class="form-label fw-semibold small">Product Image</label>
                        <div class="d-flex align-items-center gap-3">
                            <div id="prodImagePreview" style="width:80px;height:80px;border-radius:8px;overflow:hidden;border:1px solid #dee2e6;display:flex;align-items:center;justify-content:center;background:#f8f9fa;">
                                ${product.imageUrl ? '<img src="' + product.imageUrl + '" style="width:100%;height:100%;object-fit:cover;" />' : '<i class="fa fa-image text-muted" style="font-size:1.5rem"></i>'}
                            </div>
                            <div>
                                <input type="file" class="form-control form-control-sm" id="prodImageFile" accept=".jpg,.jpeg,.png,.webp" style="max-width:280px;" ${!product.id ? 'disabled title="Save product first"' : ''} />
                                <small class="text-muted">${product.id ? 'JPG, PNG, or WebP. Max 2MB.' : 'Save product first to upload image.'}</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label fw-semibold small">Unit Price (Sell) <span class="text-danger">*</span></label>
                        <input type="number" class="form-control" id="prodUnitPrice" required value="${product.unitPrice || ''}" min="0" placeholder="0" />
                        <div class="invalid-feedback">Please enter a price.</div>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label fw-semibold small">Purchase Price (Buy)</label>
                        <input type="number" class="form-control" id="prodPurchasePrice" value="${product.purchasePrice || ''}" min="0" placeholder="0" />
                        <small class="text-muted">Harga beli dari supplier.</small>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label fw-semibold small">Low Stock Threshold</label>
                        <input type="number" class="form-control" id="prodLowStock" value="${product.lowStockThreshold || ''}" min="0" placeholder="e.g. 10" />
                        <small class="text-muted">Alert when stock ≤ this value.</small>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label fw-semibold small">Discount</label>
                        <div class="input-group mb-1" style="max-width:170px;">
                            <input type="number" class="form-control" id="prodDiscountPct" min="0" max="100" step="0.01" value="${product.discountPercentage || 0}" placeholder="0" ${product.hasDiscount ? '' : 'disabled'} />
                            <span class="input-group-text">%</span>
                        </div>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="prodHasDiscount" ${product.hasDiscount ? 'checked' : ''} />
                            <label class="form-check-label small" for="prodHasDiscount">Enable discount</label>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label fw-semibold small">Category <span class="text-danger">*</span></label>
                        <div class="input-group">
                            <select class="form-select" id="prodCategory" required>
                                <option value="">Select category</option>${catOptions}
                            </select>
                            <button type="button" class="btn btn-outline-primary btn-sm" id="btnManageCategory" title="Manage"><i class="fa fa-cog"></i></button>
                        </div>
                        <div class="invalid-feedback">Please select a category.</div>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label fw-semibold small">Unit <span class="text-danger">*</span></label>
                        <div class="input-group">
                            <select class="form-select" id="prodUnit" required>
                                <option value="">Select unit</option>${unitOptions}
                            </select>
                            <button type="button" class="btn btn-outline-primary btn-sm" id="btnManageUnit" title="Manage"><i class="fa fa-cog"></i></button>
                        </div>
                        <div class="invalid-feedback">Please select a unit.</div>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label fw-semibold small">Supplier <span class="text-danger">*</span></label>
                        <select class="form-select" id="prodSupplier" required>
                            <option value="">Select supplier</option>${supOptions}
                        </select>
                        <div class="invalid-feedback">Please select a supplier.</div>
                    </div>
                    <div class="col-md-12">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <label class="form-label fw-semibold small mb-0">Varian Produk</label>
                            <div class="form-check form-switch mb-0">
                                <input class="form-check-input" type="checkbox" id="prodHasVariants" ${product.hasVariants ? 'checked' : ''} />
                                <label class="form-check-label small" for="prodHasVariants">Aktifkan varian</label>
                            </div>
                        </div>
                        <div id="variantSection" style="display:${product.hasVariants ? 'block' : 'none'};max-width:540px;">
                            <div class="d-flex gap-2 mb-2 align-items-end flex-wrap">
                                <div>
                                    <label class="form-label small mb-1">Nama Varian</label>
                                    <input type="text" id="newVariantName" class="form-control form-control-sm" placeholder="e.g. Merah, 1 Liter..." style="width:200px;" />
                                </div>
                                <div>
                                    <label class="form-label small mb-1">Stok Awal</label>
                                    <input type="number" id="newVariantStock" class="form-control form-control-sm" min="0" value="0" style="width:80px;" />
                                </div>
                                <button type="button" id="btnAddVariant" class="btn btn-sm btn-outline-primary"><i class="fa fa-plus"></i> Tambah</button>
                            </div>
                            <table class="table table-sm table-bordered mb-1" id="tableVariants">
                                <thead class="table-light">
                                    <tr><th>Nama Varian</th><th style="width:100px;">Stok</th><th style="width:50px;"></th></tr>
                                </thead>
                                <tbody id="variantTbody"><tr><td colspan="3" class="text-center text-muted small py-2">Belum ada varian.</td></tr></tbody>
                            </table>
                            <small class="text-muted"><i class="fa fa-info-circle me-1"></i>Varian disimpan saat klik tombol Save.</small>
                        </div>
                    </div>
                </div>
            </form>
            <div class="d-flex justify-content-end mt-3 pt-3 border-top">
                <button class="btn btn-primary" id="btnSaveProduct">
                    <span class="spinner-border spinner-border-sm d-none"></span>
                    <i class="fa fa-save me-1"></i>Save
                </button>
            </div>
        `;

        $('#prodFormPanel').html(html);
        this.bindFormEvents(product);
    },

    esc(s) { return $('<span>').text(s || '').html(); },

    bindFormEvents(product) {
        $('#btnSaveProduct').off('click').on('click', (e) => {
            e.preventDefault();
            const form = document.getElementById('productForm');
            if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
            this.save();
        });
        $('#btnDeleteProduct').off('click').on('click', () => this.deleteProduct(this.currentId));
        $('#btnCancelProduct').off('click').on('click', () => this.resetPanel());
        $('#btnPrintBarcode').off('click').on('click', () => this.printBarcode(product));
        $('#btnManageCategory').off('click').on('click', () => this.openCategoryModal());
        $('#btnManageUnit').off('click').on('click', () => this.openUnitModal());
        $('#prodHasDiscount').off('change').on('change', function () {
            const enabled = $(this).is(':checked');
            $('#prodDiscountPct').prop('disabled', !enabled);
            if (!enabled) $('#prodDiscountPct').val(0);
        });
        $('#prodImageFile').off('change').on('change', function () {
            ProductPage.uploadImage(this);
        });
        $('#prodHasVariants').off('change').on('change', function () {
            $('#variantSection').toggle($(this).is(':checked'));
            if ($(this).is(':checked') && ProductPage.currentId) ProductPage.loadVariants(ProductPage.currentId);
        });
        $('#btnAddVariant').off('click').on('click', () => this.addVariant());
        $('#newVariantName').off('keydown').on('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ProductPage.addVariant(); } });
        $('#variantTbody').off('click.del').on('click.del', '.btn-del-variant', function () {
            ProductPage.deleteVariant(parseInt($(this).data('id'), 10), $(this).closest('tr'));
        });
        $('#variantTbody').off('click.rem').on('click.rem', '.btn-remove-variant', function () {
            $(this).closest('tr').remove();
        });
        if (product.id && product.hasVariants) this.loadVariants(product.id);
    },

    async uploadImage(input) {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toastr.error('File too large. Max 2MB.');
            return;
        }
        const formData = new FormData();
        formData.append('id', this.currentId);
        formData.append('file', file);
        try {
            const res = await fetch('/Product/UploadProductImage', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            const result = await res.json();
            if (result && result.success) {
                toastr.success('Image uploaded');
                $('#prodImagePreview').html(
                    '<img src="' + result.imageUrl +
                    '" style="width:100%;height:100%;object-fit:cover;" />');
                // Update in allProducts cache
                const p = this.allProducts.find(
                    x => x.id === this.currentId);
                if (p) p.imageUrl = result.imageUrl;
            } else {
                toastr.error(
                    (result && result.error) || 'Upload failed');
            }
        } catch (e) {
            toastr.error(e.message || 'Upload failed');
        }
    },

    async save() {
        const currentProduct = this.allProducts.find(x => x.id === this.currentId);
        const data = {
            'ProductModel.ID': parseInt($('#prodID').val()) || 0,
            'ProductModel.Name': $('#prodName').val(),
            'ProductModel.Barcode': $('#prodBarcode').val(),
            'ProductModel.Description': $('#prodDescription').val(),
            'ProductModel.UnitPrice': parseFloat($('#prodUnitPrice').val()) || 0,
            'ProductModel.PurchasePrice': parseFloat($('#prodPurchasePrice').val()) || 0,
            'ProductModel.LowStockThreshold': $('#prodLowStock').val() || '',
            'ProductModel.HasDiscount': $('#prodHasDiscount').is(':checked'),
            'ProductModel.DiscountPercentage': parseFloat($('#prodDiscountPct').val()) || 0,
            'ProductModel.CategoryID': parseInt($('#prodCategory').val()) || 0,
            'ProductModel.UnitID': parseInt($('#prodUnit').val()) || 0,
            'ProductModel.SupplierID': parseInt($('#prodSupplier').val()) || 0,
            'ProductModel.ImageUrl': (currentProduct && currentProduct.imageUrl) || '',
            'ProductModel.HasVariants': $('#prodHasVariants').is(':checked'),
        };
        const $btn = $('#btnSaveProduct');
        $btn.prop('disabled', true).find('.spinner-border').removeClass('d-none');
        try {
            const result = await Common.Api.post('/Product/SaveProduct', data);
            if (result && result.success) {
                const savedId = result.id || this.currentId;
                if ($('#prodHasVariants').is(':checked') && savedId)
                    await this.saveAllVariants(savedId);
                toastr.success('Product saved');
                this.currentId = savedId;
                await this.loadProducts();
                await this.loadDropdownData();
                this.loadForm(savedId);
            } else {
                toastr.error((result && result.error) || 'Failed to save');
            }
        } catch (e) { toastr.error(e.message || 'Failed'); }
        finally { $btn.prop('disabled', false).find('.spinner-border').addClass('d-none'); }
    },

    async saveAllVariants(productId) {
        const saves = [];
        $('#variantTbody tr[data-id]').each(function () {
            const id = parseInt($(this).data('id'), 10) || 0;
            const name = $(this).find('.variant-name-input').val().trim();
            const stock = parseInt($(this).find('.variant-stock-input').val(), 10) || 0;
            if (name) saves.push({ ID: id, ProductID: productId, Name: name, StockQuantity: stock });
        });
        for (const v of saves) await Common.Api.post('/Product/SaveVariant', v);
    },

    deleteProduct(id) {
        if (!id) return;
        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it',
            showLoaderOnConfirm: true,
            preConfirm: () => Common.Api.post('/Product/DeleteProduct', { id })
                .then(() => { toastr.success('Product deleted'); this.resetPanel(); this.loadProducts(); })
                .catch(e => Swal.showValidationMessage(e.message || 'Delete failed'))
        });
    },

    resetPanel() {
        this.currentId = null;
        $('.prod-list-item').removeClass('active');
        $('#prodFormPanel').html('<div class="empty-state"><i class="fa fa-cubes-stacked"></i><p>Select a product to edit or create a new one</p></div>');
    },

    // ===== Print Barcode =====
    printBarcode(product) {
        if (!product || !product.barcode) {
            toastr.warning('This product has no barcode to print.');
            return;
        }
        Swal.fire({
            title: 'Print Barcode',
            html: `
                <div class="text-start">
                    <label class="form-label small fw-semibold">Product: <span class="text-primary">${product.name}</span></label>
                    <label class="form-label small fw-semibold mt-2">Barcode: <code>${product.barcode}</code></label>
                    <div class="row g-2 mt-1">
                        <div class="col-6">
                            <label class="form-label small">Quantity</label>
                            <input type="number" id="swalBarcodeQty" class="form-control" value="1" min="1" max="200" />
                        </div>
                        <div class="col-6">
                            <label class="form-label small">Columns</label>
                            <select id="swalBarcodeCols" class="form-select">
                                <option value="2">2 per row</option>
                                <option value="3" selected>3 per row</option>
                                <option value="4">4 per row</option>
                                <option value="5">5 per row</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-check mt-2">
                        <input class="form-check-input" type="checkbox" id="swalBarcodePrice" checked />
                        <label class="form-check-label small" for="swalBarcodePrice">Show price</label>
                    </div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: '<i class="fa fa-print me-1"></i>Print',
            cancelButtonText: 'Cancel',
            focusConfirm: false,
            preConfirm: () => {
                const qty = parseInt(document.getElementById('swalBarcodeQty').value) || 1;
                const cols = parseInt(document.getElementById('swalBarcodeCols').value) || 3;
                const showPrice = document.getElementById('swalBarcodePrice').checked;
                if (qty < 1 || qty > 200) { Swal.showValidationMessage('Quantity must be 1–200'); return false; }
                return { qty, cols, showPrice };
            }
        }).then(result => {
            if (!result.isConfirmed) return;
            this.executePrintBarcode(product, result.value.qty, result.value.cols, result.value.showPrice);
        });
    },

    executePrintBarcode(product, qty, cols, showPrice) {
        const $area = $('#barcodePrintArea');
        const colWidth = (100 / cols).toFixed(2);
        let cells = '';
        for (let i = 0; i < qty; i++) {
            cells += `
                <div style="width:${colWidth}%;box-sizing:border-box;padding:4px;text-align:center;page-break-inside:avoid">
                    <div style="font-weight:bold;font-size:10px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${product.name || ''}</div>
                    <svg class="bc-svg" data-idx="${i}"></svg>
                    ${showPrice ? `<div style="font-size:9px;margin-top:1px;color:#333">Rp ${Number(product.unitPrice || 0).toLocaleString('id-ID')}</div>` : ''}
                </div>`;
        }

        $area.html(`<div style="display:flex;flex-wrap:wrap;font-family:Arial,sans-serif">${cells}</div>`);

        try {
            $area.find('.bc-svg').each(function () {
                JsBarcode(this, product.barcode, {
                    format: 'CODE128', width: 1.5, height: 40,
                    displayValue: true, fontSize: 10, margin: 2, textMargin: 1
                });
            });
        } catch (e) {
            toastr.error('Invalid barcode format');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=700,height=500');
        printWindow.document.write(`<html><head><title>Barcode - ${product.name || ''} (x${qty})</title>
            <style>@media print { body { margin: 0; } @page { margin: 5mm; } }</style>
            </head><body style="margin:0">`);
        printWindow.document.write($area.html());
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 400);
    },

    // ===== Category Modal =====
    openCategoryModal() {
        Common.Api.post('/Product/FillFormCategory', { id: 0 })
            .then(html => {
                $('#categoryBodyModal').html(html);
                this.loadCategoryTable();
                new bootstrap.Modal(document.getElementById('categoryModal')).show();
            }).catch(e => console.error(e));
    },

    async loadCategoryTable() {
        let data = [];
        try { const res = await Common.Api.get('/Product/GetCategoryList'); data = (res && res.result) ? res.result : res || []; } catch { }
        const $table = $('#tableCategory');
        if ($.fn.DataTable.isDataTable($table)) $table.DataTable().destroy();
        $table.DataTable({
            deferRender: true, processing: true, serverSide: false, destroy: true,
            searching: false, responsive: true, dom: 'lrtip', data: data,
            columns: [
                { data: 'categoryName' },
                { data: null, className: 'text-center', render: () => '<div class="btn-group btn-group-sm"><button class="btn btn-outline-primary edit"><i class="fa fa-pencil"></i></button><button class="btn btn-outline-danger delete"><i class="fa fa-trash"></i></button></div>', orderable: false }
            ]
        });
        const tb = $table.DataTable();
        $table.find('tbody').off().on('click', '.edit', function () {
            const row = tb.row($(this).closest('tr')).data();
            Common.Api.post('/Product/FillFormCategory', { id: row.id }).then(html => { $('#categoryBodyModal').html(html); ProductPage.loadCategoryTable(); });
        }).on('click', '.delete', function () {
            const row = tb.row($(this).closest('tr')).data();
            Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', showLoaderOnConfirm: true,
                preConfirm: () => Common.Api.post('/Product/DeleteCategory', { id: row.id })
                    .then(() => { toastr.success('Deleted'); ProductPage.loadCategoryTable(); ProductPage.loadDropdownData(); })
                    .catch(e => Swal.showValidationMessage(e.message))
            });
        });
    },

    async saveCategory() {
        const formData = $('#formCategory').serializeArray().reduce((a, c) => { a[c.name] = c.value; return a; }, {});
        $('#buttonSaveCategory').prop('disabled', true).find('.spinner-border').show();
        try {
            const r = await Common.Api.post('/Product/SaveCategory', formData);
            if (r && r.success) { toastr.success('Saved'); this.loadCategoryTable(); await this.loadDropdownData(); await this.loadProducts(); Common.Api.post('/Product/FillFormCategory', { id: 0 }).then(h => $('#categoryBodyModal').html(h).promise().done(() => this.loadCategoryTable())); }
            else toastr.error((r && r.error) || 'Failed');
        } catch (e) { console.error(e); }
        finally { $('#buttonSaveCategory').prop('disabled', false).find('.spinner-border').hide(); }
    },

    // ===== Unit Modal =====
    openUnitModal() {
        Common.Api.post('/Product/FillFormUnit', { id: 0 })
            .then(html => {
                $('#unitBodyModal').html(html);
                this.loadUnitTable();
                new bootstrap.Modal(document.getElementById('unitModal')).show();
            }).catch(e => console.error(e));
    },

    async loadUnitTable() {
        let data = [];
        try { const res = await Common.Api.get('/Product/GetUnitList'); data = (res && res.result) ? res.result : res || []; } catch { }
        const $table = $('#tableUnit');
        if ($.fn.DataTable.isDataTable($table)) $table.DataTable().destroy();
        $table.DataTable({
            deferRender: true, processing: true, serverSide: false, destroy: true,
            searching: false, responsive: true, dom: 'lrtip', data: data,
            columns: [
                { data: 'unitName' },
                { data: null, className: 'text-center', render: () => '<div class="btn-group btn-group-sm"><button class="btn btn-outline-primary edit"><i class="fa fa-pencil"></i></button><button class="btn btn-outline-danger delete"><i class="fa fa-trash"></i></button></div>', orderable: false }
            ]
        });
        const tb = $table.DataTable();
        $table.find('tbody').off().on('click', '.edit', function () {
            const row = tb.row($(this).closest('tr')).data();
            Common.Api.post('/Product/FillFormUnit', { id: row.id }).then(html => { $('#unitBodyModal').html(html); ProductPage.loadUnitTable(); });
        }).on('click', '.delete', function () {
            const row = tb.row($(this).closest('tr')).data();
            Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', showLoaderOnConfirm: true,
                preConfirm: () => Common.Api.post('/Product/DeleteUnit', { id: row.id })
                    .then(() => { toastr.success('Deleted'); ProductPage.loadUnitTable(); ProductPage.loadDropdownData(); })
                    .catch(e => Swal.showValidationMessage(e.message))
            });
        });
    },

    async saveUnit() {
        const formData = $('#formUnit').serializeArray().reduce((a, c) => { a[c.name] = c.value; return a; }, {});
        $('#buttonSaveUnit').prop('disabled', true).find('.spinner-border').show();
        try {
            const r = await Common.Api.post('/Product/SaveUnit', formData);
            if (r && r.success) { toastr.success('Saved'); this.loadUnitTable(); await this.loadDropdownData(); await this.loadProducts(); Common.Api.post('/Product/FillFormUnit', { id: 0 }).then(h => $('#unitBodyModal').html(h).promise().done(() => this.loadUnitTable())); }
            else toastr.error((r && r.error) || 'Failed');
        } catch (e) { console.error(e); }
        finally { $('#buttonSaveUnit').prop('disabled', false).find('.spinner-border').hide(); }
    },

    // ===== Variant Management =====
    async loadVariants(productId) {
        if (!productId) return;
        try {
            const res = await Common.Api.get(`/Product/GetVariants?productId=${productId}`);
            const list = Array.isArray(res) ? res : (res && res.result ? res.result : res || []);
            this.renderVariantRows(list);
        } catch (e) { console.error('Failed load variants', e); }
    },

    renderVariantRows(list) {
        const $tbody = $('#variantTbody').empty();
        if (!list || !list.length) {
            $tbody.append('<tr><td colspan="3" class="text-muted text-center small py-2">Belum ada varian.</td></tr>');
            return;
        }
        list.forEach(v => {
            $tbody.append(
                `<tr data-id="${v.id}">
                    <td><input type="text" class="form-control form-control-sm variant-name-input" value="${$('<span>').text(v.name).html()}" /></td>
                    <td><input type="number" class="form-control form-control-sm variant-stock-input" value="${v.stockQuantity}" min="0" /></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-danger btn-del-variant" data-id="${v.id}" title="Hapus"><i class="fa fa-trash"></i></button>
                    </td>
                </tr>`
            );
        });
    },

    addVariant() {
        const name = $('#newVariantName').val().trim();
        if (!name) { toastr.warning('Isi nama varian terlebih dahulu'); return; }
        const stock = parseInt($('#newVariantStock').val(), 10) || 0;
        $('#variantTbody').find('tr:not([data-id])').remove();
        const escapedName = $('<span>').text(name).html();
        $('#variantTbody').append(
            `<tr data-id="0">
                <td><input type="text" class="form-control form-control-sm variant-name-input" value="${escapedName}" /></td>
                <td><input type="number" class="form-control form-control-sm variant-stock-input" value="${stock}" min="0" /></td>
                <td class="text-center"><button class="btn btn-sm btn-outline-secondary btn-remove-variant" title="Batal"><i class="fa fa-times"></i></button></td>
            </tr>`
        );
        $('#newVariantName').val('');
        $('#newVariantStock').val('0');
    },

    async deleteVariant(id, $row) {
        if (!id) { $row.remove(); return; }
        const r = await Swal.fire({ title: 'Hapus varian ini?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, hapus' });
        if (!r.isConfirmed) return;
        try {
            const res = await Common.Api.get(`/Product/DeleteVariant?id=${id}`);
            if (res && res.success) { $row.remove(); toastr.success('Varian dihapus'); }
            else toastr.error((res && res.error) || 'Gagal menghapus');
        } catch (e) { toastr.error((e && e.message) || 'Request failed'); }
    }
};