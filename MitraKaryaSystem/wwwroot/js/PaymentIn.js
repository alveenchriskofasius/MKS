const PaymentIn = (function () {
  const api = {
    create: (payload) => Common.Api.postJson('/api/paymentin/create', payload),
    listBySO: (soId) => Common.Api.get(`/api/paymentin/list?salesOrderId=${soId}`),
    listByInvoice: (invId) => Common.Api.get(`/api/paymentin/list?salesInvoiceId=${invId}`),
    getInvoice: (id) => Common.Api.get(`/SalesInvoice/Get?id=${id}`),
    listByCustomer: (custId) => Common.Api.get(`/api/paymentin/list?customerId=${custId}`)
  };

  const bindHistory = (soId, invoiceId, customerId) => {
    let loader = null;

    if (invoiceId) loader = api.listByInvoice(invoiceId);
    else if (soId) loader = api.listBySO(soId);
    else if (customerId !== undefined && customerId !== null) loader = api.listByCustomer(customerId);

    if (!loader) {
      $('#piHistoryBody').html(`
        <tr>
          <td colspan='6' class='text-center text-muted small'>No payments</td>
        </tr>
      `);
      return;
    }

    loader
      .then((list) => {
        const rows = (list || []).map((p) => {
          const date = Common.Format.Date(p.date);
          const status = (p.statusID || p.statusId) ===2 ? 'Submitted' : 'Draft';
          const amt = p.amount ||0;
          const amtText = (typeof amt === 'number' ? amt : Number(amt ||0)).toFixed(2);

          return `
            <tr>
              <td>${p.no || ''}</td>
              <td>${date}</td>
              <td>${p.method || ''}</td>
              <td class='text-end'>${amtText}</td>
              <td>${p.type || ''}</td>
              <td>${status}</td>
            </tr>
          `;
        }).join('');

        $('#piHistoryBody').html(rows || `
          <tr>
            <td colspan='6' class='text-center text-muted small'>No payments</td>
          </tr>
        `);
      })
      .catch((err) => {
        console.error('Failed load payment history', err);
        const statusText = err.status ? `(${err.status}) ` : '';
        const msg = err.message || 'Failed load';

        $('#piHistoryBody').html(`
          <tr>
            <td colspan='6' class='text-center text-muted small'>Failed load</td>
          </tr>
        `);

        toastr.error(`${statusText}${msg}`, 'Failed load payment history');
      });
  };

  const setTypeByAmount = (amount, total) => {
    amount = Number(amount ||0);
    total = Number(total ||0);

    if (total >0 && amount >= total) {
      $("input[name='piType'][value='Full']").prop('checked', true);
    } else if (amount >0 && amount < total) {
      $("input[name='piType'][value='DP']").prop('checked', true);
    }
  };

  const openFromSO = (so) => {
    const remaining = (Number(so.amount) ||0) - (Number(so.paidAmount) ||0);

    $('#piCustomerName').text(so.customerName || '-');
    $('#piCustomerId').val(so.customerID || so.CustomerID || '');
    $('#piSOId').val(so.id || so.ID || '');
    $('#piInvoiceId').val('');
    $('#piDate').val(new Date().toISOString().slice(0,10));
    $('#piAmount').val(remaining.toFixed(2));

    setTypeByAmount(remaining, (Number(so.amount) ||0));

    $('#paymentInModal').modal('show');
    bindHistory(so.id || so.ID, null);
  };

  const openFromInvoice = async (inv) => {
    const id = inv.id || inv.ID;

    try {
      const data = await api.getInvoice(id);
      const amount = Number(data.amount || inv.amount ||0);
      const paid = Number(data.paidAmount || inv.paidAmount ||0);
      const remaining = Math.max(0, amount - paid);

      $('#piCustomerName').text(inv.customerName || '-');
      $('#piCustomerId').val(inv.customerID || inv.CustomerID || data.customerID || '');
      $('#piSOId').val('');
      $('#piInvoiceId').val(id);
      $('#piDate').val(new Date().toISOString().slice(0,10));
      $('#piAmount').val(remaining.toFixed(2));

      setTypeByAmount(remaining, amount);

      $('#paymentInModal').modal('show');
      bindHistory(null, id);
    } catch (err) {
      console.error('getInvoice failed', err);

      const remaining = (Number(inv.amount) ||0) - (Number(inv.paidAmount) ||0);

      $('#piCustomerName').text(inv.customerName || '-');
      $('#piCustomerId').val(inv.customerID || inv.CustomerID || '');
      $('#piSOId').val('');
      $('#piInvoiceId').val(id);
      $('#piDate').val(new Date().toISOString().slice(0,10));
      $('#piAmount').val((remaining >0 ? remaining :0).toFixed(2));

      setTypeByAmount(remaining, Number(inv.amount ||0));

      $('#paymentInModal').modal('show');
      bindHistory(null, id);
    }
  };

  // New: open payment modal for a customer without SO or Invoice
  window.showPaymentInModal = function (customerId, customerName, defaultDate) {
    try {
      $('#piCustomerName').text(customerName || '-');
      $('#piCustomerId').val(customerId || '');
      $('#piSOId').val('');
      $('#piInvoiceId').val('');
      $('#piDate').val(defaultDate || new Date().toISOString().slice(0,10));
      $('#piAmount').val('0.00');

      setTypeByAmount(0,0);

      $('#paymentInModal').modal('show');
      bindHistory(null, null, customerId);
    } catch (e) {
      console.error('Failed open payment dialog', e);
      toastr.error('Failed open payment dialog');
    }
  };

  function parseNullableInt(val) {
    return val === undefined || val === null || val === '' ? null : Number(val);
  }

  const save = () => {
    const payload = {
      date: $('#piDate').val(),
      customerID: parseNullableInt($('#piCustomerId').val()),
      salesOrderID: parseNullableInt($('#piSOId').val()),
      salesInvoiceID: parseNullableInt($('#piInvoiceId').val()),
      method: $('#piMethod').val(),
      type: $('input[name="piType"]:checked').val(),
      amount: Number($('#piAmount').val()),
      note: $('#piNote').val(),
      submit: $('#piSubmit').is(':checked')
    };

    $('#btnPaymentSave').prop('disabled', true).find('.spinner-border').removeClass('d-none');

    return api
      .create(payload)
      .then((res) => {
        if (res && res.success) {
          toastr.success('Payment saved');
          // Offer print receipt
          MksPrint.paymentIn({ no: res.no || '', date: payload.date, customerName: $('#piCustomerName').text(), salesOrderNo: '', method: payload.method, amount: payload.amount });
          bindHistory(payload.salesOrderID || null, payload.salesInvoiceID || null, payload.customerID || null);
          $(document).trigger('so:payment:updated', res);
        } else {
          const msg = (res && (res.result || res.message)) || 'Failed to save payment';
          toastr.error(msg);
        }
      })
      .catch((err) => {
        console.error('PaymentIn.save failed', err);
        const statusText = err.status ? `(${err.status}) ` : '';
        toastr.error(`${statusText}${err.message || 'Network error'}`, 'Payment save failed');
      })
      .finally(() => {
        $('#btnPaymentSave').prop('disabled', false).find('.spinner-border').addClass('d-none');
      });
  };

  return { openFromSO, openFromInvoice, save, bindHistory };
})();

$(document).on('click', '#btnPaymentSave', () => PaymentIn.save());
