async function waitForCore() {
  
  while (
    !window.getIndexedDB ||
    !window.setIndexedDB ||
    !window.deleteIndexedDB ||
    !window.debounce ||
    !window.addToSyncQueue
  ) {
    
    await new Promise(resolve =>
      setTimeout(resolve, 200)
    );
    
  }
  
  console.log("✅ Fees dependencies loaded");
  
}

(async () => {
      
      await waitForCore();

console.log("FEES BOOT CHECK:", {
  getIndexedDB: window.getIndexedDB,
  debounce: window.debounce,
  addToSyncQueue: window.addToSyncQueue
});

console.log("=== FEES DEPENDENCY CHECK ===");

console.log("getIndexedDB:", typeof window.getIndexedDB);
console.log("setIndexedDB:", typeof window.setIndexedDB);
console.log("deleteIndexedDB:", typeof window.deleteIndexedDB);

console.log("escapeHTML:", typeof window.escapeHTML);
console.log("sanitizeKey:", typeof window.sanitizeKey);

console.log("showLoading:", typeof window.showLoading);
console.log("hideLoading:", typeof window.hideLoading);

console.log("debounce:", typeof window.debounce);

console.log("addToSyncQueue:", typeof window.addToSyncQueue);
console.log("triggerSync:", typeof window.triggerSync);


// ─── Guarded Sync Helpers ───
const syncLock = new Map();

async function guardedAddToSyncQueue(key, action, data) {
  if (syncLock.get(key)) return;
  syncLock.set(key, true);

  if (typeof addToSyncQueue === 'function') {
    try {
      await addToSyncQueue(key, action, data);
    } catch (e) {
      console.error('Sync queue error for', key, e);
    }
  }
}

function guardedTriggerSync() {
  if (typeof triggerSync === 'function') {
    try {
      triggerSync();
    } catch (e) {
      console.error('Trigger sync error:', e);
    }
  }
}

function releaseSyncLock(key) {
  syncLock.delete(key);
}


// ----------------- FEES -----------------
window.loadFeesStudents = async function() {
  try {
    const className = document.getElementById('fees-class').value;
    const tbody = document.querySelector('#fees-table tbody');
    const totalFeesInput = document.getElementById('total-fees-amount');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!className) {
      totalFeesInput.value = '';
      return;
    }
    let students = await getIndexedDB('students');
    if (!Array.isArray(students)) students = [];
    const classStudents = students.filter(s => s.classId === className);
    let fees = await getIndexedDB('fees');
    if (!Array.isArray(fees)) fees = [];
    const feesConfig = await getIndexedDB('feesConfig', className);
    const totalFullAmount = feesConfig ? feesConfig.totalAmount : 0;
    totalFeesInput.value = totalFullAmount > 0 ? totalFullAmount : '';
    const fragment = document.createDocumentFragment();
    classStudents.forEach(s => {
      const fee = fees.find(f => f.id === s.id) || { payments: [] };
      const totalPaid = fee.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      let status = totalFullAmount > 0 && totalPaid >= totalFullAmount ? '<span class="paid">Fully Paid ✅</span>' :
        totalPaid > 0 ? '<span class="outstanding">Outstanding Balance</span>' :
        '<span class="unpaid">Not Paid ❌</span>';

      const photoDisplay = s.photo ?
  `<img src="${escapeHTML(s.photo)}" class="student-photo zoomable" data-src="${escapeHTML(s.photo)}" data-student-id="${escapeHTML(s.id)}" alt="${escapeHTML(s.name)}'s photo">` :
  '<span class="no-data">No photo</span>';


      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHTML(s.id)}</td>
        <td>${photoDisplay}${escapeHTML(s.name)}</td>
        <td><input type="number" min="0" data-id="${escapeHTML(s.id)}" placeholder="Amount (ZMW)"></td>
        <td class="status-cell">${status}</td>
      `;
      tr.dataset.historicalPaid = totalPaid;
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
    document.querySelectorAll('#fees-table input[type="number"]').forEach(inp => inp.addEventListener('input', debounce(updateFeeStatus, 300)));
  } catch (e) {
    console.error('loadFeesStudents failed', e);
  }
};





function updateFeeStatus(event) {
  const row = event.target.closest('tr');
  if (!row) return;
  const statusCell = row.querySelector('.status-cell');
  const amountInput = event.target;

  // Convert input to number safely
  const inputValue = parseFloat(amountInput.value);
  if (isNaN(inputValue) || inputValue <= 0) {
    statusCell.innerHTML = '<span class="unpaid">Not Paid Yet ❌</span>';
    return;
  }

  // Get total fees for the class
  const className = document.getElementById('fees-class').value;
  getIndexedDB('feesConfig', className).then(config => {
    const totalFees = config && !isNaN(config.totalAmount) ? Number(config.totalAmount) : 0;

    let statusHtml = '';

    if (totalFees <= 0) {
      // No total fee configured
      statusHtml = '<span class="unpaid">Not Paid ❌</span>';
    } else {
      // Use high-precision tolerance
      const tolerance = 0.001;

      if (Math.abs(inputValue - totalFees) <= tolerance) {
        statusHtml = '<span class="paid">Fully Paid ✅</span>';
      } else if (inputValue > totalFees + tolerance) {
        statusHtml = '<span class="overpaid">Over Paid ⚠️</span>';
      } else if (inputValue < totalFees - tolerance) {
        statusHtml = '<span class="outstanding">Paid with Outstanding Balance</span>';
      }
    }

    statusCell.innerHTML = statusHtml;
  });
}





document.querySelectorAll('#fees-table input[type="number"]').forEach(input => {
  input.addEventListener('change', updateFeeStatus); // fires on paste / autofill
});




window.clearFeesInputs = function() {
  const rows = document.querySelectorAll('#fees-table tbody tr');

  rows.forEach(row => {
    // Clear input
    const input = row.querySelector('input[type="number"]');
    if (input) input.value = '';

    // TEMPORARILY reset session-paid amount
    row.dataset.sessionCleared = 'true';

    // Force UI reset
    const statusCell = row.querySelector('.status-cell');
    statusCell.innerHTML = '<span class="unpaid">Not Paid ❌</span>';
  });
};


window.saveFeesConfig = async function() {
  showLoading('Saving fees configuration...');
  try {
    const classSelect = document.getElementById('fees-class');
    if (!classSelect) return alert('Class selector not found');

    const className = classSelect.value;
    if (!className) return alert('Please select a class');

    const totalFeesInput = document.getElementById('total-fees-amount');
    if (!totalFeesInput) return alert('Total fees input not found');

    const totalAmount = parseFloat(totalFeesInput.value);
    if (isNaN(totalAmount) || totalAmount <= 0) return alert('Enter a valid positive total fees amount');

    // Prepare the feesConfig object
    const now = new Date().toISOString();
    const feesConfigData = { id: className, totalAmount, updatedAt: now };

    // Save into IndexedDB
    await setIndexedDB('feesConfig', className, feesConfigData);

// Add to sync queue if syncing is used (guarded)
if (typeof addToSyncQueue === 'function') {
  await guardedAddToSyncQueue(`feesConfig/${className}`, 'set', feesConfigData);
  guardedTriggerSync();
}

    // Reset all input amounts and statuses to Not Paid
    const tbody = document.querySelector('#fees-table tbody');
    if (tbody) {
      tbody.querySelectorAll('input[type="number"]').forEach(inp => inp.value = '');
      tbody.querySelectorAll('.status-cell').forEach(cell => cell.innerHTML = '<span class="unpaid">Not Paid Yet ❌</span>');
    }

    alert(`Total fees set to ${totalAmount} ZMW for ${className}`);
  } catch (error) {
    console.error('Fees configuration save error:', error);
    alert('Fees configuration error. Please try again.');
  } finally {
    hideLoading();
  }
};




window.saveFees = async function() {
  showLoading('Saving fees...');
  try {
    const className = document.getElementById('fees-class').value;
    if (!className) return alert('Select a class');

    // Get total fees for class and ensure it's a number
    const feesConfig = await getIndexedDB('feesConfig', className);
    const totalFees = feesConfig && !isNaN(feesConfig.totalAmount) ? Number(feesConfig.totalAmount) : 0;

    if (totalFees <= 0) {
      alert('Total fees for this class is not set or invalid');
      hideLoading();
      return;
    }

    const inputs = document.querySelectorAll('#fees-table input[type="number"]');
    let hasInput = false;
    const date = new Date().toISOString();
    const tolerance = 0.001; // same as updateFeeStatus

    for (const inp of inputs) {
      const amount = parseFloat(inp.value);
      const studentId = sanitizeKey(inp.dataset.id);

      if (!isNaN(amount) && amount > 0) {
        hasInput = true;

        let fee = await getIndexedDB('fees', studentId);
        if (!fee) fee = { id: studentId, payments: [], classId: className, updatedAt: date };

        // Strict numeric comparison with tolerance
        let status = '';
        if (Math.abs(amount - totalFees) <= tolerance) status = 'fullypaid';
        else if (amount > totalFees + tolerance) status = 'overpaid';
        else if (amount < totalFees - tolerance) status = 'outstanding';

        fee.payments.push({ amount, date, status });
        fee.updatedAt = date;

        await setIndexedDB('fees', studentId, fee);

        // Guarded sync
        if (typeof guardedAddToSyncQueue === 'function') {
          await guardedAddToSyncQueue(`fees/${studentId}`, 'set', fee);
        }
      }
    }

    if (!hasInput) {
      alert('Enter at least one positive amount');
      hideLoading();
      return;
    }

    if (typeof guardedTriggerSync === 'function') guardedTriggerSync();

    alert('Fees saved successfully');
    clearFeesInputs();
    loadFeesStudents();

  } catch (e) {
    console.error('saveFees failed', e);
    alert('Error saving fees. Please try again.');
  } finally {
    hideLoading();
  }
};





window.viewFeesHistory = async function() {
  try {
    const className = document.getElementById('fees-history-class').value;
    if (!className) return alert('Select a class');

    const studentId = document.getElementById('fees-search-student-id').value.trim();
    const historyDiv = document.getElementById('fees-history');

    let fees = await getIndexedDB('fees');
    if (!Array.isArray(fees)) fees = [];

    const feesConfig = await getIndexedDB('feesConfig', className);
    const totalFullAmount = feesConfig ? feesConfig.totalAmount : 0;

    let students = await getIndexedDB('students');
    if (!Array.isArray(students)) students = [];

    const studentMap = new Map(students.map(stu => [stu.id, stu]));
    const filteredFees = fees.filter(
      f => studentMap.get(f.id)?.classId === className && (!studentId || f.id === studentId)
    );

    historyDiv.innerHTML = '';

    if (!filteredFees.length) {
      historyDiv.innerHTML = '<p>No fee records found</p>';
      historyDiv.style.display = 'block';
      return;
    }

    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Date</th>
          <th>ID</th>
          <th>Name</th>
          <th>Amount (ZMW)</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    let found = false;

    filteredFees.forEach(f => {
      const student = studentMap.get(f.id);
      if (!student) return;

      let runningTotal = 0;

      f.payments.forEach((payment, index) => {
        runningTotal += Number(payment.amount) || 0;
        found = true;

        // ✅ ENHANCED STATUS LOGIC (ADDED ONLY)
        let statusHTML = '<span class="unpaid">Not Paid ❌</span>';

        if (totalFullAmount > 0) {
          if (runningTotal === totalFullAmount) {
            statusHTML = '<span class="paid">Fully Paid ✅</span>';
          } else if (runningTotal > totalFullAmount) {
            statusHTML = '<span class="overpaid">Over Paid ⚠️</span>';
          } else if (runningTotal > 0) {
            statusHTML = '<span class="outstanding">Outstanding Balance</span>';
          }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHTML(payment.date)}</td>
          <td>${escapeHTML(f.id)}</td>
          <td>${escapeHTML(student.name)}</td>
          <td>${payment.amount} ZMW</td>
          <td>${statusHTML}</td>
          <td>
            <button class="edit-fee-btn"
              onclick="editFeeRecord('${escapeHTML(f.id)}', ${index}, ${payment.amount}, '${escapeHTML(payment.date)}')">
              Edit
            </button>
            <button class="delete-fee-btn"
              onclick="deleteFeeRecord('${escapeHTML(f.id)}', ${index})">
              Delete
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    });

    if (!found) {
      tbody.innerHTML = '<tr><td colspan="6">No fee records found</td></tr>';
    }

    historyDiv.appendChild(table);
    historyDiv.style.display = 'block';

  } catch (e) {
    console.error('viewFeesHistory failed', e);
  }
};





window.editFeeRecord = async function(studentId, index, currentAmount, currentDate) {
  showLoading('Updating fee...');
  try {
    const newAmountStr = prompt(`New amount (current: ${currentAmount} ZMW):`, currentAmount);
    if (newAmountStr === null) return;
    const newAmount = parseFloat(newAmountStr);
    if (isNaN(newAmount) || newAmount <= 0) return alert('Positive amount required');

    const fee = await getIndexedDB('fees', studentId);
    if (!fee || !fee.payments[index]) return alert('Record not found');

    // Update the payment
    fee.payments[index].amount = newAmount;
    fee.updatedAt = new Date().toISOString();

    // ✅ Recalculate the status based on total of all payments
    const students = await getIndexedDB('students');
    const student = students.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found');

    const feesConfig = await getIndexedDB('feesConfig', student.classId);
    const totalFees = feesConfig && typeof feesConfig.totalAmount === 'number' ? feesConfig.totalAmount : 0;

    const totalPaid = fee.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const epsilon = 0.001; // floating point tolerance

    if (totalPaid <= 0) fee.status = 'unpaid';
    else if (Math.abs(totalPaid - totalFees) < epsilon) fee.status = 'fullypaid';
    else if (totalPaid < totalFees) fee.status = 'outstanding';
    else fee.status = 'overpaid';

    // Save & sync
    await setIndexedDB('fees', studentId, fee);
    await guardedAddToSyncQueue(`fees/${studentId}`, 'set', fee);
    guardedTriggerSync(); // Background

    alert('Updated successfully');
    viewFeesHistory();
  } catch (e) {
    console.error('editFeeRecord failed', e);
    alert('Error updating fee');
  } finally {
    hideLoading();
  }
};





window.deleteFeeRecord = async function(studentId, index) {
  showLoading('Deleting fee...');
  try {
    if (!confirm(`Delete this payment for ${studentId}?`)) return;

    const fee = await getIndexedDB('fees', studentId);
    if (!fee || !fee.payments[index]) return alert('Record not found');

    // Remove the specific payment
    const removedPayment = fee.payments.splice(index, 1)[0];

    fee.updatedAt = new Date().toISOString();

    if (fee.payments.length === 0) {
      // No payments left — delete the entire record
      await deleteIndexedDB('fees', studentId);
      await guardedAddToSyncQueue(`fees/${studentId}`, 'delete', null);
    } else {
      // Payments remain — recalc status for remaining payments if needed
      // Optional: update statuses here if you display per payment in history
      await setIndexedDB('fees', studentId, fee);
      await guardedAddToSyncQueue(`fees/${studentId}`, 'set', fee);
    }

    // Trigger background sync once
    guardedTriggerSync();

    alert('Payment deleted successfully');
    viewFeesHistory(); // Refresh the history table

  } catch (e) {
    console.error('deleteFeeRecord failed', e);
    alert('Error deleting payment. Try again.');
  } finally {
    hideLoading();
  }
};



window.deleteAllFees = async function() {
  showLoading('Deleting all fees...');
  
  try {
    const className =
      document.getElementById('fees-history-class')?.value ||
      document.getElementById('fees-class')?.value;
    
    if (!className) {
      hideLoading();
      return alert('Select a class');
    }
    
    const studentId =
      document.getElementById('fees-search-student-id')?.value.trim();
    
    const message = studentId ?
      `Delete all for ${studentId} in ${className}?` :
      `Delete all in ${className}?`;
    
    if (!confirm(message)) {
      hideLoading();
      return;
    }
    
    let fees = await getIndexedDB('fees');
    if (!fees) fees = {};
    
    const feesArray = Array.isArray(fees) ?
      fees :
      Object.values(fees);
    
    for (const fee of feesArray) {
      if (
        fee.classId === className &&
        (!studentId || fee.id === studentId)
      ) {
        await deleteIndexedDB('fees', fee.id);
        await guardedAddToSyncQueue(
          `fees/${fee.id}`,
          'delete',
          null
        );
      }
    }
    
    guardedTriggerSync(); // Background sync
    
    alert('Deleted');
    
    const historyClassEl =
      document.getElementById('fees-history-class');
    
    if (historyClassEl && historyClassEl.value) {
      viewFeesHistory();
    } else {
      loadFeesStudents();
    }
    
  } catch (e) {
    console.error('deleteAllFees failed', e);
    alert('Failed to delete fees. Check console for details.');
  } finally {
    hideLoading();
  }
};

window.hideFeesHistory = function() {
  document.getElementById('fees-history').style.display = 'none';
};

console.log("Fees module loaded successfully V2");

})();
