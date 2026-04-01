$(document).ready(function () { LoginPage.init(); });

const LoginPage = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        $('#btnLogin').on('click', function () { LoginPage.doLogin(); });
        $('#loginPassword').on('keypress', function (e) {
            if (e.which === 13) LoginPage.doLogin();
        });
    },

    async doLogin() {
        var email = $('#loginEmail').val().trim();
        var password = $('#loginPassword').val();

        if (!email || !password) {
            this.showError('Email dan password wajib diisi.');
            return;
        }

        this.setLoading(true);
        try {
            var res = await Common.Api.post('/Account/DoLogin', {
                'model.Email': email,
                'model.Password': password
            });
            if (res.success) {
                // Restore saved cart from DB into session
                try { await Common.Api.post('/Cart/RestoreCart', {}); } catch (_) { }
                window.location.href = '/';
            } else {
                this.showError(res.message || 'Login gagal.');
            }
        } catch (e) {
            this.showError('Terjadi kesalahan. Coba lagi.');
        } finally {
            this.setLoading(false);
        }
    },

    showError(msg) {
        $('#loginError').text(msg).show();
    },

    setLoading(loading) {
        $('#btnLogin').prop('disabled', loading);
        $('#loginSpinner').toggle(loading);
    }
};
