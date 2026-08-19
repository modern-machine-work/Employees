async function initEmployeePage() {
  const employeeID = getEmployeeID();
  if (!employeeID) {
    alert('No employee linked to this user. Contact admin.');
    return;
  }

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();
  let approved = [];
  let pending = [];
  let me = null;

  async function loadData() {
    const [employees, myAttendance] = await Promise.all([
      apiGet('getEmployees'),
      apiGet('getMyAttendance', { employeeID }),
    ]);

    me = employees.find((row) => String(row.EmployeeID) === String(employeeID));
    if (!me) {
      alert('Employee record not found.');
      return;
    }

    approved = myAttendance.approved || [];
    pending = myAttendance.pending || [];

    const monthKey = getCurrentMonthKey();
    const approvedDates = approved.map((row) => normalizeDateStr(row.Date));
    const daysWorked = approvedDates.filter((d) => d.startsWith(monthKey)).length;
    const hoursWorked = approved
      .filter((row) => String(row.Date || '').slice(0, 7) === monthKey)
      .reduce((sum, row) => sum + Number(row.WorkMinutes || 0), 0) / 60;

    me._daysWorked = daysWorked;
    me._hoursWorked = hoursWorked;

    renderHeader(me);
    renderDetails(me);
    renderTodayCard();
    renderCalendar(currentYear, currentMonth);
  }

  function renderHeader(employee) {
    document.getElementById('employeePageTitle').textContent = employee.EmployeeName || 'My Portal';

    const earned = calculateEarnedSalary(employee, getCurrentMonthKey());
    document.getElementById('earnedSalary').textContent = formatCurrency(earned);
    document.getElementById('daysPresent').textContent = employee._daysWorked;

    const todayStr = getTodayDateString();
    const presentToday = approved.some((row) => normalizeDateStr(row.Date) === todayStr)
      || pending.some((row) => normalizeDateStr(row.Date) === todayStr && row.CheckIn);
    document.getElementById('currentStatus').textContent = presentToday ? 'Present Today' : 'Absent Today';
  }

  function renderDetails(employee) {
    document.getElementById('employeeDetails').innerHTML = [
      ['Employee ID', employee.EmployeeID],
      ['Name', employee.EmployeeName],
      ['Contact', employee.Contact],
      ['Department', employee.Department],
      ['Designation', employee.Designation],
      ['Monthly Salary', formatCurrency(employee.MonthlySalary || 0)],
    ].map(([label, value]) => `
      <div class="detail-item">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || '—')}</strong>
      </div>
    `).join('');
  }

  function getTodayApproved() {
    const todayStr = getTodayDateString();
    return approved.find((row) => normalizeDateStr(row.Date) === todayStr) || null;
  }

  function getTodayPending() {
    const todayStr = getTodayDateString();
    return pending
      .filter((row) => normalizeDateStr(row.Date) === todayStr && String(row.Status || '').toLowerCase() === 'pending')
      .sort((a, b) => String(b.PendingID).localeCompare(String(a.PendingID)))[0] || null;
  }

  function formatTime12(value) {
    if (!value) return '—';
    const mins = parseTimeToMinutes(value);
    if (mins === null) return value;
    let h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, '0')} ${period}`;
  }

  function renderTodayCard() {
    const stepMain = document.getElementById('stepMain');
    const stepBreak = document.getElementById('stepBreak');
    const btnMain = document.getElementById('btnMainAction');
    const btnBreak = document.getElementById('btnBreak');
    const mainLabel = document.getElementById('mainActionLabel');
    const breakLabel = document.getElementById('breakLabel');
    const badge = document.getElementById('todayStatusBadge');
    const note = document.getElementById('attendanceNote');
    const summary = document.getElementById('attSummary');

    const record = getTodayApproved() || getTodayPending();
    const isPending = !getTodayApproved() && Boolean(getTodayPending());

    const ci = record?.CheckIn || '';
    const bs = record?.BreakStart || '';
    const be = record?.BreakEnd || '';
    const co = record?.CheckOut || '';

    // Summary box
    const hasAny = ci || bs || be || co;
    summary.classList.toggle('hidden', !hasAny);
    document.getElementById('sumCheckIn').textContent = formatTime12(ci);
    document.getElementById('sumBreakStart').textContent = formatTime12(bs);
    document.getElementById('sumBreakEnd').textContent = formatTime12(be);
    document.getElementById('sumCheckOut').textContent = formatTime12(co);

    // Main action: Check In → Check Out → (after complete) Check In starts a new session
    if (!ci) {
      mainField = 'CheckIn';
      mainLabel.textContent = 'Check In';
      btnMain.textContent = 'Check In';
      btnMain.disabled = false;
    } else if (!co) {
      mainField = 'CheckOut';
      mainLabel.textContent = 'Check Out';
      btnMain.textContent = 'Check Out';
      btnMain.disabled = Boolean(bs) && !be; // cannot check out while on break
    } else {
      mainField = 'CheckIn';
      mainLabel.textContent = 'Check In Again';
      btnMain.textContent = 'Check In';
      btnMain.disabled = false;
    }

    // Break box: after check-in, before check-out, hidden once break ended
    const showBreak = Boolean(ci) && !co && !be;
    stepBreak.classList.toggle('hidden', !showBreak);
    if (showBreak) {
      if (!bs) {
        breakField = 'BreakStart';
        breakLabel.textContent = 'Break Start';
        btnBreak.textContent = 'Break Start';
      } else {
        breakField = 'BreakEnd';
        breakLabel.textContent = 'Break End';
        btnBreak.textContent = 'Break End';
      }
    }

    if (co) {
      badge.textContent = isPending ? 'Waiting Approval' : 'Checked Out';
      badge.className = 'badge ' + (isPending ? 'pending' : 'done');
    } else if (ci && bs && !be) {
      badge.textContent = 'On Break';
      badge.className = 'badge pending';
    } else if (ci) {
      badge.textContent = isPending ? 'Waiting Approval' : 'Checked In';
      badge.className = 'badge ' + (isPending ? 'pending' : 'active');
    } else {
      badge.textContent = 'Not Checked In';
      badge.className = 'badge pending';
    }

    if (record && ci && co) {
      note.textContent = 'Session complete — waiting for admin approval. Tap "Check In" to start a new session.';
    } else if (ci && bs && !be) {
      note.textContent = 'On break. Tap "Break End" when you resume work.';
    } else if (ci) {
      note.textContent = 'You are checked in. Tap "Check Out" at day end.';
    } else {
      note.textContent = 'Tap "Check In" to start your day.';
    }
  }

  function nowTime() {
    const now = new Date();
    const minutes = now.getMinutes();
    let hours = now.getHours();
    if (minutes >= 55) {
      hours = (hours + 1) % 24;
    }
    const rounded = minutes <= 5 ? 0 : minutes;
    return `${String(hours).padStart(2, '0')}:${String(rounded).padStart(2, '0')}`;
  }

  let breakField = 'BreakStart';
  let mainField = 'CheckIn';
  let submitting = false;

  function setActionButtonsEnabled(enabled) {
    ['btnMainAction', 'btnBreak', 'prevMonthBtn', 'nextMonthBtn'].forEach((id) => {
      const node = document.getElementById(id);
      if (node && !node.disabled) node.disabled = !enabled;
    });
  }

  async function submitStep(field) {
    if (submitting) return;
    submitting = true;
    setActionButtonsEnabled(false);

    try {
      const time = nowTime();
      const existing = getTodayPending() || getTodayApproved() || {};

      // Re-check-in after a completed session starts a fresh pending record
      if (field === 'CheckIn' && existing.CheckIn && existing.CheckOut) {
        await apiPost('saveAttendancePending', {
          EmployeeID: employeeID,
          Date: getTodayDateString(),
          CheckIn: time,
          BreakStart: '',
          BreakEnd: '',
          CheckOut: '',
          WorkMinutes: '',
          OTMinutes: '',
          Remarks: '',
        });
        await loadData();
        return;
      }

      const ci = field === 'CheckIn' ? time : (existing.CheckIn || '');
      const bs = field === 'BreakStart' ? time : (existing.BreakStart || '');
      const be = field === 'BreakEnd' ? time : (existing.BreakEnd || '');
      const co = field === 'CheckOut' ? time : (existing.CheckOut || '');

      let workMinutes = '';
      let otMinutes = '';
      if (ci && co) {
        workMinutes = String(calculateWorkMinutes(ci, co, bs, be));
        otMinutes = String(Math.max(0, Number(workMinutes) - 660));
      }

      await apiPost('saveAttendancePending', {
        PendingID: existing.PendingID || undefined,
        EmployeeID: employeeID,
        Date: getTodayDateString(),
        CheckIn: ci,
        BreakStart: bs,
        BreakEnd: be,
        CheckOut: co,
        WorkMinutes: workMinutes,
        OTMinutes: otMinutes,
        Remarks: existing.Remarks || '',
      });
      await loadData();
    } catch (error) {
      alert(error.message);
    } finally {
      submitting = false;
      ['prevMonthBtn', 'nextMonthBtn'].forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.disabled = false;
      });
    }
  }

  document.getElementById('btnMainAction')?.addEventListener('click', () => {
    if (mainField) submitStep(mainField);
  });
  document.getElementById('btnBreak')?.addEventListener('click', () => submitStep(breakField));

  function renderCalendar(year, month) {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const approvedDates = new Set(
      approved
        .map((row) => normalizeDateStr(row.Date))
        .filter((d) => d.startsWith(monthKey))
    );
    const pendingDates = new Set(
      pending
        .filter((row) => String(row.Status || '').toLowerCase() === 'pending')
        .map((row) => normalizeDateStr(row.Date))
        .filter((d) => d.startsWith(monthKey))
    );

    const weeks = buildCalendarGrid(year, month, approvedDates);
    const todayStr = getTodayDateString();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    document.getElementById('calendarMonthLabel').textContent = `${monthNames[month]} ${year}`;

    let html = '';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) => {
      html += `<div class="calendar-header">${d}</div>`;
    });

    weeks.forEach((week) => {
      week.forEach((cell) => {
        if (!cell) {
          html += '<div class="calendar-day empty"></div>';
          return;
        }
        const isPending = !cell.present && pendingDates.has(cell.date);
        const cls = cell.present ? 'present' : (isPending ? 'pending-day' : 'absent');
        const isToday = cell.date === todayStr ? ' today' : '';
        html += `<div class="calendar-day ${cls}${isToday}" data-date="${cell.date}">${cell.day}</div>`;
      });
    });

    document.getElementById('attendanceCalendar').innerHTML = html;
  }

  function showDayDetail(dateStr) {
    const rows = approved.filter((row) => normalizeDateStr(row.Date) === dateStr);
    const pendingRows = pending.filter((row) =>
      normalizeDateStr(row.Date) === dateStr && String(row.Status || '').toLowerCase() === 'pending');
    if (!rows.length && !pendingRows.length) return;

    let totalMinutes = 0;
    let totalOTMinutes = 0;
    const renderSession = (row, status) => {
      const mins = Number(row.WorkMinutes || 0);
      const otMins = Number(row.OTMinutes || 0);
      if (status === 'approved') {
        totalMinutes += mins;
        totalOTMinutes += otMins;
      }
      const chips = [];
      if (row.CheckIn) chips.push(`<div class="daychip"><span>Check In</span><strong>${formatTime12(row.CheckIn)}</strong></div>`);
      if (row.BreakStart) chips.push(`<div class="daychip"><span>Break</span><strong>${formatTime12(row.BreakStart)} – ${formatTime12(row.BreakEnd)}</strong></div>`);
      if (row.CheckOut) chips.push(`<div class="daychip"><span>Check Out</span><strong>${formatTime12(row.CheckOut)}</strong></div>`);
      const hoursStr = mins ? `${minutesToHours(mins)} hrs` : '<span class="muted-text">In progress</span>';
      const otStr = otMins ? ` + ${minutesToHours(otMins)} hrs` : '';
      return `
        <div class="day-session">
          <div class="day-session-head">
            <span class="badge ${status === 'approved' ? 'done' : 'pending'}">${status === 'approved' ? 'Approved' : 'Pending'}</span>
            <span class="day-hours">${hoursStr}${otStr}</span>
          </div>
          <div class="daychip-row">${chips.join('')}</div>
        </div>`;
    };

    document.getElementById('dayDetailTitle').textContent = formatDateDisplay(dateStr);
    document.getElementById('dayDetailBody').innerHTML =
      rows.map((r) => renderSession(r, 'approved')).join('') +
      pendingRows.map((r) => renderSession(r, 'pending')).join('');
    
    let totalText = `Total: ${minutesToHours(totalMinutes)} hours`;
    if (totalOTMinutes > 0) {
      totalText += ` (OT : ${minutesToHours(totalOTMinutes)} hours)`;
    }
    document.getElementById('dayDetailTotal').textContent = totalText;
    document.getElementById('dayDetailModal').classList.remove('hidden');
  }

  document.getElementById('closeDayDetailModal')?.addEventListener('click', () => {
    document.getElementById('dayDetailModal').classList.add('hidden');
  });

  document.getElementById('attendanceCalendar')?.addEventListener('click', (event) => {
    const dayNode = event.target.closest('.calendar-day');
    if (!dayNode || dayNode.classList.contains('empty') || !dayNode.dataset.date) return;
    showDayDetail(dayNode.dataset.date);
  });

  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    currentMonth -= 1;
    if (currentMonth < 0) { currentMonth = 11; currentYear -= 1; }
    renderCalendar(currentYear, currentMonth);
  });

  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    currentMonth += 1;
    if (currentMonth > 11) { currentMonth = 0; currentYear += 1; }
    renderCalendar(currentYear, currentMonth);
  });

  await loadData();
}

function calculateWorkMinutes(inTime, outTime, breakStart, breakEnd) {
  const inMins = parseTimeToMinutes(inTime);
  const outMins = parseTimeToMinutes(outTime);
  if (inMins === null || outMins === null) return 0;

  let total = outMins - inMins;
  if (total < 0) total += 24 * 60;

  const bStart = parseTimeToMinutes(breakStart);
  const bEnd = parseTimeToMinutes(breakEnd);
  if (bStart !== null && bEnd !== null && bEnd > bStart) {
    total -= (bEnd - bStart);
  }

  return Math.max(total, 0);
}

function parseTimeToMinutes(value) {
  if (!value) return null;
  const parts = String(value).split(':');
  if (parts.length < 2) return null;
  return Number(parts[0]) * 60 + Number(parts[1]);
}
