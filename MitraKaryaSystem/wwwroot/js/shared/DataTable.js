(function (window, $) {
 if (!window || !$) return;

 const defaultOptions = {
 deferRender: true,
 processing: true,
 serverSide: false,
 destroy: true,
 filter: false,
 searching: false,
 responsive: true,
 dom: 'lBfrtip',
 buttons: [],
 columnDefs: []
 };

 async function resolveData(src) {
 try {
 if (Array.isArray(src)) return src;
 if (typeof src === 'function') {
 const res = await src();
 if (Array.isArray(res)) return res;
 if (res && Array.isArray(res.result)) return res.result;
 if (res && Array.isArray(res.data)) return res.data;
 return res || [];
 }
 return [];
 } catch (e) {
 if (window.toastr) toastr.error(e.message || 'Failed load data');
 return [];
 }
 }

 const SharedTable = {
 // opts: { table, columns, data | load, options, actions }
 // actions: {
 // editSelector, onEdit(row, tb, el),
 // deleteSelector, onDelete(row, tb, el),
 // delete: { apiUrl, payload(row), title, text, confirmText, onSuccess(res,row,tb) },
 // custom: [ { selector, onClick(row, tb, el, event) } ],
 // refresh(tb)
 // }
 init: async function (opts) {
 if (!opts || !opts.table) throw new Error('SharedTable: table selector is required');
 const $table = $(opts.table);
 if (!$table.length) return null;

 const data = await resolveData(opts.data || opts.load);
 const dtOptions = $.extend(true, {}, defaultOptions, { data: data, columns: opts.columns || [] }, opts.options || {});

 // Initialize DataTable
 $table.DataTable(dtOptions);
 const tb = $table.DataTable();

 // Bind actions if provided
 if (opts.actions) {
 const act = opts.actions;
 const $body = $table.find('tbody');
 // Namespace unbind to avoid removing other handlers
 $body.off('click.sharedTable');

 if (act.editSelector && typeof act.onEdit === 'function') {
 $body.on('click.sharedTable', act.editSelector, function (e) {
 e.preventDefault();
 const row = tb.row($(this).closest('tr')).data();
 act.onEdit(row, tb, this);
 });
 }

 if (typeof act.onDelete === 'function' && act.deleteSelector) {
 $body.on('click.sharedTable', act.deleteSelector, function (e) {
 e.preventDefault();
 const row = tb.row($(this).closest('tr')).data();
 act.onDelete(row, tb, this);
 });
 } else if (act.delete && act.delete.apiUrl) {
 const delSel = act.deleteSelector || '.delete';
 $body.on('click.sharedTable', delSel, function (e) {
 e.preventDefault();
 const row = tb.row($(this).closest('tr')).data();
 const payloadFn = act.delete.payload || (r => ({ id: r && (r.id || r.ID) }));
 const title = act.delete.title || 'Are you sure?';
 const text = act.delete.text || "You won't be able to revert this!";
 const confirmText = act.delete.confirmText || 'Yes, delete it';

 if (window.Swal && Swal.fire) {
 Swal.fire({
 title: title,
 text: text,
 icon: 'warning',
 showCancelButton: true,
 confirmButtonText: confirmText,
 showLoaderOnConfirm: true,
 preConfirm: () =>
 Common.Api.post(act.delete.apiUrl, payloadFn(row))
 .then(res => res)
 .catch(error => { Swal.showValidationMessage(error.message || 'Request failed'); })
 }).then((result) => {
 if (result.isConfirmed) {
 try { (act.delete.onSuccess ? act.delete.onSuccess(result.value, row, tb) : null); } catch {}
 if (window.toastr) toastr.success('Data has been deleted');
 if (typeof act.refresh === 'function') act.refresh(tb);
 }
 });
 } else {
 // Fallback without Swal
 Common.Api.post(act.delete.apiUrl, payloadFn(row)).then(() => {
 if (window.toastr) toastr.success('Data has been deleted');
 if (typeof act.refresh === 'function') act.refresh(tb);
 }).catch(err => { if (window.toastr) toastr.error(err.message || 'Delete failed'); });
 }
 });
 }

 if (Array.isArray(act.custom)) {
 act.custom.forEach(c => {
 if (!c || !c.selector || typeof c.onClick !== 'function') return;
 $body.on('click.sharedTable', c.selector, function (e) {
 e.preventDefault();
 const row = tb.row($(this).closest('tr')).data();
 c.onClick(row, tb, this, e);
 });
 });
 }
 }

 return tb;
 }
 };

 window.SharedTable = SharedTable;
})(window, jQuery);
