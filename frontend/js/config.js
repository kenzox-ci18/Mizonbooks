
// MizonBooks backend manzili
const API_URL = (() => {
  const { protocol, hostname, port } = window.location;

  // Kompyuterda lokal ishlash
  if (protocol === "file:") {
    return "http://localhost:5000/api";
  }

  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocal) {
    return "http://localhost:5000/api";
  }

  // Internetdagi haqiqiy backend
  return "https://mizonbooks-api.onrender.com/api";
})();
