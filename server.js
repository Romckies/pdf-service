import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour parser le JSON
app.use(express.json());

// Exemple de route simple
app.get("/", (req, res) => {
  res.send("🚀 PDF Service is running!");
});

// Exemple de route POST (ex: génération PDF)
app.post("/generate", async (req, res) => {
  try {
    const { html } = req.body;

    if (!html) {
      return res.status(400).json({ error: "Le champ 'html' est requis." });
    }

    // 👉 Ici tu pourrais mettre ton code Puppeteer / PDF
    // const pdfBuffer = await generatePDF(html);

    // Pour le test, on renvoie juste un message
    res.json({ message: "PDF généré avec succès !" });
  } catch (error) {
    console.error("Erreur génération PDF:", error);
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

// Démarrage serveur
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
