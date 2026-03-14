const driverPages = (function () {
  var statusMap = { 1: 'Pending', 2: 'Assigned', 3: 'Out For Delivery', 4: 'Delivered', 5: 'Canceled' };
  var statusBadge = { 1: 'badge-pending', 2: 'badge-assigned', 3: 'badge-outfordelivery', 4: 'badge-delivered', 5: 'badge-canceled' };

  function initTable() {
    $('#tableDriverTasks').DataTable({
      deferRender: true,
      destroy: true,
      searching: true,
      paging: true,
      info: true,
      columns: [
        { data: 'no' },
        { data: 'salesOrderNo', render: function (d) { return d || ''; } },
        { data: 'statusID', render: function (d) { return '<span class="badge-status ' + (statusBadge[d] || 'badge-draft') + '">' + (statusMap[d] || d) + '</span>'; } },
        { data: 'deliveryAddress', render: function (d) { return d || ''; } },
        {
          data: null,
          orderable: false,
          render: function () {
            return '<button class="btn btn-sm btn-outline-primary view-do"><i class="fa fa-eye"></i></button>';
          }
        }
      ]
    });
    $('#tableDriverTasks').off('click', '.view-do').on('click', '.view-do', function () {
      var row = $('#tableDriverTasks').DataTable().row($(this).closest('tr')).data();
      if (!row) return;
      openDetail(row.id || row.ID);
    });
  }

  function openDetail(id) {
    $.get('/Driver/Get', { id: id }, function (data) {
      if (!data) { toastr.error('Delivery Order not found'); return; }
      var status = data.statusID || data.StatusID;
      var soId = data.salesOrderID || data.SalesOrderID;
      var doNo = data.no || data.No || '-';
      var driverLabel = data.driverName || data.DriverName || '-';
      var address = data.deliveryAddress || data.DeliveryAddress || '-';
      var items = (data.items || data.Items || []).map(function (i) {
        return '<tr><td>' + (i.productName || i.ProductName || i.productID || i.ProductID || '-') + '</td><td>' + (i.quantity || i.Quantity) + '</td></tr>';
      }).join('');

      var html = '<div class="text-start">' +
        '<div class="d-flex gap-3 mb-3">' +
        '<div class="flex-fill"><div class="text-muted small">DO No</div><div class="fw-bold">' + doNo + '</div></div>' +
        '<div class="flex-fill"><div class="text-muted small">SO ID</div><div class="fw-bold">' + (soId || '-') + '</div></div>' +
        '<div class="flex-fill"><div class="text-muted small">Status</div><div><span class="badge-status ' + (statusBadge[status] || 'badge-draft') + '">' + (statusMap[status] || status) + '</span></div></div>' +
        '<div class="flex-fill"><div class="text-muted small">Driver</div><div class="fw-bold">' + driverLabel + '</div></div>' +
        '</div>' +
        '<div class="mb-3"><div class="text-muted small">Delivery Address</div><div>' + address + '</div></div>' +
        '<div class="border rounded p-2"><div class="fw-bold mb-1">Items</div>' +
        '<table class="table table-sm mb-0"><thead><tr><th>Product</th><th>Qty</th></tr></thead><tbody>' +
        (items || '<tr><td colspan="2" class="text-center text-muted">No items</td></tr>') +
        '</tbody></table></div></div>';

      Swal.fire({ title: 'Delivery Order Details', width: 650, html: html, showCloseButton: true, showConfirmButton: false });
    }).fail(function () { toastr.error('Error loading delivery order'); });
  }

  function load() {
    var status = $('#filterTaskStatus').val();
    $.get('/Driver/MyTasks', { statusID: status || null }, function (list) {
      var tb = $('#tableDriverTasks').DataTable();
      var normalized = (list || []).map(function (item) {
        return {
          id: item.id || item.ID,
          no: item.no || item.No,
          salesOrderID: item.salesOrderID || item.SalesOrderID,
          salesOrderNo: item.salesOrderNo || item.SalesOrderNo || null,
          statusID: item.statusID || item.StatusID,
          driverUserID: item.driverUserID || item.DriverUserID,
          driverName: item.driverName || item.DriverName || null,
          deliveryAddress: item.deliveryAddress || item.DeliveryAddress
        };
      });
      tb.clear();
      tb.rows.add(normalized || []);
      tb.draw();
    });
  }

  function bind() {
    $('#filterTaskStatus').off('change').on('change', load);
  }

  function init() {
    bind();
    initTable();
    load();
  }

  return { init: init };
})();

$(document).ready(function () { driverPages.init(); });
