$(document).ready(function(){ Dashboard.Init(); });
var Dashboard = {
    Init: function(){ this.LoadSalesToday(); this.LoadStockAlerts(); this.LoadPendingDO(); },
    LoadSalesToday: function(){
        $.get('/Home/SalesToday', function(res){
            if(!res || !res.success){ $('#salesTodayContainer').text('Error load'); return; }
            // Prefer server-calculated total; fall back to previous client calculation if missing
            if (res.total !== undefined && res.total !== null) {
                $('#salesTodayContainer').html(`<h3>${Number(res.total).toFixed(2)}</h3><small>Total sales today</small>`);
                return;
            }
            var data = res.result;
            var rows = [];
            if(Array.isArray(data)) rows = data;
            else if(data && Array.isArray(data.result)) rows = data.result;
            var today = new Date().toISOString().slice(0,10);
            var sum = 0;
            rows.forEach(function(r){
                var dateStr = (r.date || r.Date || '').toString().slice(0,10);
                if(dateStr === today){ sum += parseFloat(r.amount || r.Amount || 0); }
            });
            $('#salesTodayContainer').html(`<h3>${sum.toFixed(2)}</h3><small>Total sales today</small>`);
        }).fail(function(){ $('#salesTodayContainer').text('Error load'); });
    },
    LoadStockAlerts: function(){
        $.get('/Home/StockAlerts', function(res){
            if(!res || !res.success){ $('#stockAlertsContainer').text('Error load'); return; }
            var data = res.result;
            // server returns only low-stock items
            var rows = [];
            if(Array.isArray(data)) rows = data;
            else if(data && Array.isArray(data.result)) rows = data.result;
            if(rows.length==0) { $('#stockAlertsContainer').text('No alerts'); return; }
            var html = '<ul class="list-unstyled mb-0">';
            rows.forEach(function(p){ html += `<li>${(p.name||p.Name)} - ${(p.stockQuantity||p.StockQuantity||0)}</li>`; });
            html += '</ul>';
            $('#stockAlertsContainer').html(html);
        }).fail(function(){ $('#stockAlertsContainer').text('Error load'); });
    },
    LoadPendingDO: function(){
        $.get('/Home/PendingDeliveryOrders', function(res){
            if(!res || !res.success){ $('#pendingDOContainer').text('Error'); return; }
            var rows = res.result || [];
            var html = '<ul class="list-unstyled mb-0">';
            rows.forEach(function(d){ html += `<li>${d.no||d.No} - SO:${d.salesOrderID||d.SalesOrderID}</li>`; });
            html += '</ul>';
            $('#pendingDOContainer').html(html);
        }).fail(function(){ $('#pendingDOContainer').text('Error'); });
    }
}
