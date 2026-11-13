const categoryNames = {
  badiiy: "Badiiy adabiyot",
  biznes: "Biznes",
  psixologiya: "Psixologiya",
  tarix: "Tarix",
  bolalar: "Bolalar",
};

const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">' +
      '<rect width="300" height="400" fill="#ece3d6"/>' +
      '<rect x="70" y="80" width="160" height="240" rx="8" fill="#c9b49b"/>' +
      '<rect x="85" y="95" width="130" height="210" rx="4" fill="#f8f3eb"/>' +
      '<text x="150" y="212" font-family="Georgia,serif" font-size="22" ' +
      'text-anchor="middle" fill="#62432f">MizonBooks</text></svg>',
  );

let currentUser = null;

async function loadCurrentUser() {
  const token = localStorage.getItem("mizon_token");

  if (!token) return;

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user || null;
    }
  } catch {
    currentUser = null;
  }
}

let books = [];

/* CART (SAVAT) */

const CART_KEY = "mizon_cart";
const MAX_PER_BOOK = 20;

function readCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");

    if (!Array.isArray(raw)) return [];

    return raw
      .map((item) => ({
        id: String(item?.id ?? ""),
        qty: Math.floor(Number(item?.qty)),
      }))
      .filter((item) => item.id && item.id.length <= 64 && item.qty >= 1)
      .map((item) => ({ id: item.id, qty: Math.min(item.qty, MAX_PER_BOOK) }));
  } catch {
    return [];
  }
}

let cart = readCart();

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // brauzer saqlashga ruxsat bermasa, savat shu sahifa ochiq turguncha ishlaydi
  }

  renderCart();
}

function findBook(id) {
  return books.find((book) => String(book.id) === String(id));
}

function maxQty(book) {
  return Math.max(0, Math.min(Number(book.stock) || 0, MAX_PER_BOOK));
}

// Savatdagi har bir qator: { item, book }. Katalogdan yo'qolgan kitoblar tushmaydi
function cartLines() {
  return cart
    .map((item) => ({ item, book: findBook(item.id) }))
    .filter((line) => line.book);
}

// Katalog yuklangach: sotuvdan chiqqan kitoblarni olib tashlaydi, sonini ombordagi miqdorga moslaydi
function reconcileCart() {
  cart = cart
    .map((item) => {
      const book = findBook(item.id);
      return book ? { id: item.id, qty: Math.min(item.qty, maxQty(book)) } : null;
    })
    .filter((item) => item && item.qty >= 1);

  saveCart();
}

function cartTotal() {
  return cartLines().reduce(
    (sum, { item, book }) => sum + Number(book.price) * item.qty,
    0,
  );
}

const cartBtn = document.getElementById("cartBtn");
const cartCount = document.getElementById("cartCount");
const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");
const cartItemsEl = document.getElementById("cartItems");
const cartEmptyEl = document.getElementById("cartEmpty");
const cartFootEl = document.getElementById("cartFoot");
const cartTotalEl = document.getElementById("cartTotal");
const cartHintEl = document.getElementById("cartHint");
const checkoutBtn = document.getElementById("checkoutBtn");
const cartToast = document.getElementById("cartToast");

function showToast(text) {
  cartToast.textContent = text;
  cartToast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => cartToast.classList.remove("show"), 2200);
}

function addToCart(bookId) {
  const book = findBook(bookId);

  if (!book || maxQty(book) < 1) return;

  const existing = cart.find((item) => item.id === String(book.id));

  if (existing) {
    if (existing.qty >= maxQty(book)) {
      showToast(`Omborda faqat ${maxQty(book)} ta qolgan.`);
      return;
    }

    existing.qty += 1;
  } else {
    cart.push({ id: String(book.id), qty: 1 });
  }

  saveCart();
  showToast(`“${book.name}” savatga qo‘shildi.`);
}

function changeQty(bookId, delta) {
  const item = cart.find((entry) => entry.id === String(bookId));
  const book = findBook(bookId);

  if (!item || !book) return;

  const next = item.qty + delta;

  if (next < 1) {
    removeFromCart(bookId);
    return;
  }

  if (next > maxQty(book)) {
    showToast(`Omborda faqat ${maxQty(book)} ta qolgan.`);
    return;
  }

  item.qty = next;
  saveCart();
}

function removeFromCart(bookId) {
  cart = cart.filter((item) => item.id !== String(bookId));
  saveCart();
}

function renderCart() {
  const lines = cartLines();
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);

  cartCount.textContent = totalQty;
  cartCount.hidden = totalQty === 0;

  cartItemsEl.replaceChildren();

  cartEmptyEl.hidden = lines.length > 0;
  cartFootEl.hidden = lines.length === 0;
  cartItemsEl.hidden = lines.length === 0;

  cartTotalEl.textContent = formatPrice(cartTotal());

  cartHintEl.textContent = localStorage.getItem("mizon_token")
    ? ""
    : "Buyurtma berish uchun tizimga kirasiz yoki Google orqali ro‘yxatdan o‘tasiz — savatingiz saqlanib qoladi.";

  lines.forEach(({ item, book }) => {
    const row = document.createElement("div");
    row.className = "cart-item";

    const image = document.createElement("img");
    image.src = getBookImage(book);
    image.alt = book.name;
    image.onerror = () => {
      image.onerror = null;
      image.src = FALLBACK_IMAGE;
    };

    const info = document.createElement("div");
    info.className = "cart-item-info";

    const title = document.createElement("strong");
    title.textContent = book.name;

    const author = document.createElement("small");
    author.textContent = book.author;

    const price = document.createElement("span");
    price.className = "cart-item-price";
    price.textContent = formatPrice(Number(book.price) * item.qty);

    const stepper = document.createElement("div");
    stepper.className = "qty-stepper";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", "Kamaytirish");
    minus.addEventListener("click", () => changeQty(book.id, -1));

    const qty = document.createElement("span");
    qty.textContent = item.qty;

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "Ko‘paytirish");
    plus.disabled = item.qty >= maxQty(book);
    plus.addEventListener("click", () => changeQty(book.id, 1));

    stepper.append(minus, qty, plus);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "cart-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Savatdan olib tashlash");
    remove.addEventListener("click", () => removeFromCart(book.id));

    info.append(title, author, stepper);
    row.append(image, info, price, remove);
    cartItemsEl.append(row);
  });
}

function openCart() {
  renderCart();
  cartDrawer.classList.add("open");
  cartOverlay.classList.add("show");
  cartDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.remove("show");
  cartDrawer.setAttribute("aria-hidden", "true");

  if (!orderModal.classList.contains("show")) {
    document.body.classList.remove("modal-open");
  }
}

cartBtn.addEventListener("click", openCart);
cartOverlay.addEventListener("click", closeCart);
document.getElementById("cartClose").addEventListener("click", closeCart);

// Tizimga kirmagan mijoz kirish sahifasiga o'tadi va buyurtmani davom ettirish uchun qaytadi
checkoutBtn.addEventListener("click", async () => {
  if (cartLines().length === 0) return;

  await userReady;

  if (!currentUser) {
    window.location.href = `login.html?next=${encodeURIComponent("books.html?checkout=1")}`;
    return;
  }

  closeCart();
  openOrderModal();
});

async function loadBooks() {
  try {
    const response = await fetch(`${API_URL}/books`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Kitoblarni yuklab bo‘lmadi.");
    }

    books = data.books || [];
    emptyState.innerHTML = emptyStateHTML;
    renderBooks();
    reconcileCart();
  } catch (error) {
    console.error("Kitoblarni yuklashda xatolik:", error);

    emptyState.classList.add("show");
    emptyState.textContent =
      "Kitoblarni yuklab bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.";
  }
}

/* ELEMENTS */

const booksGrid = document.getElementById("booksGrid");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const categoryButtons = document.querySelectorAll(".category-btn");
const bookCount = document.getElementById("bookCount");
const emptyState = document.getElementById("emptyState");

const orderModal = document.getElementById("orderModal");
const orderForm = document.getElementById("orderForm");
const selectedBook = document.getElementById("selectedBook");
const orderMessage = document.getElementById("orderMessage");

let activeCategory = "all";
const emptyStateHTML = emptyState.innerHTML;

/* HELPERS */

function formatPrice(price) {
  return new Intl.NumberFormat("uz-UZ").format(price) + " so‘m";
}

function getBookImage(book) {
  return book.image || FALLBACK_IMAGE;
}

function getBookCategory(book) {
  return categoryNames[book.category] || book.category;
}

/* RENDER */

function renderBooks() {
  if (!booksGrid) return;

  const searchText = searchInput.value.toLowerCase().trim();

  let filteredBooks = books.filter((book) => {
    const isActive = true;

    const matchesCategory =
      activeCategory === "all" || book.category === activeCategory;

    const matchesSearch =
      book.name.toLowerCase().includes(searchText) ||
      book.author.toLowerCase().includes(searchText);

    return isActive && matchesCategory && matchesSearch;
  });

  if (sortSelect.value === "price-asc") {
    filteredBooks.sort((a, b) => Number(a.price) - Number(b.price));
  }

  if (sortSelect.value === "price-desc") {
    filteredBooks.sort((a, b) => Number(b.price) - Number(a.price));
  }

  if (sortSelect.value === "name") {
    filteredBooks.sort((a, b) => a.name.localeCompare(b.name, "uz"));
  }

  booksGrid.replaceChildren();

  bookCount.textContent = filteredBooks.length;

  emptyState.classList.toggle("show", filteredBooks.length === 0);

  filteredBooks.forEach((book) => {
    const card = document.createElement("article");
    card.className = "book-card";

    const imageWrap = document.createElement("div");
    imageWrap.className = "book-image-wrap";

    const category = document.createElement("span");
    category.className = "book-category";
    category.textContent = getBookCategory(book);

    const image = document.createElement("img");
    image.src = getBookImage(book);
    image.alt = book.name;
    image.loading = "lazy";

    image.onerror = () => {
      image.onerror = null;
      image.src = FALLBACK_IMAGE;
    };

    imageWrap.append(category, image);

    const info = document.createElement("div");
    info.className = "book-info";

    const title = document.createElement("h3");
    title.textContent = book.name;

    const author = document.createElement("p");
    author.className = "book-author";
    author.textContent = book.author;

    const bottom = document.createElement("div");
    bottom.className = "book-bottom";

    const price = document.createElement("span");
    price.className = "book-price";
    price.textContent = formatPrice(Number(book.price));

    const buyButton = document.createElement("button");
    buyButton.className = "buy-button";
    buyButton.type = "button";
    buyButton.dataset.id = book.id;

    if (Number(book.stock) <= 0) {
      buyButton.textContent = "Tugagan";
      buyButton.disabled = true;
    } else {
      buyButton.textContent = "Savatga qo‘shish";
    }

    bottom.append(price, buyButton);
    info.append(title, author, bottom);
    card.append(imageWrap, info);

    booksGrid.appendChild(card);
  });
}

/* ORDER MODAL */

function openOrderModal() {
  const lines = cartLines();

  if (lines.length === 0) return;

  orderForm.reset();

  orderMessage.textContent = "";
  orderMessage.className = "order-message";
  orderForm.querySelector(".order-submit").disabled = false;

  // Tizimga kirgan mijozning ma'lumotlari avtomatik to'ldiriladi
  if (currentUser) {
    document.getElementById("customerName").value = currentUser.full_name || "";
    document.getElementById("customerPhone").value = currentUser.phone || "";
  }

  selectedBook.replaceChildren();

  lines.forEach(({ item, book }) => {
    const row = document.createElement("div");
    row.className = "order-summary-row";

    const title = document.createElement("span");
    title.textContent = `${book.name} × ${item.qty}`;

    const price = document.createElement("strong");
    price.textContent = formatPrice(Number(book.price) * item.qty);

    row.append(title, price);
    selectedBook.append(row);
  });

  const total = document.createElement("div");
  total.className = "order-summary-row order-summary-total";

  const totalLabel = document.createElement("span");
  totalLabel.textContent = "Jami";

  const totalValue = document.createElement("strong");
  totalValue.textContent = formatPrice(cartTotal());

  total.append(totalLabel, totalValue);
  selectedBook.append(total);

  orderModal.classList.add("show");
  document.body.classList.add("modal-open");

  document.getElementById(
    document.getElementById("customerName").value ? "customerPhone" : "customerName",
  ).focus();
}

function hideOrderModal() {
  orderModal.classList.remove("show");

  if (!cartDrawer.classList.contains("open")) {
    document.body.classList.remove("modal-open");
  }
}

/* SEARCH */

searchInput.addEventListener("input", renderBooks);

/* SORT */

sortSelect.addEventListener("change", renderBooks);

/* CATEGORY */

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    categoryButtons.forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");
    activeCategory = button.dataset.category;

    renderBooks();
  });
});

/* BUY BUTTON */

booksGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".buy-button");

  if (!button) return;

  addToCart(button.dataset.id);
});

/* CLOSE MODAL */

orderModal.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", hideOrderModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (orderModal.classList.contains("show")) {
    hideOrderModal();
  } else if (cartDrawer.classList.contains("open")) {
    closeCart();
  }
});

/* ORDER FORM */

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const note = document.getElementById("orderNote").value.trim();

  if (name.length < 2) {
    orderMessage.textContent = "Ismingizni to‘liq kiriting.";
    orderMessage.className = "order-message error";
    return;
  }

  const digits = phone.replace(/\D/g, "");

  if (digits.length < 9 || digits.length > 15) {
    orderMessage.textContent = "Telefon raqamingizni tekshiring.";
    orderMessage.className = "order-message error";
    return;
  }

  if (!localStorage.getItem("mizon_token")) {
    window.location.href = `login.html?next=${encodeURIComponent("books.html?checkout=1")}`;
    return;
  }

  const lines = cartLines();

  if (lines.length === 0) {
    orderMessage.textContent = "Savatingiz bo‘sh.";
    orderMessage.className = "order-message error";
    return;
  }

  const submitButton = orderForm.querySelector(".order-submit");
  let orderSucceeded = false;
  submitButton.disabled = true;
  orderMessage.textContent = "Yuborilmoqda...";
  orderMessage.className = "order-message";

  try {
    const headers = { "Content-Type": "application/json" };
    const token = localStorage.getItem("mizon_token");

    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_URL}/orders/cart`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        items: lines.map(({ item, book }) => ({
          bookId: book.id,
          quantity: item.qty,
        })),
        name,
        phone,
        note,
      }),
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      throw new Error(
        `Server JSON o‘rniga boshqa javob qaytardi (HTTP ${response.status}). Backend yangi versiyada ishlayotganini tekshiring.`,
      );
    }

    if (!response.ok) {
      const failure = new Error(data.message || "Buyurtma yuborilmadi.");
      failure.status = response.status;
      failure.unavailable = data.unavailable;
      throw failure;
    }

    orderMessage.textContent = data.message;
    orderMessage.className = "order-message success";
    orderForm.reset();
    orderSucceeded = true;

    cart = [];
    saveCart();

    setTimeout(hideOrderModal, 2500);
  } catch (error) {
    orderMessage.textContent =
      error instanceof TypeError
        ? "Server bilan aloqa yo‘q. Birozdan keyin urinib ko‘ring."
        : error.message;
    orderMessage.className = "order-message error";

    if (error.status === 401) {
      // Sessiya muddati tugagan: qayta kirib, savat bilan davom etiladi
      localStorage.removeItem("mizon_token");
      setTimeout(() => {
        window.location.href = `login.html?next=${encodeURIComponent("books.html?checkout=1")}`;
      }, 1500);
    } else if (error.unavailable) {
      // Kitob tugagan bo'lishi mumkin: katalog va savat yangilanadi
      loadBooks();
    }
  } finally {
    submitButton.disabled = orderSucceeded;
  }
});

/* INITIALIZATION */

const userReady = loadCurrentUser();

renderCart();

(async function init() {
  await Promise.all([userReady, loadBooks()]);

  // Kirish sahifasidan buyurtmani davom ettirish uchun qaytgan bo'lsa
  const params = new URLSearchParams(window.location.search);

  if (params.get("checkout") === "1") {
    window.history.replaceState({}, "", "books.html");

    if (currentUser && cartLines().length > 0) {
      openOrderModal();
    } else if (cartLines().length > 0) {
      openCart();
    }
  }
})();
