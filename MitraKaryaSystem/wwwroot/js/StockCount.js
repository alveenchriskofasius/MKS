$(document).ready(function(){ StockCountPage.Init(); });

const StockCountPage = {
    Init: function(){
        this.BindButtons();
        this.LoadForm(0);
        this.InitTable();
    },
    BindButtons: function(){
        $('#btnNew').on('click', ()=> this.LoadForm(0));
        $('#btnSave').on('click', ()=> this.Save());
        $('#btnSearch').on('click', ()=> this.Search());
        $('#btnAutoAdjust').on('click', ()=> this.AutoAdjust());
        $('#btnAddProduct').on('click', ()=> this.AddProductFromInput());
        $('#scanProduct').on('keypress', (e)=> { if(e.which===13){ e.preventDefault(); this.AddProductFromInput(); } });
    },
    LoadForm: function(id){
        $('#stockCountHeader').html('<div class="p-2 text-center"><div class="spinner-border spinner-border-sm"></div></div>');
        $.get('/StockCount/FillForm', { id: id || 0 }, html => { $('#stockCountHeader').html(html); this.RefreshTotals(); });
        this.LoadDetails(id);
    },
    InitTable: function(){
        $('#tableStockCountItems').DataTable({
            deferRender:true, processing:false, serverSide:false, destroy:true, searching:false, paging:false, info:false,
            columns:[
                { data:'productID', visible:false },
                { data:'product' },
                { data:'systemQty', className:'text-end', render:(d)=> d },
                { data:'physicalQty', className:'text-end', render:(d,t,r)=> t==='display'?`<input type="number" class="form-control form-control-sm sc-physical" value="${d}" min="0" />`:d },
                { data:'diffQty', className:'text-end'},
                { data:'unitPrice', className:'text-end', render: $.fn.dataTable.render.number(',', '.', 2) },
                { data:'diffValue', className:'text-end', render: $.fn.dataTable.render.number(',', '.', 2) },
                { data:null, orderable:false, render:()=> `<button class='btn btn-sm btn-danger sc-del'><i class='fa fa-trash'></i></button>` }
            ],
            data: []
        });
        const tbl = $('#tableStockCountItems');
        tbl.on('change','input.sc-physical', function(){
            const table = $('#tableStockCountItems').DataTable();
            let $td = $(this).closest('td');
            let idx = table.cell($td).index();
            if(!idx) return; let rowIdx = idx.row; let row = table.row(rowIdx).data();
            let phys = parseInt($(this).val(),10); if(isNaN(phys)||phys<0) phys=0;
            row.physicalQty = phys; row.diffQty = phys - parseInt(row.systemQty || 0); row.diffValue = row.diffQty * parseFloat(row.unitPrice||0);
            table.row(rowIdx).data(row).invalidate();
            StockCountPage.RefreshTotals();
        });
        tbl.on('click','.sc-del', function(){
            const table = $('#tableStockCountItems').DataTable();
            const row = table.row($(this).closest('tr'));
            const data = row.data();
            if(data.id>0){
                Swal.fire({ title:'Delete item?', icon:'warning', showCancelButton:true }).then(r=>{ if(r.isConfirmed){ $.get('/StockCount/DeleteItem',{id:data.id},res=>{ if(res.success){ row.remove().draw(); StockCountPage.RefreshTotals(); } else toastr.error(res.result||'Delete failed'); }); } });
            } else { row.remove().draw(); StockCountPage.RefreshTotals(); }
        });
    },
    LoadDetails: function(id){
        const table = $('#tableStockCountItems').DataTable();
        if(!id){ table.clear().draw(); this.RefreshTotals(); return; }
        $.get('/StockCount/GetDetailList',{id:id}, res=>{ table.clear(); table.rows.add(res); table.draw(); this.RefreshTotals(); });
    },
    AddProductFromInput: function(){
        const name = $('#scanProduct').val(); if(!name) { toastr.info('Input product name'); return; }
        // simple fetch product by name (client filter). In real scenario use autocomplete.
        $.get('/Product/GetProductComboList',{ name: name }, data => {
            if(!data || !data.result || data.result.length===0){ toastr.warning('Product not found'); return; }
            const prod = data.result[0];
            const table = $('#tableStockCountItems').DataTable();
            // if exists -> focus row
            let exists = false;
            table.rows().every(function(){ let r=this.data(); if(r.productID==prod.id){ exists=true; $(this.node()).addClass('table-warning'); setTimeout(()=> $(this.node()).removeClass('table-warning'),800); }
            });
            if(!exists){
                table.row.add({ id:0, productID:prod.id, product: prod.name, systemQty: prod.stockQuantity, physicalQty: prod.stockQuantity, diffQty:0, unitPrice: prod.unitPrice, diffValue:0 }).draw();
                this.RefreshTotals();
            }
            $('#scanProduct').val('').focus();
        });
    },
    CollectData: function(){
        const table = $('#tableStockCountItems').DataTable();
        let items=[]; table.rows().every(function(){ let r=this.data(); items.push({ ID:r.id||0, ProductID:r.productID, SystemQty:r.systemQty, PhysicalQty:r.physicalQty, DiffQty:r.diffQty, UnitPrice:r.unitPrice }); });
        return items;
    },
    Save: function(){
        let model = { ID: $('#stockCountID').val(), Date: $('#stockCountDate').val(), No: $('#stockCountNo').val(), Note: $('#stockCountNote').val(), AutoAdjust: $('#stockCountAutoAdjust').is(':checked'), Items: this.CollectData() };
        $('#btnSave').prop('disabled',true); $('#btnSave .spinner-border').removeClass('d-none');
        $.ajax({url:'/StockCount/Save', type:'POST', data: model}).done(res=>{
            if(res.success){ toastr.success('Saved'); $('#stockCountID').val(res.id); $('#stockCountNo').val(res.no); }
            else toastr.error(res.result||'Save failed');
        }).fail(err=> toastr.error(err.responseText||'Error')).always(()=> { $('#btnSave').prop('disabled',false); $('#btnSave .spinner-border').addClass('d-none'); });
    },
    RefreshTotals: function(){
        const table = $('#tableStockCountItems').DataTable();
        let total = 0; table.rows().every(function(){ let r=this.data(); total += (parseFloat(r.diffValue)||0); });
        $('#totalDiffValue').text(total.toFixed(2));
    },
    Search: function(){
        const modal = new bootstrap.Modal(document.getElementById('searchModal'));
        modal.show();
        let tb = $('#tableStockCountSearch').DataTable({ deferRender:true, processing:false, serverSide:false, destroy:true, searching:false, columns:[
            { data:'no' },{ data:'date' },{ data:'note' },{ data:'items', className:'text-end' },{ data:'diffValue', className:'text-end', render: $.fn.dataTable.render.number(',', '.', 2)},
            { data:null, orderable:false, render:()=> `<button class='btn btn-sm btn-primary sc-edit'><i class='fa fa-edit'></i></button> <button class='btn btn-sm btn-danger sc-delete'><i class='fa fa-trash'></i></button>` }
        ]});
        $.get('/StockCount/GetSearchList', data=>{ tb.clear(); tb.rows.add(data); tb.draw(); });
        $('#tableStockCountSearch').off('click').on('click','.sc-edit', function(){ let row = tb.row($(this).closest('tr')).data(); StockCountPage.LoadForm(row.id); modal.hide(); });
        $('#tableStockCountSearch').on('click','.sc-delete', function(){ let row = tb.row($(this).closest('tr')).data(); Swal.fire({title:'Delete?', icon:'warning', showCancelButton:true}).then(r=>{ if(r.isConfirmed){ $.get('/StockCount/Delete',{id:row.id}, res=>{ if(res.success){ toastr.success('Deleted'); StockCountPage.LoadForm(0); StockCountPage.Search(); } else toastr.error(res.result||'Delete failed'); }); }}); });
    },
    AutoAdjust: function(){
        let id = $('#stockCountID').val(); if(!id || id==0){ toastr.info('Save first'); return; }
        $.get('/StockCount/AutoAdjust', { id:id }, res=>{ if(res.success){ toastr.success('Auto adjust prepared'); } else toastr.error(res.result||'Adjust failed'); });
    }
};
