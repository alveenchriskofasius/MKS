$(document).ready(function () {
    RolePage.init();
});

const RolePage = {
    currentId: null,

    init() {
        this.loadRoles();
        this.initButtons();
    },

    initButtons() {
        $('#buttonAddRole').click(() => this.loadForm(0));
        $('#roleSearch').on('input', function () {
            const q = $(this).val().toLowerCase();
            $('.role-list-item').each(function () {
                $(this).toggle($(this).text().toLowerCase().includes(q));
            });
        });
    },

    async loadRoles() {
        try {
            const res = await Common.Api.get('FillGridRole');
            const roles = Array.isArray(res) ? res : (res && res.result ? res.result : []);
            const $list = $('#roleList').empty();

            if (!roles.length) {
                $list.html('<li class="text-center text-muted py-4"><small>No roles found</small></li>');
                return;
            }

            roles.forEach(r => {
                const id = r.id || r.ID;
                const isActive = id === RolePage.currentId;
                $list.append(
                    '<li class="role-list-item' + (isActive ? ' active' : '') + '" data-id="' + id + '">' +
                        '<div>' +
                            '<div class="role-name">' + (r.name || r.Name || '') + '</div>' +
                            '<div class="role-desc">' + (r.description || r.Description || '') + '</div>' +
                        '</div>' +
                        '<i class="fa fa-chevron-right" style="font-size:.7rem;color:var(--mks-gray-600)"></i>' +
                    '</li>'
                );
            });

            $list.off('click', '.role-list-item').on('click', '.role-list-item', function () {
                RolePage.loadForm($(this).data('id'));
            });
        } catch (e) {
            toastr.error(e.message || 'Failed to load roles');
        }
    },

    async loadForm(id) {
        this.currentId = id;
        $('.role-list-item').removeClass('active');
        $('.role-list-item[data-id="' + id + '"]').addClass('active');

        try {
            const html = await Common.Api.post('FillFormRole', { id: id });
            $('#roleFormPanel').html(html);
            this.bindFormEvents();
        } catch (e) {
            toastr.error(e.message || 'Error loading form');
        }
    },

    bindFormEvents() {
        $('#buttonSave').off('click').on('click', function () { RolePage.save(); });

        $('#btnDeleteRole').off('click').on('click', function () {
            RolePage.deleteRole($(this).data('id'));
        });

        $('#btnCancelEdit').off('click').on('click', function () {
            RolePage.currentId = null;
            $('.role-list-item').removeClass('active');
            $('#roleFormPanel').html(
                '<div class="empty-state">' +
                    '<i class="fa fa-shield-halved"></i>' +
                    '<p>Select a role to edit or create a new one</p>' +
                '</div>'
            );
        });

        $('#btnSelectAll').off('click').on('click', function () {
            $('.permission-toggle').prop('checked', true);
        });
        $('#btnDeselectAll').off('click').on('click', function () {
            $('.permission-toggle').prop('checked', false);
        });

        $(document).off('click', '.toggle-all').on('click', '.toggle-all', function () {
            var group = $(this).data('group');
            var toggles = $('.permission-toggle[data-group="' + group + '"]');
            var allChecked = toggles.filter(':checked').length === toggles.length;
            toggles.prop('checked', !allChecked);
        });
    },

    async save() {
        var formData = $('#roleForm').serializeArray();
        var permissions = [];
        $('input[name="permission"]').each(function () {
            permissions.push({ ID: $(this).val(), IsSelected: $(this).prop('checked') });
        });

        var name = (formData.find(function (i) { return i.name === 'Role.Name'; }) || {}).value;
        if (!name || !name.trim()) {
            toastr.warning('Role name is required');
            return;
        }

        var requestData = {
            Role: {
                ID: (formData.find(function (i) { return i.name === 'Role.ID'; }) || {}).value || 0,
                Name: name,
                Description: (formData.find(function (i) { return i.name === 'Role.Description'; }) || {}).value || ''
            },
            Permissions: permissions
        };

        var $btn = $('#buttonSave');
        $btn.prop('disabled', true).find('.spinner-border').removeClass('d-none');

        try {
            var result = await Common.Api.postJson('SaveRole', requestData);
            if (result && result.success) {
                toastr.success('Role saved successfully');
                await this.loadRoles();
            } else {
                toastr.error('Failed to save role');
            }
        } catch (e) {
            toastr.error(e.message || 'Failed to save role');
        } finally {
            $btn.prop('disabled', false).find('.spinner-border').addClass('d-none');
        }
    },

    async deleteRole(id) {
        var result = await Swal.fire({
            title: 'Delete Role?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Yes, delete',
            cancelButtonText: 'Cancel'
        });

        if (!result.isConfirmed) return;

        try {
            await Common.Api.post('DeleteRole', { id: id });
            toastr.success('Role deleted');
            this.currentId = null;
            $('#roleFormPanel').html(
                '<div class="empty-state">' +
                    '<i class="fa fa-shield-halved"></i>' +
                    '<p>Select a role to edit or create a new one</p>' +
                '</div>'
            );
            await this.loadRoles();
        } catch (e) {
            toastr.error(e.message || 'Failed to delete role');
        }
    }
};
