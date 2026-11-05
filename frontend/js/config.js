// Backend manzili. Frontend backend bilan bir joyda yuklansa "/api" ishlaydi.
const API_URL = (() => {
  const { protocol, hostname, port } = window.location;

  if (protocol === "file:") return "http://localhost:5000/api";

  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocal && port && port !== "5000") return `http://${hostname}:5000/api`;

  return "/api";
})();
