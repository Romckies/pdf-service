import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" })); // autorise des payloads volumineux

// Route de test
app.get("/", (req, res) => {
  res.send("🚀 PDF Service is running!");
});

// Route génération PDF
app.post("/generate", async (req, res) => {
  try {
    const { html } = req.body;

    if (!html) {
      return res.status(400).json({ error: "Le champ 'html' est requis." });
    }

    // Lancer Puppeteer
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Charger le HTML fourni
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Générer le PDF
    const pdfBuffer = await page.pdf({ format: "A4" });

    await browser.close();

    // Répondre avec le PDF
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=generated.pdf",
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ Erreur génération PDF:", error);
    res.status(500).json({ error: "Erreur lors de la génération du PDF" });
  }
});

// Démarrage serveur
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
