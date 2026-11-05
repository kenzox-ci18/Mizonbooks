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
const selectedBookId = document.getElementById("selectedBookId");
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
      buyButton.textContent = "Buyurtma berish";
    }

    bottom.append(price, buyButton);
    info.append(title, author, bottom);
    card.append(imageWrap, info);

    booksGrid.appendChild(card);
  });
}

/* ORDER MODAL */

function openOrderModal(bookId) {
  const book = books.find(
    (item) => String(item.id) === String(bookId) && Number(item.stock) > 0,
  );

  if (!book) return;

  orderForm.reset();

  selectedBookId.value = book.id;
  orderMessage.textContent = "";
  orderMessage.className = "order-message";
  orderForm.querySelector(".order-submit").disabled = false;

  // Tizimga kirgan mijozning ma'lumotlari avtomatik to'ldiriladi
  if (currentUser) {
    document.getElementById("customerName").value = currentUser.full_name || "";
    document.getElementById("customerPhone").value = currentUser.phone || "";
  }

  selectedBook.replaceChildren();

  const image = document.createElement("img");
  image.src = getBookImage(book);
  image.alt = book.name;

  const details = document.createElement("div");

  const title = document.createElement("strong");
  title.textContent = book.name;

  const price = document.createElement("span");
  price.textContent = formatPrice(Number(book.price));

  details.append(title, price);
  selectedBook.append(image, details);

  orderModal.classList.add("show");
  document.body.classList.add("modal-open");

  document.getElementById("customerName").focus();
}

function hideOrderModal() {
  orderModal.classList.remove("show");
  document.body.classList.remove("modal-open");
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

  openOrderModal(button.dataset.id);
});

/* CLOSE MODAL */

orderModal.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", hideOrderModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && orderModal.classList.contains("show")) {
    hideOrderModal();
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
    orderMessage.textContent =
      "Buyurtma berish uchun avval tizimga kiring yoki ro‘yxatdan o‘ting.";
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

    const response = await fetch(`${API_URL}/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        bookId: selectedBookId.value,
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
      throw new Error(data.message || "Buyurtma yuborilmadi.");
    }

    orderMessage.textContent = data.message;
    orderMessage.className = "order-message success";
    orderForm.reset();
    orderSucceeded = true;

    setTimeout(hideOrderModal, 2500);
  } catch (error) {
    orderMessage.textContent =
      error instanceof TypeError
        ? "Server bilan aloqa yo‘q. Birozdan keyin urinib ko‘ring."
        : error.message;
    orderMessage.className = "order-message error";
  } finally {
    submitButton.disabled = orderSucceeded;
  }
});

/* INITIALIZATION */

loadCurrentUser();
loadBooks();
