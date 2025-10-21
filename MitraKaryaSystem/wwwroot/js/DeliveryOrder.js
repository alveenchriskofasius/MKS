const DOStatusMap = {1:'Pending',2:'Assigned',3:'Out For Delivery',4:'Delivered',5:'Canceled'};
// Fallback modal definition (if not loaded from SalesOrder.js page)
if(typeof window.DeliveryOrderModal === 'undefined'){
  window.DeliveryOrderModal = {
    Open: function(id){
      $.get('/DeliveryOrder/Get',{id:id}, function(data){
        if(!data){ toastr.error('Delivery Order not found'); return; }
        const status = data.statusID || data.StatusID; const soId = data.salesOrderID || data.SalesOrderID;
        const soNo = data.no || data.No || data.salesOrderNo || data.SalesOrderNo || '-';
        const driverLabel = (data.driverName || data.DriverName || data.driverUserID || data.DriverUserID) ? (data.driverName || data.DriverName || (data.driverUserID || data.DriverUserID)) : '-';
        const items = (data.items||data.Items||[]).map(i=> `<tr><td>${i.productID||i.ProductID||i.productName||i.ProductName||'-'}</td><td>${i.quantity||i.Quantity}</td></tr>`).join('');
        Swal.fire({ title: 'Delivery Order', width:650, html: `<div class='text-start'>
            <div class='mb-2'><strong>No:</strong> ${soNo} &nbsp; <strong>DO ID:</strong> ${data.id||data.ID||'-'}</div>
            <div class='mb-2'><strong>SO:</strong> ${soId||'-'} &nbsp; <strong>Status:</strong> ${DOStatusMap[status]||status} &nbsp; <strong>Driver:</strong> ${driverLabel}</div>
            <div class='mb-2'><strong>Address:</strong> ${(data.deliveryAddress||data.DeliveryAddress)||'-'}</div>
            <div class='border rounded p-2'><div class='fw-bold mb-1'>Items</div><table class='table table-sm mb-0'><thead><tr><th>Product</th><th>Qty</th></tr></thead><tbody>${items}</tbody></table></div>
          </div>`, showCloseButton:true, showConfirmButton:false });
      }).fail(()=> toastr.error('Error load DO'));
    }
  };
}
$(document).ready(function(){ DOPages.Init(); });
const DOPages = {
  Init(){ this.InitTable(); this.Bind(); this.Load(); },
  Bind(){ $('#btnRefreshDO,#filterDOStatus').on('change click', ()=> this.Load()); },
  InitTable(){ $('#tableDeliveryOrder').DataTable({ deferRender:true, destroy:true, searching:true, paging:true, info:true, columns:[ {data:'no', render: d=> d||'-'}, {data:'salesOrderNo', render:d=> d||(d===0? '0':'-')}, {data:'statusID', render:d=> DOStatusMap[d]||d}, {data:'driverName', render:d=> d||'-'}, {data:'deliveryAddress', render:d=> d||'-'}, {data:null, orderable:false, render:()=> `<button class='btn btn-sm btn-outline-primary do-view'><i class='fa fa-eye'></i></button>`}] }); $('#tableDeliveryOrder').on('click','.do-view', function(){ let row=$('#tableDeliveryOrder').DataTable().row($(this).closest('tr')).data(); if(!row) return; DeliveryOrderModal.Open(row.id||row.ID); }); },
  Load(){ const status = $('#filterDOStatus').val(); $.get('/DeliveryOrder/List', { statusID: status||null }, list=>{ let tb=$('#tableDeliveryOrder').DataTable(); tb.clear(); // normalize incoming list to prefer SalesOrderNo and DriverName
    const normalized = (list || []).map(item => ({
      id: item.id || item.ID,
      no: item.no || item.No,
      salesOrderID: item.salesOrderID || item.SalesOrderID,
      salesOrderNo: item.salesOrderNo || item.SalesOrderNo || item.SalesOrderNo || null,
      statusID: item.statusID || item.StatusID,
      driverUserID: item.driverUserID || item.DriverUserID,
      driverName: item.driverName || item.DriverName || null,
      deliveryAddress: item.deliveryAddress || item.DeliveryAddress
    }));
    tb.rows.add(normalized||[]); tb.draw(); }); }
};