var Common = {
 hasPermission: function (name) {
  var perms = window.__userPermissions || [];
  var key = (name || '').replace(/\s/g, '').toLowerCase();
  return perms.some(function (p) { return (p || '').replace(/\s/g, '').toLowerCase() === key; });
 },
 getCsrfToken: function () {
 // Try common sources: hidden input, meta tag, then cookie
 const $input = $('input[name="__RequestVerificationToken"], input[name="_RequestVerificationToken"]');
 if ($input.length) return $input.val();
 const meta = $('meta[name="csrf-token"]').attr('content');
 if (meta) return meta;
 // Look for common antiforgery cookies
 const cookieVal = (name) => (document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[-./\\^$*+?()|[\]{}]/g, '\\$&') + '=([^;]+)')) || [])[1];
 const xsrf = cookieVal('XSRF-TOKEN') || cookieVal('.AspNetCore.Antiforgery') || (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('.AspNetCore.Antiforgery')) || '').split('=')[1];
 return xsrf ? decodeURIComponent(xsrf) : undefined;
 },

 MakeCSRFExtendedData: function (data) {
 const token = Common.getCsrfToken();
 const base = data || {};
 if (!token) return $.extend({}, base);
 // Add both keys for broader compatibility if not already present
 const extra = {};
 if (base._RequestVerificationToken == null) extra._RequestVerificationToken = token;
 if (base.__RequestVerificationToken == null) extra.__RequestVerificationToken = token;
 return $.extend({}, base, extra);
 },

 // New: Promise-based async helpers using fetch
 Api: {
 async fetchJson(url, opts) {
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(), (opts && opts.timeout) ||30000);
 const headers = new Headers((opts && opts.headers) || {});
 // Default headers
 if (!headers.has('Accept')) headers.set('Accept', 'application/json, text/plain, */*');
 // Attach CSRF header if available and not already set
 if (!headers.has('RequestVerificationToken')) {
 const t = Common.getCsrfToken();
 if (t) headers.set('RequestVerificationToken', t);
 }
 const finalOpts = Object.assign({ method: 'GET', credentials: 'same-origin' }, opts, { headers, signal: controller.signal });

 let res;
 try {
 res = await fetch(url, finalOpts);
 } finally {
 clearTimeout(timeout);
 }

 const text = await res.text();
 let data = null;
 const ct = res.headers.get('content-type') || '';
 if (ct.includes('application/json')) {
 try { data = text ? JSON.parse(text) : null; } catch (e) { /* ignore parse error */ }
 }
 if (!res.ok) {
 const msg = (data && (data.message || data.result)) || text || res.statusText || `HTTP ${res.status}`;
 const err = new Error(msg);
 err.status = res.status;
 err.data = data;
 throw err;
 }
 // Detect Access Denied HTML redirect (server returns 200 with HTML after 302)
 if (data == null && typeof text === 'string' && text.includes('Access Denied')) {
 const err = new Error('You don\'t have permission to perform this action. Please contact your administrator.');
 err.status = 403;
 err.accessDenied = true;
 throw err;
 }
 return data != null ? data : text;
 },

 // GET with CSRF header (where applicable)
 async get(url) {
 return Common.Api.fetchJson(url, { method: 'GET' });
 },

 async post(url, data) {
 // send form-encoded by default to match existing server expectations
 const form = new URLSearchParams(Common.MakeCSRFExtendedData(data)).toString();
 return Common.Api.fetchJson(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: form });
 },

 async postJson(url, json) {
 // send JSON (for API endpoints)
 // attach CSRF as header rather than mixing into payload
 return Common.Api.fetchJson(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(json) });
 },

 async put(url, data) {
 const form = new URLSearchParams(Common.MakeCSRFExtendedData(data)).toString();
 return Common.Api.fetchJson(url, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: form });
 },

 async delete(url, data) {
 // Some servers expect DELETE body, some do not. Support both by sending form body when provided
 const hasBody = data != null;
 return Common.Api.fetchJson(url, {
 method: 'DELETE',
 credentials: 'same-origin',
 headers: hasBody ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } : undefined,
 body: hasBody ? new URLSearchParams(Common.MakeCSRFExtendedData(data)).toString() : undefined
 });
 }
 },

 // Backward-compatible synchronous helpers (DEPRECATED) kept for existing code
 GetData: {
 Post: function (_url, _data) {
 // synchronous behavior preserved for compatibility
 console.warn('[Common.GetData.Post] Synchronous AJAX is deprecated; use Common.Api.post or GetData.PostAsync instead.');
 let result = [];
 const csrfToken = Common.getCsrfToken();

 $.ajax({
 url: _url,
 type: 'POST',
 headers: { "_RequestVerificationToken": csrfToken },
 dataType: 'json',
 data: Common.MakeCSRFExtendedData(_data),
 async: false,
 cache: false
 }).done(function (data) { result = data; }).fail(function () { result = []; });

 return result;
 },
 Get: function (_url) {
 // synchronous behavior preserved for compatibility
 console.warn('[Common.GetData.Get] Synchronous AJAX is deprecated; use Common.Api.get or GetData.GetAsync instead.');
 const csrfToken = Common.getCsrfToken();
 let result = [];
 $.ajax({
 url: _url,
 type: 'GET',
 headers: { "_RequestVerificationToken": csrfToken },
 async: false,
 cache: false
 }).done(function (data) { result = data; }).fail(function () { result = []; });
 return result;
 },

 // New async methods that should be used by modernized code
 GetAsync: async function (url) {
 return Common.Api.get(url);
 },
 PostAsync: async function (url, data) {
 return Common.Api.post(url, data);
 },
 PostJsonAsync: async function (url, json) {
 return Common.Api.postJson(url, json);
 }
 },

 Validation: {
 Number: function (evt) {
 const charCode = (evt.which) ? evt.which : evt.keyCode;
 if (charCode !==46 && charCode >31 && (charCode <48 || charCode >57)) return false;
 return true;
 },
 Digit: function (number) {
 return /^[0-9]+$/.test(number);
 },
 Decimal: function (number) {
 if (parseInt(number) ===0) return true;
 const regex = /^(\d+)(\.\d{1,2})?$/; // up to2 decimal places
 return regex.test(String(number).trim());
 }
 },
 Helper: {
 CommaSeparation: function (yourNumber) {
 const temp = String(yourNumber);
 const value = parseFloat(temp.replace(/,/g, ''));
 if (value !== "" && !isNaN(value)) {
 const n = parseFloat(value).toFixed(2).toString().split('.');
 n[0] = n[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
 return n.join('.');
 }
 return '';
 },
 CommaSeparation2: function (yourNumber) {
 const temp = String(yourNumber);
 const value = parseFloat(temp.replace(/,/g, ''));
 if (value !== "" && !isNaN(value)) {
 let n = parseFloat(value).toString().split('.');
 if (parseFloat(value) >1) n = parseFloat(value).toFixed(2).toString().split('.');
 n[0] = n[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
 return n.join('.');
 }
 return '';
 },
 ReplaceComa: function (number) { return number.replace(/\s*,\s*|\s+,/g, ''); },
 ReplaceComma: function (number) { return Common.Helper.ReplaceComa(number); }, // alias
 Datepicker: function () { $('.date-picker').datepicker({ dateFormat: 'dd-M-yy', autoclose: true, changeMonth: true }); }
 },
 Form: {
 Save: function (_url, _data) {
 return new Promise(function (resolve, reject) {
 const csrfToken = Common.getCsrfToken();
 $.ajax({
 url: _url,
 headers: { "_RequestVerificationToken": csrfToken },
 type: 'POST',
 dataType: 'json',
 data: Common.MakeCSRFExtendedData(_data),
 async: true,
 cache: false,
 success: function (data) { resolve(data); },
 error: function (jqXHR) { reject(jqXHR); }
 });
 });
 },
 SaveWithJSON: function (_url, data) {
 let result = [];
 $.ajax({
 url: _url,
 headers: { "_RequestVerificationToken": Common.getCsrfToken() },
 type: 'POST',
 dataType: 'json',
 contentType: 'application/json; charset=utf-8',
 data: Common.MakeCSRFExtendedData(data),
 cache: false,
 async: false
 }).done(function (data) { result = data; }).fail(function () { result = { respon: { errorMessage: 'Save data failed!', errorType:1 } }; });
 return result;
 },
 Delete: function (_url, _data) {
 let result = '';
 $.ajax({
 url: _url,
 headers: { "_RequestVerificationToken": Common.getCsrfToken() },
 type: 'GET',
 data: Common.MakeCSRFExtendedData(_data),
 async: false,
 cache: false
 }).done(function (data) { result = data; }).fail(function () { result = { respon: { errorMessage: 'Delete data failed!', errorType:1 } }; });
 return result;
 },
 HandleFormSubmit: function (form, constraints) {
 const errors = validate(form, constraints);
 Common.Form.ShowErrors(form, errors || {});
 return (errors === undefined);
 },
 ShowErrors: function (form, errors) {
 $.each(form.elements, function (_i, element) { Common.Form.ShowErrorsForInput(element, errors && errors[element.id]); });
 },
 ShowErrorsForInput: function (input, errors) {
 const formGroup = Common.Form.ClosestParent(input.parentNode, 'form-group');
 const messages = input.parentNode.querySelector('.messages');
 Common.Form.ResetFormGroup(formGroup);
 if (!messages) return; // nothing to render into
 if (errors) {
 if (formGroup) formGroup.classList.add('has-error');
 $.each(errors, function (_i, error) { Common.Form.AddError(messages, error, input); });
 } else if (formGroup != null) {
 formGroup.classList.add('has-success');
 }
 },
 ResetFormGroup: function (formGroup) {
 if (formGroup != null) {
 if (formGroup.classList.value.includes('has-error')) formGroup.classList.remove('has-error');
 if (formGroup.classList.value.includes('has-success')) formGroup.classList.remove('has-success');
 $.each(formGroup.querySelectorAll('.text-danger'), function (_i, el) { el.parentNode.removeChild(el); });
 }
 },
 AddError: function (messages, error, input) {
 const block = document.createElement('p');
 block.classList.add('text-danger', 'error');
 block.innerText = error;
 messages.appendChild(block);
 $(input).addClass('input-danger');
 },
 ClosestParent: function (child, className) {
 if (!child || child === document) return null;
 if (child.classList && child.classList.contains(className)) return child;
 return Common.Form.ClosestParent(child.parentNode, className);
 },
 SetValue: function bindObjectToForm(obj) {
 for (const prop in obj) {
 if (Object.prototype.hasOwnProperty.call(obj, prop)) {
 const element = document.getElementById(prop);
 if (element) element.value = obj[prop];
 }
 }
 }
 },
 Format: {
 Comma: function (yourNumber) {
 const temp = String(yourNumber);
 let value = parseFloat(temp.replace(/,/g, ''));
 if (value !== '' && !isNaN(value)) {
 const n = parseFloat(value).toFixed(2).toString().split('.');
 n[0] = n[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
 value = n.join('.');
 } else value = '';
 return value;
 },
 Comma2: function (yourNumber) {
 const temp = String(yourNumber);
 let value = parseFloat(temp.replace(/,/g, ''));
 if (value !== '' && !isNaN(value)) {
 const n = parseFloat(value).toFixed(2).toString().split('.');
 n[0] = n[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
 value = n.join('.');
 } else value = '0';
 value = value.replace('.00', '').replace('.0', '');
 return value;
 },
 Date: function (value) {
 if (value === null || value === '' || value === undefined) return '';
 const dt = new Date(value);
 if (isNaN(dt)) return '';
 const month = dt.getMonth() +1;
 return ((dt.getDate() <10) ? '0' + dt.getDate() : dt.getDate()) + '-' + (month <10 ? '0' + month : month) + '-' + dt.getFullYear();
 },
 DateByForm: function (value) {
 if (value === null) return '';
 const dt = new Date(value);
 const day = ('0' + dt.getDate()).slice(-2);
 const month = ('0' + (dt.getMonth() +1)).slice(-2);
 return dt.getFullYear() + '-' + month + '-' + day;
 },
 Datetime: function (value) {
 if (value === null) return '';
 const dt = new Date(value);
 const month = dt.getMonth() +1;
 const minutes = (dt.getMinutes() <10) ? ('0' + dt.getMinutes()) : dt.getMinutes();
 const seconds = (dt.getSeconds() <10) ? ('0' + dt.getSeconds()) : dt.getSeconds();
 return ((dt.getDate() <10) ? '0' + dt.getDate() : dt.getDate()) + '-' + (month <10 ? '0' + month : month) + '-' + dt.getFullYear() + ' ' + dt.getHours() + ':' + minutes + ':' + seconds;
 },
 Money: function (id) {
 $(id).each(function (_index, el) {
 const $el = $(el);
 const elType = $el.is('input') || $el.is('textarea') ? 'input' : 'other';
 let value = (elType === 'input') ? $el.val().replace(/,/g, '') : $el.text().replace(/,/g, '');
 $el.on('paste keyup', function () { value = $el.val().replace(/,/g, ''); Common.Format.MoneyCurrency($el, elType, value); });
 Common.Format.MoneyCurrency($el, elType, value);
 });
 },
 MoneyCurrency: function (el, elType, value) {
 let result = '';
 const valueArray = String(value).split('');
 const resultArray = [];
 let counter =0;
 let temp = '';
 for (let i = valueArray.length -1; i >=0; i--) {
 temp += valueArray[i];
 counter++;
 if (counter ===3) { resultArray.push(temp); counter =0; temp = ''; }
 }
 if (counter >0) resultArray.push(temp);
 for (let i = resultArray.length -1; i >=0; i--) {
 const resTemp = resultArray[i].split('');
 for (let j = resTemp.length -1; j >=0; j--) result += resTemp[j];
 if (i >0) result += ',';
 }
 if (elType === 'input') $(el).val(result); else $(el).empty().text(result);
 },
 Currency: function (bilangan) {
 let minus = '';
 bilangan = String(bilangan).replace(/,/g, '');
 if (bilangan.includes('-')) { bilangan = bilangan.replace('-', ''); minus = '-'; }
 const numberString = bilangan.toString();
 const sisa = numberString.length %3;
 let rupiah = numberString.substr(0, sisa);
 const ribuan = numberString.substr(sisa).match(/\d{3}/g);
 if (ribuan) { const separator = sisa ? ',' : ''; rupiah += separator + ribuan.join(','); }
 return minus + rupiah;
 }
 },
 Table: {
 InitClient: function (idTB) {
 $(idTB).DataTable({ destroy: true, filter: true, serverSide: false, language: { emptyTable: 'No data available in table' }, data: [], dom: "<'row' <'col-md-12'B>><'row'<'col-md-6 col-sm-12'l><'col-md-6 col-sm-12'f>r><'table-scrollable't><'row'<'col-md-5 col-sm-12'i><'col-md-7 col-sm-12'p>>", buttons: ['copyHtml5', 'excelHtml5'] });
 },
 LoadTableClientWithPaging: function (_idTB, _data, _columns, _lengthMenu, _columnDefs, _tableName, _orderColumn, _sCrollX = false) {
 const ordering = !(!_orderColumn || _orderColumn.length ===0);
 $(_idTB).DataTable({ deferRender: true, processing: true, serverSide: false, ordering: ordering, destroy: true, filter: true, language: { emptyTable: 'No data available in table' }, dom: "<'row' <'col-md-12'B>><'row'<'col-md-6 col-sm-12'l><'col-md-6 col-sm-12'f>r><'table-scrollable't><'row'<'col-md-5 col-sm-12'i><'col-md-7 col-sm-12'p>>", buttons: [{ extend: 'copyHtml5' }, { extend: 'excelHtml5', title: _tableName }], data: _data, lengthMenu: _lengthMenu, columns: _columns, columnDefs: _columnDefs, order: _orderColumn, scrollX: _sCrollX });
 },
 LoadTableClientNoPaging: function (_idTB, _data, _columns, _columnDefs, _tableName, _orderColumn) {
 $(_idTB).DataTable({ deferRender: true, processing: true, serverSide: false, destroy: true, filter: false, paging: false, language: { emptyTable: 'No data available in table' }, dom: "<'row' <'col-md-12'B>><'row'<'col-md-6 col-sm-12'l><'col-md-6 col-sm-12'f>r><'table-scrollable't><'row'<'col-md-5 col-sm-12'i><'col-md-7 col-sm-12'p>>", buttons: [{ extend: 'copyHtml5' }, { extend: 'excelHtml5', title: _tableName }], data: _data, columns: _columns, columnDefs: _columnDefs, order: _orderColumn });
 },
 LoadTableClient: function (_idTB, _data, _columns, _columnDefs) {
 $(_idTB).DataTable({ deferRender: true, processing: true, serverSide: false, destroy: true, filter: false, lengthChange: false, paging: false, data: _data, columns: _columns, columnDefs: _columnDefs, order: false });
 }
 },
 Alert: {
 Error: function (message) { if (window.Swal && Swal.fire) Swal.fire('Error System!', message, 'error'); else alert('Error: ' + message); },
 Success: function (message) { if (window.Swal && Swal.fire) Swal.fire('Success!', message, 'success'); else alert('Success: ' + message); },
 Warning: function (message) { if (window.Swal && Swal.fire) Swal.fire('Warning!', message, 'warning'); else alert('Warning: ' + message); },
 AlertType: function (errorType, message) {
 if (errorType ===0) Common.Alert.Success(message);
 else if (errorType ===1) Common.Alert.Error(message);
 else if (errorType ===2) Common.Alert.Warning(message);
 else Common.Alert.Error(message);
 },
 BolokUi: function () { $.blockUI({ css: { padding: '15px', opacity:5 }, message: 'processing encryption your data import... please wait...' }); },
 BlockUi: function () { return Common.Alert.BolokUi(); } // alias
 },
 CheckError: {
 Object: function (data) {
 // preserve original shape but this method seemed incorrect; return true if no error
 if (!data) return true;
 if (data.ErrorType ===0) return true;
 return false;
 }
 },
 Convert: {
 // Deprecated: returns empty string initially as FileReader is async. Use Base64Async instead
 Base64: function (file) {
 console.warn('[Common.Convert.Base64] Use Base64Async(file) which returns a Promise.');
 let result = '';
 const reader = new FileReader();
 reader.readAsDataURL(file);
 reader.onload = function () { result = reader.result; };
 reader.onerror = function (error) { result = 'Error: ' + error; };
 return result;
 },
 Base64Async: function (file) {
 return new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.onload = () => resolve(reader.result);
 reader.onerror = (e) => reject(e);
 reader.readAsDataURL(file);
 });
 }
 },
 Chart: {
 SetStepChart: function (maxTop) {
 if (maxTop == null || Number.isNaN(maxTop)) return { topChartValue:1, stepSize:0.1 };
 if (maxTop >1) maxTop = Math.ceil(maxTop);
 if (maxTop ===0) return { topChartValue:1, stepSize:0.1 };

 const thresholds = [10000000,1000000,100000,10000,1000,100,10,1,0.1,0.01,0.001];
 for (let i =0; i < thresholds.length; i++) {
 const t = thresholds[i];
 if (maxTop > t) {
 const stepSize = t;
 const topChartValue = Common.Chart.GetMaxValue(maxTop, stepSize);
 return { topChartValue: topChartValue, stepSize: stepSize };
 }
 }
 return { topChartValue: Common.Chart.GetMaxValue(maxTop,0.001), stepSize:0.001 };
 },
 SetStepChartPercent: function (maxTop) {
 const stepSize =20; let topChartValue =100;
 if (maxTop == null || Number.isNaN(maxTop) || maxTop ==0) return { topChartValue, stepSize };
 if (maxTop >1) maxTop = Math.ceil(maxTop);
 topChartValue = Common.Chart.GetMaxValue(maxTop, stepSize) + stepSize;
 return { topChartValue, stepSize };
 },
 GetMaxValue: function (maxTop, counter) {
 let result =0;
 for (let i = counter; i < maxTop; i += counter) result += counter;
 result += counter;
 return result;
 },
 SetYValue: function (value, type) {
 let maxTop = (type === 'Daily') ? YValueDaily.topChartValue : YValueCumulative.topChartValue;
 if (value <1) maxTop = value.toFixed(2);
 if (value >1) maxTop = Math.ceil(value);
 // simplified mapping; keep original cases where needed
 if (maxTop >1000) {
 const map = {
50000000: '50M',30000000: '30M',20000000: '20M',10000000: '10M',
5000000: '5M',4000000: '4M',3000000: '3M',2000000: '2M',1000000: '1M',
900000: '900K',800000: '800K',700000: '700K',600000: '600K',500000: '500K',
400000: '400K',300000: '300K',200000: '200K',100000: '100K',50000: '50K'
 };
 return map[value] || value;
 }
 // fallback
 return String(value);
 }
 },
 ImageValidate: function (fileType) {
 return (fileType && fileType.startsWith('image/')) || fileType === 'image/png' || fileType === 'image/jpeg' || fileType === 'image/jpg';
 }
};