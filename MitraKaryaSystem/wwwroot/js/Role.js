$(document).ready(function () {
 Table.FillGridRole();
 Buttons.Init();
});

let Table = {
 FillGridPermission: function () {
 let tableID = '#tablePermission';
 $(tableID).DataTable({
 "deferRender": true,
 "processing": true,
 "serverSide": false,
 "destroy": true,
 "filter": true,
 "searching": false,
 "responsive": true,
 });
 },
 FillGridRole: async function () {
 await SharedTable.init({
 table: '#tableRole',
 columns: [
 { data: 'name' },
 { data: 'description' },
 {
 data: null,
 render: function () {
 return `
 <div class="btn-group" role="group" aria-label="Action Buttons">
 <a class="btn btn-warning edit" href="#" role="button">
 <i class="fa fa-pencil"></i> Edit
 </a>
 <a class="btn btn-danger delete" role="button">
 <i class="fa fa-trash"></i> Delete
 </a>
 </div>`;
 },
 orderable: false
 }
 ],
 load: async () => {
 try { 
 const res = await Common.Api.get('FillGridRole');
 return Array.isArray(res) ? res : (res && res.result) ? res.result : [];
 } catch (e) { toastr.error(e.message || 'Failed load roles'); return []; }
 },
 options: { scrollX: true },
 actions: {
 editSelector: '.edit',
 onEdit: function (row) {
 if (!row) return;
 Form.FillForm(row.id);
 $('#roleModal').modal('show');
 },
 delete: {
 apiUrl: 'DeleteRole',
 payload: (r) => ({ id: r && (r.id || r.ID) }),
 onSuccess: function () { toastr.options.onShown = function () { Table.FillGridRole(); }; }
 },
 refresh: () => Table.FillGridRole()
 }
 });
 }

}

let Buttons = {
 Init: function () {
 $('#buttonSave').click(function () { Form.Save(); });
 $('#buttonAddRole').click(function () { Form.FillForm(0); });
 }
};

var Form = {
 Save: function () {
 // Serialize the form data for Role
 var formData = $('#roleForm').serializeArray();

 // Collect permission data
 var permissions = [];
 $('input[name^="permission"]').each(function () {
 permissions.push({
 ID: $(this).val(),
 IsSelected: $(this).prop('checked')
 });
 });

 var requestData = {
 Role: {
 ID: formData.find(item => item.name === 'Role.ID').value,
 Name: formData.find(item => item.name === 'Role.Name').value,
 Description: formData.find(item => item.name === 'Role.Description').value
 },
 Permissions: permissions
 };
 // Show loading indicator
 $('#buttonSave').prop('disabled', true); // Disable the button
 $('#buttonSave .spinner-border').show(); // Show the spinner
 Common.Api.postJson('SaveRole', requestData)
 .then(function (result) {
 toastr.options.onShown = function () {
 Table.FillGridRole();
 $('#roleModal').modal('hide');
 }
 result && result.success ? toastr.success('Data saved') : toastr.error('Data not saved');
 })
 .catch(function (error) {
 toastr.error(error.message || 'Data not saved');
 })
 .finally(function () {
 // Close loading indicator
 $('#buttonSave').prop('disabled', false); // Enable the button
 $('#buttonSave .spinner-border').hide(); // Hide the spinner
 });
 },

 FillForm: function (id) {
 Common.Api.post('FillFormRole', { id: id })
 .then(function (result) {
 $('#bodyModal').html(result);
 $('#roleModal').modal('show');
 Table.FillGridPermission();
 })
 .catch(function (error) {
 toastr.error(error.message || 'Error load data');
 });
 }
};
