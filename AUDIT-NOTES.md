# MIZON BOOKS — yangilanish eslatmasi

Ushbu paketga Google OAuth ID-token tekshiruvi, mavjud email bo'yicha akkauntni bog'lash, savat API'si, tranzaksiyali checkout va order_items qo'shildi. 4 bo'lakli fizik promo-kod tizimi saqlandi.

Muhim: Google OAuth ishlashi uchun Google Cloud'dan `GOOGLE_CLIENT_ID`, database uchun `DATABASE_URL`, JWT uchun kuchli `JWT_SECRET`, admin uchun `ADMIN_EMAIL`/`ADMIN_USERNAME` kiritilishi shart. Bu qiymatlar ZIPga kiritilmagan.

Mavjud eski users/books/promo_codes/orders ma'lumotlari uchun migratsiya `ensureSchema()` orqali qo'shiladi. Server schema migratsiyasi xato bersa endi xatoni yashirmay ishga tushishni to'xtatadi.

Tekshiruv: Node sintaksis tekshiruvi va lokal statik tekshiruvlar bajariladi. Haqiqiy Google OAuth, PostgreSQL tranzaksiyalari va production domeni uchun tegishli Google Cloud/DB/hosting credentials zarur; ular bo'lmasa live integratsiya tasdiqlangan deb hisoblanmaydi.
