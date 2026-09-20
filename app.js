// ------------------------------------------------------------
// Niloufar Barbershop - Frontend prototype
// IMPORTANT:
// GitHub Pages is static. For production-wide availability locking
// and Telegram delivery, connect this frontend to a secure backend/API.
// Do NOT place a Telegram bot token directly in this file.
// ------------------------------------------------------------

const BOOKING_API_URL = ""; // Later: put your secure backend/serverless endpoint here.
const STORAGE_KEY = "niloufar_bookings_v1";

// One-hour appointment starts. Change this array later if you prefer 30-minute slots.
const TIME_SLOTS = ["18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];

const els = {
  form: document.getElementById("bookingForm"),
  name: document.getElementById("name"),
  phone: document.getElementById("phone"),
  service: document.getElementById("service"),
  date: document.getElementById("date"),
  dateHint: document.getElementById("dateHint"),
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

const toEnglishDigits = (value = "") => value
  .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
  .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

function getBookings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveBooking(booking) {
  const bookings = getBookings();
  bookings.push(booking);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

function isSlotBooked(date, time) {
  return getBookings().some(item => item.date === date && item.time === time);
}

function isFriday(dateString) {
  if (!dateString) return false;
  const date = new Date(`${dateString}T12:00:00`);
  return date.getDay() === 5;
}

function setDateMinimum() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  els.date.min = `${yyyy}-${mm}-${dd}`;
}

function formatDateFa(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("fa-IR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
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

function renderTimeSlots() {
  const date = els.date.value;
  els.timeSlots.innerHTML = "";

  TIME_SLOTS.forEach(time => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "time-slot";
    button.textContent = time;

    const booked = isSlotBooked(date, time);
    button.disabled = booked;
    if (booked) button.setAttribute("aria-label", `${time} رزرو شده`);

    if (els.time.value === time) button.classList.add("selected");

    button.addEventListener("click", () => {
      els.time.value = time;
      els.selectedTimeLabel.textContent = time;
      closeTimeModal();
      clearFormError();
    });

    els.timeSlots.appendChild(button);
  });
}

function openTimeModal() {
  if (!els.date.value || isFriday(els.date.value)) return;
  renderTimeSlots();
  els.timeModal.classList.add("show");
  els.timeModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
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

async function sendBookingToBackend(booking) {
  // Future hook for Telegram + central database.
  // The backend should:
  // 1) atomically check whether date/time is still free,
  // 2) save the booking,
  // 3) send the booking message to Telegram,
  // 4) return success/error to this frontend.
  if (!BOOKING_API_URL) return { mode: "local" };

  const response = await fetch(BOOKING_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking)
  });

  if (!response.ok) throw new Error("BOOKING_API_ERROR");
  return response.json();
}

els.date.addEventListener("change", () => {
  clearFormError();
  resetSelectedTime();

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

  els.timePickerBtn.disabled = false;
  els.dateHint.textContent = `تاریخ انتخابی: ${formatDateFa(els.date.value)}`;
  els.dateHint.style.color = "";
});

els.timePickerBtn.addEventListener("click", openTimeModal);

document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeTimeModal));
document.querySelectorAll("[data-close-success]").forEach(el => el.addEventListener("click", closeSuccessModal));

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
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
    id: (crypto.randomUUID ? crypto.randomUUID() : `booking-${Date.now()}`),
    name: els.name.value.trim(),
    phone: toEnglishDigits(els.phone.value.trim()),
    service: els.service.value,
    date: els.date.value,
    time: els.time.value,
    product: els.product.value || "بدون محصول",
    payment: "پرداخت در محل",
    createdAt: new Date().toISOString()
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

  if (isSlotBooked(booking.date, booking.time)) {
    resetSelectedTime();
    showFormError("این ساعت قبلاً رزرو شده است. لطفاً ساعت دیگری را انتخاب کن.");
    return;
  }

  const submitButton = els.form.querySelector("button[type='submit']");
  const originalText = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML = '<i data-lucide="loader-circle"></i> در حال ثبت رزرو';
  if (window.lucide) lucide.createIcons();

  try {
    const result = await sendBookingToBackend(booking);

    // Local mode is intentionally browser-only for this frontend milestone.
    // When BOOKING_API_URL is active, the backend becomes the source of truth.
    if (result.mode === "local") saveBooking(booking);

    openSuccessModal(booking);
    els.form.reset();
    resetSelectedTime();
    els.timePickerBtn.disabled = true;
    els.selectedTimeLabel.textContent = "ابتدا تاریخ را انتخاب کن";
    els.dateHint.textContent = "جمعه‌ها امکان رزرو وجود ندارد.";
  } catch (error) {
    showFormError("ثبت رزرو انجام نشد. لطفاً دوباره تلاش کن.");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
    if (window.lucide) lucide.createIcons();
  }
});

document.getElementById("year").textContent = new Date().getFullYear();
setDateMinimum();
if (window.lucide) lucide.createIcons();
