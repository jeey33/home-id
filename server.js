const express = require("express");
const path = require("path");
const { Pool } = require("pg"); // Ajout du module PostgreSQL

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ======================================================
// CONFIGURATION DE LA BASE DE DONNÉES (PostgreSQL)
// ======================================================

// Sur Render, la variable d'environnement DATABASE_URL est automatiquement fournie
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://localhost:5432/homeid", // Fallback local si besoin
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false // Requis par Render
});

// Variable globale pour éviter d'interroger la BDD à chaque chargement de page statique
let isSetupCached = false;

// ======================================================
// INITIALISATION AUTOMATIQUE DES TABLES
// ======================================================
async function initDB() {
  try {
    // 1. Création des tables si elles n'existent pas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS home (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        year INT,
        surface INT,
        land INT,
        is_setup BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS systems (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        icon VARCHAR(10),
        status VARCHAR(50),
        color VARCHAR(20)
      );

      CREATE TABLE IF NOT EXISTS equipment (
        id VARCHAR(50) PRIMARY KEY,
        system_id VARCHAR(50) REFERENCES systems(id),
        name VARCHAR(100),
        model VARCHAR(100),
        installed VARCHAR(50),
        notice VARCHAR(255),
        artisan VARCHAR(100),
        specs JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        text TEXT,
        date VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS professionals (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        domain VARCHAR(100),
        access VARCHAR(50),
        expires VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(50) PRIMARY KEY,
        system_id VARCHAR(50) REFERENCES systems(id),
        name VARCHAR(255),
        added VARCHAR(50)
      );
    `);

    // 2. Vérifier si la maison est déjà configurée
    const checkSetup = await pool.query(`SELECT is_setup FROM home LIMIT 1`);
    if (checkSetup.rows.length > 0 && checkSetup.rows[0].is_setup) {
      isSetupCached = true;
    }

    console.log("Base de données connectée et vérifiée ! (Setup:", isSetupCached, ")");
  } catch (error) {
    console.error("Erreur d'initialisation de la base de données :", error);
  }
}

// Lancer l'initialisation au démarrage
initDB();

// ======================================================
// REDIRECTION SETUP
// ======================================================
app.use((req, res, next) => {
  if ((req.path === "/" || req.path === "/index.html") && !isSetupCached) {
    return res.redirect("/setup.html");
  }
  if (req.path === "/setup.html" && isSetupCached) {
    return res.redirect("/");
  }
  next();
});

// ======================================================
// FICHIERS PUBLICS
// ======================================================
app.use(express.static(path.join(__dirname, "public")));

// ======================================================
// SETUP DE LA MAISON
// ======================================================
app.post("/api/setup", async (req, res) => {
  if (isSetupCached) {
    return res.status(403).json({ error: "Maison déjà configurée." });
  }

  const { name, year, surface, land } = req.body;
  if (!name || !year) {
    return res.status(400).json({ error: "Le nom et l'année sont obligatoires." });
  }

  const homeId = "HID-" + Math.random().toString(36).substring(2, 8).toUpperCase();

  try {
    // 1. Nettoyer au cas où il y aurait eu un plantage précédent
    await pool.query(`DELETE FROM home`);

    // 2. Enregistrer la maison
    await pool.query(
      `INSERT INTO home (id, name, year, surface, land, is_setup) VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [homeId, name, parseInt(year), parseInt(surface) || 0, parseInt(land) || 0]
    );

    // 3. Créer les systèmes par défaut (en ignorant s'ils existent déjà)
    const defaultSystems = [
      { id: "electricite", name: "Électricité", icon: "⚡", status: "À configurer", color: "orange" },
      { id: "eau", name: "Plomberie & Eau", icon: "💧", status: "À configurer", color: "orange" },
      { id: "chauffage", name: "Chauffage", icon: "🔥", status: "À configurer", color: "orange" },
      { id: "climatisation", name: "Clim & VMC", icon: "❄️", status: "À configurer", color: "orange" },
      { id: "piscine", name: "Piscine & Spa", icon: "🏊", status: "À configurer", color: "orange" },
      { id: "exterieur", name: "Extérieur & Fermetures", icon: "🌳", status: "À configurer", color: "orange" },
      { id: "domotique", name: "Réseau & Sécurité", icon: "📡", status: "À configurer", color: "orange" }
    ];

    for (let sys of defaultSystems) {
      await pool.query(
        `INSERT INTO systems (id, name, icon, status, color) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (id) DO NOTHING`,
        [sys.id, sys.name, sys.icon, sys.status, sys.color]
      );
    }

    isSetupCached = true;
    res.json({ ok: true, id: homeId });

  } catch (err) {
    console.error("ERREUR SQL LORS DU SETUP :", err);
    res.status(500).json({ error: "Erreur serveur lors du setup." });
  }
});

// ======================================================
// INFOS MAISON
// ======================================================
app.get("/api/home", async (req, res) => {
  if (!isSetupCached) {
    return res.status(403).json({ error: "Maison non configurée." });
  }

  const role = req.query.role || "owner";

  try {
    const homeResult = await pool.query(`SELECT * FROM home LIMIT 1`);
    const home = homeResult.rows[0];

    const systemsResult = await pool.query(`SELECT * FROM systems`);
    let systems = systemsResult.rows;

    // Récupérer le nombre d'équipements pour chaque système
    const equipCount = await pool.query(`SELECT system_id, COUNT(*) as count FROM equipment GROUP BY system_id`);
    
    systems = systems.map(sys => {
      const match = equipCount.rows.find(e => e.system_id === sys.id);
      return { ...sys, equipment: match ? parseInt(match.count) : 0 };
    });

    // Filtrage selon le rôle (Artisan)
    if (role === "electricien") {
      systems = systems.filter(s => ["electricite", "domotique"].includes(s.id));
    } else if (role === "pisciniste") {
      systems = systems.filter(s => s.id === "piscine");
    } else if (role === "clim") {
      systems = systems.filter(s => ["climatisation", "chauffage"].includes(s.id));
    }

    const alertsResult = await pool.query(`SELECT * FROM alerts ORDER BY id DESC`);
    const prosResult = await pool.query(`SELECT * FROM professionals ORDER BY id DESC`);

    res.json({
      id: home.id,
      name: home.name,
      year: home.year,
      surface: home.surface,
      land: home.land,
      role: role,
      systems: systems,
      alerts: alertsResult.rows,
      professionals: prosResult.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la récupération des données." });
  }
});

// ======================================================
// OUVRIR UN SYSTÈME
// ======================================================
app.get("/api/systems/:id", async (req, res) => {
  const systemId = req.params.id;

  try {
    const sysResult = await pool.query(`SELECT * FROM systems WHERE id = $1`, [systemId]);
    if (sysResult.rows.length === 0) {
      return res.status(404).json({ error: "Système introuvable", systemId });
    }
    const system = sysResult.rows[0];

    const equipResult = await pool.query(`SELECT * FROM equipment WHERE system_id = $1 ORDER BY created_at ASC`, [systemId]);
    const docsResult = await pool.query(`SELECT * FROM documents WHERE system_id = $1`, [systemId]);

    res.json({
      id: system.id,
      name: system.name,
      icon: system.icon,
      equipment: equipResult.rows || [],
      documents: docsResult.rows || [],
      lastMaintenance: null,
      nextMaintenance: null
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ======================================================
// AJOUT D'UN ÉQUIPEMENT
// ======================================================
app.post("/api/equipment", async (req, res) => {
  const { systemId, name, model, artisan, notice, specs } = req.body;

  if (!systemId || !name) {
    return res.status(400).json({ error: "Le système et le nom sont obligatoires." });
  }

  const eqId = "EQ-" + Date.now().toString(36).toUpperCase();
  const installedDate = new Date().toLocaleDateString("fr-FR");

  try {
    // 1. Ajouter l'équipement
    await pool.query(
      `INSERT INTO equipment (id, system_id, name, model, installed, notice, artisan, specs) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [eqId, systemId, name, model || "", installedDate, notice || null, artisan || null, specs || {}]
    );

    // 2. Mettre à jour le statut du système
    await pool.query(
      `UPDATE systems SET status = 'À jour', color = 'green' WHERE id = $1`,
      [systemId]
    );

    res.json({ ok: true, equipment: { id: eqId, name, model } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de l'enregistrement." });
  }
});

// ======================================================
// AJOUT D'UN RAPPEL (ALERT)
// ======================================================
app.post("/api/alerts", async (req, res) => {
  const { title, text, date } = req.body;

  if (!title || !text || !date) {
    return res.status(400).json({ error: "Titre, action et date obligatoires." });
  }

  try {
    await pool.query(
      `INSERT INTO alerts (title, text, date) VALUES ($1, $2, $3)`,
      [title, text, date]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la programmation." });
  }
});

// ======================================================
// AJOUT DOCUMENT
// ======================================================
app.post("/api/documents", async (req, res) => {
  const { systemId, name } = req.body;

  if (!systemId || !name) {
    return res.status(400).json({ error: "Système et nom du document obligatoires." });
  }

  const docId = "DOC-" + Date.now().toString(36).toUpperCase();
  const addedDate = new Date().toLocaleDateString("fr-FR");

  try {
    await pool.query(
      `INSERT INTO documents (id, system_id, name, added) VALUES ($1, $2, $3, $4)`,
      [docId, systemId, name, addedDate]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de l'ajout du document." });
  }
});

// ======================================================
// DÉMARRAGE DU SERVEUR
// ======================================================
app.listen(PORT, () => {
  console.log(`HOME ID fonctionne sur le port ${PORT}`);
});
