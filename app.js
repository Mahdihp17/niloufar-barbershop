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

function openSuccessModal(booking) {
  els.successText.textContent = `${booking.name}، نوبت شما برای ${formatDateFa(booking.date)} ساعت ${booking.time} ثبت شد. روش پرداخت: پرداخت در محل.`;
  els.successModal.classList.add("show");
  els.successModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
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
    await createBooking(booking);
    openSuccessModal(booking);
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
