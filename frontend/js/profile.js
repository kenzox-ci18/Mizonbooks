
const avatar = document.getElementById("avatar");
const userName = document.getElementById("userName");
const userHandle = document.getElementById("userHandle");
const userPhone = document.getElementById("userPhone");

const promoForm = document.getElementById("promoForm");
const promoCode = document.getElementById("promoCode");
const promoMessage = document.getElementById("promoMessage");

const pieceCount = document.getElementById("pieceCount");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");
const progressTrack = document.querySelector(".progress-track");

const winnerBanner = document.getElementById("winnerBanner");

const adminLink = document.getElementById("adminLink");
let currentUser = null;

const editProfileBtn = document.getElementById("editProfileBtn");
const logoutBtn = document.getElementById("logoutBtn");

const pieces = [
    document.getElementById("piece1"),
    document.getElementById("piece2"),
    document.getElementById("piece3"),
    document.getElementById("piece4")
];

const pieceCards = [
    document.getElementById("pieceCard1"),
    document.getElementById("pieceCard2"),
    document.getElementById("pieceCard3"),
    document.getElementById("pieceCard4")
];

const LOGIN_URL = "login.html?next=profile.html";

const AVATAR_DATA_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

function getToken() {
    return localStorage.getItem("mizon_token");
}

function showPromoMessage(message, type = "info") {
    if (!promoMessage) return;

    promoMessage.textContent = message;
    promoMessage.className = `promo-message ${type}`;
}

const bookmarkEl = document.getElementById("bookmark");
const bookmarkSegs = document.querySelectorAll(".bookmark-seg");

// Xatcho'p rasmi: 4 bo'lakka bo'linadi, har bir bo'lak o'z kodi bilan ochiladi
(function setupBookmarkArt() {
    if (!bookmarkEl) return;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 340" preserveAspectRatio="none">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#7a4f33"/><stop offset="0.5" stop-color="#b98a54"/><stop offset="1" stop-color="#4a2c1c"/>
</linearGradient></defs>
<rect width="130" height="340" fill="url(#g)"/>
<rect x="8" y="8" width="114" height="324" fill="none" stroke="#f3dfb8" stroke-width="1.5"/>
<rect x="13" y="13" width="104" height="314" fill="none" stroke="#f3dfb8" stroke-width="0.6"/>
<text x="65" y="46" text-anchor="middle" font-size="22" fill="#f3dfb8">&#10022;</text>
<text x="65" y="110" text-anchor="middle" font-family="Georgia,serif" font-size="19" font-weight="bold" fill="#fff4dc">MIZON</text>
<text x="65" y="135" text-anchor="middle" font-family="Georgia,serif" font-size="15" fill="#f3dfb8" letter-spacing="3">BOOKS</text>
<circle cx="65" cy="190" r="26" fill="none" stroke="#f3dfb8" stroke-width="1.5"/>
<path d="M50 196 L65 176 L80 196 Z" fill="#f3dfb8"/>
<text x="65" y="250" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#f3dfb8" letter-spacing="2">HAR BIR KITOB</text>
<text x="65" y="266" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#f3dfb8" letter-spacing="2">YANGI OLAM</text>
<text x="65" y="312" text-anchor="middle" font-size="18" fill="#f3dfb8">&#10022;</text>
</svg>`;

    bookmarkEl.style.setProperty(
        "--bm-art",
        `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
    );
})();

// Admin yuklagan xatcho'p rasmi bo'lsa, o'sha rasm 4 bo'lakka bo'linib ochiladi
async function loadBookmarkImage() {
    if (!bookmarkEl) return;

    try {
        const response = await fetch(`${API_URL}/bookmark`);

        if (!response.ok) return;

        const data = await response.json();

        if (
            typeof data.image === "string" &&
            /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(data.image)
        ) {
            bookmarkEl.style.setProperty("--bm-art", `url("${data.image}")`);
        }
    } catch {
        // rasm bo'lmasa, standart xatcho'p dizayni ishlatiladi
    }
}

function renderProgress(pieceList, isWinner = false) {
    const owned = Array.isArray(pieceList)
        ? [...new Set(pieceList.map(Number))].filter(n => n >= 1 && n <= 4)
        : [];

    const safeCount = owned.length;
    const percent = safeCount * 25;

    if (pieceCount) {
        pieceCount.textContent = `${safeCount} / 4`;
    }

    if (progressPercent) {
        progressPercent.textContent = `${percent}%`;
    }

    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }

    if (progressTrack) {
        progressTrack.setAttribute("aria-valuenow", percent);
    }

    pieces.forEach((piece, index) => {
        if (!piece) return;

        piece.textContent = owned.includes(index + 1)
            ? "Qo‘lga kiritilgan"
            : "Hali olinmagan";
    });

    pieceCards.forEach((card, index) => {
        if (!card) return;

        card.classList.toggle("completed", owned.includes(index + 1));
    });

    bookmarkSegs.forEach(seg => {
        seg.classList.toggle("revealed", owned.includes(Number(seg.dataset.piece)));
    });

    if (bookmarkEl) {
        bookmarkEl.classList.toggle("complete", safeCount === 4);
    }

    if (winnerBanner) {
        winnerBanner.hidden = !(isWinner || safeCount === 4);
    }
}

function setAvatar(avatarUrl, fullName, username) {
    if (!avatar) return;

    avatar.replaceChildren();

    if (
        avatarUrl &&
        typeof avatarUrl === "string" &&
        (/^https?:\/\//i.test(avatarUrl) || AVATAR_DATA_RE.test(avatarUrl))
    ) {
        const image = document.createElement("img");

        image.src = avatarUrl;
        image.alt = "Profil rasmi";
        image.referrerPolicy = "no-referrer";

        image.onerror = () => {
            image.remove();
            avatar.textContent = (fullName || username || "M")
                .trim()
                .charAt(0)
                .toUpperCase();
        };

        avatar.appendChild(image);
    } else {
        avatar.textContent = (fullName || username || "M")
            .trim()
            .charAt(0)
            .toUpperCase();
    }
}

async function loadProfile() {
    const token = getToken();

    if (!token) {
        window.location.href = LOGIN_URL;
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            localStorage.removeItem("mizon_token");
            window.location.href = LOGIN_URL;
            return;
        }

        if (!response.ok) {
            throw new Error("Profil ma'lumotlarini yuklab bo‘lmadi.");
        }

        const data = await response.json();

        if (!data.user) {
            throw new Error("Foydalanuvchi ma'lumotlari topilmadi.");
        }

        const user = data.user;

        userName.textContent = user.full_name || user.username || "Foydalanuvchi";
        userHandle.textContent = `@${user.username || "username"}`;
        userPhone.textContent = user.phone || "Telefon kiritilmagan";

        setAvatar(
            user.avatar_url,
            user.full_name,
            user.username
        );

        currentUser = user;

        renderProgress(user.pieces || [], Boolean(user.is_winner));

        if (adminLink) {
            adminLink.hidden = user.role !== "admin";
        }

        // Google orqali kirganlarda telefon bo'lmaydi, g'olibga qo'ng'iroq qilish uchun kerak
        if (!user.phone) {
            showPromoMessage(
                "Yutuq bo‘lsa siz bilan bog‘lanishimiz uchun “Profilni tahrirlash” orqali telefon raqamingizni kiriting.",
                "info"
            );
        }

    } catch (error) {
        showPromoMessage(
            error.message || "Server bilan bog‘lanib bo‘lmadi.",
            "error"
        );
    }
}

if (promoForm) {
    promoForm.addEventListener("submit", async event => {
        event.preventDefault();

        const code = promoCode.value.replace(/[\s-]/g, "").toUpperCase();

        if (!code) {
            showPromoMessage("Promo-kodni kiriting.", "error");
            return;
        }

        const token = getToken();

        if (!token) {
            window.location.href = LOGIN_URL;
            return;
        }

        const submitButton = promoForm.querySelector(
            "button[type='submit']"
        );

        if (submitButton) {
            submitButton.disabled = true;
        }

        showPromoMessage("Promo-kod tekshirilmoqda...");

        try {
            const response = await fetch(`${API_URL}/promo/redeem`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("mizon_token");
                window.location.href = LOGIN_URL;
                return;
            }

            if (!response.ok) {
                throw new Error(
                    data.message || data.error || "Promo-kodni tekshirib bo‘lmadi."
                );
            }

            promoCode.value = "";

            showPromoMessage(
                data.message || "Promo-kod muvaffaqiyatli qabul qilindi.",
                "success"
            );

            renderProgress(data.pieces || [], Boolean(data.winner));

        } catch (error) {
            showPromoMessage(
                error.message || "Server bilan bog‘lanib bo‘lmadi.",
                "error"
            );
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
}

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editMessage = document.getElementById("editMessage");

function closeEditModal() {
    if (editModal) editModal.hidden = true;
}

// Fayldan tanlangan rasm (data URL). Bo'sh bo'lsa, havola maydoni ishlatiladi
let editAvatarData = "";

const editAvatarFile = document.getElementById("editAvatarFile");
const editAvatarPreview = document.getElementById("editAvatarPreview");
const editAvatarUrl = document.getElementById("editAvatar");

function showEditAvatarPreview(src) {
    if (!editAvatarPreview) return;

    editAvatarPreview.replaceChildren();

    const letter = (
        (currentUser && (currentUser.full_name || currentUser.username)) || "M"
    ).trim().charAt(0).toUpperCase();

    if (src && (/^https?:\/\//i.test(src) || AVATAR_DATA_RE.test(src))) {
        const image = document.createElement("img");

        image.src = src;
        image.alt = "Profil rasmi";
        image.referrerPolicy = "no-referrer";
        image.onerror = () => {
            image.remove();
            editAvatarPreview.textContent = letter;
        };

        editAvatarPreview.appendChild(image);
    } else {
        editAvatarPreview.textContent = letter;
    }
}

// Rasm kvadrat qilib kesiladi va 256x256 gacha kichraytiriladi (server uchun yengil bo'lishi uchun)
function avatarFileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
            reject(new Error("Faqat PNG, JPG yoki WEBP rasm yuklang."));
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            reject(new Error("Rasm hajmi 15 MB dan oshmasligi kerak."));
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            const size = 256;
            const side = Math.min(img.naturalWidth, img.naturalHeight);
            const sx = (img.naturalWidth - side) / 2;
            const sy = (img.naturalHeight - side) / 2;

            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, size, size);
            ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

            resolve(canvas.toDataURL("image/jpeg", 0.85));
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Rasmni o‘qib bo‘lmadi."));
        };

        img.src = objectUrl;
    });
}

if (editProfileBtn && editModal) {
    document.getElementById("editAvatarPick").addEventListener("click", () => {
        editAvatarFile.click();
    });

    document.getElementById("editAvatarClear").addEventListener("click", () => {
        editAvatarData = "";
        editAvatarUrl.value = "";
        editAvatarFile.value = "";
        showEditAvatarPreview("");
    });

    editAvatarFile.addEventListener("change", async () => {
        const file = editAvatarFile.files[0];

        if (!file) return;

        try {
            editAvatarData = await avatarFileToDataUrl(file);
            editAvatarUrl.value = "";
            showEditAvatarPreview(editAvatarData);

            editMessage.textContent = "";
            editMessage.className = "promo-message";
        } catch (error) {
            editMessage.textContent = error.message;
            editMessage.className = "promo-message error";
        } finally {
            editAvatarFile.value = "";
        }
    });

    editAvatarUrl.addEventListener("input", () => {
        editAvatarData = "";
        showEditAvatarPreview(editAvatarUrl.value.trim());
    });

    editProfileBtn.addEventListener("click", () => {
        if (!currentUser) return;

        document.getElementById("editName").value = currentUser.full_name || "";
        document.getElementById("editPhone").value = currentUser.phone || "";

        const currentAvatar = currentUser.avatar || "";
        const isDataAvatar = currentAvatar.startsWith("data:");

        editAvatarData = isDataAvatar ? currentAvatar : "";
        editAvatarUrl.value = isDataAvatar ? "" : currentAvatar;
        showEditAvatarPreview(currentAvatar);
        editMessage.textContent = "";
        editMessage.className = "promo-message";

        editModal.hidden = false;
    });

    document.getElementById("editCancel").addEventListener("click", closeEditModal);

    editModal.addEventListener("click", event => {
        if (event.target === editModal) closeEditModal();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeEditModal();
    });

    editForm.addEventListener("submit", async event => {
        event.preventDefault();

        const saveButton = document.getElementById("editSave");
        saveButton.disabled = true;

        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    fullName: document.getElementById("editName").value,
                    phone: document.getElementById("editPhone").value,
                    avatar: editAvatarData || editAvatarUrl.value.trim()
                })
            });

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("mizon_token");
                window.location.href = LOGIN_URL;
                return;
            }

            if (!response.ok) {
                throw new Error(data.message || "Saqlab bo‘lmadi.");
            }

            closeEditModal();
            await loadProfile();
            showPromoMessage("Profil yangilandi.", "success");
        } catch (error) {
            editMessage.textContent = error.message;
            editMessage.className = "promo-message error";
        } finally {
            saveButton.disabled = false;
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("mizon_token");
        window.location.href = "books.html";
    });
}

loadBookmarkImage();
loadProfile();