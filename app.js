// Niloufar Barbershop - Production booking frontend
// Replace YOUR_PROJECT_REF after deploying the Supabase Edge Function.
const BOOKING_API_URL = "https://eahlaxmbsndvsdpwwlao.supabase.co/functions/v1/booking-api";

const TIME_SLOTS = ["18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];
let bookedTimes = new Set();
let bookedTimesDate = "";

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

function apiConfigured() {
  return BOOKING_API_URL.startsWith("https://") && !BOOKING_API_URL.includes("YOUR_PROJECT_REF");
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
  return result;
}

function renderTimeSlots() {
  const date = els.date.value;
  els.timeSlots.innerHTML = "";

  TIME_SLOTS.forEach(time => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "time-slot";
    button.textContent = time;

    const booked = bookedTimesDate === date && bookedTimes.has(time);
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

async function openTimeModal() {
  if (!els.date.value || isFriday(els.date.value)) return;

  els.timePickerBtn.disabled = true;
  els.selectedTimeLabel.textContent = "در حال بررسی زمان‌ها...";

  try {
    await fetchBookedTimes(els.date.value);
    renderTimeSlots();
    els.timeModal.classList.add("show");
    els.timeModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    els.selectedTimeLabel.textContent = els.time.value || "انتخاب ساعت";
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
  if (response.status === 409 || result.error === "SLOT_TAKEN") {
    const error = new Error("SLOT_TAKEN");
    error.code = "SLOT_TAKEN";
    throw error;
  }
  if (!response.ok) throw new Error(result.error || "BOOKING_API_ERROR");
  return result;
}

els.date.addEventListener("change", async () => {
  clearFormError();
  resetSelectedTime();
  bookedTimes = new Set();
  bookedTimesDate = "";

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
    resetSelectedTime();
    els.timePickerBtn.disabled = true;
    els.selectedTimeLabel.textContent = "ابتدا تاریخ را انتخاب کن";
    els.dateHint.textContent = "جمعه‌ها امکان رزرو وجود ندارد.";
    els.dateHint.style.color = "";
  } catch (error) {
    if (error.code === "SLOT_TAKEN" || error.message === "SLOT_TAKEN") {
      resetSelectedTime();
      try { await fetchBookedTimes(booking.date); } catch {}
      showFormError("این ساعت همین الان توسط شخص دیگری رزرو شد. لطفاً ساعت دیگری را انتخاب کن.");
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

document.getElementById("year").textContent = new Date().getFullYear();
setDateMinimum();
if (window.lucide) lucide.createIcons();
