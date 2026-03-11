(function(){
  const state = { items: [], taxRate: 0.11, suggestIndex: -1, _searchSeq: 0 };
  const fmt = n => 'Rp ' + (Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:0, maximumFractionDigits:0});

  function getPayType(){ return $('input[name="posPayType"]:checked').val() || 'Full'; }

  function recalc(){
    let subtotal = state.items.reduce((s,i)=> s + i.price*i.qty, 0);
    const tax = subtotal * state.taxRate;
    const total = subtotal + tax;
    $('#posSubtotal').text(fmt(subtotal));
    $('#posTax').text(fmt(tax));
    $('#posTotal').text(fmt(total));
    const payType = getPayType();
    const tender = parseFloat($('#posTender').val()||0);
    let change = 0;
    if(payType === 'Full'){
      change = Math.max(0, tender - total);
      $('#posChange').text(fmt(change));
      $('#posChangeWrap').removeClass('d-none');
      $('#posDebtWrap').addClass('d-none');
    } else if(payType === 'DP'){
      const remaining = Math.max(0, total - tender);
      $('#posChangeWrap').addClass('d-none');
      $('#posDebt').text(fmt(remaining));
      $('#posDebtWrap').removeClass('d-none');
    } else {
      $('#posChangeWrap').addClass('d-none');
      $('#posDebt').text(fmt(total));
      $('#posDebtWrap').removeClass('d-none');
    }
    $('#posBtnPay').prop('disabled', state.items.length===0);
    $('#posBtnQris').prop('disabled', state.items.length===0);
    return { subtotal, tax, total, change };
  }

  function updatePaymentUI(){
    const payType = getPayType();
    if(payType === 'Piutang'){
      $('#posTenderWrap').addClass('d-none');
      $('#posTender').val('');
    } else {
      $('#posTenderWrap').removeClass('d-none');
      $('#posTenderLabel').text(payType === 'DP' ? 'Down Payment Amount' : 'Cash Received');
    }
    recalc();
  }

  function render(){
    const $tb = $('#posOrderTable tbody').empty();
    if(state.items.length===0){ $tb.append('<tr><td colspan="5" class="text-center text-muted small">No items</td></tr>'); }
    else state.items.forEach((it,idx)=> $tb.append(`<tr data-id='${it.id}'><td>${it.name}</td><td><div class='pos-qty-group'><button class='btn btn-outline-secondary btn-sm pos-qty-btn pos-minus' data-idx='${idx}' type='button'>-</button><input type='number' class='form-control form-control-sm pos-qty' data-idx='${idx}' value='${it.qty}' min='1'/><button class='btn btn-outline-secondary btn-sm pos-qty-btn pos-plus' data-idx='${idx}' type='button'>+</button></div></td><td class='text-end'>${fmt(it.price)}</td><td class='text-end'>${fmt(it.price*it.qty)}</td><td class='text-end'><button class='btn btn-sm btn-danger pos-del'><i class='fa fa-trash'></i></button></td></tr>`));
    recalc();
  }

  function addOrInc(p){
    if(!p) return;
    const stock = (p.stockQuantity != null ? Number(p.stockQuantity) : (p.StockQuantity != null ? Number(p.StockQuantity) : null));
    if(stock != null && !isNaN(stock) && stock <= 0){
      toastr.warning('Stok 0 / habis. Tidak bisa ditambahkan ke cart.');
      return;
    }
    const id = p.id; const name = p.text||p.name; let price = Number(p.unitPrice||p.price||0);
    const hasDiscount = p.hasDiscount || p.HasDiscount || false;
    const discPct = Number(p.discountPercentage || p.DiscountPercentage || 0);
    if (hasDiscount && discPct > 0) price = price - (price * discPct / 100);
    let f = state.items.find(i=>i.id===id);
    if(f) f.qty += 1; else state.items.push({ id, name, price, qty:1, hasDiscount, discPct });
    state._searchSeq++;
    render();
    destroySuggest();
    $('#posSearch').val('').focus();
  }

  // Suggestion management
  function destroySuggest(){ state.suggestIndex=-1; $('#posSearch').siblings('.pos-suggest').remove(); }
  function buildSuggest(list, query){
    const lowThreshold = 5; // same as dashboard alert threshold
    const $wrap = $('<div class="pos-suggest shadow" />');
    list.slice(0,10).forEach((p,i)=>{
      const rawName = p.name||p.Name||'';
      const supplier = p.supplierName||p.SupplierName||'';
      const price = Number(p.unitPrice||p.UnitPrice||0);
      const stockRaw = (p.stockQuantity!=null ? p.stockQuantity : p.StockQuantity);
      const stock = (stockRaw != null && stockRaw !== '') ? Number(stockRaw) : null;
      const highlighted = highlightMatch(rawName, query);
      const isOut = (stock != null && !isNaN(stock) && stock <= 0);
      // Build stock badge (warning for low, danger for empty)
      let stockBadge = '';
      if (stock != null && !isNaN(stock)) {
        if (stock <= 0) stockBadge = `<span class='badge text-bg-danger ms-2'>Stock 0</span>`;
        else if (stock > 0 && stock <= lowThreshold) stockBadge = `<span class='badge text-bg-warning ms-2'>Low ${stock}</span>`;
      }
      const leftHtml = `${highlighted} <small class='text-muted'>${supplier}</small> ${stockBadge}`;
      const hasDisc = p.hasDiscount || p.HasDiscount || false;
      const discPct = Number(p.discountPercentage || p.DiscountPercentage || 0);
      const discBadge = (hasDisc && discPct > 0) ? ` <span class='badge text-bg-success ms-1'>-${discPct}%</span>` : '';
      const $row = $(`<div class='pos-suggest-item d-flex justify-content-between align-items-center${isOut ? ' disabled' : ''}' data-idx='${i}' tabindex='0'><div class='text-truncate'>${leftHtml}${discBadge}</div><div class='ms-2 fw-semibold'>${fmt(price)}</div></div>`);
      $row.on('click keydown', e=>{
        if(e.type==='click' || e.key==='Enter'){
          if(isOut){ toastr.warning('Stok 0 / habis. Tidak bisa ditambahkan ke cart.'); return; }
          addOrInc({ id:p.id||p.ID, text:rawName, unitPrice:price, stockQuantity: stock, hasDiscount: hasDisc, discountPercentage: discPct });
          destroySuggest();
        }
      });
      $wrap.append($row);
    });
    return $wrap;
  }
  function setActiveSuggestion(){ const $items = $('.pos-suggest-item'); $items.removeClass('active'); if(state.suggestIndex>=0 && state.suggestIndex<$items.length){ $($items[state.suggestIndex]).addClass('active'); } }
  function highlightMatch(text, query){ if(!query) return text; const esc = query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); const reg = new RegExp(esc,'ig'); return text.replace(reg, m=>`<span class='match'>${m}</span>`); }

  function searchProductsAsync(query){
    const isBarcode = /^\d{3,}$/.test(query);
    const p1 = $.get('/Product/GetProductComboList?name=' + encodeURIComponent(query)).catch(()=>[]);
    const p2 = isBarcode ? $.get('/StockIn/ScanBarcode?barcode=' + encodeURIComponent(query)).catch(()=>null) : Promise.resolve(null);
    return Promise.all([p1,p2]).then(([list, barcodeRes])=>{
      let arr = Array.isArray(list) ? list : (list && list.result) ? list.result : [];
      if(barcodeRes && (barcodeRes.id || barcodeRes.ID)){
        const bid = barcodeRes.id || barcodeRes.ID;
        const fromList = arr.find(x => (x.id || x.ID) === bid);
        const barcodeItem = fromList ? {
          ...fromList,
          // ensure the display name/price align with barcode scan response when available
          Name: (barcodeRes.name || barcodeRes.Name) ?? (fromList.name || fromList.Name),
          UnitPrice: (barcodeRes.unitPrice || barcodeRes.UnitPrice) ?? (fromList.unitPrice || fromList.UnitPrice),
          SupplierName: (barcodeRes.supplierName || barcodeRes.SupplierName) ?? (fromList.supplierName || fromList.SupplierName),
          StockQuantity: (fromList.stockQuantity ?? fromList.StockQuantity)
        } : {
          ID: bid,
          Name: barcodeRes.name || barcodeRes.Name,
          UnitPrice: barcodeRes.unitPrice || barcodeRes.UnitPrice,
          SupplierName: barcodeRes.supplierName || barcodeRes.SupplierName,
          SupplierID: barcodeRes.supplierID || barcodeRes.SupplierID,
          Barcode: barcodeRes.barcode || barcodeRes.Barcode,
          StockQuantity: barcodeRes.stockQuantity ?? barcodeRes.StockQuantity
        };

        // Put barcode result first, then the rest (dedupe by id)
        const seen = new Set([bid]);
        const normalized = [barcodeItem];
        arr.forEach(p=>{
          const id = p.id || p.ID;
          if(!id || seen.has(id)) return;
          seen.add(id);
          normalized.push(p);
        });
        return normalized;
      }

      const seen = new Set();
      const normalized=[];
      arr.forEach(p=>{ const id=p.id||p.ID; if(!id||seen.has(id)) return; seen.add(id); normalized.push(p); });
      return normalized;
    });
  }

  function wireSearch(){
    let typingTimer = null; const $input = $('#posSearch');
    $input.on('input', function(){ clearTimeout(typingTimer); destroySuggest(); const q=this.value.trim(); if(!q) return; const seq=++state._searchSeq; typingTimer=setTimeout(()=>{ searchProductsAsync(q).then(list=>{ if(seq!==state._searchSeq) return; if(list.length>0){ $input.after(buildSuggest(list,q)); state.suggestIndex=-1; } }); }, 200); });
    $input.on('keydown', function(e){ const $items = $('.pos-suggest-item'); if(e.key==='ArrowDown'){ if($items.length){ e.preventDefault(); state.suggestIndex = (state.suggestIndex+1) % $items.length; setActiveSuggestion(); } } else if(e.key==='ArrowUp'){ if($items.length){ e.preventDefault(); state.suggestIndex = (state.suggestIndex<=0? $items.length-1 : state.suggestIndex-1); setActiveSuggestion(); } } else if(e.key==='Enter'){ e.preventDefault(); clearTimeout(typingTimer); if($items.length && state.suggestIndex>=0){ $items.eq(state.suggestIndex).trigger('click'); return; } destroySuggest(); const q=this.value.trim(); if(!q) return; const seq=++state._searchSeq; searchProductsAsync(q).then(list=>{ if(seq!==state._searchSeq) return; if(list.length>0){ const p=list[0]; addOrInc({ id:p.id||p.ID, text:p.name||p.Name, unitPrice:Number(p.unitPrice||p.UnitPrice||0), stockQuantity: (p.stockQuantity ?? p.StockQuantity), hasDiscount: p.hasDiscount || p.HasDiscount || false, discountPercentage: p.discountPercentage || p.DiscountPercentage || 0 }); } }); } else if(e.key==='Escape'){ destroySuggest(); }
    });
    $input.on('blur', ()=> setTimeout(destroySuggest, 180));
  }

  function wireTable(){
    $('#posOrderTable')
      .on('change', '.pos-qty', function(){ const i=parseInt($(this).data('idx')); let v=parseInt($(this).val()); if(!v||v<1) v=1; state.items[i].qty=v; render(); setTimeout(()=> $('#posSearch').focus(), 30); })
      .on('click', '.pos-minus', function(){ const i=parseInt($(this).data('idx')); if(state.items[i].qty>1) state.items[i].qty--; render(); setTimeout(()=> $('#posSearch').focus(), 30); })
      .on('click', '.pos-plus', function(){ const i=parseInt($(this).data('idx')); state.items[i].qty++; render(); setTimeout(()=> $('#posSearch').focus(), 30); })
      .on('click', '.pos-del', function(){ const id=$(this).closest('tr').data('id'); state.items = state.items.filter(x=>x.id!==id); render(); setTimeout(()=> $('#posSearch').focus(), 30); });
  }

  function captureReceiptData(payResponse){
    const { subtotal, tax, total, change } = recalc();
    return {
      items: state.items.map(i=> ({ name:i.name, qty:i.qty, price:i.price })),
      subtotal, tax, total, change,
      customer: $('#posCustomer option:selected').text() || 'Umum',
      payType: $('input[name="posPayType"]:checked').val() || 'Full',
      no: payResponse.no || '-',
      paid: payResponse.paid || 0,
      changeAmt: payResponse.change || change
    };
  }

  function buildReceiptPreviewHtml(snap){
    const itemsHtml = snap.items.map(i=> `<tr><td>${i.name}</td><td class='text-center'>${i.qty}</td><td class='text-end'>${fmt(i.price)}</td><td class='text-end'>${fmt(i.price*i.qty)}</td></tr>`).join('');
    return `<div class='text-start'>
      <h5 class='mb-2'>Receipt</h5>
      <div class='small mb-2'>No: ${snap.no} | Date: ${Common.Format.Datetime(new Date())}</div>
      <table class='table table-sm'>
        <thead><tr><th>Product</th><th class='text-center'>Qty</th><th class='text-end'>Price</th><th class='text-end'>Total</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class='border-top pt-2'>
        <div class='d-flex justify-content-between'><span>Subtotal</span><span>${fmt(snap.subtotal)}</span></div>
        <div class='d-flex justify-content-between'><span>Tax (11%)</span><span>${fmt(snap.tax)}</span></div>
        <div class='d-flex justify-content-between fw-bold'><span>Grand Total</span><span>${fmt(snap.total)}</span></div>
        <div class='d-flex justify-content-between'><span>Paid</span><span>${fmt(snap.paid)}</span></div>
        <div class='d-flex justify-content-between'><span>Change</span><span>${fmt(snap.changeAmt)}</span></div>
        ${snap.paid < snap.total ? `<div class='d-flex justify-content-between text-danger fw-semibold'><span>Remaining Debt</span><span>${fmt(snap.total - snap.paid)}</span></div>` : ''}
      </div>
    </div>`;
  }

  function buildPrintableReceiptHtml(snap){
    const itemsHtml = snap.items.map(i=> `<tr><td style="text-align:left;">${i.name}</td><td style="text-align:center;">${i.qty}</td><td style="text-align:right;">${fmt(i.price)}</td><td style="text-align:right;">${fmt(i.price*i.qty)}</td></tr>`).join('');
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt - ${snap.no}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #000; width: 72mm; margin: 0 auto; }
  .receipt { padding: 4mm 0; }
  .header { text-align: center; margin-bottom: 8px; }
  .header h2 { font-size: 16px; margin-bottom: 2px; }
  .header .sub { font-size: 10px; color: #555; }
  .divider { border: none; border-top: 1px dashed #999; margin: 6px 0; }
  .info { font-size: 11px; margin-bottom: 4px; }
  .info span { display: inline-block; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  th { font-size: 11px; font-weight: 600; border-bottom: 1px solid #333; padding: 3px 2px; }
  td { font-size: 11px; padding: 3px 2px; vertical-align: top; }
  .summary { margin-top: 4px; }
  .summary .line { display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0; }
  .summary .line.grand { font-size: 14px; font-weight: 700; margin-top: 4px; padding: 4px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; }
  .summary .line.change { font-size: 12px; font-weight: 600; color: #333; }
  .footer { text-align: center; margin-top: 10px; font-size: 10px; color: #777; }
</style></head>
<body>
<div class="receipt">
  <div class="header">
    <h2>Mitra Karya</h2>
    <div class="sub">Thank you for your purchase</div>
  </div>
  <hr class="divider">
  <div class="info"><strong>No:</strong> ${snap.no}</div>
  <div class="info"><strong>Date:</strong> ${Common.Format.Datetime(new Date())}</div>
  <div class="info"><strong>Customer:</strong> ${snap.customer}</div>
  <div class="info"><strong>Payment:</strong> ${snap.payType}</div>
  <hr class="divider">
  <table>
    <thead><tr><th style="text-align:left;">Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <hr class="divider">
  <div class="summary">
    <div class="line"><span>Subtotal</span><span>${fmt(snap.subtotal)}</span></div>
    <div class="line"><span>Tax (11%)</span><span>${fmt(snap.tax)}</span></div>
    <div class="line grand"><span>Grand Total</span><span>${fmt(snap.total)}</span></div>
    <div class="line"><span>Paid</span><span>${fmt(snap.paid)}</span></div>
    <div class="line change"><span>Change</span><span>${fmt(snap.changeAmt)}</span></div>
    ${snap.paid < snap.total ? `<div class="line" style="color:#c00;font-weight:600"><span>Remaining Debt</span><span>${fmt(snap.total - snap.paid)}</span></div>` : ''}
  </div>
  <hr class="divider">
  <div class="footer">Mitra Karya System<br/>Thank you!</div>
</div>
</body></html>`;
  }

  function printReceipt(snap){
    const html = buildPrintableReceiptHtml(snap);
    const w = window.open('', '_blank', 'width=350,height=600');
    if(!w){ toastr.warning('Pop-up blocked. Please allow pop-ups to print.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.onload = function(){ w.focus(); w.print(); };
  }

  function submit(){
    if(state.items.length===0){ toastr.info('Cart empty'); return; }
    const customerId = parseInt($('#posCustomer').val()||0) || null;
    const payType = $('input[name="posPayType"]:checked').val();
    const tender = parseFloat($('#posTender').val()||0);
    const { total } = recalc();
    if(payType === 'Full' && tender < total){ toastr.warning('Cash received must be ≥ total for Full payment.'); return; }
    if(payType === 'DP'){
      if(tender <= 0){ toastr.warning('Down payment amount must be greater than 0.'); return; }
      if(tender >= total){ toastr.warning('Down payment must be less than total. Use Full payment instead.'); return; }
    }
    if((payType === 'DP' || payType === 'Piutang') && (!customerId || customerId === 0)){
      toastr.warning('Please select a customer for ' + (payType === 'DP' ? 'Down Payment' : 'Debt') + ' payment.'); return;
    }
    const items = state.items.map(i=>({ productID:i.id, quantity:i.qty, unitPrice:i.price }));
    const req = { CustomerID: customerId, Date: new Date().toISOString(), Items: items, PaymentType: payType, TenderAmount: tender };
    $('#posBtnPay').prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Saving');
    $.ajax({ url:'/Pos/Save', method:'POST', contentType:'application/json', data: JSON.stringify(req), timeout: 120000 })
      .done(r=>{
        if(r&&r.success){
          // Capture snapshot BEFORE clearing cart
          const snap = captureReceiptData(r);
          const previewHtml = buildReceiptPreviewHtml(snap);
          toastr.success('Saved');
          if(r.change){ toastr.info('Change: ' + fmt(r.change)); }
          // reset cart immediately
          state.items = [];
          $('#posPayFull').prop('checked', true);
          $('#posTender').val('');
          updatePaymentUI();
          render();
          if(window.Swal){
            Swal.fire({ html: previewHtml, width: 500, showConfirmButton: true, confirmButtonText: '<i class="fa fa-print"></i> Print', showCancelButton: true, cancelButtonText: 'Close', customClass: { confirmButton: 'btn btn-primary', cancelButton: 'btn btn-secondary' } })
              .then(res=>{ if(res.isConfirmed){ printReceipt(snap); } });
          } else {
            printReceipt(snap);
          }
        } else {
          const msg = (r && r.result) || 'Failed';
          toastr.error(msg);
        }
      })
      .fail((xhr, status)=>{
        if(status==='timeout'){
          toastr.error('Server timeout. Please check connection or try again.');
        } else {
          toastr.error('Error');
        }
      })
      .always(()=> $('#posBtnPay').prop('disabled', state.items.length===0).html('<i class="fa fa-shopping-cart"></i> Pay & Save'));
  }

  function init(){
    $.get('/Customer/GetList', list=>{ const arr = Array.isArray(list)?list:(list&&list.result)?list.result:[]; const $sel=$('#posCustomer').empty(); $sel.append('<option value="0">Umum</option>'); arr.forEach(c=>$sel.append(`<option value='${c.id||c.ID}'>${c.name||c.Name}</option>`)); });
    wireSearch(); wireTable();
    $('#posTender').on('input change', recalc);
    $('#posBtnPay').on('click', submit);
    $('#posBtnCancel').on('click', ()=> { state.items=[]; $('#posPayFull').prop('checked', true); $('#posTender').val(''); updatePaymentUI(); render(); $('#posSearch').val('').focus(); });
    $('#posBtnHistory').on('click', openHistory);
    // autofocus search on payment type change
    $('input[name="posPayType"]').on('change', ()=> { updatePaymentUI(); setTimeout(()=> $('#posSearch').focus(), 30); });
    // refresh history table after installment payment
    $(document).on('so:payment:updated', ()=> {
      const $table = $('#tablePosHistory');
      if($.fn.DataTable.isDataTable('#tablePosHistory')){
        $table.DataTable().clear().destroy();
        openHistory();
      }
    });
    $('#posBtnQris').on('click', startQris);
    $('#qrisBtnCancel').on('click', function(){ clearInterval(qrisPolling); if(qrisModal) qrisModal.hide(); });
    $('#posSearch').focus();
  }

  // ==================== HISTORY ====================
  const statusMap = { 1:'Draft', 2:'Paid', 3:'Debt' };
  const statusBadgeMap = { 1:'bg-secondary', 2:'bg-success', 3:'bg-warning text-dark' };

  function openHistory(){
    const modal = new bootstrap.Modal(document.getElementById('posHistoryModal'));
    modal.show();
    const $table = $('#tablePosHistory');
    if($.fn.DataTable.isDataTable('#tablePosHistory')){ $table.DataTable().clear().destroy(); }
    $table.find('tbody').html('<tr><td colspan="9" class="text-center"><div class="spinner-border spinner-border-sm"></div></td></tr>');
    $.get('/Pos/GetHistory', function(data){
      const list = Array.isArray(data) ? data : (data && data.result ? data.result : []);
      const dt = $table.DataTable({
        deferRender:true, processing:false, serverSide:false, destroy:true, searching:true,
        order:[[0,'desc']],
        data: list,
        columns:[
          { data:'no' },
          { data:'date', render: d => Common.Format.Datetime(d) },
          { data:'amount', className:'text-end', render: d => fmt(d) },
          { data:'paidAmount', className:'text-end', render: d => fmt(d) },
          { data:'paymentType', render: d => { const cls = d==='Full'?'bg-success':d==='DP'?'bg-info':'bg-warning text-dark'; return `<span class="badge ${cls}">${d}</span>`; } },
          { data:'customerName' },
          { data:'statusID', render: d => { const txt = statusMap[d]||d; const cls = statusBadgeMap[d]||'bg-secondary'; return `<span class="badge ${cls}">${txt}</span>`; } },
          { data:'createdBy' },
          { data:null, orderable:false, className:'text-center', render:()=> `<button class="btn btn-sm btn-outline-primary pos-hist-view" title="View"><i class="fa fa-eye"></i></button>` }
        ]
      });
      $table.off('click','.pos-hist-view').on('click','.pos-hist-view', function(){
        const row = dt.row($(this).closest('tr')).data();
        if(row) viewHistoryDetail(row.id);
      });
    }).fail(()=> toastr.error('Failed load history'));
  }

  function viewHistoryDetail(id){
    $.get('/Pos/GetHistoryDetail', { id: id }, function(res){
      if(!res || res.success===false){ toastr.error(res&&res.result||'Not found'); return; }
      const items = res.items || [];
      const subtotal = items.reduce((s,i)=> s + (i.unitPrice * i.quantity), 0);
      const tax = subtotal * state.taxRate;
      const total = subtotal + tax;
      const itemsHtml = items.map(i=> `<tr><td>${i.productName}</td><td class="text-center">${i.quantity}</td><td class="text-end">${fmt(i.unitPrice)}</td><td class="text-end">${fmt(i.subTotal)}</td></tr>`).join('');
      const statusTxt = statusMap[res.statusID] || res.statusID;
      const statusCls = statusBadgeMap[res.statusID] || 'bg-secondary';
      const payTypeTxt = res.paymentType || 'Full';
      const payTypeCls = payTypeTxt==='Full'?'bg-success':payTypeTxt==='DP'?'bg-info':'bg-warning text-dark';
      const outstanding = total - res.paidAmount;
      const html = `<div class="text-start">
        <div class="row mb-3">
          <div class="col-6"><div class="small text-muted">No</div><div class="fw-semibold">${res.no}</div></div>
          <div class="col-6"><div class="small text-muted">Date</div><div class="fw-semibold">${Common.Format.Datetime(res.date)}</div></div>
        </div>
        <div class="row mb-3">
          <div class="col-4"><div class="small text-muted">Customer</div><div class="fw-semibold">${res.customerName}</div></div>
          <div class="col-4"><div class="small text-muted">Payment</div><div><span class="badge ${payTypeCls}">${payTypeTxt}</span></div></div>
          <div class="col-4"><div class="small text-muted">Status</div><div><span class="badge ${statusCls}">${statusTxt}</span></div></div>
        </div>
        <table class="table table-sm">
          <thead><tr><th>Product</th><th class="text-center">Qty</th><th class="text-end">Price</th><th class="text-end">Total</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="border-top pt-2">
          <div class="d-flex justify-content-between"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
          <div class="d-flex justify-content-between"><span>Tax (11%)</span><span>${fmt(tax)}</span></div>
          <div class="d-flex justify-content-between fw-bold fs-5"><span>Total</span><span>${fmt(total)}</span></div>
          <div class="d-flex justify-content-between mt-1"><span>Paid</span><span>${fmt(res.paidAmount)}</span></div>
          ${outstanding > 0 ? `<div class="d-flex justify-content-between text-danger fw-semibold"><span>Remaining Debt</span><span>${fmt(outstanding)}</span></div>` : ''}
        </div>
      </div>`;
      // Build snap for printing
      const snap = {
        items: items.map(i=>({ name:i.productName, qty:i.quantity, price:i.unitPrice })),
        subtotal, tax, total,
        customer: res.customerName,
        payType: res.paymentType || 'Full',
        no: res.no,
        paid: res.paidAmount,
        changeAmt: 0
      };
      Swal.fire({
        title: 'Transaction Detail',
        html: html,
        width: 560,
        showConfirmButton: true,
        confirmButtonText: '<i class="fa fa-print"></i> Print',
        showDenyButton: outstanding > 0,
        denyButtonText: '<i class="fa fa-hand-holding-dollar"></i> Pay Installment',
        showCancelButton: true,
        cancelButtonText: 'Close',
        customClass: { confirmButton:'btn btn-primary', denyButton:'btn btn-success ms-2', cancelButton:'btn btn-secondary ms-2' }
      }).then(r=>{
        if(r.isConfirmed){ printReceipt(snap); }
        else if(r.isDenied){
          PaymentIn.openFromSO({
            id: id,
            amount: total,
            paidAmount: res.paidAmount,
            customerName: res.customerName,
            customerID: res.customerID
          });
        }
      });
    }).fail(()=> toastr.error('Failed load detail'));
  }

  // ==================== QRIS ====================
  let qrisPolling = null;
  let qrisModal = null;

  function startQris(){
    if(state.items.length===0){ toastr.info('Cart empty'); return; }
    const customerId = parseInt($('#posCustomer').val()||0) || null;
    const items = state.items.map(i=>({ productID:i.id, quantity:i.qty, unitPrice:i.price }));
    const { total } = recalc();
    // Save order first as Piutang (debt) so we get a trade ID
    const req = { CustomerID: customerId, Date: new Date().toISOString(), Items: items, PaymentType: 'Piutang', TenderAmount: 0 };
    $('#posBtnQris').prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span>');
    $.ajax({ url:'/Pos/Save', method:'POST', contentType:'application/json', data: JSON.stringify(req), timeout: 30000 })
      .done(function(r){
        if(r && r.success){
          showQrisModal(r.id, total, r.no);
        } else {
          toastr.error((r && r.result) || 'Failed to save order');
        }
      })
      .fail(function(){ toastr.error('Failed to save order'); })
      .always(function(){ $('#posBtnQris').prop('disabled', state.items.length===0).html('<i class="fa fa-qrcode"></i>'); });
  }

  function showQrisModal(tradeId, amount, tradeNo){
    // Reset modal state
    $('#qrisLoading').show();
    $('#qrisContent, #qrisDone, #qrisError').hide();
    qrisModal = new bootstrap.Modal(document.getElementById('qrisModal'));
    qrisModal.show();

    // Generate QRIS
    $.post('/Qris/Generate', { tradeId: tradeId })
      .done(function(r){
        if(r && r.success){
          $('#qrisLoading').hide();
          $('#qrisImage').attr('src', r.qrCodeUrl);
          $('#qrisAmount').text(fmt(r.amount));
          $('#qrisContent').show();
          // Start polling
          pollQrisStatus(r.orderId, tradeId, tradeNo);
        } else {
          $('#qrisLoading').hide();
          $('#qrisError').text(r && r.result || 'Failed to generate QR code').show();
        }
      })
      .fail(function(){
        $('#qrisLoading').hide();
        $('#qrisError').text('Failed to generate QR code').show();
      });
  }

  function pollQrisStatus(orderId, tradeId, tradeNo){
    clearInterval(qrisPolling);
    let attempts = 0;
    const maxAttempts = 120; // ~5 minutes at 3s interval
    qrisPolling = setInterval(function(){
      attempts++;
      if(attempts > maxAttempts){
        clearInterval(qrisPolling);
        $('#qrisStatus').html('<span class="badge text-bg-danger"><i class="fa fa-times me-1"></i>QR Expired</span>');
        return;
      }
      $.get('/Qris/Status', { orderId: orderId })
        .done(function(r){
          if(r && r.success){
            if(r.status === 'settlement' || r.status === 'capture'){
              clearInterval(qrisPolling);
              $('#qrisContent').hide();
              $('#qrisDone').show();
              toastr.success('Payment received via QRIS!');
              // Clear cart
              state.items = [];
              $('#posPayFull').prop('checked', true);
              $('#posTender').val('');
              updatePaymentUI();
              render();
              // Auto close after 2s
              setTimeout(function(){
                if(qrisModal) qrisModal.hide();
              }, 2000);
            } else if(r.status === 'expire' || r.status === 'cancel' || r.status === 'deny'){
              clearInterval(qrisPolling);
              $('#qrisStatus').html('<span class="badge text-bg-danger"><i class="fa fa-times me-1"></i>' + (r.status === 'expire' ? 'QR Expired' : 'Payment ' + r.status) + '</span>');
            }
          }
        });
    }, 3000);
  }


  $(document).ready(init);
})();
