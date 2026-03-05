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
 { data: 'date' },
 { data: 'customerName' },
 { data: 'amount', className: 'text-end', render: $.fn.dataTable.render.number(',', '.',2) },
 { data: 'paidAmount', className: 'text-end', render: $.fn.dataTable.render.number(',', '.',2) },
 { data: 'statusID', render: (d) => SIStatus[d] || d },
 { data: null, orderable: false, defaultContent: '', render: (d) => {
 const fullyPaid = Number(d.paidAmount ||0) >= Number(d.amount ||0);
 const payBtn = (d.statusID ===4) ? '' : `<button class='btn btn-sm btn-outline-success si-pay' ${fullyPaid ? 'disabled' : ''} title='Record payment'><i class='fa fa-cash-register'></i></button>`;
 const fixBtn = (d.amount ===0 && (d.paidAmount ||0) >0) ? `<button class='btn btn-sm btn-warning si-fix' title='Fix invoice amount'><i class='fa fa-wrench'></i></button>` : '';
 return `${payBtn} ${fixBtn}`;
 } }
 ],
 load: async () => {
 try { return await Common.Api.get('/SalesInvoice/List'); } catch (e) { toastr.error(e.message||'Failed to load invoices'); return []; }
 },
 options: { searching: false },
 actions: {
 custom: [
 { selector: '.si-pay', onClick: (_row, _tb, el) => {
 const tb = $('#tableSalesInvoice').DataTable();
 const row = tb.row($(el).closest('tr')).data();
 if (!row) return;
 if (Number(row.statusID) ===4) return;
 if (Number(row.paidAmount ||0) >= Number(row.amount ||0)) return;
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
