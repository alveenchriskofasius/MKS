$(document).ready(function(){ StockCountPage.Init(); });

const StockCountPage = {
 _search: null,
 Init: function(){
  this.BindButtons();
  this.LoadForm(0);
  this.InitTable();
  this.InitProductSearch();
 },
 InitProductSearch: function(){
  if (this._search) this._search.destroy();
  this._search = MksProductSearch.attach('#scanProduct', {
   showPrice: true,
   showStock: true,
   blockZeroStock: false,
   onSelect: (prod) => this.AddProductToTable({
    id: prod.id, name: prod.name,
    unitPrice: prod.unitPrice || 0,
    stockQuantity: prod.stockQuantity ?? prod.StockQuantity ?? 0
   })
  });
 },
 BindButtons: function(){
  $('#btnNew').on('click', ()=> this.LoadForm(0));
  $('#btnSave').on('click', ()=> this.Save());
  $('#btnSearch').on('click', ()=> this.Search());
  $('#btnAutoAdjust').on('click', ()=> this.AutoAdjust());
  $('#btnPrint').on('click', ()=> { const id = parseInt($('#stockCountID').val()||'0',10); if(!id){ toastr.info('Save Stock Count first'); return; } MksPrint.stockCount(); });
  },
 LoadForm: function(id){
 $('#stockCountHeader').html('<div class="p-2 text-center"><div class="spinner-border spinner-border-sm"></div></div>');
 $.get('/StockCount/FillForm', { id: id ||0 }, html => {
  $('#stockCountHeader').html(html);
  this.RefreshTotals();
  this.UpdateAdjustedState();
 });
 this.LoadDetails(id);
 },
 UpdateAdjustedState: function(){
  const adjusted = $('#stockCountAutoAdjust').val() === 'true';
  const hasId = parseInt($('#stockCountID').val()) > 0;
  if(adjusted && hasId){
   $('#scanProduct, #btnAddProduct').prop('disabled', true);
   $('#btnAutoAdjust').prop('disabled', true).attr('title','Already adjusted');
   $('#btnSave').prop('disabled', true);
   $('input.sc-physical').prop('disabled', true);
   $('.sc-del').prop('disabled', true);
  } else {
   $('#scanProduct, #btnAddProduct').prop('disabled', false);
   $('#btnAutoAdjust').prop('disabled', false).attr('title','Adjust stock based on physical count');
   $('#btnSave').prop('disabled', false);
  }
 },
 InitTable: function(){
 $('#tableStockCountItems').DataTable({
 deferRender:true,
 processing:false,
 serverSide:false,
 destroy:true,
 searching:false,
 paging:false,
 info:false,
 columns:[
 { data:'productID', visible:false },
 { data:'product' },
 { data:'systemQty', className:'text-end', render:(d)=> d },
 { data:'physicalQty', className:'text-end', render:(d,t,r)=> t==='display'?`<input type="number" class="form-control form-control-sm sc-physical" value="${d}" min="0" />`:d },
 { data:'diffQty', className:'text-end', render:(d)=> { if(d>0) return `<span class="text-success fw-semibold">+${d}</span>`; if(d<0) return `<span class="text-danger fw-semibold">${d}</span>`; return `<span class="text-muted">0</span>`; }},
 { data:'unitPrice', className:'text-end', render: $.fn.dataTable.render.number(',', '.',2) },
 { data:'diffValue', className:'text-end', render:(d)=> { const formatted = Math.abs(d).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}); if(d>0) return `<span class="text-success">+${formatted}</span>`; if(d<0) return `<span class="text-danger">-${formatted}</span>`; return `<span class="text-muted">0.00</span>`; }},
 { data:null, orderable:false, className:'text-center', render:()=> `<button class='btn btn-sm btn-outline-danger sc-del' title='Remove'><i class='fa fa-trash'></i></button>` }
 ],
 data: []
 });
 const tbl = $('#tableStockCountItems');
 tbl.on('change','input.sc-physical', function(){
 const table = $('#tableStockCountItems').DataTable();
 let $td = $(this).closest('td');
 let idx = table.cell($td).index();
 if(!idx) return; let rowIdx = idx.row; let row = table.row(rowIdx).data();
 let phys = parseInt($(this).val(),10); if(isNaN(phys)||phys<0) phys=0;
 row.physicalQty = phys; row.diffQty = phys - parseInt(row.systemQty ||0); row.diffValue = row.diffQty * parseFloat(row.unitPrice||0);
 table.row(rowIdx).data(row).invalidate();
 StockCountPage.RefreshTotals();
 });
 tbl.on('click','.sc-del', function(){
 const table = $('#tableStockCountItems').DataTable();
 const row = table.row($(this).closest('tr'));
 const data = row.data();
 if(data.id>0){
 Swal.fire({ title:'Delete item?', icon:'warning', showCancelButton:true }).then(r=>{ if(r.isConfirmed){ $.get('/StockCount/DeleteItem',{id:data.id},res=>{ if(res.success){ row.remove().draw(); StockCountPage.RefreshTotals(); } else toastr.error(res.result||'Delete failed'); }); } });
 } else { row.remove().draw(); StockCountPage.RefreshTotals(); }
 });
 },
 LoadDetails: function(id){
 const table = $('#tableStockCountItems').DataTable();
 if(!id){ table.clear().draw(); this.RefreshTotals(); return; }
 $.get('/StockCount/GetDetailList',{id:id}, res=>{ table.clear(); table.rows.add(res); table.draw(); this.RefreshTotals(); this.UpdateAdjustedState(); });
 },
 AddProductToTable: function(prod){
  const table = $('#tableStockCountItems').DataTable();
  let exists = false;
  table.rows().every(function(){ let r=this.data(); if(r.productID == prod.id){ exists=true; $(this.node()).addClass('table-warning'); setTimeout(()=> $(this.node()).removeClass('table-warning'),800); }
  });
  if(exists){ toastr.info('Product already added'); return; }
  table.row.add({ id:0, productID: prod.id, product: prod.name, systemQty: prod.stockQuantity, physicalQty: prod.stockQuantity, diffQty:0, unitPrice: prod.unitPrice, diffValue:0 }).draw();
  this.RefreshTotals();
 },
 CollectData: function(){
 const table = $('#tableStockCountItems').DataTable();
 let items=[]; table.rows().every(function(){ let r=this.data(); items.push({ ID:r.id||0, ProductID:r.productID, SystemQty:r.systemQty, PhysicalQty:r.physicalQty, DiffQty:r.diffQty, UnitPrice:r.unitPrice }); });
 return items;
 },
 Save: function(){
 const items = this.CollectData();
 if(!items.length){ toastr.info('Add at least one product'); return; }
 let model = { ID: $('#stockCountID').val(), Date: $('#stockCountDate').val(), No: $('#stockCountNo').val(), Note: $('#stockCountNote').val(), AutoAdjust: false, Items: items };
 const csrfToken = Common.getCsrfToken();
 $('#btnSave').prop('disabled',true); $('#btnSave .spinner-border').removeClass('d-none');
 $.ajax({url:'/StockCount/Save', type:'POST', data: model, headers: { 'RequestVerificationToken': csrfToken }}).done(res=>{
 if(res.success){ toastr.success('Saved'); this.LoadForm(res.id); }
 else toastr.error(res.result||'Save failed');
 }).fail(err=> toastr.error(err.responseText||'Error')).always(()=> { $('#btnSave').prop('disabled',false); $('#btnSave .spinner-border').addClass('d-none'); });
 },
 RefreshTotals: function(){
 const table = $('#tableStockCountItems').DataTable();
 let total =0; table.rows().every(function(){ let r=this.data(); total += (parseFloat(r.diffValue)||0); });
 const formatted = Math.abs(total).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});
 const sign = total > 0 ? '+' : (total < 0 ? '-' : '');
 const cls = total > 0 ? 'text-bg-success' : (total < 0 ? 'text-bg-danger' : 'text-bg-info');
 $('#totalDiffValue').removeClass('text-bg-info text-bg-success text-bg-danger').addClass(cls).text(sign + formatted);
 },
 Search: function(){
 const modal = new bootstrap.Modal(document.getElementById('searchModal'));
 modal.show();
 let tb = $('#tableStockCountSearch').DataTable({ deferRender:true, processing:false, serverSide:false, destroy:true, searching:false, columns:[
 { data:'no' },{ data:'date', render: d => Common.Format.Date(d) },{ data:'note' },{ data:'items' },
 { data:null, orderable:false, className:'text-center', render:()=> `<div class="btn-group btn-group-sm"><button class='btn btn-outline-primary sc-edit' title='Edit'><i class='fa fa-pencil'></i></button> <button class='btn btn-outline-danger sc-delete' title='Delete'><i class='fa fa-trash'></i></button></div>` }
 ]});
 $.get('/StockCount/GetSearchList', data=>{ tb.clear(); tb.rows.add(data); tb.draw(); });
 $('#tableStockCountSearch').off('click').on('click','.sc-edit', function(){ let row = tb.row($(this).closest('tr')).data(); StockCountPage.LoadForm(row.id); modal.hide(); });
 $('#tableStockCountSearch').on('click','.sc-delete', function(){ let row = tb.row($(this).closest('tr')).data(); Swal.fire({title:'Delete?', text:'Stock adjustments (if any) will be reversed.', icon:'warning', showCancelButton:true}).then(r=>{ if(r.isConfirmed){ $.get('/StockCount/Delete',{id:row.id}, res=>{ if(res.success){ toastr.success('Deleted'); StockCountPage.LoadForm(0); StockCountPage.Search(); } else toastr.error(res.result||'Delete failed'); }); }}); });
 },
 AutoAdjust: function(){
  let id = parseInt($('#stockCountID').val()); if(!id || id===0){ toastr.info('Save the stock count first before adjusting'); return; }
  const adjusted = $('#stockCountAutoAdjust').val() === 'true';
  if(adjusted){ toastr.info('Stock has already been adjusted for this count'); return; }
  const items = this.CollectData();
  const hasDiff = items.some(i => i.DiffQty !== 0);
  if(!hasDiff){ toastr.info('No differences found — nothing to adjust'); return; }
  Swal.fire({
   title: 'Auto Adjust Stock?',
   html: 'This will update the actual stock quantities to match the physical counts.<br><br><strong>This action cannot be undone easily.</strong>',
   icon: 'question',
   showCancelButton: true,
   confirmButtonText: 'Yes, Adjust Stock',
   confirmButtonColor: '#2563eb',
   cancelButtonText: 'Cancel'
  }).then(r=>{
   if(!r.isConfirmed) return;
   Swal.fire({ title:'Adjusting...', allowOutsideClick:false, didOpen:()=> Swal.showLoading() });
   $.get('/StockCount/AutoAdjust', { id: id }, res=>{
    Swal.close();
    if(res.success){
     Swal.fire({
      icon: 'success',
      title: 'Stock Adjusted',
      html: `<strong>${res.adjustedCount}</strong> product(s) adjusted.<br>Total difference value: <strong>${Number(res.diffValue||0).toLocaleString('id-ID',{minimumFractionDigits:2})}</strong>`,
      confirmButtonColor: '#2563eb'
     }).then(()=> StockCountPage.LoadForm(id));
    } else {
     toastr.error(res.result||'Adjust failed');
    }
   });
  });
 }
};
