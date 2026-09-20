// Niloufar Barbershop - Production booking frontend with Persian (Jalali) calendar
const BOOKING_API_URL = "https://eahlaxmbsndvsdpwwlao.supabase.co/functions/v1/booking-api";

const TIME_SLOTS = Array.from({length: 15}, (_, index) => {
  const total = 18 * 60 + index * 20;
  const hour = String(Math.floor(total / 60)).padStart(2, "0");
  const minute = String(total % 60).padStart(2, "0");
  return `${hour}:${minute}`;
});
let bookedTimes = new Set();
let bookedTimesDate = "";
let calendarMonthStart = null;
let selectedDayFull = false;
let lastReceiptData = null;
const RECEIPT_SITE_URL = "https://mahdihp17.github.io/niloufar-barbershop/";

const persianPartsFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric"
});
const persianLongDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric"
});
const persianMonthFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long"
});
const persianNumberFormatter = new Intl.NumberFormat("fa-IR", { useGrouping: false });

const els = {
  form: document.getElementById("bookingForm"),
  name: document.getElementById("name"),
  phone: document.getElementById("phone"),
  service: document.getElementById("service"),
  date: document.getElementById("date"),
  datePickerBtn: document.getElementById("datePickerBtn"),
  selectedDateLabel: document.getElementById("selectedDateLabel"),
  dateHint: document.getElementById("dateHint"),
  dateModal: document.getElementById("dateModal"),
  calendarDays: document.getElementById("calendarDays"),
  calendarMonthLabel: document.getElementById("calendarMonthLabel"),
  calendarPrevMonth: document.getElementById("calendarPrevMonth"),
  calendarNextMonth: document.getElementById("calendarNextMonth"),
  time: document.getElementById("time"),
  timePickerBtn: document.getElementById("timePickerBtn"),
  selectedTimeLabel: document.getElementById("selectedTimeLabel"),
  product: document.getElementById("product"),
  formMessage: document.getElementById("formMessage"),
  timeModal: document.getElementById("timeModal"),
  timeSlots: document.getElementById("timeSlots"),
  successModal: document.getElementById("successModal"),
  successText: document.getElementById("successText")
};

const toEnglishDigits = (value = "") => String(value)
  .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
  .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

function apiConfigured() {
  return BOOKING_API_URL.startsWith("https://") && !BOOKING_API_URL.includes("YOUR_PROJECT_REF");
}

function normalizeDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function todayLocal() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return new Date(Number(map.year), Number(map.month) - 1, Number(map.day), 12, 0, 0, 0);
}

function addDays(date, amount) {
  const copy = normalizeDate(date);
  copy.setDate(copy.getDate() + amount);
  return normalizeDate(copy);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function getPersianParts(date) {
  const parts = {};
  persianPartsFormatter.formatToParts(date).forEach(part => {
    if (["year", "month", "day"].includes(part.type)) {
      parts[part.type] = Number(toEnglishDigits(part.value));
    }
  });
  return parts;
}

function findPersianMonthStart(date) {
  const normalized = normalizeDate(date);
  const { day } = getPersianParts(normalized);
  return addDays(normalized, -(day - 1));
}

function nextPersianMonthStart(monthStart) {
  return findPersianMonthStart(addDays(monthStart, 32));
}

function previousPersianMonthStart(monthStart) {
  return findPersianMonthStart(addDays(monthStart, -1));
}

function isFriday(dateString) {
  if (!dateString) return false;
  return fromIsoDate(dateString).getDay() === 5;
}

function formatDateFa(dateString) {
  if (!dateString) return "";
  return persianLongDateFormatter.format(fromIsoDate(dateString));
}

function showFormError(message) {
  els.formMessage.textContent = message;
  els.formMessage.className = "form-message error";
}

function clearFormError() {
  els.formMessage.textContent = "";
  els.formMessage.className = "form-message";
}

function resetSelectedTime() {
  els.time.value = "";
  els.selectedTimeLabel.textContent = "انتخاب ساعت";
}

function resetSelectedDate() {
  els.date.value = "";
  els.selectedDateLabel.textContent = "انتخاب تاریخ شمسی";
}

function renderCalendar() {
  if (!calendarMonthStart) calendarMonthStart = findPersianMonthStart(todayLocal());

  const targetParts = getPersianParts(calendarMonthStart);
  const today = todayLocal();
  const selectedIso = els.date.value;

  els.calendarMonthLabel.textContent = persianMonthFormatter.format(calendarMonthStart);
  els.calendarDays.innerHTML = "";

  // JavaScript: Sunday=0 ... Friday=5, Saturday=6. Calendar starts on Saturday.
  const saturdayOffset = (calendarMonthStart.getDay() + 1) % 7;
  const gridStart = addDays(calendarMonthStart, -saturdayOffset);

  for (let index = 0; index < 42; index += 1) {
    const cellDate = addDays(gridStart, index);
    const cellParts = getPersianParts(cellDate);
    const iso = toIsoDate(cellDate);
    const inCurrentMonth = cellParts.year === targetParts.year && cellParts.month === targetParts.month;
    const isPast = cellDate < today;
    const friday = cellDate.getDay() === 5;
    const selected = selectedIso === iso;
    const isToday = isSameDate(cellDate, today);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = persianNumberFormatter.format(cellParts.day);
    button.dataset.iso = iso;

    if (!inCurrentMonth) button.classList.add("outside");
    if (friday) button.classList.add("friday");
    if (selected) button.classList.add("selected");
    if (isToday) button.classList.add("today");

    button.disabled = !inCurrentMonth || isPast || friday;

    if (friday && inCurrentMonth) button.title = "جمعه تعطیل است";
    else if (isPast && inCurrentMonth) button.title = "این تاریخ گذشته است";

    button.addEventListener("click", () => selectCalendarDate(cellDate));
    els.calendarDays.appendChild(button);
  }

  const previousMonthLastDay = addDays(calendarMonthStart, -1);
  els.calendarPrevMonth.disabled = previousMonthLastDay < today;
}

function openDateModal() {
  clearFormError();
  calendarMonthStart = els.date.value
    ? findPersianMonthStart(fromIsoDate(els.date.value))
    : findPersianMonthStart(todayLocal());

  renderCalendar();
  els.dateModal.classList.add("show");
  els.dateModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeDateModal() {
  els.dateModal.classList.remove("show");
  els.dateModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function selectCalendarDate(date) {
  const iso = toIsoDate(date);
  els.date.value = iso;
  els.selectedDateLabel.textContent = formatDateFa(iso);
  closeDateModal();
  handleDateSelection();
}

function handleDateSelection() {
  clearFormError();
  resetSelectedTime();
  bookedTimes = new Set();
  bookedTimesDate = "";
  selectedDayFull = false;

  if (!els.date.value) {
    els.timePickerBtn.disabled = true;
    els.selectedTimeLabel.textContent = "ابتدا تاریخ را انتخاب کن";
    return;
  }

  if (isFriday(els.date.value)) {
    els.timePickerBtn.disabled = true;
    els.selectedTimeLabel.textContent = "جمعه تعطیل است";
    els.dateHint.textContent = "این تاریخ جمعه است؛ لطفاً روز دیگری را انتخاب کن.";
    els.dateHint.style.color = "#ff9ba7";
    return;
  }

  els.dateHint.textContent = `تاریخ انتخابی: ${formatDateFa(els.date.value)}`;
  els.dateHint.style.color = "";
  els.timePickerBtn.disabled = false;
  els.selectedTimeLabel.textContent = "انتخاب ساعت";
}

async function fetchBookedTimes(date) {
  if (!apiConfigured()) throw new Error("API_NOT_CONFIGURED");

  const response = await fetch(`${BOOKING_API_URL}?date=${encodeURIComponent(date)}`, {
    method: "GET",
    headers: { "Accept": "application/json" },
    cache: "no-store"
  });

  if (!response.ok) throw new Error("AVAILABILITY_ERROR");
  const result = await response.json();
  bookedTimes = new Set(result.bookedTimes || []);
  bookedTimesDate = date;
  selectedDayFull = Boolean(result.capacityFull);
  return result;
}


function isPastTimeToday(time, dateString) {
  const today = todayLocal();
  const selected = fromIsoDate(dateString);
  if (!isSameDate(today, selected)) return false;

  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const map = Object.fromEntries(nowParts.map(p => [p.type, p.value]));
  const currentMinutes = Number(map.hour) * 60 + Number(map.minute);
  const [h, m] = time.split(":").map(Number);

  return h * 60 + m <= currentMinutes;
}

function renderTimeSlots() {
  const date = els.date.value;
  els.timeSlots.innerHTML = "";

  if (selectedDayFull) {
    const full = document.createElement("div");
    full.className = "capacity-full";
    full.innerHTML = `
      <i data-lucide="calendar-x-2"></i>
      <strong>ظرفیت رزرو امروز تکمیل شده می‌باشد</strong>
      <span>لطفاً یک روز دیگر را از تقویم انتخاب کنید.</span>
    `;
    els.timeSlots.appendChild(full);
    if (window.lucide) lucide.createIcons();
    return;
  }

  let availableCount = 0;

  TIME_SLOTS.forEach(time => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "time-slot";

    const booked = bookedTimesDate === date && bookedTimes.has(time);
    const passed = isPastTimeToday(time, date);
    const disabled = booked || passed;

    if (!disabled) availableCount += 1;

    button.disabled = disabled;

    const stateLabel = booked ? "رزرو شده" : passed ? "گذشته" : "آزاد";
    button.innerHTML = `<span>${time}</span><small>${stateLabel}</small>`;

    if (booked) {
      button.classList.add("booked");
      button.setAttribute("aria-label", `${time} رزرو شده`);
    }

    if (passed) {
      button.classList.add("passed");
      button.setAttribute("aria-label", `${time} گذشته است`);
    }

    if (els.time.value === time) button.classList.add("selected");

    button.addEventListener("click", () => {
      els.time.value = time;
      els.selectedTimeLabel.textContent = time;
      closeTimeModal();
      clearFormError();
    });

    els.timeSlots.appendChild(button);
  });

  // Today may have no usable time left even though some slots were not booked.
  if (availableCount === 0) {
    els.timeSlots.innerHTML = "";
    const full = document.createElement("div");
    full.className = "capacity-full";
    full.innerHTML = `
      <i data-lucide="clock-alert"></i>
      <strong>برای امروز زمان قابل رزروی باقی نمانده است</strong>
      <span>لطفاً یک روز دیگر را انتخاب کنید.</span>
    `;
    els.timeSlots.appendChild(full);
    if (window.lucide) lucide.createIcons();
  }
}

async function openTimeModal() {
  if (!els.date.value || isFriday(els.date.value)) return;

  els.timePickerBtn.disabled = true;
  els.selectedTimeLabel.textContent = "در حال بررسی زمان‌ها...";

  try {
    const availability = await fetchBookedTimes(els.date.value);
    renderTimeSlots();
    if (availability.capacityFull) {
      els.selectedTimeLabel.textContent = "ظرفیت تکمیل شده";
    }
    els.timeModal.classList.add("show");
    els.timeModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (!selectedDayFull) {
      els.selectedTimeLabel.textContent = els.time.value || "انتخاب ساعت";
    }
  } catch {
    showFormError("امکان دریافت زمان‌های آزاد وجود ندارد. لطفاً دوباره تلاش کن.");
    els.selectedTimeLabel.textContent = "انتخاب ساعت";
  } finally {
    els.timePickerBtn.disabled = false;
  }
}

function closeTimeModal() {
  els.timeModal.classList.remove("show");
  els.timeModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}


function ensureReceiptDownloadButton() {
  let button = document.getElementById("downloadReceiptBtn");
  if (button) return button;

  const closeButton = els.successModal.querySelector(".success-card [data-close-success]");
  if (!closeButton) return null;

  button = document.createElement("button");
  button.id = "downloadReceiptBtn";
  button.type = "button";
  button.className = "btn receipt-download-btn";
  button.innerHTML = '<i data-lucide="download"></i> دانلود رسید تصویری';
  button.addEventListener("click", downloadReceiptImage);

  closeButton.before(button);
  if (window.lucide) lucide.createIcons();
  return button;
}

function toPersianDigits(value = "") {
  return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function receiptRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawReceiptWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }

  if (line && lines.length < maxLines) {
    const usedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
    const remaining = words.slice(usedWords).join(" ");
    let finalLine = remaining || line;

    while (ctx.measureText(finalLine).width > maxWidth && finalLine.length > 1) {
      finalLine = finalLine.slice(0, -1);
    }

    if (remaining && finalLine.length < remaining.length) finalLine = `${finalLine.trim()}…`;
    lines.push(finalLine);
  }

  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

async function createReceiptCanvas(receipt) {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch {}
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#080b12");
  bg.addColorStop(0.5, "#0f1520");
  bg.addColorStop(1, "#081713");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow1 = ctx.createRadialGradient(900, 120, 0, 900, 120, 430);
  glow1.addColorStop(0, "rgba(124,156,255,0.20)");
  glow1.addColorStop(1, "rgba(124,156,255,0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(140, 1080, 0, 140, 1080, 420);
  glow2.addColorStop(0, "rgba(72,215,189,0.15)");
  glow2.addColorStop(1, "rgba(72,215,189,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Main receipt panel
  receiptRoundedRect(ctx, 70, 60, 940, 1230, 46);
  ctx.fillStyle = "rgba(255,255,255,0.055)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Brand mark
  const brandGradient = ctx.createLinearGradient(110, 100, 210, 200);
  brandGradient.addColorStop(0, "#8aa5ff");
  brandGradient.addColorStop(1, "#67dbc5");
  ctx.beginPath();
  ctx.arc(150, 150, 54, 0, Math.PI * 2);
  ctx.fillStyle = brandGradient;
  ctx.fill();

  ctx.fillStyle = "#08101a";
  ctx.font = '900 58px "Vazirmatn", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", 150, 155);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillStyle = "#f7f8fb";
  ctx.font = '800 38px "Vazirmatn", sans-serif';
  ctx.fillText("آرایشگاه مردانه نیلوفر", 940, 132);

  ctx.fillStyle = "#a9b1c2";
  ctx.font = '500 24px "Vazirmatn", sans-serif';
  ctx.fillText("رسید رزرو آنلاین نوبت", 940, 174);

  // Success pill
  receiptRoundedRect(ctx, 110, 230, 860, 78, 24);
  ctx.fillStyle = "rgba(72,215,189,0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(72,215,189,0.24)";
  ctx.stroke();

  ctx.fillStyle = "#9ae9d7";
  ctx.font = '700 27px "Vazirmatn", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("رزرو با موفقیت ثبت شده است", 540, 280);

  // Booking code
  ctx.textAlign = "right";
  ctx.fillStyle = "#a9b1c2";
  ctx.font = '500 22px "Vazirmatn", sans-serif';
  ctx.fillText("کد رزرو", 920, 365);

  receiptRoundedRect(ctx, 110, 390, 860, 88, 20);
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.stroke();

  ctx.direction = "ltr";
  ctx.textAlign = "center";
  ctx.fillStyle = "#dce4ff";
  ctx.font = '600 25px monospace';
  ctx.fillText(receipt.bookingId || "ثبت‌شده", 540, 445);

  const rows = [
    ["نام و نام خانوادگی", receipt.name],
    ["شماره موبایل", toPersianDigits(receipt.phone)],
    ["خدمت", receipt.serviceLabel || receipt.service],
    ["محصول", receipt.productLabel || receipt.product || "بدون محصول"],
    ["تاریخ", formatDateFa(receipt.date)],
    ["ساعت", toPersianDigits(receipt.time)],
    ["روش پرداخت", "پرداخت در محل"],
  ];

  let y = 545;
  for (const [label, value] of rows) {
    ctx.direction = "rtl";
    ctx.textAlign = "right";

    ctx.fillStyle = "#8e99ad";
    ctx.font = '500 21px "Vazirmatn", sans-serif';
    ctx.fillText(label, 920, y);

    ctx.fillStyle = "#f7f8fb";
    ctx.font = '700 27px "Vazirmatn", sans-serif';
    y = drawReceiptWrappedText(ctx, value, 920, y + 38, 760, 38, 2);
    y += 26;

    ctx.beginPath();
    ctx.moveTo(150, y);
    ctx.lineTo(930, y);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();
    y += 42;
  }

  // Footer
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillStyle = "#a9b1c2";
  ctx.font = '500 21px "Vazirmatn", sans-serif';
  ctx.fillText("لطفاً در زمان انتخاب‌شده در آرایشگاه حضور داشته باشید.", 540, 1190);

  ctx.direction = "ltr";
  ctx.fillStyle = "#8aa5ff";
  ctx.font = '600 20px sans-serif';
  ctx.fillText(RECEIPT_SITE_URL.replace(/^https?:\/\//, ""), 540, 1240);

  ctx.direction = "rtl";
  ctx.fillStyle = "#697489";
  ctx.font = '500 18px "Vazirmatn", sans-serif';
  ctx.fillText("این رسید به‌صورت خودکار پس از ثبت رزرو ساخته شده است.", 540, 1275);

  return canvas;
}

async function downloadReceiptImage() {
  if (!lastReceiptData) return;

  const button = document.getElementById("downloadReceiptBtn");
  const oldHtml = button ? button.innerHTML : "";

  if (button) {
    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader-circle"></i> در حال ساخت رسید';
    if (window.lucide) lucide.createIcons();
  }

  try {
    const canvas = await createReceiptCanvas(lastReceiptData);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 1));
    if (!blob) throw new Error("RECEIPT_EXPORT_FAILED");

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const shortId = (lastReceiptData.bookingId || "booking").slice(0, 8);
    link.href = url;
    link.download = `niloufar-receipt-${shortId}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch {
    showFormError("ساخت تصویر رسید انجام نشد. لطفاً دوباره تلاش کن.");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = oldHtml;
      if (window.lucide) lucide.createIcons();
    }
  }
}

function openSuccessModal(booking) {
  lastReceiptData = booking;
  ensureReceiptDownloadButton();
  els.successText.textContent = `${booking.name}، نوبت شما برای ${formatDateFa(booking.date)} ساعت ${booking.time} ثبت شد. روش پرداخت: پرداخت در محل.`;
  els.successModal.classList.add("show");
  els.successModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  if (window.lucide) lucide.createIcons();
}

function closeSuccessModal() {
  els.successModal.classList.remove("show");
  els.successModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function validatePhone(phone) {
  const clean = toEnglishDigits(phone).replace(/\s+/g, "");
  return /^09\d{9}$/.test(clean);
}

async function createBooking(booking) {
  if (!apiConfigured()) throw new Error("API_NOT_CONFIGURED");

  const response = await fetch(BOOKING_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(booking)
  });

  const result = await response.json().catch(() => ({}));
  const knownErrors = ["SLOT_TAKEN", "DAY_FULL", "TIME_PASSED"];
  if (!response.ok && knownErrors.includes(result.error)) {
    const error = new Error(result.error);
    error.code = result.error;
    throw error;
  }
  if (!response.ok) throw new Error(result.error || "BOOKING_API_ERROR");
  return result;
}

els.datePickerBtn.addEventListener("click", openDateModal);
els.calendarPrevMonth.addEventListener("click", () => {
  if (els.calendarPrevMonth.disabled) return;
  calendarMonthStart = previousPersianMonthStart(calendarMonthStart);
  renderCalendar();
});
els.calendarNextMonth.addEventListener("click", () => {
  calendarMonthStart = nextPersianMonthStart(calendarMonthStart);
  renderCalendar();
});

document.querySelectorAll("[data-close-date-modal]").forEach(el => el.addEventListener("click", closeDateModal));
els.timePickerBtn.addEventListener("click", openTimeModal);
document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeTimeModal));
document.querySelectorAll("[data-close-success]").forEach(el => el.addEventListener("click", closeSuccessModal));

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeDateModal();
    closeTimeModal();
    closeSuccessModal();
  }
});

document.querySelectorAll(".choose-service").forEach(button => {
  button.addEventListener("click", () => {
    els.service.value = button.dataset.service;
    document.getElementById("booking").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => els.name.focus({ preventScroll: true }), 450);
  });
});

els.phone.addEventListener("input", () => {
  els.phone.value = toEnglishDigits(els.phone.value).replace(/\D/g, "").slice(0, 11);
});

els.form.addEventListener("submit", async event => {
  event.preventDefault();
  clearFormError();

  const booking = {
    name: els.name.value.trim(),
    phone: toEnglishDigits(els.phone.value.trim()),
    service: els.service.value,
    date: els.date.value,
    time: els.time.value,
    product: els.product.value || "بدون محصول",
    payment: "پرداخت در محل"
  };

  if (!booking.name || !booking.service || !booking.date || !booking.time) {
    showFormError("لطفاً تمام فیلدهای ضروری را کامل کن.");
    return;
  }

  if (!validatePhone(booking.phone)) {
    showFormError("شماره موبایل باید با 09 شروع شود و 11 رقم باشد.");
    return;
  }

  if (isFriday(booking.date)) {
    showFormError("جمعه‌ها آرایشگاه تعطیل است. یک روز دیگر را انتخاب کن.");
    return;
  }

  const submitButton = els.form.querySelector("button[type='submit']");
  const originalText = submitButton.innerHTML;

  submitButton.disabled = true;
  submitButton.innerHTML = '<i data-lucide="loader-circle"></i> در حال ثبت رزرو';
  if (window.lucide) lucide.createIcons();

  try {
    const serviceLabel = els.service.options[els.service.selectedIndex]?.textContent?.trim() || booking.service;
    const productLabel = els.product.options[els.product.selectedIndex]?.textContent?.trim() || booking.product;
    const result = await createBooking(booking);

    openSuccessModal({
      ...booking,
      serviceLabel,
      productLabel,
      bookingId: result?.booking?.id || result?.bookingId || ""
    });

    els.form.reset();
    bookedTimes = new Set();
    bookedTimesDate = "";
    selectedDayFull = false;
    resetSelectedDate();
    resetSelectedTime();
    els.timePickerBtn.disabled = true;
    els.selectedTimeLabel.textContent = "ابتدا تاریخ را انتخاب کن";
    els.dateHint.textContent = "تقویم شمسی است؛ جمعه‌ها امکان رزرو وجود ندارد.";
    els.dateHint.style.color = "";
  } catch (error) {
    if (error.code === "SLOT_TAKEN" || error.message === "SLOT_TAKEN") {
      resetSelectedTime();
      try { await fetchBookedTimes(booking.date); } catch {}
      showFormError("این زمان همین الان توسط شخص دیگری رزرو شد. لطفاً یکی از زمان‌های آزاد را انتخاب کن.");
    } else if (error.code === "DAY_FULL" || error.message === "DAY_FULL") {
      resetSelectedTime();
      selectedDayFull = true;
      els.timePickerBtn.disabled = true;
      els.selectedTimeLabel.textContent = "ظرفیت تکمیل شده";
      showFormError("ظرفیت رزرو امروز تکمیل شده می‌باشد. لطفاً یک روز دیگر را انتخاب کن.");
    } else if (error.code === "TIME_PASSED" || error.message === "TIME_PASSED") {
      resetSelectedTime();
      try { await fetchBookedTimes(booking.date); } catch {}
      showFormError("زمان انتخاب‌شده گذشته است. لطفاً یک زمان جدید انتخاب کن.");
    } else if (error.message === "API_NOT_CONFIGURED") {
      showFormError("اتصال رزرو هنوز پیکربندی نشده است.");
    } else {
      showFormError("ثبت رزرو انجام نشد. لطفاً دوباره تلاش کن.");
    }
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
    if (window.lucide) lucide.createIcons();
  }
});

const currentPersianYear = getPersianParts(todayLocal()).year;
document.getElementById("year").textContent = persianNumberFormatter.format(currentPersianYear);
if (window.lucide) lucide.createIcons();
