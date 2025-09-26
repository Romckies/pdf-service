import express from "express";
import bodyParser from "body-parser";
import puppeteer from "puppeteer-core";   // ⬅️ puppeteer-core
import chromium from "chromium";          // ⬅️ chromium
import handlebars from "handlebars";
import fs from "fs";
import path from "path";

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

// ... ton code template etc ...

app.post("/generate-pdf", async (req, res) => {
  try {
    const { auditData, userDetails, generatedDate } = req.body;

    if (!auditData) {
      return res.status(400).json({ error: "auditData requis" });
    }

    // préparer le HTML (inchangé)
    const html = template({
      auditScore: auditData.audit_score,
      audit_results: auditData.audit_results,
      strengths: auditData.audit_results?.strengths,
      criticalIssues: auditData.audit_results?.critical_issues,
      recommendations: auditData.audit_results?.recommendations,
      categoryScores: auditData.audit_results?.category_scores,
      userDetails,
      generatedDate
    });

    // 🚀 Lancement avec chromium.path
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromium.path,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (err) {
    console.error("🚨 Erreur génération PDF:", err);
    res.status(500).json({
      error: "Erreur génération PDF",
      details: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Service PDF en écoute sur http://localhost:${PORT}`);
});
