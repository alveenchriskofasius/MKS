$(document).ready(function () { UserPage.init(); });

const UserPage = {
    currentId: null,

    init() {
        this.loadUsers();
        this.initButtons();
    },

    initButtons() {
        $('#buttonAddUser').click(function () { UserPage.loadForm(0); });
        $('#userSearch').on('input', function () {
            var q = $(this).val().toLowerCase();
            $('.user-list-item').each(function () {
                $(this).toggle($(this).text().toLowerCase().indexOf(q) > -1);
            });
        });
    },

    async loadUsers() {
        try {
            var res = await Common.Api.get('/User/GetUserList');
            var users = Array.isArray(res) ? res : (res && res.result ? res.result : []);
            var $list = $('#userList').empty();

            if (!users.length) {
                $list.html('<li class="text-center text-muted py-4"><small>No users found</small></li>');
                return;
            }

            users.forEach(function (u) {
                var id = u.id || u.ID;
                var name = u.name || u.Name || '';
                var userName = u.userName || u.UserName || '';
                var email = u.email || u.Email || '';
                var isActive = u.isActive !== undefined ? u.isActive : (u.IsActive !== undefined ? u.IsActive : (u.active === 'Active'));
                var initials = name.split(' ').map(function (w) { return w[0] || ''; }).join('').substring(0, 2);
                var isSelected = id === UserPage.currentId;
                var statusBadge = isActive
                    ? '<span class="badge bg-success" style="font-size:.65rem">Active</span>'
                    : '<span class="badge bg-secondary" style="font-size:.65rem">Inactive</span>';

                $list.append(
                    '<li class="user-list-item' + (isSelected ? ' active' : '') + '" data-id="' + id + '">' +
                        '<div class="user-avatar">' + initials + '</div>' +
                        '<div class="user-info" style="min-width:0; flex:1">' +
                            '<div class="user-name text-truncate">' + name + '</div>' +
                            '<div class="user-email text-truncate">' + (email || userName) + '</div>' +
                        '</div>' +
                        '<span class="user-status">' + statusBadge + '</span>' +
                    '</li>'
                );
            });

            $list.off('click', '.user-list-item').on('click', '.user-list-item', function () {
                UserPage.loadForm($(this).data('id'));
            });
        } catch (e) {
            toastr.error(e.message || 'Failed to load users');
        }
    },

    async loadForm(id) {
        this.currentId = id;
        $('.user-list-item').removeClass('active');
        $('.user-list-item[data-id="' + id + '"]').addClass('active');

        try {
            var html = await Common.Api.post('/User/FillForm', { id: id });
            if (typeof html !== 'string') html = (html && html.html) || '<div class="text-danger">Unexpected response</div>';
            $('#userFormPanel').html(html);
            this.bindFormEvents();
            if (id > 0) this.loadRoles(id);
        } catch (e) {
            toastr.error(e.message || 'Error loading form');
        }
    },

    bindFormEvents() {
        $('#buttonSave').off('click').on('click', function () {
            var form = $('#userForm')[0];
            if (form && !form.checkValidity()) {
                form.classList.add('was-validated');
                return;
            }
            UserPage.save();
        });

        $('#btnDeleteUser').off('click').on('click', function () {
            UserPage.deleteUser($(this).data('id'));
        });

        $('#btnCancelEdit').off('click').on('click', function () {
            UserPage.currentId = null;
            $('.user-list-item').removeClass('active');
            $('#userFormPanel').html(
                '<div class="empty-state">' +
                    '<i class="fa fa-users"></i>' +
                    '<p>Select a user to edit or create a new one</p>' +
                '</div>'
            );
        });
    },

    async save() {
        var formData = $('#userForm').serializeArray().reduce(function (acc, cur) { acc[cur.name] = cur.value; return acc; }, {});
        if (!$('#isActive').is(':checked')) formData['IsActive'] = 'false';

        var $btn = $('#buttonSave');
        $btn.prop('disabled', true).find('.spinner-border').removeClass('d-none');

        try {
            var result = await Common.Api.post('/User/SaveUser', formData);
            var ok = result && (result.success || (result.result && result.result.success));
            if (ok) {
                toastr.success('User saved successfully');

                // Save roles if editing existing user
                var userId = formData.ID || 0;
                if (parseInt(userId) > 0) {
                    await this.saveRoles(userId);
                }

                await this.loadUsers();
            } else {
                toastr.error((result && (result.result || result.message)) || 'Failed to save user');
            }
        } catch (e) {
            toastr.error(e.message || 'Failed to save user');
        } finally {
            $btn.prop('disabled', false).find('.spinner-border').addClass('d-none');
        }
    },

    loadRoles(userId) {
        $.get('/User/GetUserRoles', { userId: userId }, function (roles) {
            var list = Array.isArray(roles) ? roles : [];
            if (!list.length) {
                $('#userRolesContainer').html('<span class="text-muted small">No roles available</span>');
                return;
            }
            var html = list.map(function (r) {
                var selected = r.isAssigned ? ' selected' : '';
                var checked = r.isAssigned ? ' checked' : '';
                return '<label class="role-chip' + selected + '">' +
                    '<input type="checkbox" class="user-role-cb" value="' + r.id + '"' + checked + ' />' +
                    '<i class="fa fa-shield-halved" style="font-size:.7rem"></i> ' + (r.name || '') +
                '</label>';
            }).join('');
            $('#userRolesContainer').html(html);

            // Toggle chip style on click
            $(document).off('click', '.role-chip').on('click', '.role-chip', function () {
                var $cb = $(this).find('input');
                // checkbox toggles automatically via label, just update visual
                setTimeout(function () {
                    $(this).toggleClass('selected', $cb.is(':checked'));
                }.bind(this), 0);
            });
        }).fail(function () {
            $('#userRolesContainer').html('<span class="text-danger small">Failed to load roles</span>');
        });
    },

    async saveRoles(userId) {
        var roleIds = [];
        $('.user-role-cb:checked').each(function () { roleIds.push(parseInt($(this).val())); });
        try {
            await $.ajax({
                url: '/User/SaveUserRoles?userId=' + userId,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(roleIds)
            });
        } catch (e) {
            // silent – user save already showed success
        }
    },

    async deleteUser(id) {
        var result = await Swal.fire({
            title: 'Delete User?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Yes, delete',
            cancelButtonText: 'Cancel'
        });

        if (!result.isConfirmed) return;

        try {
            var res = await Common.Api.post('/User/DeleteUser', { id: id });
            if (res && (res.success === true || res === true)) {
                toastr.success('User deleted');
            } else {
                toastr.error((res && (res.result || res.message)) || 'Failed to delete user');
                return;
            }
            this.currentId = null;
            $('#userFormPanel').html(
                '<div class="empty-state">' +
                    '<i class="fa fa-users"></i>' +
                    '<p>Select a user to edit or create a new one</p>' +
                '</div>'
            );
            await this.loadUsers();
        } catch (e) {
            toastr.error(e.message || 'Failed to delete user');
        }
    }
};