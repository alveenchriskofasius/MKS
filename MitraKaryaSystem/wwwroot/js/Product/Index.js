$(document).ready(function () { productIndex.init(); });

const productIndex = (function () {
 function init() { initTable(); }

 async function initTable() {
 await SharedTable.init({
 table: '#tableProduct',
 columns: [
 { data: 'name' },
 { data: 'categoryName' },
 { data: 'unitName' },
 { data: 'unitPrice' },
 { data: 'stockQuantity' },
 { data: 'supplierName' },
 {
 data: null, render: function (row) {
 return `
 <a class="btn btn-warning edit" href="/Product/Form?id=${row.id}">
 <i class="fa fa-pencil"></i>
 </a>
 <span style="margin:05px;"></span>
 <a class="btn btn-danger delete">
 <i class="fa fa-trash"></i>
 </a>`;
 }, orderable: false
 }
 ],
 load: async () => {
 try {
 const res = await Common.Api.get('/Product/GetProductList');
 return (res && res.result) ? res.result : res || [];
 } catch (e) {
 console.error('GetProductList failed', e);
 toastr.error(e.message || 'Failed load products');
 return [];
 }
 },
 options: {
 dom: 'lBfrtip',
 columnDefs: [{ targets: [0,1,2,3,4,5], className: 'text-left' }]
 },
 actions: {
 deleteSelector: '.delete',
 onDelete: function (row) {
 if (!row) return;
 Swal.fire({
 title: 'Are you sure?',
 text: "You won't be able to revert this!",
 icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', showLoaderOnConfirm: true,
 preConfirm: () => Common.Api.post('/Product/DeleteProduct', { id: row.id })
 .then(() => { toastr.options.onShown = function () { productIndex.refresh(); }; toastr.success('Data has been deleted'); })
 .catch(error => { Swal.showValidationMessage(error.message || 'Request failed'); })
 });
 },
 refresh: () => initTable()
 }
 });
 }

 return {
 init: init,
 refresh: function () {
 initTable();
 }
 };
})();