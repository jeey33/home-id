const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/* =====================================================
   BASE DE DONNÉES POSTGRESQL
===================================================== */

if (!process.env.DATABASE_URL) {
  console.error("ERREUR : DATABASE_URL n'est pas configurée.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5
});


/* =====================================================
   INITIALISATION DE LA BASE
===================================================== */

async function initDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS homes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      year INTEGER,
      surface INTEGER,
      land INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS systems (
      id SERIAL PRIMARY KEY,
      home_id TEXT REFERENCES homes(id) ON DELETE CASCADE,
      system_key TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      status TEXT,
      color TEXT,
      UNIQUE(home_id, system_key)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS equipment (
      id SERIAL PRIMARY KEY,
      system_id INTEGER REFERENCES systems(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      model TEXT,
      installed TEXT,
      specs JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      home_id TEXT REFERENCES homes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      text TEXT,
      date TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS professionals (
      id SERIAL PRIMARY KEY,
      home_id TEXT REFERENCES homes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      domain TEXT,
      access TEXT,
      expires TEXT
    );
  `);

  console.log("Base de données HOME ID initialisée.");
}


/* =====================================================
   PAGE / API
===================================================== */

app.use((req, res, next) => {

  if (
    (req.path === "/" || req.path === "/index.html") &&
    req.path !== "/setup.html"
  ) {
    next();
    return;
  }

  next();
});


app.use(express.static(path.join(__dirname, "public")));


/* =====================================================
   SETUP MAISON
===================================================== */

app.post("/api/setup", async (req, res) => {

  try {

    const { name, year, surface, land } = req.body;

    if (!name || !year) {
      return res.status(400).json({
        error: "Nom et année requis."
      });
    }

    const existing = await pool.query(
      "SELECT id FROM homes LIMIT 1"
    );

    if (existing.rows.length > 0) {
      return res.status(403).json({
        error: "Une maison existe déjà."
      });
    }

    const homeId =
      "HID-" +
      Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();


    await pool.query(
      `
      INSERT INTO homes
      (id, name, year, surface, land)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        homeId,
        name,
        parseInt(year),
        parseInt(surface) || 0,
        parseInt(land) || 0
      ]
    );


    const systems = [

      ["electricite", "Électricité", "⚡", "À configurer", "orange"],

      ["eau", "Plomberie & Eau", "💧", "À configurer", "orange"],

      ["chauffage", "Chauffage", "🔥", "À configurer", "orange"],

      ["climatisation", "Clim & VMC", "❄️", "À configurer", "orange"],

      ["piscine", "Piscine & Spa", "🏊", "À configurer", "orange"],

      ["exterieur", "Extérieur & Fermetures", "🌳", "À configurer", "orange"],

      ["domotique", "Réseau & Sécurité", "📡", "À configurer", "orange"]

    ];


    for (const system of systems) {

      await pool.query(
        `
        INSERT INTO systems
        (home_id, system_key, name, icon, status, color)
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          homeId,
          system[0],
          system[1],
          system[2],
          system[3],
          system[4]
        ]
      );

    }


    res.json({
      ok: true,
      id: homeId
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Erreur création maison."
    });

  }

});


/* =====================================================
   GET HOME
===================================================== */

app.get("/api/home", async (req, res) => {

  try {

    const homeResult = await pool.query(
      `
      SELECT *
      FROM homes
      ORDER BY created_at
      LIMIT 1
      `
    );

    if (homeResult.rows.length === 0) {

      return res.status(403).json({
        error: "Maison non configurée"
      });

    }

    const home = homeResult.rows[0];


    const systemsResult = await pool.query(
      `
      SELECT
        s.*,
        COUNT(e.id)::integer AS equipment
      FROM systems s
      LEFT JOIN equipment e
        ON e.system_id = s.id
      WHERE s.home_id = $1
      GROUP BY s.id
      ORDER BY s.id
      `,
      [home.id]
    );


    const alertsResult = await pool.query(
      `
      SELECT *
      FROM alerts
      WHERE home_id = $1
      ORDER BY created_at DESC
      `,
      [home.id]
    );


    const professionalsResult = await pool.query(
      `
      SELECT *
      FROM professionals
      WHERE home_id = $1
      ORDER BY id DESC
      `,
      [home.id]
    );


    const role = req.query.role || "owner";

    let systems = systemsResult.rows;


    if (role === "electricien") {

      systems = systems.filter(s =>
        ["electricite", "domotique"].includes(s.system_key)
      );

    }

    else if (role === "pisciniste") {

      systems = systems.filter(
        s => s.system_key === "piscine"
      );

    }

    else if (role === "clim") {

      systems = systems.filter(s =>
        ["climatisation", "chauffage"].includes(s.system_key)
      );

    }


    res.json({

      id: home.id,

      name: home.name,

      year: home.year,

      surface: home.surface,

      land: home.land,

      role,

      systems,

      alerts: alertsResult.rows,

      professionals: professionalsResult.rows

    });


  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Erreur récupération maison."
    });

  }

});


/* =====================================================
   DETAIL D'UN SYSTEME
===================================================== */

app.get("/api/systems/:id", async (req, res) => {

  try {

    const systemResult = await pool.query(
      `
      SELECT *
      FROM systems
      WHERE system_key = $1
      LIMIT 1
      `,
      [req.params.id]
    );


    if (systemResult.rows.length === 0) {

      return res.status(404).json({
        error: "Système introuvable"
      });

    }


    const system = systemResult.rows[0];


    const equipmentResult = await pool.query(
      `
      SELECT *
      FROM equipment
      WHERE system_id = $1
      ORDER BY id DESC
      `,
      [system.id]
    );


    res.json({

      id: system.system_key,

      name: system.name,

      icon: system.icon,

      equipment: equipmentResult.rows,

      documents: []

    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Erreur système."
    });

  }

});


/* =====================================================
   AJOUT EQUIPEMENT
===================================================== */

app.post("/api/equipment", async (req, res) => {

  try {

    const {
      systemId,
      name,
      model,
      specs
    } = req.body;


    if (!systemId || !name) {

      return res.status(400).json({
        error: "Nom et système requis."
      });

    }


    const systemResult = await pool.query(
      `
      SELECT id
      FROM systems
      WHERE system_key = $1
      LIMIT 1
      `,
      [systemId]
    );


    if (systemResult.rows.length === 0) {

      return res.status(404).json({
        error: "Système introuvable."
      });

    }


    await pool.query(
      `
      INSERT INTO equipment
      (
        system_id,
        name,
        model,
        installed,
        specs
      )
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        systemResult.rows[0].id,
        name,
        model || "",
        new Date().toLocaleDateString("fr-FR"),
        specs || {}
      ]
    );


    res.json({
      ok: true
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Erreur ajout équipement."
    });

  }

});


/* =====================================================
   AJOUT RAPPEL
===================================================== */

app.post("/api/alerts", async (req, res) => {

  try {

    const {
      title,
      text,
      date
    } = req.body;


    const homeResult = await pool.query(
      `
      SELECT id
      FROM homes
      LIMIT 1
      `
    );


    if (homeResult.rows.length === 0) {

      return res.status(404).json({
        error: "Maison introuvable."
      });

    }


    await pool.query(
      `
      INSERT INTO alerts
      (
        home_id,
        title,
        text,
        date
      )
      VALUES ($1,$2,$3,$4)
      `,
      [
        homeResult.rows[0].id,
        title,
        text,
        date
      ]
    );


    res.json({
      ok: true
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Erreur ajout rappel."
    });

  }

});


/* =====================================================
   TEST BASE
===================================================== */

app.get("/api/health", async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT NOW()"
    );

    res.json({

      ok: true,

      database: "connected",

      time: result.rows[0].now

    });

  } catch (error) {

    res.status(500).json({

      ok: false,

      database: "error",

      error: error.message

    });

  }

});


/* =====================================================
   DEMARRAGE
===================================================== */

async function startServer() {

  try {

    await initDatabase();

    app.listen(PORT, () => {

      console.log(
        `HOME ID fonctionne sur le port ${PORT}`
      );

    });

  } catch (error) {

    console.error(
      "Impossible de démarrer HOME ID :",
      error
    );

    process.exit(1);

  }

}

startServer();