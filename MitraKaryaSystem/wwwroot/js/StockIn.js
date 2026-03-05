$(document).ready(function () {
    ControlStockIn.Init();
    ButtonStockIn.Init();
    FormStockIn.FillForm(0, true);
    FormStockIn.LoadApprovedPOs();
});

const StockInStatus = {1: 'Draft', 2: 'Submitted', 3: 'Verified' };

function UpdateStockInStatusBadge(statusID) {
 const $b = $('#stockInStatus');
 const txt = StockInStatus[statusID] || 'Draft';
 $b.text(txt);
 $b.removeClass('text-bg-warning text-bg-success text-bg-secondary text-bg-info');
 $b.addClass(statusID >= 3 ? 'text-bg-success' : (statusID === 2 ? 'text-bg-info' : 'text-bg-warning'));
 const idVal = parseInt($('#stockInID').val()||'0',10);
 // toggle footer buttons with save prerequisite
 if (statusID === 1) {
   if (idVal > 0) { $('#buttonSubmit').removeClass('d-none'); } else { $('#buttonSubmit').addClass('d-none'); }
   $('#buttonVerify').addClass('d-none');
 } else if (statusID === 2) { $('#buttonSubmit').addClass('d-none'); $('#buttonVerify').removeClass('d-none'); }
 else { $('#buttonSubmit,#buttonVerify').addClass('d-none'); }
 // lock inputs if verified
 if (statusID >= 3) {
   lockStockInItems();
 } else {
   // ensure UI gets re-enabled when returning to Draft/Submitted
   unlockStockInItems();
 }
}

function lockStockInItems() {
  // disable add / product select and editing
  $('#buttonAdd').prop('disabled', true);
  $('#selectProduct').prop('disabled', true).trigger('change.select2');
  $('#tableProduct').find('input[type="number"], .delete').each(function(){
    $(this).prop('disabled', true).addClass('disabled');
  });
}

function unlockStockInItems() {
  $('#buttonAdd').prop('disabled', false);
  $('#selectProduct').prop('disabled', false).trigger('change.select2');
  $('#tableProduct').find('input[type="number"], .delete').each(function(){
    $(this).prop('disabled', false).removeClass('disabled');
  });
}

let ButtonStockIn = {
 Init: function () {
 $('#buttonAdd').click(function (event) {
 event.preventDefault();
 ControlStockIn.AddProduct();
 });

 $('#buttonSave').click(function (event) {
 event.preventDefault();
 let table = $('#tableProduct').DataTable();
 if (table.rows().count() <=0) {
 toastr.info('Insert at least1 product', 'Cannot save');
 return;
 }
 FormStockIn.Save();
 });

 $('#buttonNew').click(function () {
 FormStockIn.ResetProductForm();
 FormStockIn.Reset();
 });

 $('#buttonSearch').click(function () {
 TableStockIn.FillGridSearch();
 });

 // Submit button
 $(document).on('click', '#buttonSubmit', function(){
   const id = parseInt($('#stockInID').val()||'0',10);
   if (!id) { toastr.info('Save first'); return; }
   const $btn = $(this);
   $btn.prop('disabled', true).text('Submitting...');
   Common.Api.post('/StockIn/Submit', { id: id })
     .then(res => { if (res && res.success) { toastr.success('Submitted'); $('#stockInStatusID').val(2); UpdateStockInStatusBadge(2); } else toastr.error((res && res.result) || 'Submit failed'); })
     .catch(() => toastr.error('Error submit'))
     .finally(() => $btn.prop('disabled', false).text('Submit'));
 });

 // Verify button
 $(document).on('click', '#buttonVerify', function(){
   const id = parseInt($('#stockInID').val()||'0',10);
   if (!id) { toastr.info('Save first'); return; }
   const $btn = $(this);
   $btn.prop('disabled', true).text('Verifying...');
   Common.Api.post('/StockIn/Verify', { id: id })
     .then(res => {
        if (res && res.success) {
          toastr.success('Verified');
          $('#stockInStatusID').val(3); UpdateStockInStatusBadge(3); TableStockIn.FillGridProduct(id, true);
          // Show low stock warnings if any
          if (res.lowStockWarnings && res.lowStockWarnings.length > 0) {
            var msgs = res.lowStockWarnings.map(w => (w.name || w.Name) + ': ' + (w.stockQuantity ?? 0) + '/' + (w.lowStockThreshold ?? 0));
            toastr.warning('Low stock: ' + msgs.join(', '), 'Stock Alert', { timeOut: 8000 });
          }
        }
        else { toastr.error((res && res.result) || 'Verify failed'); }
     })
     .catch(() => toastr.error('Error verify'))
     .finally(() => $btn.prop('disabled', false).text('Verify'));
 });
 }
};

let TableStockIn = {
 FillGridProduct: function (id, isReset) {
 let tableID = $('#tableProduct');
 if (isReset && $.fn.DataTable.isDataTable('#tableProduct')) { tableID.DataTable().clear().destroy(); }
 let dataList = [];
  if (id) {
    dataList = Common.GetData.Get('/StockIn/GetDetailListById?id=' + id);
    if (dataList && dataList.result && Array.isArray(dataList.result)) dataList = dataList.result;
    if (!Array.isArray(dataList)) dataList = [];
  }
 const statusID = parseInt($('#stockInStatusID').val()||'1',10);
 const canEdit = statusID < 3; // editable until verified
 let columns = [
 { 
   data: null,
   visible: false,
   render: function(data, type, row) {
     return row.id || row.ID || null;
   }
 },
 { 
   data: null,
   visible: false,
   render: function(data, type, row) {
     return row.productID || row.ProductID;
   }
 },
 { 
   data: null,
   render: function(data, type, row) {
     return row.product || row.Product;
   }
 },
 canEdit ? { 
   data: null,
   render: function(data, type, row) {
     const qty = row.quantity || row.Quantity;
     return type === 'display' ? `<input type="number" class="form-control change" value="${qty}" min="1" />` : qty;
   }
 } : { 
   data: null,
   render: function(data, type, row) {
     return row.quantity || row.Quantity;
   }
 },
 { 
   data: null,
   render: function(data, type, row) {
     const price = row.unitPrice || row.UnitPrice || 0;
     if (type === 'display') {
       return price.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
     }
     return price;
   }
 },
 { 
   data: null,
   visible: false,
   render: function(data, type, row) {
     return row.supplierID || row.SupplierID;
   }
 },
 { 
   data: null,
   visible: false,
   render: function(data, type, row) {
     return row.barcode || row.Barcode;
   }
 },
 { 
   data: null,
   render: function(data, type, row) {
     return row.supplier || row.Supplier;
   }
 },
 canEdit ? { 
   data: null, 
   render: () => `<a class="btn btn-danger delete"><i class="fa fa-trash"></i></a>`, 
   orderable: false 
 } : { 
   data: null, 
   render: () => '', 
   orderable: false 
 }
 ];

 let table = tableID.DataTable({
 deferRender: true,
 processing: true,
 serverSide: false,
 destroy: true,
 filter: true,
 searching: false,
 responsive: true,
 columns: columns,
 decimal: ',', thousands: '.',
 data: dataList.length >0 ? dataList : []
 });

 tableID.find('tbody').unbind();
 $('#tableProduct').off('change');
 if (canEdit) {
   // if previously opened a verified record, ensure inputs are re-enabled
   unlockStockInItems();
   $('#tableProduct').on('change', 'input[type="number"]', function () {
     let rowIndex = table.cell($(this).closest('td')).index().row;
     let newQty = parseInt($(this).val());
     if (isNaN(newQty) || newQty < 1) newQty = 1;
 
     // Update the row object (renderers read from row.quantity/row.Quantity)
     let rowData = table.row(rowIndex).data();
     if (!rowData) return;
     rowData.quantity = newQty;
     rowData.Quantity = newQty;
     table.row(rowIndex).data(rowData).invalidate();
     table.draw(false);
     ControlStockIn.UpdateSummary();
   });

   tableID.find('tbody').on('click', '.delete', function () {
     let row = table.row($(this).parents('tr')).data();
     const rowId = row.id || row.ID;
     if (rowId) {
       Swal.fire({
         title: 'Are you sure?',
         text: "You won't be able to revert this!",
         icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', showLoaderOnConfirm: true,
         preConfirm: () => Common.Api.post(`/StockIn/DeleteItem`, { id: rowId })
         .then(r => {
           toastr.options.onShown = () => { TableStockIn.FillGridProduct(id, true); ControlStockIn.UpdateSummary(); };
           if (r && r.success) toastr.success('Data has been deleted'); else toastr.error('Data not deleted');
         })
         .catch(err => Swal.showValidationMessage(err.message || 'Request failed')),
         allowOutsideClick: () => !Swal.isLoading()
       });
     } else { table.row($(this).parents('tr')).remove().draw(); ControlStockIn.UpdateSummary(); }
   });
 } else {
   // verified: ensure Add & product select disabled
   lockStockInItems();
 }

 ControlStockIn.UpdateSummary();
 },
 FillGridSearch: function () {
 let tableID = $('#tableSearch');
 Common.Api.get('/StockIn/GetStockInList')
 .then(data => {
 let columns = [
 { data: 'no' }, { data: 'date' }, { data: 'amount' }, { data: 'createdBy' }, { data: 'updatedBy' },
 { data: null, render: (d, t, row) => `<div class="btn-group" role="group"><a class="btn btn-warning edit"><i class="fa fa-pencil"></i> Edit</a><a class="btn btn-danger delete"><i class="fa fa-trash"></i> Delete</a></div>`, orderable: false }
 ];

 let table = tableID.DataTable({
 deferRender: true,
 processing: true,
 serverSide: false,
 destroy: true,
 filter: true,
 searching: false,
 responsive: true,
 data: data,
 columns: columns
 });

 tableID.find('tbody').unbind();
 tableID.find('tbody').on('click', '.edit', function () { 
   let row = table.row($(this).parents('tr')).data(); 
   const rowId = row.id || row.ID;
   FormStockIn.FillForm(rowId, true); 
   $('#searchModal').modal('hide'); 
 });
 tableID.find('tbody').on('click', '.delete', function () {
 let row = table.row($(this).parents('tr')).data();
 const rowId = row.id || row.ID;
 Swal.fire({
 title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it', showLoaderOnConfirm: true,
 preConfirm: () => Common.Api.post(`/StockIn/Delete`, { id: rowId })
 .then(r => { toastr.options.onShown = () => { TableStockIn.FillGridSearch(); FormStockIn.ResetProductForm(); FormStockIn.Reset(); }; if (r && r.success) toastr.success('Data has been deleted'); else toastr.error('Data not deleted'); })
 .catch(err => Swal.showValidationMessage(err.message || 'Request failed')),
 allowOutsideClick: () => !Swal.isLoading()
 });
 });
 })
 .catch(() => toastr.error('Failed load Stock In list'));
 }
};

let ControlStockIn = {
 Init: function () {
 $('#selectProduct').select2({
 placeholder: 'Type product name below', minimumInputLength:3,
 ajax: {
 url: '/Product/GetProductComboList', dataType: 'json', delay:250,
 data: params => ({ name: params.term }),
 processResults: data => {
 const list = Array.isArray(data) ? data : (data && data.result) ? data.result : [];
 return { results: $.map(list, item => ({ id: item.id || item.ID, text: (item.name || item.Name) + ' - ' + (item.supplierName || item.SupplierName), supplierID: item.supplierID || item.SupplierID, name: item.name || item.Name, supplierName: item.supplierName || item.SupplierName, unitPrice: item.unitPrice || item.UnitPrice, unit: item.unit || item.Unit, stockQuantity: item.stockQuantity || item.StockQuantity, barcode: item.barcode || item.Barcode })) };
 }
 }, templateResult: d => d.text, templateSelection: d => d.text
 });

 ControlStockIn.ProductSelect();
 },
 ProductSelect: function () { $('#selectProduct').on('select2:select', function (e) { let data = e.params.data; ControlStockIn.AddOrIncrease(data); $(this).val(null).trigger('change'); $(this).select2('close'); }); },
 AddOrIncrease: function (selectedProduct) {
 let table = $('#tableProduct').DataTable();
 let exists = false;
 const rows = table.rows().nodes();
 const qtyInput = parseInt($('#quantity').val()) ||1;
 $(rows).each(function () { 
   let rowData = table.row(this).data(); 
   const rowProductID = rowData.productID || rowData.ProductID;
   if (rowProductID == selectedProduct.id) { 
     exists = true; 
     const currentQty = parseInt(rowData.quantity || rowData.Quantity);
     let newQuantity = currentQty + qtyInput; 
     rowData.quantity = newQuantity;
     rowData.Quantity = newQuantity;
     table.row(this).data(rowData).invalidate(); 
   } 
 });
 if (!exists) { ControlStockIn.AddRow(selectedProduct.id, selectedProduct.name, qtyInput, selectedProduct.unitPrice, selectedProduct.barcode, selectedProduct.supplierID, selectedProduct.supplierName); }
 table.draw(false);
 ControlStockIn.UpdateSummary();
 },
 AddRow: function (productID, productName, quantity, unitPrice, barcode, supplierID, supplier) { let table = $('#tableProduct').DataTable(); table.row.add({ id: undefined, productID, product: productName, quantity, unitPrice, supplierID, barcode, supplier }).draw(); },
 AddProduct: function () { let selectedData = $('#selectProduct').select2('data')[0]; if (!selectedData) { toastr.info('Select a product first'); return; } ControlStockIn.AddOrIncrease(selectedData); $('#quantity').val(1); },
 UpdateSummary: function () {
 let table = $('#tableProduct').DataTable();
 const data = table.rows().data();
 let totalQty =0;
 let totalValue =0;
 for (let i =0; i < data.length; i++) {
 let qty = parseInt(data[i].quantity || data[i].Quantity) ||0;
 let price = parseFloat(data[i].unitPrice || data[i].UnitPrice) ||0;
 totalQty += qty;
 totalValue += qty * price;
 }
 $('#totalQty').text(totalQty);
 $('#totalUnitPrice').text(totalValue.toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 }));
 }
};

let FormStockIn = {
 ResetProductForm: function () { $('#selectProduct').val(null).trigger('change'); $('#quantity').val(1); },
 Reset: function () { this.FillForm(0, true); ControlStockIn.UpdateSummary(); },
 Save: function () {
 var postData = { ID: $('#stockInID').val(), Date: $('#stockInDate').val(), No: $('#stockInNumber').val(), PurchaseOrderID: $('#stockInPO').val() || null, StockInDetails: [] };
 let table = $('#tableProduct').DataTable();
 table.rows().every(function () { 
   let r = this.data(); 
   if (r && r.productID && r.quantity) { 
     const itemId = r.id || r.ID || 0;
     postData.StockInDetails.push({ productID: r.productID, quantity: r.quantity, ID: itemId }); 
   } 
 });
 $('#buttonSave').prop('disabled', true); $('#buttonSave .spinner-border').show();
 Common.Api.postJson('/StockIn/Save', postData).then(result => {
 if (result.success) { 
   toastr.success('Data saved'); 
   const resultId = result.id || result.ID;
   const resultNo = result.no || result.No;
   const resultStatusID = result.statusID || result.StatusID;
   if (resultId) $('#stockInID').val(resultId); 
   if (resultNo) $('#stockInNumber').val(resultNo); 
   if (resultStatusID) { $('#stockInStatusID').val(resultStatusID); UpdateStockInStatusBadge(resultStatusID); }
   // Reload product table to get IDs from server
   const savedId = resultId || $('#stockInID').val();
   if (savedId) {
     TableStockIn.FillGridProduct(savedId, true);
   }
 }
 else { toastr.error(result.result || 'Data not saved'); }
 }).catch(err => { toastr.error(err.message || 'Error', 'Data not saved'); })
 .finally(() => { $('#buttonSave').prop('disabled', false); $('#buttonSave .spinner-border').hide(); });
 },
 FillForm: function (id, isReset = false) {
 Common.Api.post('/StockIn/FillForm', { id: id }).then(result => {
 $('#stockInHeaderBody').html(result);
 const statusVal = parseInt($('#stockInStatusID').val() || '1',10);
 // reload PO dropdown and set stored value
 FormStockIn.LoadApprovedPOs(function() {
   const poId = $('#stockInPurchaseOrderID').val();
   if (poId) $('#stockInPO').val(poId);
   // lock PO dropdown if not Draft
   if (statusVal > 1) $('#stockInPO').prop('disabled', true); else $('#stockInPO').prop('disabled', false);
 });
 UpdateStockInStatusBadge(statusVal);
 TableStockIn.FillGridProduct(id, isReset);
 }).catch(err => toastr.error(err.message || 'Error load data'));
 },
 LoadApprovedPOs: function(callback) {
   Common.Api.get('/StockIn/GetApprovedPOs').then(data => {
     var $sel = $('#stockInPO');
     var current = $sel.val();
     $sel.find('option:not(:first)').remove();
     if (Array.isArray(data)) {
       data.forEach(function(po) { $sel.append($('<option></option>').val(po.id).text(po.no + ' (' + po.date + ')')); });
     }
     if (current) $sel.val(current);
     if (typeof callback === 'function') callback();
   }).catch(() => {});
 }
};