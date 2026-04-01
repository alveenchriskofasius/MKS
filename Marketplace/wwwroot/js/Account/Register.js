$(document).ready(function () { RegisterPage.init(); });

const RegisterPage = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        $('#btnRegister').on('click', function () { RegisterPage.doRegister(); });
    },

    async doRegister() {
        var name = $('#regName').val().trim();
        var email = $('#regEmail').val().trim();
        var phone = $('#regPhone').val().trim();
        var address = $('#regAddress').val().trim();
        var password = $('#regPassword').val();

        if (!name || !email || !phone || !address || !password) {
            this.showError('Semua field wajib diisi.');
            return;
        }

        if (password.length < 6) {
            this.showError('Password minimal 6 karakter.');
            return;
        }

        this.setLoading(true);
        try {
            var res = await Common.Api.post('/Account/DoRegister', {
                'model.Name': name,
                'model.Email': email,
                'model.Phone': phone,
                'model.Address': address,
                'model.Password': password
            });
            if (res.success) {
                Common.showToast('Registrasi berhasil! Silakan masuk.');
                setTimeout(function () { window.location.href = '/Account/Login'; }, 1500);
            } else {
                this.showError(res.message || 'Registrasi gagal.');
            }
        } catch (e) {
            this.showError('Terjadi kesalahan. Coba lagi.');
        } finally {
            this.setLoading(false);
        }
    },

    showError(msg) {
        $('#regError').text(msg).show();
    },

    setLoading(loading) {
        $('#btnRegister').prop('disabled', loading);
        $('#regSpinner').toggle(loading);
    }
};
