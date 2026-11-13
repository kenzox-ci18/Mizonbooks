// MizonBooks backend manzili
const API_URL = (() => {
  const { protocol, hostname, port, origin } = window.location;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  // Fayl to'g'ridan-to'g'ri ochilsa (file://) yoki VS Code Live Server (5500/5501) bo'lsa,
  // lokal backend (5000-port) ishlatiladi
  if (protocol === "file:" || (isLocal && (port === "5500" || port === "5501"))) {
    return "http://localhost:5000/api";
  }

  // Backend saytning o'zini ham tarqatadi, shuning uchun API shu manzilda
  // (agar frontend alohida joyda bo'lsa, shu yerga backend manzilini yozing)
  return `${origin}/api`;
})();
