const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// BASE DE DONNÉES POSTGRESQL
// ============================================================

if (!process.env.DATABASE_URL) {
  console.error("ERREUR : DATABASE_URL n'est pas configurée.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});


// ============================================================
// EXPRESS
// ============================================================

app.use(express.json());


// ============================================================
// INITIALISATION DE LA BASE
// ============================================================

async function initDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS houses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      year INTEGER,
      surface INTEGER,
      land INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS systems (
      id TEXT PRIMARY KEY,
      house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      icon TEXT,
      status TEXT DEFAULT 'À configurer',
      color TEXT DEFAULT 'orange',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id SERIAL PRIMARY KEY,
      system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      model TEXT DEFAULT '',
      installed TEXT DEFAULT '',
      specs JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS professionals (
      id SERIAL PRIMARY KEY,
      house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      access TEXT DEFAULT 'Actif',
      expires TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      system_id TEXT REFERENCES systems(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      file_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Base PostgreSQL initialisée.");
}


// ============================================================
// OUTIL : RÉCUPÉRER LA MAISON
// ============================================================

async function getHouse() {
  const result = await pool.query(`
    SELECT *
    FROM houses
    ORDER BY created_at ASC
    LIMIT 1
  `);

  return result.rows[0] || null;
}


// ============================================================
// PROTECTION SETUP / APPLICATION
// ============================================================

app.use(async (req, res, next) => {

  try {

    if (
      req.path === "/" ||
      req.path === "/index.html" ||
      req.path === "/setup.html"
    ) {

      const house = await getHouse();

      if (
        (req.path === "/" || req.path === "/index.html") &&
        !house
      ) {
        return res.redirect("/setup.html");
      }

      if (
        req.path === "/setup.html" &&
        house
      ) {
        return res.redirect("/");
      }
    }

    next();

  } catch (error) {

    console.error("Erreur middleware :", error);

    res.status(500).send("Erreur serveur");
  }

});


// ============================================================
// FICHIERS DU SITE
// ============================================================

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", async (req, res) => {

  try {

    await pool.query("SELECT 1");

    res.json({
      ok: true,
      app: "HOME ID",
      database: "PostgreSQL",
      version: "1.0.0"
    });

  } catch (error) {

    res.status(500).json({
      ok: false,
      error: "Database unavailable"
    });

  }

});


// ============================================================
// CONFIGURATION INITIALE DE LA MAISON
// ============================================================

app.post("/api/setup", async (req, res) => {

  try {

    const existingHouse = await getHouse();

    if (existingHouse) {
      return res.status(403).json({
        error: "Maison déjà configurée."
      });
    }

    const {
      name,
      year,
      surface,
      land
    } = req.body;

    if (!name || !year) {
      return res.status(400).json({
        error: "Nom et année requis."
      });
    }

    const houseId =
      "HID-" +
      Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();


    // --------------------------------------------------------
    // MAISON
    // --------------------------------------------------------

    await pool.query(
      `
      INSERT INTO houses
      (id, name, year, surface, land)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        houseId,
        name,
        parseInt(year),
        parseInt(surface) || 0,
        parseInt(land) || 0
      ]
    );


    // --------------------------------------------------------
    // SYSTÈMES
    // --------------------------------------------------------

    const systems = [

      [
        "electricite",
        "Électricité",
        "⚡",
        "À configurer",
        "orange",
        1
      ],

      [
        "eau",
        "Plomberie & Eau",
        "💧",
        "À configurer",
        "orange",
        2
      ],

      [
        "chauffage",
        "Chauffage",
        "🔥",
        "À configurer",
        "orange",
        3
      ],

      [
        "climatisation",
        "Clim & VMC",
        "❄️",
        "À configurer",
        "orange",
        4
      ],

      [
        "piscine",
        "Piscine & Spa",
        "🏊",
        "À configurer",
        "orange",
        5
      ],

      [
        "exterieur",
        "Extérieur & Fermetures",
        "🌳",
        "À configurer",
        "orange",
        6
      ],

      [
        "domotique",
        "Réseau & Sécurité",
        "📡",
        "À configurer",
        "orange",
        7
      ]

    ];


    for (const system of systems) {

      await pool.query(
        `
        INSERT INTO systems
        (
          id,
          house_id,
          name,
          icon,
          status,
          color,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          system[0],
          houseId,
          system[1],
          system[2],
          system[3],
          system[4],
          system[5]
        ]
      );

    }


    res.json({
      ok: true,
      id: houseId
    });

  } catch (error) {

    console.error("Erreur setup :", error);

    res.status(500).json({
      error: "Impossible de créer la maison."
    });

  }

});


// ============================================================
// INFOS MAISON
// ============================================================

app.get("/api/home", async (req, res) => {

  try {

    const house = await getHouse();

    if (!house) {
      return res.status(403).json({
        error: "Maison non configurée."
      });
    }

    const role = req.query.role || "owner";


    let systemQuery = `
      SELECT
        s.id,
        s.name,
        s.icon,
        s.status,
        s.color,
        COUNT(e.id)::INTEGER AS equipment
      FROM systems s
      LEFT JOIN equipment e
        ON e.system_id = s.id
      WHERE s.house_id = $1
    `;

    const params = [house.id];


    if (role === "electricien") {

      systemQuery += `
        AND s.id IN ('electricite', 'domotique')
      `;

    } else if (role === "pisciniste") {

      systemQuery += `
        AND s.id = 'piscine'
      `;

    } else if (role === "clim") {

      systemQuery += `
        AND s.id IN ('climatisation', 'chauffage')
      `;

    }


    systemQuery += `
      GROUP BY
        s.id,
        s.name,
        s.icon,
        s.status,
        s.color,
        s.sort_order
      ORDER BY s.sort_order
    `;


    const systemsResult =
      await pool.query(
        systemQuery,
        params
      );


    const alertsResult =
      await pool.query(
        `
        SELECT
          id,
          title,
          text,
          date
        FROM alerts
        WHERE house_id = $1
        ORDER BY created_at DESC
        `,
        [house.id]
      );


    const professionalsResult =
      await pool.query(
        `
        SELECT
          id,
          name,
          domain,
          access,
          expires
        FROM professionals
        WHERE house_id = $1
        ORDER BY id DESC
        `,
        [house.id]
      );


    res.json({

      id: house.id,

      name: house.name,

      year: house.year,

      surface: house.surface,

      land: house.land,

      role,

      systems: systemsResult.rows,

      alerts: alertsResult.rows,

      professionals: professionalsResult.rows

    });

  } catch (error) {

    console.error("Erreur /api/home :", error);

    res.status(500).json({
      error: "Erreur serveur"
    });

  }

});


// ============================================================
// DÉTAIL D'UN SYSTÈME
// ============================================================

app.get("/api/systems/:id", async (req, res) => {

  try {

    const house = await getHouse();

    if (!house) {
      return res.status(404).json({
        error: "Maison introuvable"
      });
    }


    const systemResult =
      await pool.query(
        `
        SELECT
          id,
          name,
          icon,
          status,
          color
        FROM systems
        WHERE id = $1
        AND house_id = $2
        `,
        [
          req.params.id,
          house.id
        ]
      );


    if (systemResult.rows.length === 0) {

      return res.status(404).json({
        error: "Système introuvable"
      });

    }


    const system =
      systemResult.rows[0];


    const equipmentResult =
      await pool.query(
        `
        SELECT
          id,
          name,
          model,
          installed,
          specs
        FROM equipment
        WHERE system_id = $1
        ORDER BY created_at DESC
        `,
        [system.id]
      );


    const documentsResult =
      await pool.query(
        `
        SELECT
          id,
          name,
          file_url
        FROM documents
        WHERE system_id = $1
        ORDER BY created_at DESC
        `,
        [system.id]
      );


    res.json({

      id: system.id,

      name: system.name,

      icon: system.icon,

      status: system.status,

      color: system.color,

      equipment: equipmentResult.rows,

      documents: documentsResult.rows

    });

  } catch (error) {

    console.error("Erreur système :", error);

    res.status(500).json({
      error: "Erreur serveur"
    });

  }

});


// ============================================================
// AJOUT ÉQUIPEMENT
// ============================================================

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


    const house = await getHouse();

    if (!house) {

      return res.status(403).json({
        error: "Maison non configurée."
      });

    }


    const systemResult =
      await pool.query(
        `
        SELECT id
        FROM systems
        WHERE id = $1
        AND house_id = $2
        `,
        [
          systemId,
          house.id
        ]
      );


    if (systemResult.rows.length === 0) {

      return res.status(404).json({
        error: "Système introuvable."
      });

    }


    const result =
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
        VALUES
        ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          systemId,
          name,
          model || "",
          new Date().toLocaleDateString("fr-FR"),
          specs || {}
        ]
      );


    res.json({
      ok: true,
      equipment: result.rows[0]
    });

  } catch (error) {

    console.error("Erreur équipement :", error);

    res.status(500).json({
      error: "Impossible d'enregistrer l'équipement."
    });

  }

});


// ============================================================
// AJOUT RAPPEL
// ============================================================

app.post("/api/alerts", async (req, res) => {

  try {

    const {
      title,
      text,
      date
    } = req.body;


    if (!title || !text || !date) {

      return res.status(400).json({
        error: "Informations incomplètes."
      });

    }


    const house = await getHouse();

    if (!house) {

      return res.status(403).json({
        error: "Maison non configurée."
      });

    }


    const result =
      await pool.query(
        `
        INSERT INTO alerts
        (
          house_id,
          title,
          text,
          date
        )
        VALUES
        ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          house.id,
          title,
          text,
          date
        ]
      );


    res.json({
      ok: true,
      alert: result.rows[0]
    });

  } catch (error) {

    console.error("Erreur alerte :", error);

    res.status(500).json({
      error: "Impossible d'enregistrer le rappel."
    });

  }

});


// ============================================================
// AJOUT PROFESSIONNEL
// ============================================================

app.post("/api/professionals", async (req, res) => {

  try {

    const {
      name,
      domain,
      access,
      expires
    } = req.body;


    const house = await getHouse();

    if (!house) {

      return res.status(403).json({
        error: "Maison non configurée."
      });

    }


    const result =
      await pool.query(
        `
        INSERT INTO professionals
        (
          house_id,
          name,
          domain,
          access,
          expires
        )
        VALUES
        ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          house.id,
          name,
          domain,
          access || "Actif",
          expires || ""
        ]
      );


    res.json({
      ok: true,
      professional: result.rows[0]
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Impossible d'ajouter le professionnel."
    });

  }

});


// ============================================================
// DÉMARRAGE
// ============================================================

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