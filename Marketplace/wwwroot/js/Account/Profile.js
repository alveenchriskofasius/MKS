$(document).ready(function () { ProfilePage.init(); });

const ProfilePage = {
    init() {
        this.loadProfile();
        this.bindEvents();
    },

    bindEvents() {
        $('#btnSaveProfile').on('click', function () {
            ProfilePage.saveProfile();
        });
    },

    async loadProfile() {
        try {
            var res = await Common.Api.get('/Account/GetProfile');
            $('#profileLoading').hide();

            if (!res.success) {
                $('#profileLoading')
                    .html('<p class="text-danger">Gagal memuat profil.</p>')
                    .show();
                return;
            }

            $('#profileEmail').val(res.email);
            $('#profileName').val(res.name);
            $('#profilePhone').val(res.phone);
            $('#profileAddress').val(res.address);
            $('#profileForm').show();
        } catch (e) {
            console.error('Failed loading profile', e);
            $('#profileLoading')
                .html('<p class="text-danger">Gagal memuat profil.</p>')
                .show();
        }
    },

    async saveProfile() {
        var name = $('#profileName').val().trim();
        var phone = $('#profilePhone').val().trim();
        var address = $('#profileAddress').val().trim();

        if (!name) {
            $('#profileError').text('Nama tidak boleh kosong.').show();
            return;
        }

        $('#profileError').hide();
        $('#profileSuccess').hide();
        $('#profileSpinner').show();
        $('#btnSaveProfile').prop('disabled', true);

        try {
            var res = await Common.Api.post('/Account/UpdateProfile', {
                name: name,
                phone: phone,
                address: address
            });

            if (res.success) {
                $('#profileSuccess').text(res.message || 'Profil berhasil diperbarui.').show();
                // Update navbar name
                $('#navUserName').text(name);
            } else {
                $('#profileError').text(res.message || 'Gagal memperbarui profil.').show();
            }
        } catch (e) {
            console.error('Failed updating profile', e);
            $('#profileError').text('Terjadi kesalahan.').show();
        } finally {
            $('#profileSpinner').hide();
            $('#btnSaveProfile').prop('disabled', false);
        }
    }
};
