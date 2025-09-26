import express from "express";
import bodyParser from "body-parser";
import puppeteer from "puppeteer-core";
import chromium from "chrome-aws-lambda";
import handlebars from "handlebars";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Configuration CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Helper Handlebars pour les comparaisons
handlebars.registerHelper('gte', function(a, b) {
  return a >= b;
});

handlebars.registerHelper('if_gte', function(a, b, options) {
  if (a >= b) {
    return options.fn(this);
  }
  return options.inverse(this);
});

// Charger le template
let template;
try {
  const templatePath = path.join(__dirname, "template.html");
  console.log("📂 Chargement du template depuis:", templatePath);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error("Template file not found");
  }
  
  const templateSource = fs.readFileSync(templatePath, "utf-8");
  template = handlebars.compile(templateSource);
  console.log("✅ Template chargé avec succès");
} catch (err) {
  console.error("❌ Erreur lors du chargement du template:", err);
  // Template de secours
  template = handlebars.compile(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Rapport d'Audit</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { color: #333; }
      </style>
    </head>
    <body>
      <h1>Rapport d'Audit - {{businessName}}</h1>
      <p>Score: {{auditScore}}/100</p>
      <p>Généré le {{generatedDate}}</p>
    </body>
    </html>
  `);
}

// Route de test
app.get("/", (req, res) => {
  res.json({ 
    status: "✅ PDF Service Optileo is running",
    endpoints: {
      health: "GET /",
      test: "GET /test-pdf",
      generate: "POST /generate-pdf"
    },
    version: "2.0.0",
    timestamp: new Date().toISOString()
  });
});

// Test PDF simple
app.get("/test-pdf", async (req, res) => {
  try {
    console.log("🧪 Génération d'un PDF de test...");
    
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    
    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
          }
          h1 { font-size: 48px; margin-bottom: 20px; }
          .info { 
            background: rgba(255,255,255,0.2);
            padding: 20px;
            border-radius: 10px;
            margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <h1>🚀 Test PDF Optileo</h1>
        <p>Service de génération PDF opérationnel</p>
        <div class="info">
          <p>📅 Date: ${new Date().toLocaleString('fr-FR')}</p>
          <p>✅ Puppeteer: OK</p>
          <p>✅ Chrome: OK</p>
          <p>✅ Template: OK</p>
        </div>
      </body>
      </html>
    `;
    
    await page.setContent(testHtml, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({ 
      format: "A4", 
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    await browser.close();
    
    console.log("✅ PDF de test généré avec succès");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=test-optileo.pdf");
    res.send(pdfBuffer);
    
  } catch (err) {
    console.error("❌ Erreur test PDF:", err);
    res.status(500).json({ 
      error: "Erreur lors de la génération du PDF de test",
      details: err.message 
    });
  }
});

// Route principale de génération
app.post("/generate-pdf", async (req, res) => {
  console.log("📄 Nouvelle demande de génération PDF");
  
  try {
    const { auditData, businessName, auditScore, userDetails, generatedDate } = req.body;

    if (!auditData && !auditScore) {
      return res.status(400).json({ 
        error: "Données d'audit manquantes",
        required: ["auditData ou auditScore", "businessName"]
      });
    }

    // Préparer les données du template
    const templateData = {
      businessName: businessName || userDetails?.name || "Entreprise",
      auditScore: auditScore || auditData?.audit_score || 0,
      generatedDate: generatedDate || new Date().toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      strengths: auditData?.strengths || [],
      criticalIssues: auditData?.critical_issues || [],
      recommendations: auditData?.recommendations || [],
      categoryScores: auditData?.category_scores || {}
    };

    console.log("📊 Données du template:", {
      businessName: templateData.businessName,
      score: templateData.auditScore,
      categories: Object.keys(templateData.categoryScores).length
    });

    // Générer le HTML
    const html = template(templateData);

    // Lancer Puppeteer
    console.log("🚀 Lancement de Puppeteer...");
    const browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    
    // Configuration de la page
    await page.setViewport({ width: 1200, height: 1600 });
    
    // Injecter le HTML
    await page.setContent(html, { 
      waitUntil: ["networkidle0", "domcontentloaded", "load"] 
    });

    // Attendre que les fonts soient chargées
    await page.evaluateHandle('document.fonts.ready');
    
    // Attendre un peu pour s'assurer que tout est rendu
    await page.waitForTimeout(1000);

    // Générer le PDF
    console.log("📑 Génération du PDF...");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { 
        top: "10mm", 
        right: "10mm", 
        bottom: "10mm", 
        left: "10mm" 
      },
      displayHeaderFooter: false
    });

    await browser.close();

    const filename = `audit_${businessName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
    
    console.log(`✅ PDF généré avec succès: ${filename} (${pdfBuffer.length} bytes)`);

    // Envoyer le PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (err) {
    console.error("❌ Erreur lors de la génération du PDF:", err);
    res.status(500).json({ 
      error: "Erreur lors de la génération du PDF",
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║       🚀 OPTILEO PDF SERVICE             ║
╠══════════════════════════════════════════╣
║  Port: ${PORT}                              ║
║  Status: ✅ Running                      ║
║  Endpoints:                              ║
║    GET  /          → Health check        ║
║    GET  /test-pdf  → Test PDF            ║
║    POST /generate-pdf → Generate PDF     ║
╚══════════════════════════════════════════╝
  `);
});