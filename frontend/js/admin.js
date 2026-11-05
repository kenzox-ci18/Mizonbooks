const sections = document.querySelectorAll(".admin-section");
const navItems = document.querySelectorAll(".nav-item");
const pageTitle = document.getElementById("pageTitle");
const sidebar = document.getElementById("sidebar");
const mobileMenu = document.getElementById("mobileMenu");
const sidebarOverlay = document.getElementById("sidebarOverlay");

const titles = {
  dashboard: "Dashboard",
  books: "Kitoblar",
  orders: "Buyurtmalar",
  promos: "Promo-kodlar",
  users: "Foydalanuvchilar",
  winners: "G‘oliblar",
};

function showSection(name) {
  if (!titles[name]) return;

  sections.forEach((section) => {
    section.classList.toggle("active", section.id === `${name}Section`);
  });

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.section === name);
  });

  pageTitle.textContent = titles[name];
  closeSidebar();
  refreshSection(name);
}

function openSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay?.classList.add("show");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay?.classList.remove("show");
}

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    showSection(item.dataset.section);
  });
});

mobileMenu?.addEventListener("click", () => {
  if (sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

sidebarOverlay?.addEventListener("click", closeSidebar);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSidebar();
    closeBookModal();
    closeDeleteModal();
  }
});

/* NOTIFICATIONS */

function showMessage(message, type = "info") {
  let messageBox = document.getElementById("adminMessage");

  if (!messageBox) {
    messageBox = document.createElement("div");
    messageBox.id = "adminMessage";
    messageBox.className = "admin-message";

    document.querySelector(".admin-content").prepend(messageBox);
  }

  messageBox.textContent = message;
  messageBox.dataset.type = type;
  messageBox.classList.add("show");

  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => {
    messageBox.classList.remove("show");
  }, 6000);
}

let books = [];
let deleteBookId = null;

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("mizon_token");

  if (!token) {
    throw new Error("Tizimga qayta kirishingiz kerak.");
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "So‘rov bajarilmadi.");
  }

  return data;
}

async function loadBooks() {
  try {
    const data = await apiRequest("/admin/books");
    books = data.books || [];
    renderBooks();
  } catch (error) {
    console.error("Kitoblarni yuklash xatosi:", error);
    showMessage(error.message, "error");
  }
}

/* IMAGE HELPERS */

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      reject(new Error("Faqat PNG, JPG yoki WEBP rasm yuklang."));
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      reject(new Error("Rasm hajmi 20 MB dan oshmasligi kerak."));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni o‘qib bo‘lmadi."));
    };

    img.src = url;
  });
}

// Kitob muqovasi: eng uzun tomoni maxSide gacha kichraytiriladi
async function fileToCoverDataUrl(file, maxSide = 600, quality = 0.82) {
  const img = await loadImageFile(file);

  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

// Xatcho'p: profildagi xatcho'p nisbatiga (130x340) markazdan moslab kesiladi
async function fileToBookmarkDataUrl(file) {
  const img = await loadImageFile(file);

  const width = 520;
  const height = 1360;

  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const drawWidth = img.naturalWidth * scale;
  const drawHeight = img.naturalHeight * scale;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(
    img,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );

  return canvas.toDataURL("image/jpeg", 0.9);
}

/* BOOK ELEMENTS */

const bookModal = document.getElementById("bookModal");
const bookForm = document.getElementById("bookForm");
const bookTable = document.getElementById("booksTable");
const deleteModal = document.getElementById("deleteConfirmModal");

const bookFields = {
  id: document.getElementById("bookId"),
  name: document.getElementById("bookName"),
  author: document.getElementById("bookAuthor"),
  price: document.getElementById("bookPrice"),
  stock: document.getElementById("bookStock"),
  category: document.getElementById("bookCategory"),
  image: document.getElementById("bookImage"),
  description: document.getElementById("bookDescription"),
};

const bookFormMessage = document.getElementById("bookFormMessage");
const bookModalTitle = document.getElementById("bookModalTitle");
const saveBookBtn = document.getElementById("saveBookBtn");
const bookImageFile = document.getElementById("bookImageFile");
const bookImagePreview = document.getElementById("bookImagePreview");

let pendingBookImage = null;

function showBookImagePreview(src) {
  if (src) {
    bookImagePreview.src = src;
    bookImagePreview.hidden = false;
  } else {
    bookImagePreview.removeAttribute("src");
    bookImagePreview.hidden = true;
  }
}

/* MODAL */

function openBookModal(book = null) {
  bookForm.reset();
  bookFormMessage.textContent = "";
  bookFormMessage.className = "form-message";

  if (book) {
    bookFields.id.value = book.id;
    bookFields.name.value = book.name;
    bookFields.author.value = book.author;
    bookFields.price.value = book.price;
    bookFields.stock.value = book.stock;
    bookFields.category.value = book.category;
    const existingImage = book.image || "";
    const isDataImage = existingImage.startsWith("data:");

    pendingBookImage = isDataImage ? existingImage : null;
    bookFields.image.value = isDataImage ? "" : existingImage;
    showBookImagePreview(existingImage);
    bookFields.description.value = book.description || "";

    bookModalTitle.textContent = "Kitobni tahrirlash";
    saveBookBtn.textContent = "O‘zgarishlarni saqlash";
  } else {
    bookFields.id.value = "";
    pendingBookImage = null;
    showBookImagePreview("");
    bookModalTitle.textContent = "Yangi kitob qo‘shish";
    saveBookBtn.textContent = "Kitobni saqlash";
  }

  bookModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeBookModal() {
  if (!bookModal) return;

  bookModal.hidden = true;

  if (deleteModal?.hidden !== false) {
    document.body.style.overflow = "";
  }
}

function closeDeleteModal() {
  if (!deleteModal) return;

  deleteModal.hidden = true;
  deleteBookId = null;

  if (bookModal?.hidden !== false) {
    document.body.style.overflow = "";
  }
}

document.getElementById("addBookBtn").addEventListener("click", () => {
  openBookModal();
});

document.querySelectorAll("[data-close-book-modal]").forEach((button) => {
  button.addEventListener("click", closeBookModal);
});

/* STATISTICS */

function updateBookStatistics() {
  const total = books.length;
  const active = books.filter((book) => book.active).length;
  const hidden = total - active;

  document.getElementById("booksTotal").textContent = total;
  document.getElementById("activeBooksTotal").textContent = active;
  document.getElementById("hiddenBooksTotal").textContent = hidden;
  document.getElementById("statBooks").textContent = total;
}

/* TABLE CELL */

function createCell(content) {
  const cell = document.createElement("td");
  cell.textContent = content;

  return cell;
}

/* RENDER BOOKS */

function renderBooks() {
  if (!bookTable) return;

  bookTable.replaceChildren();

  const searchInput = document.getElementById("adminBookSearch");
  const categoryInput = document.getElementById("adminBookCategory");

  const search = searchInput.value.trim().toLowerCase();
  const category = categoryInput.value;

  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      book.name.toLowerCase().includes(search) ||
      book.author.toLowerCase().includes(search);

    const matchesCategory = category === "all" || book.category === category;

    return matchesSearch && matchesCategory;
  });

  if (filteredBooks.length === 0) {
    const row = document.createElement("tr");
    const cell = createCell(
      books.length === 0
        ? "Hozircha kitoblar mavjud emas."
        : "Qidiruv bo‘yicha kitob topilmadi.",
    );

    cell.colSpan = 6;
    cell.className = "table-empty";

    row.append(cell);
    bookTable.append(row);

    updateBookStatistics();
    return;
  }

  const categoryNames = {
    badiiy: "Badiiy",
    biznes: "Biznes",
    psixologiya: "Psixologiya",
    tarix: "Tarix",
    bolalar: "Bolalar",
  };

  filteredBooks.forEach((book) => {
    const row = document.createElement("tr");

    const infoCell = document.createElement("td");
    const info = document.createElement("div");
    info.className = "book-table-info";

    const image = document.createElement("img");
    image.alt = book.name;

    if (book.image) {
      image.src = book.image;

      image.addEventListener("error", () => {
        image.hidden = true;
      });
    } else {
      image.hidden = true;
    }

    const details = document.createElement("div");
    const name = document.createElement("strong");
    const author = document.createElement("span");

    name.textContent = book.name;
    author.textContent = book.author;

    details.append(name, author);
    info.append(image, details);
    infoCell.append(info);

    const categoryCell = createCell(
      categoryNames[book.category] || book.category,
    );

    const priceCell = createCell(
      `${Number(book.price).toLocaleString("uz-UZ")} so‘m`,
    );

    const stockCell = createCell(String(book.stock));

    const statusCell = document.createElement("td");
    const status = document.createElement("span");

    status.className = `status-label ${
      book.active ? "status-active" : "status-hidden"
    }`;

    status.textContent = book.active ? "Faol" : "Yashirilgan";
    statusCell.append(status);

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "table-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "table-action";
    editButton.title = "Tahrirlash";
    editButton.innerHTML = '<i data-lucide="pencil"></i>';

    editButton.addEventListener("click", () => {
      openBookModal(book);
    });

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "table-action";
    toggleButton.title = book.active ? "Yashirish" : "Faollashtirish";

    toggleButton.innerHTML = book.active
      ? '<i data-lucide="eye-off"></i>'
      : '<i data-lucide="eye"></i>';

    toggleButton.addEventListener("click", async () => {
      const nextActive = !book.active;

      try {
        await apiRequest(`/books/${encodeURIComponent(book.id)}`, {
          method: "PUT",
          body: JSON.stringify({
            name: book.name,
            author: book.author,
            price: Number(book.price),
            category: book.category,
            image: book.image,
            description: book.description,
            stock: Number(book.stock),
            active: nextActive,
          }),
        });

        await loadBooks();

        showMessage(
          nextActive
            ? "Kitob faollashtirildi."
            : "Kitob katalogdan yashirildi.",
          "success",
        );
      } catch (error) {
        showMessage(error.message, "error");
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "table-action delete";
    deleteButton.title = "O‘chirish";
    deleteButton.innerHTML = '<i data-lucide="trash-2"></i>';

    deleteButton.addEventListener("click", () => {
      deleteBookId = book.id;
      deleteModal.hidden = false;
      document.body.style.overflow = "hidden";
    });

    actions.append(editButton, toggleButton, deleteButton);
    actionsCell.append(actions);

    row.append(
      infoCell,
      categoryCell,
      priceCell,
      stockCell,
      statusCell,
      actionsCell,
    );

    bookTable.append(row);
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }

  updateBookStatistics();
}

/* ADD AND EDIT BOOK */

bookForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = bookFields.name.value.trim();
  const author = bookFields.author.value.trim();
  const price = Number(bookFields.price.value);
  const stock = Number(bookFields.stock.value);
  const category = bookFields.category.value;

  if (
    !name ||
    !author ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isInteger(stock) ||
    stock < 0 ||
    !category
  ) {
    bookFormMessage.textContent = "Ma’lumotlarni to‘g‘ri kiriting.";
    bookFormMessage.className = "form-message error";
    return;
  }

  const editingId = bookFields.id.value;
  const existingBook = books.find((book) => String(book.id) === editingId);

  const bookData = {
    name,
    author,
    price,
    stock,
    category,
    image: pendingBookImage || bookFields.image.value.trim(),
    description: bookFields.description.value.trim(),
    active: existingBook ? existingBook.active : true
  };

  try {
    saveBookBtn.disabled = true;

    if (editingId) {
      await apiRequest(`/books/${encodeURIComponent(editingId)}`, {
        method: "PUT",
        body: JSON.stringify(bookData)
      });
    } else {
      await apiRequest("/books", {
        method: "POST",
        body: JSON.stringify(bookData)
      });
    }

    await loadBooks();
    closeBookModal();

    showMessage(
      editingId ? "Kitob ma’lumotlari yangilandi." : "Yangi kitob qo‘shildi.",
      "success"
    );
  } catch (error) {
    bookFormMessage.textContent = error.message;
    bookFormMessage.className = "form-message error";
  } finally {
    saveBookBtn.disabled = false;
  }
});

/* DELETE BOOK */

document
  .getElementById("cancelDeleteBtn")
  ?.addEventListener("click", closeDeleteModal);

document
  .getElementById("confirmDeleteBtn")
  ?.addEventListener("click", async () => {
    if (deleteBookId === null) return;

    const id = deleteBookId;

    try {
      await apiRequest(`/books/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      closeDeleteModal();
      await loadBooks();
      showMessage("Kitob o‘chirildi.", "success");
    } catch (error) {
      closeDeleteModal();
      showMessage(error.message, "error");
    }
  });

/* HELPERS */

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function emptyRow(tbody, text, colSpan) {
  const row = document.createElement("tr");
  const cell = createCell(text);

  cell.colSpan = colSpan;
  cell.className = "table-empty";

  row.append(cell);
  tbody.append(row);
}

function statusLabel(text, active) {
  const label = document.createElement("span");

  label.className = `status-label ${active ? "status-active" : "status-hidden"}`;
  label.textContent = text;

  return label;
}

function phoneCell(phone) {
  const cell = document.createElement("td");

  if (!phone) {
    cell.textContent = "—";
    return cell;
  }

  const link = document.createElement("a");
  link.href = `tel:${String(phone).replace(/[^\d+]/g, "")}`;
  link.textContent = phone;

  cell.append(link);
  return cell;
}

function downloadCsv(filename, rows) {
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

/* PROMO CODES */

const promosTable = document.getElementById("promosTable");

async function loadPromos() {
  try {
    const data = await apiRequest("/admin/promo?limit=200");

    document.getElementById("promoTotal").textContent = data.stats.total;
    document.getElementById("promoUsed").textContent = data.stats.used;
    document.getElementById("promoUnused").textContent = data.stats.unused;

    promosTable.replaceChildren();

    if (data.codes.length === 0) {
      emptyRow(promosTable, "Promo-kodlar mavjud emas.", 5);
      return;
    }

    data.codes.forEach((item) => {
      const row = document.createElement("tr");
      const used = Boolean(item.used_at);

      const codeCell = document.createElement("td");
      const strong = document.createElement("strong");
      strong.textContent = item.code;
      codeCell.append(strong);

      const statusCell = document.createElement("td");
      statusCell.append(statusLabel(used ? "Ishlatilgan" : "Faol", !used));

      const userText = item.username
        ? `${item.full_name || ""} (@${item.username})`.trim()
        : "—";

      row.append(
        codeCell,
        createCell(`${item.piece}-bo‘lak`),
        statusCell,
        createCell(userText),
        createCell(formatDate(used ? item.used_at : item.created_at)),
      );

      promosTable.append(row);
    });
  } catch (error) {
    showMessage(error.message, "error");
  }
}

const promoModal = document.getElementById("promoModal");
const promoGenerateForm = document.getElementById("promoGenerateForm");
const promoFormMessage = document.getElementById("promoFormMessage");
const generatePromoBtn = document.getElementById("generatePromoBtn");

function openPromoModal() {
  promoGenerateForm.reset();
  document.getElementById("promoCount").value = 100;
  document.getElementById("promoPiece").value = "1";
  promoFormMessage.textContent = "";
  promoFormMessage.className = "form-message";

  promoModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closePromoModal() {
  promoModal.hidden = true;
  document.body.style.overflow = "";
}

document
  .getElementById("createPromoBtn")
  .addEventListener("click", openPromoModal);

document.querySelectorAll("[data-close-promo-modal]").forEach((button) => {
  button.addEventListener("click", closePromoModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePromoModal();
});

promoGenerateForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const count = Number(document.getElementById("promoCount").value);
  const batch = document.getElementById("promoBatch").value.trim();
  const piece = Number(document.getElementById("promoPiece").value);
  const customCode = document.getElementById("promoCustom").value.trim();

  if (!customCode && (!Number.isInteger(count) || count < 1 || count > 5000)) {
    promoFormMessage.textContent = "Kodlar soni 1 dan 5000 gacha bo‘lsin.";
    promoFormMessage.className = "form-message error";
    return;
  }

  generatePromoBtn.disabled = true;

  try {
    const data = await apiRequest("/admin/promo/generate", {
      method: "POST",
      body: JSON.stringify({ count, batch, piece, customCode }),
    });

    const stamp = new Date().toISOString().slice(0, 10);

    downloadCsv(
      `promo-kodlar-${stamp}.csv`,
      [["code", "piece", "batch"], ...data.codes.map((code) => [code, data.piece, batch])],
    );

    closePromoModal();
    await loadPromos();

    showMessage(
      `${data.count} ta promo-kod yaratildi va CSV fayl yuklab olindi.`,
      "success",
    );
  } catch (error) {
    promoFormMessage.textContent = error.message;
    promoFormMessage.className = "form-message error";
  } finally {
    generatePromoBtn.disabled = false;
  }
});

document.getElementById("exportPromoBtn").addEventListener("click", async () => {
  try {
    const data = await apiRequest("/admin/promo?status=unused&limit=20000");

    if (data.codes.length === 0) {
      showMessage("Ishlatilmagan promo-kodlar yo‘q.", "info");
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);

    downloadCsv(
      `ishlatilmagan-kodlar-${stamp}.csv`,
      [["code", "piece", "batch"], ...data.codes.map((item) => [item.code, item.piece, item.batch || ""])],
    );
  } catch (error) {
    showMessage(error.message, "error");
  }
});

/* USERS */

async function loadUsers() {
  const tbody = document.getElementById("usersTable");

  try {
    const data = await apiRequest("/admin/users");

    document.getElementById("statUsers").textContent = data.users.length;

    tbody.replaceChildren();

    if (data.users.length === 0) {
      emptyRow(tbody, "Foydalanuvchilar mavjud emas.", 5);
      return;
    }

    data.users.forEach((user) => {
      const row = document.createElement("tr");

      row.append(
        createCell(user.full_name),
        createCell(`@${user.username}`),
        phoneCell(user.phone),
        createCell(formatDate(user.created_at)),
        createCell(`${user.promo_pieces_count} / 4`),
      );

      tbody.append(row);
    });
  } catch (error) {
    showMessage(error.message, "error");
  }
}

/* WINNERS */

async function setDelivered(id, delivered) {
  try {
    const data = await apiRequest(`/admin/winners/${encodeURIComponent(id)}/delivered`, {
      method: "PATCH",
      body: JSON.stringify({ delivered }),
    });

    showMessage(data.message, "success");
    await loadWinners();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadWinners() {
  const tbody = document.getElementById("winnersTable");

  try {
    const data = await apiRequest("/admin/winners");

    tbody.replaceChildren();

    if (data.winners.length === 0) {
      emptyRow(tbody, "Hozircha g‘oliblar yo‘q.", 5);
      return;
    }

    data.winners.forEach((winner) => {
      const row = document.createElement("tr");
      const delivered = winner.prize_status === "delivered";

      const statusCell = document.createElement("td");
      statusCell.append(
        statusLabel(delivered ? "Topshirilgan" : "Kutilmoqda", delivered),
      );

      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-btn";
      button.style.marginLeft = "10px";
      button.textContent = delivered ? "Qaytarish" : "Sovg‘a berildi";

      button.addEventListener("click", () => {
        if (
          !delivered &&
          !confirm(`${winner.full_name} ga sovg‘a topshirilganini tasdiqlaysizmi?`)
        ) {
          return;
        }

        setDelivered(winner.id, !delivered);
      });

      statusCell.append(button);

      row.append(
        createCell(winner.full_name),
        createCell(`@${winner.username}`),
        phoneCell(winner.phone),
        createCell(formatDate(winner.won_at)),
        statusCell,
      );

      tbody.append(row);
    });
  } catch (error) {
    showMessage(error.message, "error");
  }
}

/* ORDERS */

const ORDER_STATUS_LABELS = {
  new: "Yangi",
  contacted: "Bog‘lanildi",
  delivered: "Topshirildi",
  cancelled: "Bekor qilindi",
};

async function setOrderStatus(id, status) {
  try {
    const data = await apiRequest(`/admin/orders/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });

    showMessage(data.message, "success");
    await loadOrders();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function deleteOrder(id) {
  try {
    const data = await apiRequest(`/admin/orders/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    showMessage(data.message, "success");
    await loadOrders();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadOrders() {
  const tbody = document.getElementById("ordersTable");
  const recent = document.getElementById("recentOrders");

  try {
    const data = await apiRequest("/admin/orders");

    document.getElementById("statOrders").textContent = data.stats.total;
    document.getElementById("statPending").textContent = data.stats.pending;

    tbody.replaceChildren();
    recent.replaceChildren();

    if (data.orders.length === 0) {
      emptyRow(tbody, "Buyurtmalar hozircha mavjud emas.", 6);
      emptyRow(recent, "Hozircha buyurtmalar yo‘q.", 4);
      return;
    }

    data.orders.slice(0, 5).forEach((order) => {
      const row = document.createElement("tr");
      const labelCell = document.createElement("td");

      labelCell.append(
        statusLabel(ORDER_STATUS_LABELS[order.status] || order.status, order.status === "new"),
      );

      row.append(
        createCell(order.customer_name),
        createCell(order.book_name),
        createCell(formatDate(order.created_at)),
        labelCell,
      );

      recent.append(row);
    });

    data.orders.forEach((order) => {
      const row = document.createElement("tr");

      const bookCell = createCell(
        `${order.book_name} — ${new Intl.NumberFormat("uz-UZ").format(Number(order.book_price))} so‘m`,
      );

      if (order.note) {
        const note = document.createElement("small");
        note.style.display = "block";
        note.style.opacity = "0.7";
        note.textContent = `Izoh: ${order.note}`;
        bookCell.append(note);
      }

      const statusCell = document.createElement("td");
      const select = document.createElement("select");

      Object.entries(ORDER_STATUS_LABELS).forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === order.status;
        select.append(option);
      });

      select.addEventListener("change", () => setOrderStatus(order.id, select.value));
      statusCell.append(select);

      const actionCell = document.createElement("td");
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "secondary-btn";
      removeBtn.textContent = "O‘chirish";

      removeBtn.addEventListener("click", () => {
        if (confirm(`${order.customer_name} buyurtmasini o‘chirasizmi?`)) {
          deleteOrder(order.id);
        }
      });

      actionCell.append(removeBtn);

      row.append(
        createCell(order.customer_name),
        phoneCell(order.phone),
        bookCell,
        createCell(formatDate(order.created_at)),
        statusCell,
        actionCell,
      );

      tbody.append(row);
    });
  } catch (error) {
    showMessage(error.message, "error");
  }
}

document.getElementById("refreshOrders")?.addEventListener("click", loadOrders);

/* BOOK COVER UPLOAD */

bookImageFile.addEventListener("change", async () => {
  const file = bookImageFile.files[0];

  if (!file) return;

  try {
    pendingBookImage = await fileToCoverDataUrl(file);
    bookFields.image.value = "";
    showBookImagePreview(pendingBookImage);

    bookFormMessage.textContent = "";
    bookFormMessage.className = "form-message";
  } catch (error) {
    bookImageFile.value = "";
    bookFormMessage.textContent = error.message;
    bookFormMessage.className = "form-message error";
  }
});

bookFields.image.addEventListener("input", () => {
  pendingBookImage = null;
  showBookImagePreview(bookFields.image.value.trim());
});

/* BOOKMARK IMAGE */

const bookmarkPreviewImg = document.getElementById("bookmarkPreviewImg");
const bookmarkPlaceholder = document.getElementById("bookmarkPlaceholder");
const bookmarkPreviewGrid = document.getElementById("bookmarkPreviewGrid");
const bookmarkFile = document.getElementById("bookmarkFile");
const bookmarkMessage = document.getElementById("bookmarkMessage");

function setBookmarkMessage(text, type = "") {
  bookmarkMessage.textContent = text;
  bookmarkMessage.className = `form-message ${type}`.trim();
}

function renderBookmarkPreview(image) {
  const hasImage = Boolean(image);

  bookmarkPreviewImg.hidden = !hasImage;
  bookmarkPreviewGrid.hidden = !hasImage;
  bookmarkPlaceholder.hidden = hasImage;

  if (hasImage) {
    bookmarkPreviewImg.src = image;
  } else {
    bookmarkPreviewImg.removeAttribute("src");
  }
}

async function loadBookmarkAdmin() {
  try {
    const response = await fetch(`${API_URL}/bookmark`);
    const data = await response.json();

    renderBookmarkPreview(response.ok ? data.image : null);
  } catch {
    renderBookmarkPreview(null);
  }
}

document.getElementById("uploadBookmarkBtn").addEventListener("click", () => {
  bookmarkFile.click();
});

bookmarkFile.addEventListener("change", async () => {
  const file = bookmarkFile.files[0];

  if (!file) return;

  setBookmarkMessage("Rasm yuklanmoqda...");

  try {
    const image = await fileToBookmarkDataUrl(file);

    await apiRequest("/admin/bookmark", {
      method: "PUT",
      body: JSON.stringify({ image }),
    });

    renderBookmarkPreview(image);
    setBookmarkMessage("Xatcho‘p rasmi saqlandi.", "success");
  } catch (error) {
    setBookmarkMessage(error.message, "error");
  } finally {
    bookmarkFile.value = "";
  }
});

document.getElementById("removeBookmarkBtn").addEventListener("click", async () => {
  if (!confirm("Xatcho‘p rasmini o‘chirmoqchimisiz?")) return;

  try {
    await apiRequest("/admin/bookmark", { method: "DELETE" });

    renderBookmarkPreview(null);
    setBookmarkMessage("Rasm o‘chirildi.", "success");
  } catch (error) {
    setBookmarkMessage(error.message, "error");
  }
});

/* SECTION REFRESH + INIT */

function refreshSection(name) {
  if (name === "dashboard" || name === "orders") loadOrders();
  if (name === "promos") {
    loadPromos();
    loadBookmarkAdmin();
  }
  if (name === "users") loadUsers();
  if (name === "winners") loadWinners();
  if (name === "books") loadBooks();
}

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("mizon_token");
  window.location.href = "index.html";
});

async function initAdmin() {
  if (!localStorage.getItem("mizon_token")) {
    window.location.href = "index.html";
    return;
  }

  try {
    const me = await apiRequest("/auth/me");

    if (!me.user || me.user.role !== "admin") {
      window.location.href = "profile.html";
      return;
    }
  } catch (error) {
    if (/Token|Avval/i.test(error.message)) {
      localStorage.removeItem("mizon_token");
      window.location.href = "index.html";
      return;
    }

    showMessage(error.message, "error");
    return;
  }

  loadBooks();
  loadUsers();
  loadPromos();
  loadWinners();
  loadOrders();
  loadBookmarkAdmin();
}

initAdmin();
