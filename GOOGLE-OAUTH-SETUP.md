# Google OAuth sozlash

1. Google Cloud Console -> APIs & Services -> Credentials -> Create Credentials -> OAuth client ID -> Web application.
2. Authorized JavaScript origins ga lokal manzilni (`http://localhost:5000`) va `https://mizonbooks-web.onrender.com` production domenini kiriting.
3. Client ID ni `backend/.env` ichidagi `GOOGLE_CLIENT_ID` ga yozing. Client Secret bu GIS ID-token oqimida backendga kerak emas.
4. `ADMIN_EMAIL` ga admin Google akkauntining tasdiqlangan emailini yozing. `ADMIN_USERNAME` mavjud eski admin akkauntini ham admin holatda saqlaydi.
5. `cd backend && npm install && npm start`.

Eski login/parol bilan ochilgan akkauntlar o'chirilmaydi. O'sha akkauntning Google emaili mos kelsa, birinchi Google kirishda akkaunt Google ID bilan bog'lanadi. Google OAuth sozlanmaguncha yangi Google login ishlamaydi.

# Savat va buyurtmalar

Savat `cart_items` jadvalida saqlanadi. Checkout bitta DB tranzaksiyasida buyurtma va buyurtma tarkibini yaratadi, kitob qoldig'ini kamaytiradi va savatni tozalaydi. Jismoniy zakladkadagi 4 bo'lakli sovrin promokodlari `promo_codes` jadvalida qoladi; ular chegirma kuponi bilan aralashtirilmaydi.

# Eslatma

Google Client ID va DB/JWT sozlamalari maxfiy `.env` faylida saqlanadi. `.env` repoga yoki ZIPga qo'shilmaydi.
