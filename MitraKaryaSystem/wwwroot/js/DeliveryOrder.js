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
 { data: 'deliveryAddress', render: d => {
    if (!d) return '<span class="text-muted">—</span>';
    const clean = d.replace(/^Alamat:\s*/i, '');
    return clean.length > 40 ? clean.substring(0, 40) + '…' : clean;
 } },
 { data: null, orderable: false, className: 'text-center align-middle', render: function (_d, _t, row) {
    // action buttons depending on status: Assigned -> Start, OutForDelivery -> Deliver
    const status = row && (row.statusID || row.StatusID) ? (row.statusID || row.StatusID) : 0;
    const viewBtn = `<button class='btn btn-sm btn-outline-primary do-view' title='View details'><i class='fa fa-eye'></i></button>`;
    const printBtn = `<button class='btn btn-sm btn-outline-secondary do-print' title='Print'><i class='fa fa-print'></i></button>`;
    let extra = '';
    if (status === 1) { // Pending - assign driver
        extra = `<button class='btn btn-sm btn-outline-info do-assign' title='Assign Driver' style='margin-left:6px'><i class='fa fa-user-plus'></i></button>`;
    } else if (status === 2) { // Assigned
        extra = `<button class='btn btn-sm btn-outline-warning do-start' title='Start delivery' style='margin-left:6px'><i class='fa fa-truck-fast'></i></button>`;
    } else if (status === 3) { // Out For Delivery
        extra = `<button class='btn btn-sm btn-outline-success do-deliver' title='Mark delivered' style='margin-left:6px'><i class='fa fa-check-circle'></i></button>`;
    }
    return `<div class='d-flex align-items-center justify-content-center' style='gap:6px'>${viewBtn}${printBtn}${extra}</div>`;
 } }
 ]
 });

  // Assign driver (Pending -> Assigned)
  $('#tableDeliveryOrder').off('click', '.do-assign').on('click', '.do-assign', function () {
    const row = $('#tableDeliveryOrder').DataTable().row($(this).closest('tr')).data();
    if (!row) return;
    const id = row.id || row.ID;
    if (!id) return;
    Common.Api.get('/DeliveryOrder/GetDrivers')
      .then(list => {
        let drivers = list;
        if (list && list.result) drivers = list.result;
        const options = (drivers || []).map(u => `<option value='${u.id || u.ID}'>${u.name || u.Name || u.userName || u.UserName}</option>`).join('');
        Swal.fire({
          title: 'Assign Driver',
          html: `<select id='swalSelectDriver' class='form-select mt-2'><option value=''>-- Select driver --</option>${options}</select>`,
          showCancelButton: true,
          confirmButtonText: 'Assign',
          showLoaderOnConfirm: true,
          preConfirm: () => {
            const driverID = document.getElementById('swalSelectDriver').value;
            if (!driverID) { Swal.showValidationMessage('Pilih driver terlebih dahulu'); return false; }
            return Common.Api.post('/DeliveryOrder/AssignDriver', { id: id, driverUserID: parseInt(driverID) })
              .then(res => { if (!res.success) throw new Error(res.result || 'Gagal assign driver'); return res; })
              .catch(err => Swal.showValidationMessage(err.message || 'Request failed'));
          },
          allowOutsideClick: () => !Swal.isLoading()
        }).then(result => {
          if (result.isConfirmed) { toastr.success('Driver berhasil diassign'); doPages.init(); }
        });
      })
      .catch(() => toastr.error('Gagal memuat daftar driver'));
  });

  // Start delivery (Assigned -> OutForDelivery)
  $('#tableDeliveryOrder').off('click', '.do-start').on('click', '.do-start', function () {
    const row = $('#tableDeliveryOrder').DataTable().row($(this).closest('tr')).data();
    if (!row) return;
    const id = row.id || row.ID;
    if (!id) return;
    Swal.fire({ title: 'Start Delivery?', text: 'Mark this delivery order as Out For Delivery?', icon: 'question', showCancelButton: true }).then(async (res) => {
      if (!res.isConfirmed) return;
      try {
        const r = await Common.Api.post('/DeliveryOrder/UpdateStatus', { id: id, newStatus: 3 });
        if (r && r.success) { toastr.success('Delivery started'); doPages.init && doPages.init(); /* reload table */ }
        else toastr.error(r && (r.result || r.error) ? (r.result || r.error) : 'Failed to start delivery');
      } catch (e) { toastr.error(e && e.message ? e.message : 'Request failed'); }
    });
  });

  // Mark delivered (OutForDelivery -> Delivered)
  $('#tableDeliveryOrder').off('click', '.do-deliver').on('click', '.do-deliver', function () {
    const row = $('#tableDeliveryOrder').DataTable().row($(this).closest('tr')).data();
    if (!row) return;
    const id = row.id || row.ID;
    if (!id) return;
    Swal.fire({ title: 'Mark Delivered?', text: 'Mark this delivery order as Delivered?', icon: 'question', showCancelButton: true }).then(async (res) => {
      if (!res.isConfirmed) return;
      try {
        const r = await Common.Api.post('/DeliveryOrder/UpdateStatus', { id: id, newStatus: 4 });
        if (r && r.success) { toastr.success('Delivery marked as delivered'); doPages.init && doPages.init(); }
        else toastr.error(r && (r.result || r.error) ? (r.result || r.error) : 'Failed to mark delivered');
      } catch (e) { toastr.error(e && e.message ? e.message : 'Request failed'); }
    });
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