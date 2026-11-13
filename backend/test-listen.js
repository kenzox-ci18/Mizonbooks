const http = require("node:http");

const server = http.createServer((req, res) => {
  res.end("MIZON TEST OK");
});

server.on("error", console.error);

server.listen(5055, "0.0.0.0", () => {
  console.log("TEST SERVER ISHLAYAPTI");
});

setInterval(() => {
  console.log("TEST SERVER TIRIK", process.pid);
}, 3000);
