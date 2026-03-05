const driverPages = (function () {
  function initTable() {
    $('#tableDriverTasks').DataTable({
      deferRender: true,
      destroy: true,
      searching: true,
      paging: true,
      info: true,
      columns: [
        { data: 'no' },
        { data: 'salesOrderNo', render: d => d || '' },
        { data: 'statusID', render: d => d || '' },
        { data: 'deliveryAddress', render: d => d || '' },
        {
          data: null,
          orderable: false,
          render: () =>
            `<button class='btn btn-sm btn-outline-primary view-do'><i class='fa fa-eye'></i></button>`
        }
      ]
    });
    $('#tableDriverTasks').off('click', '.view-do').on('click', '.view-do', function () {
      const row = $('#tableDriverTasks').DataTable().row($(this).closest('tr')).data();
      if (!row) return;
      window.deliveryOrderModal.open(row.id || row.ID);
    });
  }

  function load() {
    const status = $('#filterTaskStatus').val();
    $.get('/Driver/MyTasks', { statusID: status || null }, function (list) {
      const tb = $('#tableDriverTasks').DataTable();
      const normalized = (list || []).map(item => ({
        id: item.id || item.ID,
        no: item.no || item.No,
        salesOrderID: item.salesOrderID || item.SalesOrderID,
        salesOrderNo: item.salesOrderNo || item.SalesOrderNo || null,
        statusID: item.statusID || item.StatusID,
        driverUserID: item.driverUserID || item.DriverUserID,
        driverName: item.driverName || item.DriverName || null,
        deliveryAddress: item.deliveryAddress || item.DeliveryAddress
      }));
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

  return { init };
})();

$(document).ready(function () { driverPages.init(); });
