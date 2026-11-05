const authForm = document.getElementById("authForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const message = document.getElementById("message");

let currentMode = "login";

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `message ${type}`;
}

function submitLabel(mode) {
  return mode === "login" ? "Tizimga kirish" : "Hisob yaratish";
}

function setMode(mode) {
  currentMode = mode;

  loginTab.classList.toggle("active", mode === "login");
  registerTab.classList.toggle("active", mode === "register");

  const submitText = document.getElementById("submitText");
  const submitButton = authForm.querySelector("button[type='submit']");

  if (submitText) {
    submitText.textContent = submitLabel(mode);
  } else {
    submitButton.textContent = submitLabel(mode);
  }

  const nameField = document.getElementById("fullNameField");
  const phoneField = document.getElementById("phoneField");

  nameField.hidden = mode === "login";
  phoneField.hidden = mode === "login";

  document.getElementById("fullName").required = mode === "register";
  document.getElementById("phone").required = mode === "register";

  document.getElementById("password").autocomplete =
    mode === "login" ? "current-password" : "new-password";

  const welcomeTitle = document.getElementById("welcomeTitle");
  const welcomeDescription = document.getElementById("welcomeDescription");

  if (welcomeTitle) {
    welcomeTitle.textContent =
      mode === "login" ? "Hisobingizga kiring" : "Yangi hisob yarating";
  }

  if (welcomeDescription) {
    welcomeDescription.textContent =
      mode === "login"
        ? "Kitoblar olamiga qaytganingizdan xursandmiz."
        : "MizonBooks olamiga qo‘shiling.";
  }

  showMessage("");
}

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

function goAfterLogin(user) {
  window.location.href = user?.role === "admin" ? "admin.html" : "profile.html";
}

function saveSession(data) {
  if (!data.token) {
    throw new Error("Server xavfsiz kirish tokenini qaytarmadi.");
  }

  localStorage.setItem("mizon_token", data.token);
  goAfterLogin(data.user);
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document
    .getElementById("username")
    .value.trim()
    .toLowerCase();

  const password = document.getElementById("password").value;
  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phone").value.trim();

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    showMessage(
      "Username 3–24 belgi bo‘lsin: faqat kichik lotin harflari, raqam va _ ishlating.",
    );
    return;
  }

  if (password.length < 8) {
    showMessage("Parol kamida 8 ta belgidan iborat bo‘lsin.");
    return;
  }

  if (currentMode === "register") {
    if (fullName.length < 2) {
      showMessage("Ismingizni kiriting.");
      return;
    }

    const digits = phone.replace(/\D/g, "");

    if (digits.length < 9 || digits.length > 15) {
      showMessage("Telefon raqamingizni to‘liq kiriting. Masalan: +998 90 123 45 67");
      return;
    }
  }

  const submitButton = authForm.querySelector("button[type='submit']");
  const submitText = document.getElementById("submitText");

  submitButton.disabled = true;

  if (submitText) {
    submitText.textContent = "Kutilmoqda...";
  }

  try {
    const endpoint = currentMode === "login" ? "/auth/login" : "/auth/register";

    const body = { username, password };

    if (currentMode === "register") {
      // Server "fullName" nomini kutadi
      body.fullName = fullName;
      body.phone = phone;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        "Server JSON javob qaytarmadi. Backend ishlayotganini tekshiring.",
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "So‘rovni bajarib bo‘lmadi.");
    }

    saveSession(data);
  } catch (error) {
    showMessage(
      error instanceof TypeError
        ? "Server bilan aloqa yo‘q. Backend ishlayotganini tekshiring."
        : error.message,
    );
  } finally {
    submitButton.disabled = false;

    if (submitText) {
      submitText.textContent = submitLabel(currentMode);
    }
  }
});

// Avvalgi sessiya bo‘lsa, foydalanuvchi rolini serverdan tekshirib, mos sahifaga o‘tkazadi
async function checkSession() {
  const token = localStorage.getItem("mizon_token");

  if (!token) return;

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 404) {
      localStorage.removeItem("mizon_token");
      return;
    }

    if (!response.ok) return;

    const data = await response.json();
    goAfterLogin(data.user);
  } catch (error) {
    console.error("Sessiyani tekshirishda xato:", error);
  }
}

setMode("login");
checkSession();
