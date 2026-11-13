# MizonBooks

Kitob do'koni + xatcho'p puzzle aksiyasi. Bitta Node.js server ham API, ham saytni tarqatadi.

## Ishga tushirish
1. `cd backend && npm install`
2. `backend/.env` ni to'ldiring (`.env.example` ga qarang): `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`
3. `npm start` → http://localhost:5000
4. Saytdan (`login.html` sahifasida "Hisob yaratish") `ADMIN_USERNAME` dagi username bilan ro'yxatdan o'ting — bu hisob darhol admin bo'ladi va kirgach avtomatik admin panelga o'tadi (qayta ishga tushirish shart emas).

Jadvallar server ishga tushganda o'zi yaratiladi.

## Do'kon, savat va kirish
- Sayt ochilganda mijoz darhol kitob do'koniga (`books.html`) tushadi, ro'yxatdan o'tish shart emas.
- Kitoblar "Savatga qo'shish" tugmasi bilan savatga tushadi (savat brauzerda saqlanadi, sahifani yangilasa ham yo'qolmaydi).
- "Buyurtma berish" bosilganda mijoz tizimga kirmagan bo'lsa, `login.html` ga o'tadi (username/parol yoki **Google orqali**) va kirgach savati bilan buyurtma oynasiga qaytadi.
- Savatdagi har bir kitob admin panelda alohida buyurtma bo'lib tushadi; soni 1 dan ko'p bo'lsa izohda "Soni: N dona" yoziladi.

## Google orqali kirish
1. https://console.cloud.google.com → APIs & Services → Credentials → **Create credentials → OAuth client ID → Web application**.
2. **Authorized JavaScript origins** ga sayt manzillarini qo'shing (masalan `https://sizning-sayt.uz`, lokal uchun `http://localhost:5000`).
3. Olingan **Client ID** ni `backend/.env` ga `GOOGLE_CLIENT_ID=...` qilib yozing va serverni qayta ishga tushiring.
4. Google orqali kirgan mijoz uchun hisob avtomatik yaratiladi (telefon raqam bo'lmaydi: buyurtma berishda yoki profilda kiritadi).

## Aksiya qanday ishlaydi
- Admin panel → Promo-kodlar → **Xatcho'p rasmi**: xatcho'p rasmini yuklaydi. Mijozning profilida shu rasm 4 bo'lakka (yuqoridan pastga) bo'linadi va har bir to'g'ri kod o'z bo'lagini ochadi. Rasm yuklanmasa, standart dizayn ko'rsatiladi.
- Admin panel → Promo-kodlar: bo'lak raqamini (1–4) tanlab kod yaratadi (tasodifiy yoki o'zi yozgan; o'zi yozganda bir nechta kodni vergul yoki yangi qator bilan kiritish mumkin).
- Foydalanuvchi kodni profilida kiritadi → xatcho'pning shu bo'lagi ochiladi.
- Bir xil bo'lakning ikkinchi kodi qabul qilinmaydi (kod sarflanmaydi).
- 4 ta bo'lak ham ochilsa → g'olib, Admin panel → G'oliblar ro'yxatida ko'rinadi.

## Buyurtmalar
Kitoblar sahifasidan kelgan buyurtmalar Admin panel → Buyurtmalar bo'limida (ism, telefon, kitob, izoh). Admin holatini o'zgartiradi: Yangi → Bog'lanildi → Topshirildi / Bekor qilindi.

## Profil rasmi
Profilni tahrirlash oynasida rasmni kompyuter/telefondan yuklash yoki havola kiritish mumkin (rasm 256x256 ga kichraytirilib saqlanadi).

## Kitob muqovasi
Admin panel → Kitoblar → kitob qo'shish/tahrirlash oynasida muqovani kompyuterdan yuklash yoki rasm havolasini kiritish mumkin.

## Xavfsizlik
- `backend/.env` faylini hech kimga yubormang va GitHub'ga yuklamang (`.gitignore` da bor). Agar parol ochiq qolgan bo'lsa, Neon'da almashtiring.
- Noto'g'ri parol (10 marta) va noto'g'ri promo-kod (5 marta) kiritilsa, 15 daqiqaga bloklanadi.
