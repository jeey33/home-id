const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ======================================================
// CONFIGURATION DE LA BASE DE DONNÉES (PostgreSQL)
// ======================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://localhost:5432/homeid",
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// ======================================================
// INITIALISATION AUTOMATIQUE DES TABLES
// ======================================================
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS home (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        year INT,
        surface INT,
        land INT,
        owner_password VARCHAR(255),
        is_setup BOOLEAN DEFAULT FALSE
      );
      CREATE TABLE IF NOT EXISTS systems (
        id VARCHAR(50) PRIMARY KEY,
        home_id VARCHAR(50) REFERENCES home(id),
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
        home_id VARCHAR(50) REFERENCES home(id),
        title VARCHAR(255),
        text TEXT,
        date VARCHAR(50)
      );
      CREATE TABLE IF NOT EXISTS professionals (
        id SERIAL PRIMARY KEY,
        home_id VARCHAR(50) REFERENCES home(id),
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
    console.log("Base de données connectée et prête !");
  } catch (error) {
    console.error("Erreur d'initialisation de la base de données :", error);
  }
}

initDB();

// ======================================================
// FICHIERS PUBLICS
// ======================================================
app.use(express.static(path.join(__dirname, "public")));

// ======================================================
// 📱 LE SCANNEUR DE QR CODE (LE PONT PHYSIQUE / DIGITAL)
// ======================================================
app.get("/scan/:id", async (req, res) => {
  const scannedId = req.params.id;

  try {
    const checkHome = await pool.query(`SELECT is_setup FROM home WHERE id = $1`, [scannedId]);

    if (checkHome.rows.length === 0) {
      // La maison n'existe pas -> Création
      return res.redirect(`/setup.html?id=${scannedId}`);
    } else {
      // La maison existe -> On charge l'interface avec demande de popup login
      return res.redirect(`/?id=${scannedId}&login=true`);
    }
  } catch (err) {
    console.error("Erreur de scan :", err);
    res.status(500).send("Erreur de lecture du QR Code.");
  }
});

// ======================================================
// 🔒 VÉRIFICATION MOT DE PASSE (LOGIN POPUP)
// ======================================================
app.post("/api/login", async (req, res) => {
  const { id, password } = req.body;

  try {
    const user = await pool.query(`SELECT id FROM home WHERE id = $1 AND owner_password = $2`, [id, password]);
    
    if (user.rows.length > 0) {
      res.json({ ok: true, role: "owner" });
    } else {
      res.status(401).json({ error: "Mot de passe incorrect." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ======================================================
// SETUP DE LA MAISON (AVEC MOT DE PASSE)
// ======================================================
app.post("/api/setup", async (req, res) => {
  // Le frontend envoie désormais l'ID du QR code et le mot de passe choisi
  const { id, name, year, surface, land, password } = req.body;
  
  if (!id || !name || !year || !password) {
    return res.status(400).json({ error: "Champs obligatoires manquants." });
  }

  try {
    // 1. Enregistrer la maison
    await pool.query(
      `INSERT INTO home (id, name, year, surface, land, owner_password, is_setup) VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
      [id, name, parseInt(year), parseInt(surface) || 0, parseInt(land) || 0, password]
    );

    // 2. Créer les systèmes par défaut (liés à cette maison spécifique)
    const defaultSystems = [
      { id: `elec_${id}`, name: "Électricité", icon: "⚡", status: "À configurer", color: "orange" },
      { id: `eau_${id}`, name: "Plomberie & Eau", icon: "💧", status: "À configurer", color: "orange" },
      { id: `chauffe_${id}`, name: "Chauffage", icon: "🔥", status: "À configurer", color: "orange" },
      { id: `clim_${id}`, name: "Clim & VMC", icon: "❄️", status: "À configurer", color: "orange" },
      { id: `piscine_${id}`, name: "Piscine & Spa", icon: "🏊", status: "À configurer", color: "orange" },
      { id: `ext_${id}`, name: "Extérieur", icon: "🌳", status: "À configurer", color: "orange" },
      { id: `domo_${id}`, name: "Réseau & Sécurité", icon: "📡", status: "À configurer", color: "orange" }
    ];

    for (let sys of defaultSystems) {
      await pool.query(
        `INSERT INTO systems (id, home_id, name, icon, status, color) VALUES ($1, $2, $3, $4, $5, $6)`,
        [sys.id, id, sys.name, sys.icon, sys.status, sys.color]
      );
    }

    res.json({ ok: true, id: id });

  } catch (err) {
    console.error("ERREUR SQL LORS DU SETUP :", err);
    res.status(500).json({ error: "Erreur serveur lors du setup." });
  }
});

// ======================================================
// INFOS MAISON
// ======================================================
app.get("/api/home", async (req, res) => {
  const homeId = req.query.id; // Désormais l'app demande une maison précise

  if (!homeId) return res.status(400).json({ error: "ID de maison manquant." });

  try {
    const homeResult = await pool.query(`SELECT * FROM home WHERE id = $1`, [homeId]);
    if (homeResult.rows.length === 0) return res.status(404).json({ error: "Maison introuvable." });
    
    const home = homeResult.rows[0];

    const systemsResult = await pool.query(`SELECT * FROM systems WHERE home_id = $1`, [homeId]);
    let systems = systemsResult.rows;

    const equipCount = await pool.query(
      `SELECT system_id, COUNT(*) as count FROM equipment 
       WHERE system_id IN (SELECT id FROM systems WHERE home_id = $1) 
       GROUP BY system_id`, [homeId]
    );
    
    systems = systems.map(sys => {
      const match = equipCount.rows.find(e => e.system_id === sys.id);
      return { ...sys, equipment: match ? parseInt(match.count) : 0 };
    });

    const alertsResult = await pool.query(`SELECT * FROM alerts WHERE home_id = $1 ORDER BY id DESC`, [homeId]);
    const prosResult = await pool.query(`SELECT * FROM professionals WHERE home_id = $1 ORDER BY id DESC`, [homeId]);

    res.json({
      id: home.id,
      name: home.name,
      year: home.year,
      surface: home.surface,
      land: home.land,
      role: "owner", // Par défaut. À adapter selon l'accès (Artisan/Proprio)
      systems: systems,
      alerts: alertsResult.rows,
      professionals: prosResult.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
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
      return res.status(404).json({ error: "Système introuvable" });
    }
    const system = sysResult.rows[0];

    const equipResult = await pool.query(`SELECT * FROM equipment WHERE system_id = $1 ORDER BY created_at ASC`, [systemId]);
    const docsResult = await pool.query(`SELECT * FROM documents WHERE system_id = $1`, [systemId]);

    res.json({
      id: system.id,
      name: system.name,
      icon: system.icon,
      equipment: equipResult.rows || [],
      documents: docsResult.rows || []
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

  const eqId = "EQ-" + Date.now().toString(36).toUpperCase();
  const installedDate = new Date().toLocaleDateString("fr-FR");

  try {
    await pool.query(
      `INSERT INTO equipment (id, system_id, name, model, installed, notice, artisan, specs) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [eqId, systemId, name, model || "", installedDate, notice || null, artisan || null, specs || {}]
    );

    await pool.query(`UPDATE systems SET status = 'À jour', color = 'green' WHERE id = $1`, [systemId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ======================================================
// DÉMARRAGE DU SERVEUR
// ======================================================
app.listen(PORT, () => {
  console.log(`HOME ID fonctionne sur le port ${PORT}`);
});
