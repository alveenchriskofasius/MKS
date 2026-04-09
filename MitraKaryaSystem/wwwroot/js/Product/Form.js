$(document).ready(function () {
	productButtons.init();
	productControl.init();
});

const productButtons = {
	init: function () {
		$('#buttonAddCategory').off('click').on('click', function () { productForms.fillFormCategory(0); });
		$('#buttonAddUnit').off('click').on('click', function () { productForms.fillFormUnit(0); });

		$('#buttonSave').off('click').on('click', function (event) {
			const form = $('#productForm')[0];
			if (form.checkValidity()) {
				event.preventDefault();
				event.stopPropagation();
				productForms.saveProduct();
				form.classList.remove('was-validated');
			} else {
				event.preventDefault();
				event.stopPropagation();
				form.classList.add('was-validated');
			}
		});

		$('#buttonSaveCategory').off('click').on('click', function (event) {
			const form = $('#formCategory')[0];
			if (form.checkValidity()) {
				event.preventDefault();
				event.stopPropagation();
				productForms.saveCategory();
				form.classList.remove('was-validated');
			} else {
				event.preventDefault();
				event.stopPropagation();
				form.classList.add('was-validated');
			}
		});

		$('#buttonSaveUnit').off('click').on('click', function (event) {
			const form = $('#formUnit')[0];
			if (form.checkValidity()) {
				event.preventDefault();
				event.stopPropagation();
				productForms.saveUnit();
				form.classList.remove('was-validated');
			} else {
				event.preventDefault();
				event.stopPropagation();
				form.classList.add('was-validated');
			}
		});

		$('#buttonNewCategory').off('click').on('click', function () { productForms.fillFormCategory(0); });
	}
};

const productTable = {
	fillGridCategory: async function () {
		let data = [];
		try { const res = await Common.Api.get('GetCategoryList'); data = (res && res.result) ? res.result : res || []; } catch { }
		const $table = $('#tableCategory');
		const columns = [
			{ data: 'categoryName' },
			{
					data: null, className: 'text-center', render: function () {
							return `<div class="btn-group btn-group-sm"><button class="btn btn-outline-primary edit" title="Edit"><i class="fa fa-pencil"></i></button><button class="btn btn-outline-danger delete" title="Delete"><i class="fa fa-trash"></i></button></div>`;
						}, orderable: false
					}
				];

				$table.DataTable({
					deferRender: true,
					processing: true,
					serverSide: false,
					destroy: true,
					filter: true,
					searching: false,
					responsive: true,
					columns: columns,
					dom: 'lBfrtip',
					columnDefs: [{ targets: [0], className: 'text-left' }],
					data: data
				});

				const tb = $table.DataTable();
				$table.find('tbody').off().on('click', '.edit', function () {
					const row = tb.row($(this).closest('tr')).data();
					productForms.fillFormCategory(row.id);
		});

		$table.find('tbody').on('click', '.delete', function () {
			const row = tb.row($(this).closest('tr')).data();
			// Show a confirmation dialog
			Swal.fire({
				title: 'Are you sure?',
				text: "You won't be able to revert this!",
				icon: 'warning',
				showCancelButton: true,
				confirmButtonText: 'Yes, delete it',
				showLoaderOnConfirm: true,
				preConfirm: () =>
					Common.Api.post('DeleteCategory', { id: row.id })
						.then(() => {
							toastr.options.onShown = function () {
								productForms.fillFormCategory(0);
								productTable.fillGridCategory();
								productControl.category();
							}
							toastr.success('Data has been deleted');
						})
						.catch(error => { Swal.showValidationMessage(error.message || 'Request failed'); })
			});
		});
	},
	fillGridUnit: async function () {
		let data = [];
		try { const res = await Common.Api.get('GetUnitList'); data = (res && res.result) ? res.result : res || []; } catch { }
		const $table = $('#tableUnit');
		const columns = [
			{ data: 'unitName' },
			{
					data: null, className: 'text-center', render: function () {
							return `<div class="btn-group btn-group-sm"><button class="btn btn-outline-primary edit" title="Edit"><i class="fa fa-pencil"></i></button><button class="btn btn-outline-danger delete" title="Delete"><i class="fa fa-trash"></i></button></div>`;
						}, orderable: false
					}
				];
				$table.DataTable({
					deferRender: true,
					processing: true,
					serverSide: false,
					destroy: true,
					filter: true,
					searching: false,
					responsive: true,
					columns: columns,
					dom: 'lBfrtip',
					columnDefs: [{ targets: [0], className: 'text-left' }],
					data: data
				});
				const tb = $table.DataTable();
				$table.find('tbody').off().on('click', '.edit', function () { const row = tb.row($(this).closest('tr')).data(); productForms.fillFormUnit(row.id); });
		$table.find('tbody').on('click', '.delete', function () {
			const row = tb.row($(this).closest('tr')).data();
			// Show a confirmation dialog
			Swal.fire({
				title: 'Are you sure?',
				text: "You won't be able to revert this!",
				icon: 'warning',
				showCancelButton: true,
				confirmButtonText: 'Yes, delete it',
				showLoaderOnConfirm: true,
				preConfirm: () =>
					Common.Api.post('DeleteUnit', { id: row.id })
						.then(response => {
							// Show success message
							Swal.fire({ position: 'center', icon: 'success', title: 'Success', text: 'Unit has been deleted', showConfirmButton: false, timer:1500, allowOutsideClick: false })
								.then(() => {
									productForms.fillFormUnit(0);
									productTable.fillGridUnit();
									productControl.unit();
								});
						})
						.catch(error => { Swal.showValidationMessage(error.message || 'Request failed'); })
			});
		});
	}
};

const productForms = {
	fillFormCategory: function (id) {
		Common.Api.post('FillFormCategory', { id: id })
			.then(function (result) {
				$('#categoryBodyModal').html(result);
				productTable.fillGridCategory();
				$('#categoryModal').modal('show');
			})
			.catch(function (error) { console.error('Error loading category form', error); });
	},
	fillFormUnit: function (id) {
		Common.Api.post('FillFormUnit', { id: id })
			.then(function (result) {
				$('#unitBodyModal').html(result);
				productTable.fillGridUnit();
				$('#unitModal').modal('show');
			})
			.catch(function (error) { console.error('Error loading unit form', error); });
	},
	fillFormProduct: function (id) {
		Common.Api.post('FillFormProduct', { id: id })
			.then(function (result) { console.log(result); })
			.catch(function (error) { console.error('Error loading product form', error); });
	},
	saveCategory: function () {
		const formData = $('#formCategory').serializeArray().reduce((acc, cur) => { acc[cur.name] = cur.value; return acc; }, {});
		// Show loading indicator
		$('#buttonSaveCategory').prop('disabled', true);
		$('#buttonCloseCategory').prop('disabled', true);
		$('#buttonSaveCategory .spinner-border').show();

		Common.Api.post('SaveCategory', formData)
			.then(function (result) {
				toastr.options.onShown = function () {
					productTable.fillGridCategory();
					productForms.fillFormCategory(0);
					productControl.category();
				};
				(result && result.success) ? toastr.success('Data saved') : toastr.error((result && result.error) || 'Data not saved');
			})
			.catch(function (error) { console.error('SaveCategory failed', error); })
			.finally(function () {
				// Close loading indicator
				$('#buttonSaveCategory').prop('disabled', false);
				$('#buttonCloseCategory').prop('disabled', false);
				$('#buttonSaveCategory .spinner-border').hide();
			});
	},
	saveUnit: function () {
		const formData = $('#formUnit').serializeArray().reduce((acc, cur) => { acc[cur.name] = cur.value; return acc; }, {});
		// Show loading indicator
		$('#buttonSaveCategory').prop('disabled', true);
		$('#buttonCloseCategory').prop('disabled', true);
		$('#buttonSaveCategory .spinner-border').show();

		Common.Api.post('SaveUnit', formData)
			.then(function (result) {
				toastr.options.onShown = function () {
					productTable.fillGridUnit();
					productForms.fillFormUnit(0);
					productControl.unit();
				};
				(result && result.success) ? toastr.success('Data saved') : toastr.error((result && result.error) || 'Data not saved');
			})
			.catch(function (error) { console.error('SaveUnit failed', error); })
			.finally(function () {
				// Close loading indicator
				$('#buttonSaveCategory').prop('disabled', false);
				$('#buttonCloseCategory').prop('disabled', false);
				$('#buttonSaveCategory .spinner-border').hide();
			});
	},
	saveProduct: function () {
		const formData = new FormData($('#productForm')[0]);
		formData.set('ProductModel.HasDiscount', $('#chkHasDiscount').is(':checked'));
		formData.set('ProductModel.HasVariants', $('#chkHasVariants').is(':checked'));
		// Show loading indicator
		$('#buttonSave').prop('disabled', true);
		$('#buttonSave .spinner-border').show();

		const headers = { 'Accept': 'application/json, text/plain, */*' };
		const token = Common.getCsrfToken();
		if (token) headers['RequestVerificationToken'] = token;

		fetch('SaveProduct', { method: 'POST', credentials: 'same-origin', headers: headers, body: formData })
			.then(function (r) { return r.json(); })
			.then(function (result) {
				if (result && result.success) {
					toastr.success('Data saved');
					window.location.href = '/Product';
				} else {
					toastr.error((result && result.error) || 'Data not saved');
				}
			})
			.catch(function (err) { toastr.error((err && err.message) || 'Save failed'); })
			.finally(function () {
				// Close loading indicator
				$('#buttonSave').prop('disabled', false);
				$('#buttonSave .spinner-border').hide();
			});
	},
	resetProductForm: function () {
		$('#productForm :input').each(function () { $(this).val(''); });
		$('#productForm').removeClass('was-validated');
		$('.invalid-feedback').hide();
	}
};

const productControl = {
	init: function () { this.category(); this.unit(); this.supplier(); productVariants.init(); },
	category: function () {
		const id = '#comboBoxCategory';
		Common.Api.get('GetCategoryList').then(data => {
			const list = (data && data.result) ? data.result : data || [];
			$(id).empty().append('<option selected value="">Select category</option>');
			list.forEach(item => { $(id).append(`<option value='${item.id}'${(typeof categoryID !== 'undefined' && categoryID == item.id) ? ' selected' : ''}>${item.categoryName}</option>`); });
		});
	},
	unit: function () {
		const id = '#comboBoxUnit';
		Common.Api.get('GetUnitList').then(data => {
			const list = (data && data.result) ? data.result : data || [];
			$(id).empty().append('<option selected value="">Select unit</option>');
			list.forEach(item => { $(id).append(`<option value='${item.id}'${(typeof unitID !== 'undefined' && unitID == item.id) ? ' selected' : ''}>${item.unitName}</option>`); });
		});
	},
	supplier: function () {
		const id = '#comboBoxSupplier';
		Common.Api.get('GetSupplierList').then(data => {
			const list = (data && data.result) ? data.result : data || [];
			$(id).empty().append('<option selected value="">Select supplier</option>');
			list.forEach(item => { $(id).append(`<option value='${item.id}'${(typeof supplierID !== 'undefined' && supplierID == item.id) ? ' selected' : ''}>${item.supplierName}</option>`); });
		});
	}
};

const productVariants = {
	productID: 0,
	init: function () {
		this.productID = parseInt($('#ProductModel_ID').val() || '0', 10);
		const $chk = $('#chkHasVariants'), $section = $('#variantSection');
		function toggleSection() {
			$section.toggle($chk.is(':checked'));
			if ($chk.is(':checked') && productVariants.productID > 0) productVariants.load();
		}
		$chk.off('change.variants').on('change.variants', toggleSection);
		toggleSection();

		$('#btnAddVariant').off('click').on('click', function () { productVariants.add(); });
		$('#newVariantName').off('keydown').on('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); productVariants.add(); } });
		$('#variantTbody').off('click.varDel').on('click.varDel', '.btn-del-variant', function () {
			const id = parseInt($(this).data('id'), 10);
			productVariants.delete(id, $(this).closest('tr'));
		});
		if (this.productID > 0 && $chk.is(':checked')) this.load();
	},
	load: function () {
		Common.Api.get('GetVariants?productId=' + this.productID).then(function (data) {
			const list = Array.isArray(data) ? data : (data && data.result ? data.result : []);
			productVariants.renderRows(list);
		}).catch(function (e) { console.error('Failed loading variants', e); });
	},
	renderRows: function (list) {
		const $tbody = $('#variantTbody').empty();
		if (!list.length) {
			$tbody.append('<tr><td colspan="2" class="text-muted text-center small">Belum ada varian.</td></tr>');
			return;
		}
		list.forEach(function (v) {
			$tbody.append(
				'<tr data-id="' + v.id + '">' +
				'<td>' + $('<span>').text(v.name).html() + '</td>' +
				'<td class="text-center"><button class="btn btn-sm btn-outline-danger btn-del-variant" data-id="' + v.id + '"><i class="fa fa-trash"></i></button></td>' +
				'</tr>'
			);
		});
	},
	add: function () {
		const name = $('#newVariantName').val().trim();
		if (!name) { toastr.warning('Isi nama varian terlebih dahulu'); return; }
		const pid = this.productID;
		if (!pid) { toastr.warning('Simpan produk terlebih dahulu sebelum menambah varian'); return; }
		Common.Api.post('SaveVariant', { ID: 0, ProductID: pid, Name: name, StockQuantity: 0 })
			.then(function (res) {
				if (res && res.success) {
					$('#newVariantName').val('');
					productVariants.load();
					toastr.success('Varian ditambahkan');
				} else {
					toastr.error((res && res.error) || 'Gagal menyimpan varian');
				}
			}).catch(function (e) { toastr.error(e && e.message ? e.message : 'Request failed'); });
	},
	delete: function (id, $row) {
		if (!id) { $row.remove(); return; }
		Swal.fire({ title: 'Hapus varian ini?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, hapus' }).then(function (r) {
			if (!r.isConfirmed) return;
			Common.Api.get('DeleteVariant?id=' + id).then(function (res) {
				if (res && res.success) { $row.remove(); toastr.success('Varian dihapus'); }
				else toastr.error((res && res.error) || 'Gagal menghapus');
			});
		});
	}
};