$(document).ready(function () { productIndex.init(); });

const productIndex = (function () {
 let _allData = [];
 let _dt = null;

 function init() {
  loadFilters();
  loadTable();
  bindFilters();
 }

 function loadFilters() {
  Common.Api.get('GetCategoryList').then(data => {
   const list = (data && data.result) ? data.result : data || [];
   const $sel = $('#filterCategory');
   list.forEach(c => $sel.append(`<option value="${c.id}">${c.categoryName}</option>`));
  });
  Common.Api.get('GetSupplierList').then(data => {
   const list = (data && data.result) ? data.result : data || [];
   const $sel = $('#filterSupplierProd');
   list.forEach(s => $sel.append(`<option value="${s.id}">${s.supplierName}</option>`));
  });
 }

 function bindFilters() {
  $('#btnApplyFilter').on('click', () => applyFilter());
  $('#btnClearFilter').on('click', () => {
   $('#filterProductName').val('');
   $('#filterCategory').val('');
   $('#filterSupplierProd').val('');
   applyFilter();
  });
  $('#filterProductName').on('keypress', e => { if (e.which === 13) applyFilter(); });
 }

 function applyFilter() {
  const name = ($('#filterProductName').val() || '').toLowerCase();
  const catId = $('#filterCategory').val();
  const supId = $('#filterSupplierProd').val();
  const filtered = _allData.filter(p => {
   if (name && !(p.name || '').toLowerCase().includes(name) && !(p.barcode || '').toLowerCase().includes(name)) return false;
   if (catId && String(p.categoryID) !== catId) return false;
   if (supId && String(p.supplierID) !== supId) return false;
   return true;
  });
  if (_dt) { _dt.clear().rows.add(filtered).draw(); }
 }

 async function loadTable() {
  let data = [];
  try {
   const res = await Common.Api.get('/Product/GetProductList');
   data = (res && res.result) ? res.result : res || [];
  } catch (e) {
   console.error('GetProductList failed', e);
   toastr.error(e.message || 'Failed load products');
  }
  _allData = data;

  if (_dt) { _dt.destroy(); _dt = null; }

  _dt = $('#tableProduct').DataTable({
   deferRender: true,
   processing: true,
   serverSide: false,
   destroy: true,
   data: data,
   dom: 'lrtip',
   columns: [
    { data: 'name' },
    { data: 'barcode', render: d => d ? `<code>${d}</code>` : '<span class="text-muted">-</span>' },
    { data: 'categoryName' },
    { data: 'unitName' },
    { data: 'unitPrice', className: 'text-end', render: $.fn.dataTable.render.number(',', '.', 0) },
    { data: null, className: 'text-center', render: function(data, type, row) {
       if (row.hasDiscount && row.discountPercentage > 0) return `<span class="badge text-bg-success">${row.discountPercentage}%</span>`;
       return '<span class="text-muted">-</span>';
     }, orderable: false },
    { data: 'stockQuantity', className: 'text-end', render: function(d) {
       if (d <= 0) return `<span class="text-danger fw-semibold">${d}</span>`;
       if (d <= 5) return `<span class="text-warning fw-semibold">${d}</span>`;
       return d;
     }},
    { data: 'supplierName' },
    {
     data: null, render: function (row) {
      return `<div class="btn-group btn-group-sm">
      <a class="btn btn-outline-primary edit" href="/Product/Form?id=${row.id}" title="Edit"><i class="fa fa-pencil"></i></a>
      <button class="btn btn-outline-danger delete" title="Delete"><i class="fa fa-trash"></i></button>
      </div>`;
     }, orderable: false
    }
   ],
   columnDefs: [{ targets: [0,1,2,3,7], className: 'text-left' }]
  });

  $('#tableProduct').off('click', '.delete').on('click', '.delete', function() {
   const row = _dt.row($(this).closest('tr')).data();
   if (!row) return;
   Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', showLoaderOnConfirm: true,
    preConfirm: () => Common.Api.post('/Product/DeleteProduct', { id: row.id })
     .then(() => { toastr.options.onShown = function () { productIndex.refresh(); }; toastr.success('Data has been deleted'); })
     .catch(error => { Swal.showValidationMessage(error.message || 'Request failed'); })
   });
  });
 }

 return {
  init: init,
  refresh: function () { loadTable(); }
 };
})();