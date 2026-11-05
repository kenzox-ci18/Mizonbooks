# MizonBooks

Kitob do'koni + xatcho'p puzzle aksiyasi. Bitta Node.js server ham API, ham saytni tarqatadi.

## Ishga tushirish
1. `cd backend && npm install`
2. `backend/.env` ni to'ldiring (`.env.example` ga qarang): `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`
3. `npm start` → http://localhost:5000
4. Saytdan `ADMIN_USERNAME` dagi username bilan ro'yxatdan o'ting — bu hisob darhol admin bo'ladi va kirgach avtomatik admin panelga o'tadi (qayta ishga tushirish shart emas).

Jadvallar server ishga tushganda o'zi yaratiladi.

## Aksiya qanday ishlaydi
- Admin panel → Promo-kodlar → **Xatcho'p rasmi**: xatcho'p rasmini yuklaydi. Mijozning profilida shu rasm 4 bo'lakka (yuqoridan pastga) bo'linadi va har bir to'g'ri kod o'z bo'lagini ochadi. Rasm yuklanmasa, standart dizayn ko'rsatiladi.
- Admin panel → Promo-kodlar: bo'lak raqamini (1–4) tanlab kod yaratadi (tasodifiy yoki o'zi yozgan; o'zi yozganda bir nechta kodni vergul yoki yangi qator bilan kiritish mumkin).
- Foydalanuvchi kodni profilida kiritadi → xatcho'pning shu bo'lagi ochiladi.
- Bir xil bo'lakning ikkinchi kodi qabul qilinmaydi (kod sarflanmaydi).
- 4 ta bo'lak ham ochilsa → g'olib, Admin panel → G'oliblar ro'yxatida ko'rinadi.

## Buyurtmalar
Kitoblar sahifasidan kelgan buyurtmalar Admin panel → Buyurtmalar bo'limida (ism, telefon, kitob, izoh). Admin holatini o'zgartiradi: Yangi → Bog'lanildi → Topshirildi / Bekor qilindi.

## Kitob muqovasi
Admin panel → Kitoblar → kitob qo'shish/tahrirlash oynasida muqovani kompyuterdan yuklash yoki rasm havolasini kiritish mumkin.

## Xavfsizlik
- `backend/.env` faylini hech kimga yubormang va GitHub'ga yuklamang (`.gitignore` da bor). Agar parol ochiq qolgan bo'lsa, Neon'da almashtiring.
- Noto'g'ri parol (10 marta) va noto'g'ri promo-kod (5 marta) kiritilsa, 15 daqiqaga bloklanadi.
