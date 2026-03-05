// Please see documentation at https://docs.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// Write your JavaScript code.

// site.js - global helpers

// Keep file intentionally small; export a Common object for shared utilities if not present.
window.Common = window.Common || {};

// Simple AJAX helper used by existing code
Common.GetData = Common.GetData || {
    Get: function (url) {
        try {
            const res = $.ajax({ url: url, async: false }).responseJSON;
            return res;
        } catch (e) {
            console.error('Common.GetData.Get failed', e);
            return null;
        }
    }
};
