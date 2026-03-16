const doStatusMap = {1: 'Pending',2: 'Assigned',3: 'Out For Delivery',4: 'Delivered',5: 'Canceled'};
const doStatusBadge = {1:'badge-pending',2:'badge-assigned',3:'badge-outfordelivery',4:'badge-delivered',5:'badge-canceled'};

const deliveryOrderModal = (function () {
 function open(id) {
 $.get('/DeliveryOrder/Get', { id: id }, function (data) {
 if (!data) { toastr.error('Delivery Order not found'); return; }
 const status = data.statusID || data.StatusID;
 const soId = data.salesOrderID || data.SalesOrderID;
 const soNo = data.no || data.No || data.salesOrderNo || data.SalesOrderNo || '-';
 const driverLabel = data.driverName || data.DriverName || data.driverUserID || data.DriverUserID || '-';
 const items = (data.items || data.Items || []).map(i => `<tr><td>${i.productName || i.ProductName || '-'}</td><td>${i.quantity || i.Quantity}</td></tr>`).join('');

 const html = `<div class='text-start'>
 <div class='d-flex gap-3 mb-3'>
   <div class='flex-fill'><div class='text-muted small'>DO No</div><div class='fw-bold'>${soNo}</div></div>
   <div class='flex-fill'><div class='text-muted small'>SO ID</div><div class='fw-bold'>${soId || '-'}</div></div>
   <div class='flex-fill'><div class='text-muted small'>Status</div><div><span class='badge-status ${doStatusBadge[status] || "badge-draft"}'>${doStatusMap[status] || status}</span></div></div>
   <div class='flex-fill'><div class='text-muted small'>Driver</div><div class='fw-bold'>${driverLabel}</div></div>
 </div>
 <div class='mb-3'><div class='text-muted small'>Delivery Address</div><div>${(data.deliveryAddress || data.DeliveryAddress) || '-'}</div></div>
 <div class='border rounded p-2'><div class='fw-bold mb-1'>Items</div><table class='table table-sm mb-0'><thead><tr><th>Product</th><th>Qty</th></tr></thead><tbody>${items || '<tr><td colspan="2" class="text-center text-muted">No items</td></tr>'}</tbody></table></div>
 </div>`;

 Swal.fire({ title: 'Delivery Order Details', width:650, html: html, showCloseButton: true, showConfirmButton: false });
 }).fail(() => toastr.error('Error load DO'));
 }

 return { open };
})();

const doPages = (function () {
 let allData = [];
 let activeFilter = '';

 function initTable() {
 $('#tableDeliveryOrder').DataTable({
 deferRender: true,
 destroy: true,
 searching: true,
 paging: true,
 info: true,
 columns: [
 { data: 'no', render: d => d || '-' },
 { data: 'salesOrderNo', render: d => d || (d ===0 ? '0' : '-') },
 { data: 'statusID', render: d => `<span class="badge-status ${doStatusBadge[d] || 'badge-draft'}">${doStatusMap[d] || d}</span>` },
 { data: 'driverName', render: d => d || '<span class="text-muted">—</span>' },
 { data: 'deliveryAddress', render: d => d ? (d.length > 40 ? d.substring(0,40)+'…' : d) : '<span class="text-muted">—</span>' },
 { data: null, orderable: false, className: 'text-center', render: () => `<button class='btn btn-sm btn-outline-primary do-view' title='View details'><i class='fa fa-eye'></i></button> <button class='btn btn-sm btn-outline-secondary do-print' title='Print'><i class='fa fa-print'></i></button>` }
 ]
 });

 $('#tableDeliveryOrder').off('click', '.do-view').on('click', '.do-view', function () {
 const row = $('#tableDeliveryOrder').DataTable().row($(this).closest('tr')).data();
 if (!row) return;
 deliveryOrderModal.open(row.id || row.ID);
 });

 $('#tableDeliveryOrder').off('click', '.do-print').on('click', '.do-print', function () {
 const row = $('#tableDeliveryOrder').DataTable().row($(this).closest('tr')).data();
 if (!row) return;
 $.get('/DeliveryOrder/Get', { id: row.id || row.ID }, function (data) {
   if (!data) { toastr.error('Failed to load'); return; }
   MksPrint.deliveryOrder({ no: data.no || data.No, salesOrderNo: data.salesOrderNo || data.SalesOrderNo || '-', driverName: data.driverName || data.DriverName || '-', address: data.deliveryAddress || data.DeliveryAddress || '-', status: doStatusMap[data.statusID || data.StatusID] || '-', items: data.items || data.Items || [] });
 }).fail(() => toastr.error('Failed to load'));
 });
 }

 function updateKpis() {
  const counts = { all: allData.length, 1: 0, 2: 0, 3: 0, 4: 0 };
  allData.forEach(d => { if (counts[d.statusID] !== undefined) counts[d.statusID]++; });
  $('#kpiAll').text(counts.all);
  $('#kpiPending').text(counts[1]);
  $('#kpiAssigned').text(counts[2]);
  $('#kpiOtw').text(counts[3]);
  $('#kpiDelivered').text(counts[4]);
 }

 function applyFilter() {
  const filtered = activeFilter ? allData.filter(d => d.statusID == activeFilter) : allData;
  const tb = $('#tableDeliveryOrder').DataTable();
  tb.clear();
  tb.rows.add(filtered);
  tb.draw();
 }

 function load() {
 $.get('/DeliveryOrder/List', {}, function (list) {
 allData = (list || []).map(item => ({
  id: item.id || item.ID,
  no: item.no || item.No,
  salesOrderID: item.salesOrderID || item.SalesOrderID,
  salesOrderNo: item.salesOrderNo || item.SalesOrderNo || null,
  statusID: item.statusID || item.StatusID,
  driverUserID: item.driverUserID || item.DriverUserID,
  driverName: item.driverName || item.DriverName || null,
  deliveryAddress: item.deliveryAddress || item.DeliveryAddress
 }));
 updateKpis();
 applyFilter();
 });
 }

 function bind() {
  $('#btnRefreshDO').off('click').on('click', load);
  $('#doKpiRow').off('click', '.kpi-card').on('click', '.kpi-card', function() {
   $('#doKpiRow .kpi-card').removeClass('active');
   $(this).addClass('active');
   activeFilter = $(this).data('status');
   applyFilter();
  });
 }

 function init() { initTable(); bind(); load(); }

 return { init };
})();

$(document).ready(function () { if ($('#tableDeliveryOrder').length) doPages.init(); });