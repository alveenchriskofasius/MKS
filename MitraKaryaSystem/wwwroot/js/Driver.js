const DriverPage = {
  Init(){ this.InitTable(); this.Bind(); this.Load(); },
  InitTable(){ $('#tableDriverTasks').DataTable({ deferRender:true, destroy:true, searching:true, paging:true, columns:[{data:'no'},{data:'salesOrderID'},{data:'statusID'},{data:'deliveryAddress'},{data:null, orderable:false, render:()=>`<div class='btn-group'>
    <button class='btn btn-sm btn-outline-primary act-start'>Start</button>
    <button class='btn btn-sm btn-outline-success act-delivered'>Delivered</button>
  </div>`}]}); },
  Bind(){ $('#filterTaskStatus').on('change',()=> this.Load()); $('#tableDriverTasks').on('click','.act-start',()=> this.BulkUpdate(3)); $('#tableDriverTasks').on('click','.act-delivered',()=> this.BulkUpdate(4)); },
  Load(){ const status=$('#filterTaskStatus').val(); $.get('/Driver/MyTasks', { statusID: status||null }, list=>{ let tb=$('#tableDriverTasks').DataTable(); tb.clear(); tb.rows.add(list||[]); tb.draw(); }); },
  BulkUpdate(newStatus){ let tb=$('#tableDriverTasks').DataTable(); let row = tb.row('.selected').data(); if(!row){ toastr.info('Select a row first'); return; } $.post('/Driver/UpdateStatus',{ id: row.id||row.ID, statusID: newStatus }).done(res=>{ res.success? toastr.success('Updated') : toastr.error(res.result||'Failed'); this.Load(); }); }
};
$(document).ready(()=>{ DriverPage.Init(); $('#tableDriverTasks tbody').on('click','tr', function(){ $(this).toggleClass('selected').siblings().removeClass('selected'); }); });
