const express = require("express");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

// 1. Les fichiers du front-end (index.html, style.css, script.js)
app.use(express.static(path.join(__dirname, "public")));

// 2. Tout le reste (/api, /health, liens courts) est transmis au backend
app.use(createProxyMiddleware({ target: BACKEND_URL, changeOrigin: true }));

app.listen(PORT, () => {
  console.log(`Front disponible sur http://localhost:${PORT}`);
  console.log(`Requêtes API transmises à ${BACKEND_URL}`);
});