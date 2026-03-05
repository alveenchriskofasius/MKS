(function(){
  const state = { items: [], taxRate: 0.10, suggestIndex: -1 };
  const fmt = n => 'Rp ' + (Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:0, maximumFractionDigits:0});

  function recalc(){
    let subtotal = state.items.reduce((s,i)=> s + i.price*i.qty, 0);
    const tax = subtotal * state.taxRate;
    const total = subtotal + tax;
    $('#posSubtotal').text(fmt(subtotal));
    $('#posTax').text(fmt(tax));
    $('#posTotal').text(fmt(total));
    const tender = parseFloat($('#posTender').val()||0);
    const change = Math.max(0, tender - total);
    $('#posChange').text(fmt(change));
    $('#posBtnPay').prop('disabled', state.items.length===0);
    return { subtotal, tax, total, change };
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
    const id = p.id; const name = p.text||p.name; const price = Number(p.unitPrice||p.price||0);
    let f = state.items.find(i=>i.id===id);
    if(f) f.qty += 1; else state.items.push({ id, name, price, qty:1 });
    render();
    // autofocus back to search after update
    setTimeout(()=> $('#posSearch').val('').focus(), 30);
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
      const $row = $(`<div class='pos-suggest-item d-flex justify-content-between align-items-center${isOut ? ' disabled' : ''}' data-idx='${i}' tabindex='0'><div class='text-truncate'>${leftHtml}</div><div class='ms-2 fw-semibold'>${fmt(price)}</div></div>`);
      $row.on('click keydown', e=>{
        if(e.type==='click' || e.key==='Enter'){
          if(isOut){ toastr.warning('Stok 0 / habis. Tidak bisa ditambahkan ke cart.'); return; }
          addOrInc({ id:p.id||p.ID, text:rawName, unitPrice:price, stockQuantity: stock });
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
    $input.on('input', function(){ clearTimeout(typingTimer); destroySuggest(); const q=this.value.trim(); if(!q) return; typingTimer=setTimeout(()=>{ searchProductsAsync(q).then(list=>{ if(list.length>0){ $input.after(buildSuggest(list,q)); state.suggestIndex=-1; } }); }, 200); });
    $input.on('keydown', function(e){ const $items = $('.pos-suggest-item'); if(e.key==='ArrowDown'){ if($items.length){ e.preventDefault(); state.suggestIndex = (state.suggestIndex+1) % $items.length; setActiveSuggestion(); } } else if(e.key==='ArrowUp'){ if($items.length){ e.preventDefault(); state.suggestIndex = (state.suggestIndex<=0? $items.length-1 : state.suggestIndex-1); setActiveSuggestion(); } } else if(e.key==='Enter'){ e.preventDefault(); const q=this.value.trim(); if($items.length && state.suggestIndex>=0){ $items.eq(state.suggestIndex).trigger('click'); return; } if(!q) return; searchProductsAsync(q).then(list=>{ if(list.length>0){ const p=list[0]; addOrInc({ id:p.id||p.ID, text:p.name||p.Name, unitPrice:p.unitPrice||p.UnitPrice||0, stockQuantity: (p.stockQuantity ?? p.StockQuantity) }); } }); } else if(e.key==='Escape'){ destroySuggest(); }
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
      <div class='small mb-2'>No: ${snap.no} | Date: ${(new Date()).toLocaleString()}</div>
      <table class='table table-sm'>
        <thead><tr><th>Product</th><th class='text-center'>Qty</th><th class='text-end'>Price</th><th class='text-end'>Total</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class='border-top pt-2'>
        <div class='d-flex justify-content-between'><span>Subtotal</span><span>${fmt(snap.subtotal)}</span></div>
        <div class='d-flex justify-content-between'><span>Tax (10%)</span><span>${fmt(snap.tax)}</span></div>
        <div class='d-flex justify-content-between fw-bold'><span>Grand Total</span><span>${fmt(snap.total)}</span></div>
        <div class='d-flex justify-content-between'><span>Paid</span><span>${fmt(snap.paid)}</span></div>
        <div class='d-flex justify-content-between'><span>Change</span><span>${fmt(snap.changeAmt)}</span></div>
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
  <div class="info"><strong>Date:</strong> ${(new Date()).toLocaleString('id-ID')}</div>
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
    <div class="line"><span>Tax (10%)</span><span>${fmt(snap.tax)}</span></div>
    <div class="line grand"><span>Grand Total</span><span>${fmt(snap.total)}</span></div>
    <div class="line"><span>Paid</span><span>${fmt(snap.paid)}</span></div>
    <div class="line change"><span>Change</span><span>${fmt(snap.changeAmt)}</span></div>
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
    $('#posBtnCancel').on('click', ()=> { state.items=[]; render(); $('#posSearch').val('').focus(); });
    // autofocus search on payment type change
    $('input[name="posPayType"]').on('change', ()=> setTimeout(()=> $('#posSearch').focus(), 30));
    $('#posSearch').focus();
  }

  const style = `.pos-suggest{position:absolute; z-index:1050; background:#fff; border:1px solid #dee2e6; border-radius:12px; width:100%; max-height:300px; overflow:auto;} .pos-suggest-item{padding:8px 12px; cursor:pointer;} .pos-suggest-item.active{background:#e9f2ff;} .pos-suggest-item:hover{background:#f1f5fb;} .pos-suggest-item.disabled{opacity:.55; cursor:not-allowed;} .match{background:#ffe08a}`; if(!document.getElementById('posSuggestStyle')){ const st=document.createElement('style'); st.id='posSuggestStyle'; st.innerHTML=style; document.head.appendChild(st); }

  $(document).ready(init);
})();
