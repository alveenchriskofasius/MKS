/* ========================================================================
   MksStoreProfile – Global store profile settings (server-backed).
   Caches values in-memory so receipt rendering is fast.
   ======================================================================== */
const MksStoreProfile = (function () {
    let _cache = null;
    let _loading = null;

    /** Fetch profile from server (caches result) */
    function load(force) {
        if (_cache && !force) return Promise.resolve(_cache);
        if (_loading) return _loading;
        _loading = $.get('/MasterSetting/GetStoreProfile')
            .then(function (data) {
                _cache = data || {};
                _loading = null;
                return _cache;
            })
            .catch(function () {
                _cache = {};
                _loading = null;
                return _cache;
            });
        return _loading;
    }

    /** Get cached profile (returns empty object if not yet loaded) */
    function get() {
        return _cache || {};
    }

    /** Save profile to server and refresh cache */
    function save(settings) {
        return $.ajax({
            url: '/MasterSetting/SaveStoreProfile',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(settings)
        }).then(function (res) {
            if (res && res.success) {
                _cache = Object.assign(_cache || {}, settings);
            }
            return res;
        });
    }

    /** Pre-load on page start */
    $(function () { load(); });

    return { load: load, get: get, save: save };
})();
