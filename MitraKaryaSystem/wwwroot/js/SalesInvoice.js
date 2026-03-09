$(document).ready(function(){ SalesInvoicePage.Init(); });

const SIStatus = {1: 'Draft',2: 'Issued',3: 'Partially Paid',4: 'Paid',9: 'Canceled' };

const SalesInvoicePage = {
 Init: function () { this.Bind(); this.Load(); },
 Bind: function () {
 const $t = $('#tableSalesInvoice');
 // Only need to (re)load when SO payments updated
 $(document).off('so:payment:updated').on('so:payment:updated', () => this.Load());
 },
 Load: async function () {
 await SharedTable.init({
 table: '#tableSalesInvoice',
 columns: [
 { data: 'no' },
 { data: 'date', render: d => Common.Format.Date(d) },
 { data: 'customerName' },
 { data: 'amount', className: 'text-end', render: $.fn.dataTable.render.number(',', '.',2) },
 { data: 'paidAmount', className: 'text-end', render: $.fn.dataTable.render.number(',', '.',2) },
 { data: 'statusID', render: (d) => SIStatus[d] || d },
 { data: null, orderable: false, defaultContent: '', render: (d) => {
  const s = Number(d.statusID);
  const fullyPaid = Number(d.amount ||0) > 0 && Number(d.paidAmount ||0) >= Number(d.amount ||0);
  let btns = `<button class='btn btn-sm btn-outline-secondary si-print' title='Print'><i class='fa fa-print'></i></button> `;
  if (s === 1) btns += `<button class='btn btn-sm btn-outline-primary si-issue' title='Issue'><i class='fa fa-check'></i></button> `;
  if (s === 1 || s === 2) btns += `<button class='btn btn-sm btn-outline-danger si-cancel' title='Cancel'><i class='fa fa-times'></i></button> `;
  if (s === 2 || s === 3) btns += `<button class='btn btn-sm btn-outline-success si-pay' ${fullyPaid ? 'disabled' : ''} title='Record payment'><i class='fa fa-cash-register'></i></button> `;
  if (d.amount === 0 && (d.paidAmount ||0) > 0) btns += `<button class='btn btn-sm btn-warning si-fix' title='Fix invoice amount'><i class='fa fa-wrench'></i></button>`;
  return btns;
  } }
  ],
  load: async () => {
  try { return await Common.Api.get('/SalesInvoice/List'); } catch (e) { toastr.error(e.message||'Failed to load invoices'); return []; }
  },
  options: { searching: false },
  actions: {
  custom: [
  { selector: '.si-print', onClick: (_row, _tb, el) => {
  const tb = $('#tableSalesInvoice').DataTable();
  const row = tb.row($(el).closest('tr')).data();
  if (!row) return;
  MksPrint.salesInvoice({ no: row.no, date: row.date, customerName: row.customerName, amount: row.amount, paid: row.paidAmount, status: SIStatus[row.statusID] || row.statusID });
  } },
  { selector: '.si-issue', onClick: (_row, _tb, el) => {
  const tb = $('#tableSalesInvoice').DataTable();
  const row = tb.row($(el).closest('tr')).data();
  if (!row || Number(row.statusID) !== 1) return;
  Swal.fire({ title: 'Issue Invoice?', text: `Issue invoice ${row.no}?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Issue' }).then(r => {
  if (!r.isConfirmed) return;
  Common.Api.post('/SalesInvoice/Issue', { id: row.id || row.ID })
  .then(() => { toastr.success('Invoice issued'); SalesInvoicePage.Load(); })
  .catch(e => toastr.error(e.message || 'Failed to issue'));
  });
  } },
  { selector: '.si-cancel', onClick: (_row, _tb, el) => {
  const tb = $('#tableSalesInvoice').DataTable();
  const row = tb.row($(el).closest('tr')).data();
  if (!row) return;
  const s = Number(row.statusID);
  if (s !== 1 && s !== 2) return;
  Swal.fire({ title: 'Cancel Invoice?', text: `Cancel invoice ${row.no}?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes, cancel it' }).then(r => {
  if (!r.isConfirmed) return;
  Common.Api.post('/SalesInvoice/Cancel', { id: row.id || row.ID })
  .then(() => { toastr.success('Invoice canceled'); SalesInvoicePage.Load(); })
  .catch(e => toastr.error(e.message || 'Failed to cancel'));
  });
  } },
  { selector: '.si-pay', onClick: (_row, _tb, el) => {
  const tb = $('#tableSalesInvoice').DataTable();
  const row = tb.row($(el).closest('tr')).data();
  if (!row) return;
  const s = Number(row.statusID);
  if (s !== 2 && s !== 3) return;
  if (Number(row.amount ||0) > 0 && Number(row.paidAmount ||0) >= Number(row.amount ||0)) return;
  PaymentIn.openFromInvoice({ id: row.id || row.ID, customerID: row.customerID || row.CustomerID, customerName: row.customerName || row.CustomerName, amount: row.amount, paidAmount: row.paidAmount });
  } },
  { selector: '.si-fix', onClick: (_row, _tb, el) => {
  const tb = $('#tableSalesInvoice').DataTable();
  const row = tb.row($(el).closest('tr')).data();
  if (!row) return;
  Swal.fire({
  title: 'Set Invoice Amount',
  input: 'number',
  inputAttributes: { step: '0.01', min: (row.paidAmount ||0) },
  inputValue: row.paidAmount ||0,
  showCancelButton: true,
  preConfirm: (val) => {
  const amount = Number(val ||0);
  if (amount < (row.paidAmount ||0)) return Swal.showValidationMessage('Amount cannot be less than already paid');
  return Common.Api.post('/SalesInvoice/SetAmount', { id: row.id || row.ID, amount: amount })
  .then(res => { if (!res || res.success === false) throw new Error((res && res.result) || 'Failed'); return res; })
  .catch(e => Swal.showValidationMessage(e.message || 'Failed'));
  }
  }).then(r => { if (r.isConfirmed) { toastr.success('Amount updated'); SalesInvoicePage.Load(); } });
  } }
  ],
  refresh: () => SalesInvoicePage.Load()
  }
  });
  }
};
