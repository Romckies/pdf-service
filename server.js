import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "chromium";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));

// Route de test
app.get("/", (req, res) => {
  res.send("🚀 PDF Service is running with puppeteer-core + chromium!");
});

// Route de génération PDF
app.post("/generate", async (req, res) => {
  try {
    const { html } = req.body;

    if (!html) {
      return res.status(400).json({ error: "Le champ 'html' est requis." });
    }

    // Lancer Chromium via puppeteer-core
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: chromium.path, // 👉 utilise le binaire chromium installé
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({ format: "A4" });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=generated.pdf",
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ Erreur génération PDF:", err);
    res.status(500).json({ error: "Erreur lors de la génération du PDF" });
  }
});

// Démarrage serveur
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
