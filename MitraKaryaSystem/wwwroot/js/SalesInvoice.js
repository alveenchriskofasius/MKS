$(document).ready(function(){ SalesInvoicePage.Init(); });

const SIStatus = {1:'Draft',2:'Issued',3:'Partially Paid',4:'Paid',9:'Canceled'};

const SalesInvoicePage = {
  Init: function(){ this.Bind(); this.Load(); },
  Bind: function(){
    const $t = $('#tableSalesInvoice');
    $t.off('click').on('click','.si-pay', ()=> this.onPay());
    $t.on('click','.si-fix', ()=> this.onFix());
    $(document).on('so:payment:updated', ()=> this.Load());
  },
  Load: function(){
    const $t = $('#tableSalesInvoice');
    const tb = $t.DataTable({ deferRender:true, processing:false, serverSide:false, destroy:true, searching:false, columns:[
      { data:'no' }, { data:'date' }, { data:'customerName' }, { data:'amount', className:'text-end', render: $.fn.dataTable.render.number(',', '.', 2) }, { data:'paidAmount', className:'text-end', render: $.fn.dataTable.render.number(',', '.', 2) }, { data:'statusID', render:(d)=> SIStatus[d]||d },
      { data:null, orderable:false, render: (d)=> {
          const fullyPaid = Number(d.paidAmount||0) >= Number(d.amount||0);
          // Hide pay button when already Paid (status 4). It will reappear if status changes (e.g., after returns)
          const payBtn = (d.statusID===4) ? '' : `<button class='btn btn-sm btn-outline-success si-pay' ${fullyPaid?'disabled':''}><i class='fa fa-cash-register'></i></button>`;
          const fixBtn = (d.amount===0 && (d.paidAmount||0)>0) ? `<button class='btn btn-sm btn-warning si-fix'><i class='fa fa-wrench'></i></button>` : '';
          return `${payBtn} ${fixBtn}`;
        } }
    ]});
    $.get('/SalesInvoice/List', list=>{ tb.clear(); tb.rows.add(list||[]); tb.draw(); });
  },
  onPay: function(){
    const tb = $('#tableSalesInvoice').DataTable();
    const row = tb.row($(document.activeElement).closest('tr')).data();
    if(!row) return;
    // Prevent pay if status is Paid
    if(Number(row.statusID) === 4) return;
    if(Number(row.paidAmount||0) >= Number(row.amount||0)) return;
    PaymentIn.openFromInvoice({ id:row.id||row.ID, customerID: row.customerID||row.CustomerID, customerName: row.customerName||row.CustomerName, amount: row.amount, paidAmount: row.paidAmount });
  },
  onFix: function(){
    const tb = $('#tableSalesInvoice').DataTable();
    const row = tb.row($(document.activeElement).closest('tr')).data();
    if(!row) return;
    Swal.fire({
      title:'Set Invoice Amount',
      input:'number',
      inputAttributes:{ step:'0.01', min: (row.paidAmount||0) },
      inputValue: row.paidAmount || 0,
      showCancelButton:true,
      preConfirm: (val)=>{
        const amount = Number(val||0);
        if(amount < (row.paidAmount||0)) return Swal.showValidationMessage('Amount cannot be less than already paid');
        return $.post('/SalesInvoice/SetAmount',{ id: row.id||row.ID, amount: amount }).then(res=>{
          if(!res.success) throw new Error(res.result||'Failed');
          return res;
        }).catch(e=> Swal.showValidationMessage(e.message));
      }
    }).then(r=>{ if(r.isConfirmed){ toastr.success('Amount updated'); SalesInvoicePage.Load(); } });
  }
};
