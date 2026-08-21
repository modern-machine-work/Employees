async function initAdminPage() {
  const searchInput = document.getElementById('employeeSearch');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabs = {
    employees: document.getElementById('employeesTab'),
    approvals: document.getElementById('approvalsTab'),
  };
  const editModal = document.getElementById('editAttendanceModal');
  const editForm = document.getElementById('editAttendanceForm');

  let employees = [];
  let monthAttendance = [];
  let pendingAttendance = [];
  let busy = false;

  async function loadAdminData() {
    const [empRows, allAttendance, pendingRows] = await Promise.all([
      apiGet('getEmployees'),
      apiGet('getAttendance'),
      apiGet('getAttendancePending'),
    ]);
    employees = empRows;
    monthAttendance = allAttendance;
    pendingAttendance = pendingRows;
    renderEmployees(employees);
    renderPending(pendingAttendance);
  }

  function getEmployeeMonthStats(empID) {
    const monthKey = getCurrentMonthKey();
    const rows = monthAttendance.filter((row) => String(row.EmployeeID) === String(empID));
    const pendingRows = pendingAttendance.filter((row) => String(row.EmployeeID) === String(empID));
    const monthRows = rows.filter((row) => normalizeDateStr(row.Date).startsWith(monthKey));
    const daysWorked = monthRows.length;
    const hoursWorked = monthRows.reduce((sum, row) => sum + Number(row.WorkMinutes || 0), 0) / 60;
    const todayStr = getTodayDateString();
    const todayApproved = rows
      .filter((row) => normalizeDateStr(row.Date) === todayStr)
      .map((row) => Object.assign({}, row, { _status: 'Approved' }));
    const todayPending = pendingRows
      .filter((row) => normalizeDateStr(row.Date) === todayStr)
      .map((row) => Object.assign({}, row, { _status: 'Pending' }));
    const yesterdayStr = getYesterdayDateString();
    const yesterdayPending = pendingRows
      .filter((row) => normalizeDateStr(row.Date) === yesterdayStr && !row.CheckOut)
      .map((row) => Object.assign({}, row, { _status: 'Pending' }));
    const today = todayApproved.concat(todayPending).concat(yesterdayPending);
    return { daysWorked, hoursWorked, today };
  }

  function computeEarned(employee, stats) {
    const clone = Object.assign({}, employee, {
      _daysWorked: stats.daysWorked,
      _hoursWorked: stats.hoursWorked,
    });
    return calculateEarnedSalary(clone, getCurrentMonthKey());
  }

  function formatTime12Admin(value) {
    if (!value) return '—';
    const parts = String(value).split(':');
    if (parts.length < 2) return value;
    let h = Number(parts[0]);
    const m = String(parts[1]).padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${period}`;
  }

  function renderEmployees(rows) {
    const query = (searchInput?.value || '').toLowerCase();
    const filtered = rows.filter((row) => {
      const name = String(row.EmployeeName || '').toLowerCase();
      const id = String(row.EmployeeID || '').toLowerCase();
      const dept = String(row.Department || '').toLowerCase();
      return name.includes(query) || id.includes(query) || dept.includes(query);
    }).sort((a, b) => String(b.EmployeeID || '').localeCompare(String(a.EmployeeID || '')));

    document.getElementById('employeeCards').innerHTML = filtered.map((row) => {
      const stats = getEmployeeMonthStats(row.EmployeeID);
      const earned = computeEarned(row, stats);
      const todayRows = stats.today;
      let todayHtml = '<p class="muted-text">No attendance today.</p>';
      if (todayRows.length) {
        todayHtml = todayRows.map((t) => {
          const parts = [];
          if (t.CheckIn) parts.push(`<p><strong>Check In:</strong> ${escapeHtml(formatTime12Admin(t.CheckIn))}</p>`);
          if (t.BreakStart) parts.push(`<p><strong>Break:</strong> ${escapeHtml(formatTime12Admin(t.BreakStart))} – ${escapeHtml(formatTime12Admin(t.BreakEnd))}</p>`);
          if (t.CheckOut) parts.push(`<p><strong>Check Out:</strong> ${escapeHtml(formatTime12Admin(t.CheckOut))}</p>`);
          const statusBadge = t._status === 'Pending' ? '<p><span class="badge pending">Pending Approval</span></p>' : '';
          return parts.join('') + statusBadge;
        }).join('');
      }
      return `
      <div class="employee-card">
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
          <h3>${escapeHtml(row.EmployeeName || '—')}</h3>
          <span class="badge ${normalizeStatus(row.Status)}">${escapeHtml(row.Status || 'Inactive')}</span>
        </div>
        <p><strong>ID:</strong> ${escapeHtml(row.EmployeeID || '—')}</p>
        <p><strong>Contact:</strong> ${escapeHtml(row.Contact || '—')}</p>
        <p><strong>Dept:</strong> ${escapeHtml(row.Department || '—')}</p>
        <p><strong>Designation:</strong> ${escapeHtml(row.Designation || '—')}</p>
        <hr class="card-divider">
        <p><strong>Salary Earned (this month):</strong> ${formatCurrency(earned)}</p>
        <p><strong>Days Present (this month):</strong> ${stats.daysWorked}</p>
        <hr class="card-divider">
        <p><strong>Today:</strong></p>
        ${todayHtml}
      </div>`;
    }).join('') || '<p class="muted-text">No employees found.</p>';
  }

  function renderPending(rows) {
    document.getElementById('pendingCount').textContent = rows.length;
    document.getElementById('pendingApprovalsBody').innerHTML = rows.map((row) => {
      const emp = employees.find((e) => String(e.EmployeeID) === String(row.EmployeeID));
      const empName = emp ? emp.EmployeeName : row.EmployeeID;
      return `
        <tr>
          <td><strong>${escapeHtml(empName)}</strong><br><small class="muted-text">${escapeHtml(row.EmployeeID)}</small></td>
          <td>${escapeHtml(formatDateDisplay(row.Date))}</td>
          <td>${escapeHtml(row.CheckIn || '—')}</td>
          <td>${escapeHtml(row.BreakStart || '—')}</td>
          <td>${escapeHtml(row.BreakEnd || '—')}</td>
          <td>${escapeHtml(row.CheckOut || '—')}</td>
          <td>${escapeHtml(row.Remarks || '—')}</td>
          <td class="actions">
            <button class="btn small edit-btn" data-id="${escapeHtml(row.PendingID)}" ${busy ? 'disabled' : ''}>Edit</button>
            <button class="btn small primary approve-btn" data-id="${escapeHtml(row.PendingID)}" ${busy ? 'disabled' : ''}>Approve</button>
            <button class="btn small danger reject-btn" data-id="${escapeHtml(row.PendingID)}" ${busy ? 'disabled' : ''}>Reject</button>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="8" style="text-align:center;">No pending approvals.</td></tr>';
  }

  function setBusy(value) {
    busy = value;
    document.querySelectorAll('.approve-btn, .reject-btn, .edit-btn, #refreshAdminBtn').forEach((btn) => {
      btn.disabled = value;
    });
    const saveBtn = editForm?.querySelector('button[type="submit"]');
    if (saveBtn) saveBtn.disabled = value;
  }

  async function withBusy(fn) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await loadAdminData();
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  }

  function handleApprove(pendingID) {
    if (!confirm('Approve this attendance and move to main ERP?')) return;
    withBusy(() => apiPost('approveAttendance', { PendingID: pendingID }));
  }

  function handleReject(pendingID) {
    if (!confirm('Reject this pending attendance?')) return;
    withBusy(() => apiPost('rejectAttendance', { PendingID: pendingID }));
  }

  function openEdit(pendingID) {
    const row = pendingAttendance.find((r) => String(r.PendingID) === String(pendingID));
    if (!row) return;
    document.getElementById('editPendingID').value = row.PendingID;
    document.getElementById('editDate').value = normalizeDateStr(row.Date);
    document.getElementById('editCheckIn').value = row.CheckIn || '';
    document.getElementById('editBreakStart').value = row.BreakStart || '';
    document.getElementById('editBreakEnd').value = row.BreakEnd || '';
    document.getElementById('editCheckOut').value = row.CheckOut || '';
    document.getElementById('editRemarks').value = row.Remarks || '';
    editModal.classList.remove('hidden');
  }

  editForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    withBusy(async () => {
      const ci = document.getElementById('editCheckIn').value;
      const bs = document.getElementById('editBreakStart').value;
      const be = document.getElementById('editBreakEnd').value;
      const co = document.getElementById('editCheckOut').value;

      let workMinutes = '';
      let otMinutes = '';
      if (ci && co) {
        workMinutes = String(calculateWorkMinutes(ci, co, bs, be));
        otMinutes = String(Math.max(0, Number(workMinutes) - 660));
      }

      const existing = pendingAttendance.find((r) => String(r.PendingID) === document.getElementById('editPendingID').value);
      await apiPost('saveAttendancePending', {
        PendingID: document.getElementById('editPendingID').value,
        EmployeeID: existing?.EmployeeID || '',
        Date: document.getElementById('editDate').value,
        CheckIn: ci,
        BreakStart: bs,
        BreakEnd: be,
        CheckOut: co,
        WorkMinutes: workMinutes,
        OTMinutes: otMinutes,
        Remarks: document.getElementById('editRemarks').value,
      });
      editModal.classList.add('hidden');
    });
  });

  document.getElementById('closeEditAttendanceModal')?.addEventListener('click', () => {
    editModal.classList.add('hidden');
  });

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(tabs).forEach((tab) => tab.classList.add('hidden'));
      tabs[btn.dataset.tab]?.classList.remove('hidden');
    });
  });

  searchInput?.addEventListener('input', () => renderEmployees(employees));

  document.getElementById('approvalsTab')?.addEventListener('click', (event) => {
    const id = event.target.dataset?.id;
    if (!id || busy) return;
    if (event.target.classList.contains('approve-btn')) handleApprove(id);
    else if (event.target.classList.contains('reject-btn')) handleReject(id);
    else if (event.target.classList.contains('edit-btn')) openEdit(id);
  });

  document.getElementById('refreshAdminBtn')?.addEventListener('click', () => {
    if (!busy) withBusy(() => Promise.resolve());
  });

  await loadAdminData();
}

function parseTimeToMinutesAdmin(value) {
  if (!value) return null;
  const parts = String(value).split(':');
  if (parts.length < 2) return null;
  return Number(parts[0]) * 60 + Number(parts[1]);
}
