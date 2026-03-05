$(document).ready(function () { userPage.init(); });

const userPage = (function () {
 async function init() { await initTable(); initButtons(); }
 async function initTable() {
 await SharedTable.init({
 table: '#tableUser',
 columns: [
 { data: 'userName' },
 { data: 'name' },
 { data: 'email' },
 { data: 'ktp' },
 { data: 'active' },
 {
 data: null,
 render: function () {
 return `
 <div class="btn-group" role="group">
 <a class="btn btn-warning edit" href="#">
 <i class="fa fa-pencil"></i> Edit
 </a>
 <a class="btn btn-danger delete">
 <i class="fa fa-trash"></i> Delete
 </a>
 </div>`;
 },
 orderable: false
 }
 ],
 load: async () => {
 try {
 const res = await Common.Api.get('/User/GetUserList');
 return Array.isArray(res) ? res : (res && res.result) ? res.result : [];
 } catch (e) {
 toastr.error(e.message || 'Failed load users');
 return [];
 }
 },
 options: { dom: 'lBfrtip', columnDefs: [{ targets: [0,1,2,3,4], className: 'text-left' }] },
 actions: {
 editSelector: '.edit',
 onEdit: function (row) { if (!row) return; userForms.fillForm(row.id); $('#userModal').modal('show'); },
 delete: {
 apiUrl: '/User/DeleteUser',
 payload: (r) => ({ id: r && (r.id || r.ID) }),
 onSuccess: function (res) {
 if (res && (res.success === true || res === true)) {
 toastr.success('Data has been deleted');
 } else {
 toastr.error((res && (res.result || res.message)) || 'Data not deleted');
 }
 }
 },
 refresh: () => initTable()
 }
 });
 }
 function initButtons() { 
 $('#buttonAddUser').off().on('click', function () { userForms.fillForm(0); });
 $('#buttonSave').off().on('click', function (event) {
 const form = $('#userForm')[0];
 if (form.checkValidity()) {
 event.preventDefault(); event.stopPropagation(); userForms.save(); form.classList.remove('was-validated');
 } else {
 event.preventDefault(); event.stopPropagation(); form.classList.add('was-validated');
 }
 }); 
 }
 return { init: init };
})();

const userForms = {
 save: function () {
 const formData = $('#userForm').serializeArray().reduce((acc, cur) => { acc[cur.name] = cur.value; return acc; }, {});
 $('#buttonSave').prop('disabled', true); $('#buttonSave .spinner-border').show();
 Common.Api.post('/User/SaveUser', formData)
 .then(function (result) {
 toastr.options.onShown = function () { userPage.init(); $('#userModal').modal('hide'); };
 (result && (result.success || (result.result && result.result.success))) ? toastr.success('Data saved') : toastr.error((result && (result.result || result.message)) || 'Data not saved');
 })
 .catch(function (error) {
 toastr.error(error.message || 'Data not saved');
 })
 .finally(function () {
 $('#buttonSave').prop('disabled', false); $('#buttonSave .spinner-border').hide();
 });
 },
   fillForm: function (id) {
   Common.Api.post('/User/FillForm', { id: id })
   .then(function (result) {
   // server returns HTML partial
   if (typeof result === 'string') {
   $('#bodyModal').html(result);
   $('#userModal').modal('show');
   if (id > 0) userForms.loadRoles(id);
   } else if (result && result.html) {
   $('#bodyModal').html(result.html);
   $('#userModal').modal('show');
   if (id > 0) userForms.loadRoles(id);
   } else {
   $('#bodyModal').html('<div class="text-danger">Unexpected response</div>');
   }
   })
   .catch(function (error) {
   toastr.error(error.message || 'Error load data');
   });
   },
   loadRoles: function (userId) {
   $.get('/User/GetUserRoles', { userId: userId }, function (roles) {
   var list = Array.isArray(roles) ? roles : [];
   if (!list.length) { $('#userRolesContainer').html('<span class="text-muted">No roles available</span>'); return; }
   var html = list.map(function (r) {
   var checked = r.isAssigned ? 'checked' : '';
   return '<div class="form-check"><input class="form-check-input user-role-cb" type="checkbox" value="' + r.id + '" ' + checked + ' id="role_' + r.id + '"><label class="form-check-label" for="role_' + r.id + '">' + (r.name || '') + '</label></div>';
   }).join('');
   html += '<button type="button" class="btn btn-sm btn-outline-primary mt-2" id="btnSaveRoles">Save Roles</button>';
   $('#userRolesContainer').html(html);
   $('#btnSaveRoles').on('click', function () { userForms.saveRoles(userId); });
   }).fail(function () { $('#userRolesContainer').html('<span class="text-danger">Failed to load roles</span>'); });
   },
   saveRoles: function (userId) {
   var roleIds = [];
   $('.user-role-cb:checked').each(function () { roleIds.push(parseInt($(this).val())); });
   $.ajax({ url: '/User/SaveUserRoles?userId=' + userId, type: 'POST', contentType: 'application/json', data: JSON.stringify(roleIds) })
   .done(function (res) {
   if (res && res.success) toastr.success('Roles saved');
   else toastr.error((res && res.error) || 'Failed to save roles');
   })
   .fail(function () { toastr.error('Failed to save roles'); });
   }
 };