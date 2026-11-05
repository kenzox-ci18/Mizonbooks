console.log("ISHLAYOTGAN SERVER:", __filename);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");

const app = express();

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  throw new Error("DATABASE_URL yoki JWT_SECRET sozlanmagan!");
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(cors());
// Rasmlar (xatcho'p, kitob muqovasi) base64 ko'rinishida keladi, shuning uchun limit kattaroq
app.use(express.json({ limit: "6mb" }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
}

function isValidPhone(phone) {
  if (typeof phone !== "string") return false;
  if (!/^[+\d\s()-]{7,30}$/.test(phone)) return false;

  const digits = phone.replace(/\D/g, "").length;
  return digits >= 9 && digits <= 15;
}

function adminUsername() {
  return (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
}

// Noto'g'ri parol urinishlaridan himoya: bir IP + username uchun 10 ta xato -> 15 daqiqa kutish
const loginFailures = new Map();

function loginLocked(key) {
  const entry = loginFailures.get(key);
  if (!entry || !entry.lockedUntil) return 0;

  if (entry.lockedUntil > Date.now()) return entry.lockedUntil - Date.now();

  loginFailures.delete(key);
  return 0;
}

function loginFailed(key) {
  const entry = loginFailures.get(key) || { count: 0 };
  entry.count += 1;

  if (entry.count >= 10) {
    entry.lockedUntil = Date.now() + 15 * 60 * 1000;
    entry.count = 0;
  }

  loginFailures.set(key, entry);
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Avval tizimga kiring.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      message: "Token yaroqsiz yoki muddati tugagan.",
    });
  }
}

// Frontend fayllarini shu serverning o'zi tarqatadi (bitta joyga yuklash kifoya)
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS server_time");

    res.json({
      status: "success",
      message: "Neon database bilan aloqa muvaffaqiyatli!",
      databaseTime: result.rows[0].server_time,
    });
  } catch (error) {
    console.error(error.message);

    res.status(500).json({
      status: "error",
      message: "Database bilan bog'lanishda xatolik.",
    });
  }
});

// RO'YXATDAN O'TISH
app.post("/api/auth/register", async (req, res) => {
  try {
    const body = req.body || {};

    // Ism "fullName" yoki "full_name" nomi bilan kelishi mumkin — ikkalasi ham qabul qilinadi
    const cleanName = String(body.fullName ?? body.full_name ?? "").trim();
    const cleanUsername = String(body.username ?? "")
      .trim()
      .toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const cleanPhone = String(body.phone ?? "").trim();
    const cleanEmail = String(body.email ?? "").trim() || null;

    if (!cleanName || !cleanUsername || !password || !cleanPhone) {
      return res.status(400).json({
        message: "Majburiy maydonlarni to'ldiring.",
      });
    }

    if (cleanName.length < 2 || cleanName.length > 150) {
      return res.status(400).json({
        message: "Ism 2 dan 150 belgigacha bo'lishi kerak.",
      });
    }

    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      return res.status(400).json({
        message:
          "Username 3-24 belgidan iborat bo'lsin. Faqat kichik harflar, raqamlar va _ ishlating.",
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        message: "Parol 8 dan 72 belgigacha bo'lishi kerak.",
      });
    }

    if (!isValidPhone(cleanPhone)) {
      return res.status(400).json({
        message: "Telefon raqamini tekshiring (masalan: +998 90 123 45 67).",
      });
    }

    if (
      cleanEmail &&
      (cleanEmail.length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
    ) {
      return res.status(400).json({
        message: "Email manzilini tekshiring.",
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [cleanUsername],
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "Bu username band. Boshqasini tanlang.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // .env dagi ADMIN_USERNAME bilan ro'yxatdan o'tgan odam darhol admin bo'ladi
    const role = cleanUsername === adminUsername() ? "admin" : "user";

    const result = await pool.query(
      `INSERT INTO users
            (full_name, username, password_hash, phone, email, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, full_name, username, phone, email, avatar, role, created_at`,
      [cleanName, cleanUsername, passwordHash, cleanPhone, cleanEmail, role],
    );

    const user = result.rows[0];
    const token = createToken(user);

    res.status(201).json({
      message: "Ro'yxatdan muvaffaqiyatli o'tdingiz!",
      token,
      user,
    });
  } catch (error) {
    console.error("Register error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "Bu username band. Boshqasini tanlang.",
      });
    }

    res.status(500).json({
      message: "Ro'yxatdan o'tishda xatolik yuz berdi.",
    });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const body = req.body || {};
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username.trim() || !password) {
      return res.status(400).json({
        message: "Username va parolni kiriting.",
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const limitKey = `${req.ip}|${cleanUsername}`;

    const lockMs = loginLocked(limitKey);

    if (lockMs > 0) {
      return res.status(429).json({
        message: `Juda ko'p noto'g'ri urinish. ${Math.ceil(lockMs / 60000)} daqiqadan keyin qayta urinib ko'ring.`,
      });
    }

    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      cleanUsername,
    ]);

    if (result.rows.length === 0) {
      loginFailed(limitKey);

      return res.status(401).json({
        message: "Username yoki parol noto'g'ri.",
      });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      loginFailed(limitKey);

      return res.status(401).json({
        message: "Username yoki parol noto'g'ri.",
      });
    }

    loginFailures.delete(limitKey);

    // ADMIN_USERNAME ga tegishli hisob kirishda avtomatik admin qilinadi
    if (cleanUsername === adminUsername() && user.role !== "admin") {
      await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [
        user.id,
      ]);
      user.role = "admin";
    }

    const token = createToken(user);

    res.json({
      message: "Tizimga muvaffaqiyatli kirdingiz!",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      message: "Tizimga kirishda xatolik yuz berdi.",
    });
  }
});

// FOYDALANUVCHI PROFILI
app.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.phone, u.email, u.avatar, u.role,
              u.created_at, u.won_at, u.prize_status,
              COALESCE((SELECT ARRAY_AGG(DISTINCT p.piece ORDER BY p.piece)
                        FROM promo_codes p WHERE p.used_by = u.id), '{}')
                AS pieces
       FROM users u WHERE u.id = $1`,
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Foydalanuvchi topilmadi.",
      });
    }

    const row = result.rows[0];

    res.json({
      user: {
        ...row,
        promo_pieces_count: row.pieces.length,
        avatar_url: row.avatar,
        is_winner: row.won_at !== null,
      },
    });
  } catch (error) {
    console.error("Profile error:", error.message);

    res.status(500).json({
      message: "Profilni olishda xatolik.",
    });
  }
});

// PROFILNI TAHRIRLASH
app.put("/api/auth/me", authenticate, async (req, res) => {
  try {
    const fullName = String(req.body.fullName ?? "").trim();
    const phone = String(req.body.phone ?? "").trim();
    const avatar = String(req.body.avatar ?? "").trim();

    if (fullName.length < 2 || fullName.length > 150) {
      return res
        .status(400)
        .json({ message: "Ism 2 dan 150 belgigacha bo'lishi kerak." });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: "Telefon raqamini tekshiring." });
    }

    if (avatar && (!/^https?:\/\//i.test(avatar) || avatar.length > 1000)) {
      return res.status(400).json({
        message: "Rasm havolasi http:// yoki https:// bilan boshlanishi kerak.",
      });
    }

    const result = await pool.query(
      `UPDATE users SET full_name = $1, phone = $2, avatar = $3
       WHERE id = $4
       RETURNING id, full_name, username, phone, avatar, role`,
      [fullName, phone, avatar || null, req.user.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi." });
    }

    res.json({ message: "Profil yangilandi.", user: result.rows[0] });
  } catch (error) {
    console.error("Profilni yangilash xatosi:", error.message);
    res.status(500).json({ message: "Profilni yangilashda xatolik." });
  }
});

app.get("/api/books", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, author, price, category, image, description, stock
             FROM books
             WHERE active = TRUE
             ORDER BY created_at DESC`,
    );

    res.json({
      success: true,
      books: result.rows,
    });
  } catch (error) {
    console.error("Kitoblarni olish xatosi:", error.message);
    res.status(500).json({
      message: "Kitoblarni yuklashda xatolik.",
    });
  }
});

// Faqat admin uchun (rol har safar bazadan tekshiriladi)
async function adminOnly(req, res, next) {
  try {
    const result = await pool.query("SELECT role FROM users WHERE id = $1", [
      req.user.id,
    ]);

    if (result.rows.length === 0 || result.rows[0].role !== "admin") {
      return res.status(403).json({
        message: "Bu amal faqat admin uchun.",
      });
    }

    next();
  } catch (error) {
    console.error("Admin tekshiruvi xatosi:", error.message);
    res.status(500).json({ message: "Server xatosi." });
  }
}

// Token bo'lsa foydalanuvchini aniqlaydi, bo'lmasa ham davom etadi
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    } catch {
      req.user = null;
    }
  }

  next();
}

// Admin yangi kitob qo'shadi
app.post("/api/books", authenticate, adminOnly, async (req, res) => {
  try {
    const { name, author, price, category, image, description, stock } =
      req.body;

    if (!name || !author || price === undefined) {
      return res.status(400).json({
        message: "Kitob nomi, muallifi va narxi kerak.",
      });
    }

    if (typeof name !== "string" || typeof author !== "string") {
      return res.status(400).json({
        message: "Kitob nomi va muallifi matn bo'lishi kerak.",
      });
    }

    if (typeof image === "string" && image.length > 1500000) {
      return res.status(400).json({
        message: "Kitob rasmi juda katta.",
      });
    }

    const numericPrice = Number(price);
    const numericStock = Number(stock ?? 0);

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice < 0 ||
      !Number.isInteger(numericStock) ||
      numericStock < 0
    ) {
      return res.status(400).json({
        message: "Narx yoki kitob soni noto'g'ri.",
      });
    }

    const result = await pool.query(
      `INSERT INTO books
            (name, author, price, category, image, description, stock)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
      [
        name.trim(),
        author.trim(),
        numericPrice,
        category || null,
        image || null,
        description || null,
        numericStock,
      ],
    );

    res.status(201).json({
      message: "Kitob muvaffaqiyatli qo'shildi!",
      book: result.rows[0],
    });
  } catch (error) {
    console.error("Kitob qo'shish xatosi:", error.message);
    res.status(500).json({
      message: "Kitob qo'shishda xatolik.",
    });
  }
});

// Admin barcha kitoblarni, shu jumladan yashirilganlarini ham ko'radi
app.get("/api/admin/books", authenticate, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, author, price, category, image, description, stock, active
       FROM books
       ORDER BY created_at DESC`,
    );

    res.json({
      success: true,
      books: result.rows,
    });
  } catch (error) {
    console.error("Admin kitoblarini olish xatosi:", error.message);
    res.status(500).json({
      message: "Kitoblarni yuklashda xatolik.",
    });
  }
});

// Admin kitob ma'lumotlarini yangilaydi
app.put("/api/books/:id", authenticate, adminOnly, async (req, res) => {
  try {
    const { name, author, price, category, image, description, stock, active } =
      req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof author !== "string" ||
      !author.trim() ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0 ||
      !Number.isInteger(Number(stock)) ||
      Number(stock) < 0 ||
      typeof active !== "boolean"
    ) {
      return res.status(400).json({
        message: "Kitob ma'lumotlari noto'g'ri.",
      });
    }

    if (typeof image === "string" && image.length > 1500000) {
      return res.status(400).json({
        message: "Kitob rasmi juda katta.",
      });
    }

    const result = await pool.query(
      `UPDATE books
       SET name = $1,
           author = $2,
           price = $3,
           category = $4,
           image = $5,
           description = $6,
           stock = $7,
           active = $8
       WHERE id = $9
       RETURNING id, name, author, price, category, image, description, stock, active`,
      [
        name.trim(),
        author.trim(),
        Number(price),
        category || null,
        image || null,
        description || null,
        Number(stock),
        active,
        req.params.id,
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Kitob topilmadi.",
      });
    }

    res.json({
      success: true,
      message: "Kitob ma'lumotlari yangilandi.",
      book: result.rows[0],
    });
  } catch (error) {
    console.error("Kitobni yangilash xatosi:", error.message);
    res.status(500).json({
      message: "Kitobni yangilashda xatolik.",
    });
  }
});

// Admin kitobni o'chiradi
app.delete("/api/books/:id", authenticate, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM books WHERE id = $1 RETURNING id`,
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Kitob topilmadi.",
      });
    }

    res.json({
      success: true,
      message: "Kitob o'chirildi.",
    });
  } catch (error) {
    console.error("Kitobni o'chirish xatosi:", error.message);

    res.status(500).json({
      message:
        "Kitobni o'chirishda xatolik. Unga bog'langan buyurtmalar bo'lishi mumkin.",
    });
  }
});

// ======================= PROMO-KODLAR =======================

const PROMO_PIECES_TO_WIN = 4;
// 0, O, 1, I, L kabi adashtiriladigan belgilar olib tashlangan
const PROMO_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomPromoCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += PROMO_ALPHABET[crypto.randomInt(PROMO_ALPHABET.length)];
  }
  return code;
}

// Kodni taxmin qilib topishdan himoya: 5 ta xato urinishdan keyin 15 daqiqa kutish
const failedPromoAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function promoLockRemaining(userId) {
  const entry = failedPromoAttempts.get(userId);
  if (!entry) return 0;

  if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
    return entry.lockedUntil - Date.now();
  }

  if (entry.lockedUntil) failedPromoAttempts.delete(userId);
  return 0;
}

function registerFailedPromo(userId) {
  const entry = failedPromoAttempts.get(userId) || { count: 0 };
  entry.count += 1;

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_MS;
    entry.count = 0;
  }

  failedPromoAttempts.set(userId, entry);
}

// Foydalanuvchi promo-kod kiritadi
app.post("/api/promo/redeem", authenticate, async (req, res) => {
  const userId = req.user.id;

  const lockMs = promoLockRemaining(userId);
  if (lockMs > 0) {
    return res.status(429).json({
      message: `Juda ko'p noto'g'ri urinish. ${Math.ceil(lockMs / 60000)} daqiqadan keyin qayta urinib ko'ring.`,
    });
  }

  const rawCode = typeof req.body.code === "string" ? req.body.code : "";
  const code = rawCode.replace(/[\s-]/g, "").toUpperCase();

  if (!/^[A-Z0-9]{6}$/.test(code)) {
    registerFailedPromo(userId);
    return res.status(400).json({
      message: "Promo-kod 6 ta belgidan iborat bo'lishi kerak.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Bir foydalanuvchining so'rovlari ketma-ket bajarilishi uchun qatorni qulflaymiz
    const userResult = await client.query(
      "SELECT id, won_at FROM users WHERE id = $1 FOR UPDATE",
      [userId],
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Foydalanuvchi topilmadi." });
    }

    if (userResult.rows[0].won_at) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message:
          "Siz allaqachon yutib olgansiz. Administrator siz bilan bog'lanadi.",
      });
    }

    const found = await client.query(
      "SELECT id, piece, used_by FROM promo_codes WHERE code = $1 FOR UPDATE",
      [code],
    );

    if (found.rowCount === 0 || found.rows[0].used_by !== null) {
      await client.query("ROLLBACK");
      registerFailedPromo(userId);
      return res.status(400).json({
        message: "Promo-kod noto'g'ri yoki avval ishlatilgan.",
      });
    }

    const { id: codeId, piece } = found.rows[0];

    const already = await client.query(
      "SELECT 1 FROM promo_codes WHERE used_by = $1 AND piece = $2",
      [userId, piece],
    );

    if (already.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: `Sizda ${piece}-bo'lak allaqachon bor. Boshqa bo'lakning kodini kiriting.`,
      });
    }

    await client.query(
      "UPDATE promo_codes SET used_by = $1, used_at = NOW() WHERE id = $2",
      [userId, codeId],
    );

    const piecesResult = await client.query(
      "SELECT DISTINCT piece FROM promo_codes WHERE used_by = $1 ORDER BY piece",
      [userId],
    );

    const pieces = piecesResult.rows.map((row) => row.piece);
    const total = pieces.length;
    const winner = total >= PROMO_PIECES_TO_WIN;

    if (winner) {
      await client.query(
        "UPDATE users SET won_at = NOW(), prize_status = 'pending' WHERE id = $1",
        [userId],
      );
    }

    await client.query("COMMIT");

    failedPromoAttempts.delete(userId);

    res.json({
      message: winner
        ? "Tabriklaymiz! Siz 1 ta kitob yutib oldingiz!"
        : `Kod qabul qilindi! ${piece}-bo'lak ochildi.`,
      piece,
      pieces,
      promo_pieces_count: total,
      winner,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Promo redeem error:", error.message);

    res.status(500).json({
      message: "Promo-kodni tekshirishda xatolik yuz berdi.",
    });
  } finally {
    client.release();
  }
});

// Admin: yangi promo-kodlar yaratadi (har biri xatcho'pning aniq bir bo'lagiga tegishli)
app.post(
  "/api/admin/promo/generate",
  authenticate,
  adminOnly,
  async (req, res) => {
    try {
      const piece = Number(req.body.piece);
      const batch =
        typeof req.body.batch === "string"
          ? req.body.batch.trim().slice(0, 50) || null
          : null;

      if (
        !Number.isInteger(piece) ||
        piece < 1 ||
        piece > PROMO_PIECES_TO_WIN
      ) {
        return res.status(400).json({
          message: "Bo'lak raqami 1 dan 4 gacha bo'lishi kerak.",
        });
      }

      // Admin o'zi kod yozishi mumkin (bir nechta kodni vergul yoki yangi qator bilan ajratadi)
      const customRaw =
        typeof req.body.customCode === "string"
          ? req.body.customCode.trim()
          : "";

      if (customRaw) {
        const tokens = customRaw
          .split(/[\s,;]+/)
          .map((item) => item.replace(/-/g, "").toUpperCase())
          .filter(Boolean);

        if (tokens.length > 5000) {
          return res.status(400).json({
            message: "Bir vaqtda 5000 tagacha kod kiritish mumkin.",
          });
        }

        const valid = [];
        const invalid = [];
        const seen = new Set();

        for (const token of tokens) {
          if (!/^[A-Z0-9]{6}$/.test(token)) {
            invalid.push(token);
          } else if (!seen.has(token)) {
            seen.add(token);
            valid.push(token);
          }
        }

        if (invalid.length > 0) {
          return res.status(400).json({
            message: `Har bir kod aynan 6 ta harf yoki raqamdan iborat bo'lsin. Noto'g'ri: ${invalid.slice(0, 5).join(", ")}`,
          });
        }

        if (valid.length === 0) {
          return res
            .status(400)
            .json({ message: "Kamida bitta kod kiriting." });
        }

        const inserted = await pool.query(
          `INSERT INTO promo_codes (code, batch, piece)
         SELECT unnest($1::text[]), $2::text, $3::smallint
         ON CONFLICT (code) DO NOTHING
         RETURNING code`,
          [valid, batch, piece],
        );

        if (inserted.rowCount === 0) {
          return res.status(409).json({
            message:
              valid.length === 1
                ? "Bu kod allaqachon mavjud."
                : "Kiritilgan kodlarning hammasi avval qo'shilgan.",
          });
        }

        const skipped = valid.length - inserted.rowCount;

        return res.status(201).json({
          message:
            skipped > 0
              ? `${inserted.rowCount} ta kod qo'shildi, ${skipped} tasi avval mavjud edi.`
              : `${inserted.rowCount} ta promo-kod qo'shildi.`,
          count: inserted.rowCount,
          piece,
          codes: inserted.rows.map((row) => row.code),
        });
      }

      const count = Number(req.body.count);

      if (!Number.isInteger(count) || count < 1 || count > 5000) {
        return res.status(400).json({
          message: "Kodlar soni 1 dan 5000 gacha bo'lishi kerak.",
        });
      }

      const created = [];

      for (let attempt = 0; attempt < 10 && created.length < count; attempt++) {
        const need = count - created.length;
        const candidates = new Set();

        while (candidates.size < need) {
          candidates.add(randomPromoCode());
        }

        const result = await pool.query(
          `INSERT INTO promo_codes (code, batch, piece)
         SELECT unnest($1::text[]), $2::text, $3::smallint
         ON CONFLICT (code) DO NOTHING
         RETURNING code`,
          [[...candidates], batch, piece],
        );

        created.push(...result.rows.map((row) => row.code));
      }

      res.status(201).json({
        message: `${created.length} ta promo-kod yaratildi.`,
        count: created.length,
        piece,
        codes: created,
      });
    } catch (error) {
      console.error("Promo yaratish xatosi:", error.message);
      res.status(500).json({ message: "Promo-kodlarni yaratishda xatolik." });
    }
  },
);

// Admin: promo-kodlar ro'yxati va statistika
app.get("/api/admin/promo", authenticate, adminOnly, async (req, res) => {
  try {
    const status = ["used", "unused"].includes(req.query.status)
      ? req.query.status
      : "all";

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 200, 1),
      20000,
    );

    const filter =
      status === "used"
        ? "WHERE p.used_by IS NOT NULL"
        : status === "unused"
          ? "WHERE p.used_by IS NULL"
          : "";

    const [list, stats] = await Promise.all([
      pool.query(
        `SELECT p.code, p.batch, p.piece, p.used_at, p.created_at,
                u.username, u.full_name
         FROM promo_codes p
         LEFT JOIN users u ON u.id = p.used_by
         ${filter}
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT $1`,
        [limit],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(used_by)::int AS used
         FROM promo_codes`,
      ),
    ]);

    const { total, used } = stats.rows[0];

    res.json({
      codes: list.rows,
      stats: { total, used, unused: total - used },
    });
  } catch (error) {
    console.error("Promo ro'yxati xatosi:", error.message);
    res.status(500).json({ message: "Promo-kodlarni yuklashda xatolik." });
  }
});

// Admin: foydalanuvchilar
app.get("/api/admin/users", authenticate, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.phone, u.created_at,
              (SELECT COUNT(DISTINCT p.piece)::int FROM promo_codes p WHERE p.used_by = u.id)
                AS promo_pieces_count
       FROM users u
       ORDER BY u.created_at DESC`,
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error("Foydalanuvchilar xatosi:", error.message);
    res.status(500).json({ message: "Foydalanuvchilarni yuklashda xatolik." });
  }
});

// Admin: g'oliblar
app.get("/api/admin/winners", authenticate, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, username, phone, won_at, prize_status, prize_delivered_at
       FROM users
       WHERE won_at IS NOT NULL
       ORDER BY won_at DESC`,
    );

    res.json({ winners: result.rows });
  } catch (error) {
    console.error("G'oliblar xatosi:", error.message);
    res.status(500).json({ message: "G'oliblarni yuklashda xatolik." });
  }
});

// Admin: sovg'a topshirildi / topshirilmadi deb belgilaydi
app.patch(
  "/api/admin/winners/:id/delivered",
  authenticate,
  adminOnly,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ message: "Noto'g'ri ID." });
      }

      const delivered = req.body.delivered !== false;

      const result = await pool.query(
        `UPDATE users
       SET prize_status = $1,
           prize_delivered_at = CASE WHEN $2 THEN NOW() ELSE NULL END
       WHERE id = $3 AND won_at IS NOT NULL
       RETURNING id, prize_status, prize_delivered_at`,
        [delivered ? "delivered" : "pending", delivered, id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "G'olib topilmadi." });
      }

      res.json({
        message: delivered
          ? "Sovg'a topshirilgan deb belgilandi."
          : "Sovg'a holati 'kutilmoqda' ga qaytarildi.",
        winner: result.rows[0],
      });
    } catch (error) {
      console.error("Sovg'a holati xatosi:", error.message);
      res.status(500).json({ message: "Holatni yangilashda xatolik." });
    }
  },
);

// ======================= BUYURTMALAR =======================

const ORDER_STATUSES = ["new", "contacted", "delivered", "cancelled"];
// Foydalanuvchi buyurtma beradi
console.log("MIZONBOOKS ORDERS ROUTE LOADED");
app.post("/api/orders", authenticate, async (req, res) => {
  try {
    if (orderRateLimited(req.ip)) {
      return res.status(429).json({
        message: "Buyurtmalar limiti tugadi. Keyinroq urinib ko'ring.",
      });
    }

    const bookId = String(req.body.bookId ?? "").trim();
    const name = String(req.body.name ?? "").trim();
    const phone = String(req.body.phone ?? "").trim();
    const note = String(req.body.note ?? "").trim();

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(bookId)) {
      return res.status(400).json({ message: "Kitob ID noto'g'ri." });
    }

    if (name.length < 2 || name.length > 150) {
      return res.status(400).json({ message: "Ismni tekshiring." });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: "Telefon raqamini tekshiring." });
    }

    if (note.length > 1000) {
      return res.status(400).json({ message: "Izoh juda uzun." });
    }

    const book = await pool.query(
      `SELECT id FROM books
       WHERE id = $1 AND active = TRUE AND stock > 0`,
      [bookId],
    );

    if (book.rowCount === 0) {
      return res.status(404).json({
        message: "Kitob mavjud emas yoki hozir sotuvda yo'q.",
      });
    }

    const result = await pool.query(
      `INSERT INTO orders
        (user_id, book_id, customer_name, customer_phone, note, status)
       VALUES ($1, $2, $3, $4, $5, 'new')
       RETURNING id`,
      [req.user.id, book.rows[0].id, name, phone, note || null],
    );

    res.status(201).json({
      success: true,
      message: "Buyurtmangiz qabul qilindi!",
      orderId: result.rows[0].id,
    });
  } catch (error) {
    console.error("Buyurtma yaratish xatosi:", error.message);

    res.status(500).json({
      message: "Buyurtma yuborishda xatolik yuz berdi.",
    });
  }
});
// Spamdan himoya: bitta IP dan soatiga 10 tagacha buyurtma
const orderHits = new Map();

function orderRateLimited(ip) {
  const now = Date.now();
  const hits = (orderHits.get(ip) || []).filter(
    (t) => now - t < 60 * 60 * 1000,
  );

  if (hits.length >= 10) {
    orderHits.set(ip, hits);
    return true;
  }

  hits.push(now);
  orderHits.set(ip, hits);
  return false;
}
app.get("/api/admin/orders", authenticate, adminOnly, async (req, res) => {
  try {
    const [list, stats] = await Promise.all([
      pool.query(
        `SELECT
           o.id,
           o.book_id,
           b.name AS book_name,
           b.price AS book_price,
           o.customer_name,
           o.customer_phone AS phone,
           o.note,
           o.status,
           o.created_at,
           o.updated_at
         FROM orders o
         LEFT JOIN books b ON b.id = o.book_id
         ORDER BY o.created_at DESC
         LIMIT 1000`,
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'new')::int AS pending
         FROM orders`,
      ),
    ]);

    res.json({ orders: list.rows, stats: stats.rows[0] });
  } catch (error) {
    console.error("Buyurtmalar ro'yxati xatosi:", error.message);
    res.status(500).json({
      message: "Buyurtmalarni yuklashda xatolik.",
    });
  }
});

// Admin: barcha buyurtmalar
app.get("/api/admin/orders", authenticate, adminOnly, async (req, res) => {
  try {
    const [list, stats] = await Promise.all([
      pool.query(
        `SELECT id, book_id, book_name, book_price, customer_name, phone, note,
                status, created_at, updated_at
         FROM orders
         ORDER BY created_at DESC, id DESC
         LIMIT 1000`,
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'new')::int AS pending
         FROM orders`,
      ),
    ]);

    res.json({ orders: list.rows, stats: stats.rows[0] });
  } catch (error) {
    console.error("Buyurtmalar ro'yxati xatosi:", error.message);
    res.status(500).json({ message: "Buyurtmalarni yuklashda xatolik." });
  }
});

// Admin: buyurtma holatini o'zgartiradi
app.patch(
  "/api/admin/orders/:id/status",
  authenticate,
  adminOnly,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const status = req.body.status;

      if (!Number.isInteger(id) || id < 1 || !ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Noto'g'ri ma'lumot." });
      }

      const result = await pool.query(
        `UPDATE orders SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, status`,
        [status, id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Buyurtma topilmadi." });
      }

      res.json({
        message: "Buyurtma holati yangilandi.",
        order: result.rows[0],
      });
    } catch (error) {
      console.error("Buyurtma holati xatosi:", error.message);
      res.status(500).json({ message: "Holatni yangilashda xatolik." });
    }
  },
);

// Admin: buyurtmani o'chiradi
app.delete(
  "/api/admin/orders/:id",
  authenticate,
  adminOnly,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ message: "Noto'g'ri ID." });
      }

      const result = await pool.query("DELETE FROM orders WHERE id = $1", [id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Buyurtma topilmadi." });
      }

      res.json({ message: "Buyurtma o'chirildi." });
    } catch (error) {
      console.error("Buyurtmani o'chirish xatosi:", error.message);
      res.status(500).json({ message: "Buyurtmani o'chirishda xatolik." });
    }
  },
);

// ======================= XATCHO'P RASMI =======================

const BOOKMARK_KEY = "bookmark_image";

// Hamma ko'ra oladi (profil sahifasida bo'laklar shu rasmdan ochiladi)
app.get("/api/bookmark", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT value FROM site_settings WHERE key = $1",
      [BOOKMARK_KEY],
    );

    res.json({ image: result.rows[0]?.value || null });
  } catch (error) {
    console.error("Xatcho'p rasmi xatosi:", error.message);
    res.status(500).json({ message: "Xatcho'p rasmini yuklashda xatolik." });
  }
});

app.put("/api/admin/bookmark", authenticate, adminOnly, async (req, res) => {
  try {
    const image = req.body.image;

    if (
      typeof image !== "string" ||
      image.length > 4000000 ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)
    ) {
      return res.status(400).json({
        message: "Rasm formati noto'g'ri. PNG, JPG yoki WEBP yuklang.",
      });
    }

    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [BOOKMARK_KEY, image],
    );

    res.json({ message: "Xatcho'p rasmi saqlandi." });
  } catch (error) {
    console.error("Xatcho'p saqlash xatosi:", error.message);
    res.status(500).json({ message: "Rasmni saqlashda xatolik." });
  }
});

app.delete("/api/admin/bookmark", authenticate, adminOnly, async (req, res) => {
  try {
    await pool.query("DELETE FROM site_settings WHERE key = $1", [
      BOOKMARK_KEY,
    ]);
    res.json({ message: "Xatcho'p rasmi o'chirildi." });
  } catch (error) {
    console.error("Xatcho'p o'chirish xatosi:", error.message);
    res.status(500).json({ message: "Rasmni o'chirishda xatolik." });
  }
});

// ======================= XATOLIKLARNI JSON QILIB QAYTARISH =======================

app.use("/api", (req, res) => {
  res.status(404).json({ message: "API manzili topilmadi." });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "So'rov formati noto'g'ri." });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Yuborilgan ma'lumot juda katta." });
  }

  console.error("Kutilmagan xatolik:", error.message);
  res.status(500).json({ message: "Serverda kutilmagan xatolik yuz berdi." });
});

// ======================= JADVALLARNI TAYYORLASH =======================

// Server ishga tushganda kerakli jadvallarni yaratadi (mavjud bo'lsa tegmaydi).
// id turlari mavjud users/books jadvallaridan o'qiladi, shuning uchun har qanday sxema bilan ishlaydi.
async function ensureSchema() {
  const columnType = async (table, column) => {
    const result = await pool.query(
      `SELECT format_type(a.atttypid, a.atttypmod) AS type
       FROM pg_attribute a
       WHERE a.attrelid = $1::regclass AND a.attname = $2 AND NOT a.attisdropped`,
      [table, column],
    );

    const type = result.rows[0]?.type;

    if (!type || !/^[a-z0-9 ()]+$/i.test(type)) {
      throw new Error(`${table}.${column} turi aniqlanmadi`);
    }

    return type;
  };

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        full_name     VARCHAR(150) NOT NULL,
        username      VARCHAR(24)  NOT NULL UNIQUE,
        password_hash TEXT         NOT NULL,
        phone         VARCHAR(30)  NOT NULL,
        email         VARCHAR(255),
        avatar        TEXT,
        role          VARCHAR(20)  NOT NULL DEFAULT 'user',
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS books (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        author      VARCHAR(255) NOT NULL,
        price       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
        category    VARCHAR(100),
        image       TEXT,
        description TEXT,
        stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        active      BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);

    await pool.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
    );
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT");
    await pool.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'",
    );
    await pool.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ",
    );
    await pool.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS prize_status VARCHAR(20)",
    );
    await pool.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS prize_delivered_at TIMESTAMPTZ",
    );

    await pool.query(
      "ALTER TABLE books ADD COLUMN IF NOT EXISTS description TEXT",
    );
    await pool.query(
      "ALTER TABLE books ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0",
    );
    await pool.query(
      "ALTER TABLE books ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE",
    );
    await pool.query(
      "ALTER TABLE books ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    );

    // Kitob muqovasi (base64 rasm) uchun TEXT bo'lishi kerak
    await pool.query("ALTER TABLE books ALTER COLUMN image TYPE TEXT");

    const userIdType = await columnType("users", "id");
    const bookIdType = await columnType("books", "id");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id         SERIAL PRIMARY KEY,
        code       VARCHAR(6) NOT NULL UNIQUE,
        batch      VARCHAR(50),
        piece      SMALLINT NOT NULL DEFAULT 1,
        used_by    ${userIdType} REFERENCES users(id) ON DELETE SET NULL,
        used_at    TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);

    await pool.query(
      "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS piece SMALLINT NOT NULL DEFAULT 1",
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_promo_codes_used_by ON promo_codes(used_by)",
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id            SERIAL PRIMARY KEY,
        user_id       ${userIdType} REFERENCES users(id) ON DELETE SET NULL,
        book_id       ${bookIdType} REFERENCES books(id) ON DELETE SET NULL,
        book_name     VARCHAR(255) NOT NULL,
        book_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
        customer_name VARCHAR(150) NOT NULL,
        phone         VARCHAR(30)  NOT NULL,
        note          TEXT,
        status        VARCHAR(20)  NOT NULL DEFAULT 'new',
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )`);

    // Eski/boshqacha orders jadvali bo'lsa ham ishlashi uchun ustunlarni tekshiramiz
    await pool.query(
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS book_name VARCHAR(255) NOT NULL DEFAULT ''",
    );
    await pool.query(
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS book_price NUMERIC(12,2) NOT NULL DEFAULT 0",
    );
    await pool.query(
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150) NOT NULL DEFAULT ''",
    );
    await pool.query(
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NOT NULL DEFAULT ''",
    );
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS note TEXT");
    await pool.query(
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'new'",
    );
    await pool.query(
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    );

    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)",
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key   VARCHAR(50) PRIMARY KEY,
        value TEXT
      )`);

    console.log("Database jadvallari tayyor.");
  } catch (error) {
    console.error("DIQQAT: jadvallarni tayyorlashda xatolik:", error.message);
  }
}

// .env dagi ADMIN_USERNAME ga ega foydalanuvchini admin qiladi
async function ensureAdmin() {
  const username = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  if (!username) return;

  try {
    const result = await pool.query(
      "UPDATE users SET role = 'admin' WHERE username = $1 AND role <> 'admin'",
      [username],
    );

    if (result.rowCount > 0) console.log(`@${username} admin qilindi.`);
  } catch (error) {
    console.error("Admin tayinlash xatosi:", error.message);
  }
}

const PORT = process.env.PORT || 5000;

(async () => {
  await ensureSchema();
  await ensureAdmin();

  app.listen(PORT, () => {
    console.log(
      `MizonBooks server http://localhost:${PORT} manzilida ishlayapti`,
    );
  });
})();
