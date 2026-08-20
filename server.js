const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Permet de servir notre site
app.use(express.static(path.join(__dirname, "public")));

// Test du serveur
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "HOME ID",
    version: "0.1.0"
  });
});

// Première maison de démonstration
app.get("/api/home", (req, res) => {
  res.json({
    id: "HID-DEMO-001",
    name: "Ma Maison",
    year: 1987,
    surface: 185,
    land: 1200,

    systems: [
      {
        id: "electricite",
        name: "Électricité",
        icon: "⚡",
        status: "À jour",
        color: "green",
        equipment: 3
      },
      {
        id: "eau",
        name: "Eau",
        icon: "💧",
        status: "À jour",
        color: "green",
        equipment: 2
      },
      {
        id: "chauffage",
        name: "Chauffage",
        icon: "🔥",
        status: "À jour",
        color: "green",
        equipment: 1
      },
      {
        id: "climatisation",
        name: "Climatisation",
        icon: "❄️",
        status: "Entretien",
        color: "orange",
        equipment: 3
      },
      {
        id: "piscine",
        name: "Piscine",
        icon: "🏊",
        status: "Entretien",
        color: "orange",
        equipment: 5
      },
      {
        id: "exterieur",
        name: "Extérieur",
        icon: "🌳",
        status: "À jour",
        color: "green",
        equipment: 4
      }
    ],

    alerts: [
      {
        title: "Climatisation",
        text: "Entretien recommandé",
        date: "30/09/2026"
      },
      {
        title: "Piscine",
        text: "Préparer l'hivernage",
        date: "15/10/2026"
      },
      {
        title: "Cheminée",
        text: "Ramonage annuel",
        date: "01/11/2026"
      }
    ],

    professionals: [
      {
        name: "Martin Clim",
        domain: "Climatisation",
        access: "Actif",
        expires: "30/09/2026"
      },
      {
        name: "Piscines XYZ",
        domain: "Piscine",
        access: "Actif",
        expires: "31/12/2026"
      },
      {
        name: "Dupont Électricité",
        domain: "Électricité",
        access: "Actif",
        expires: "15/10/2026"
      }
    ]
  });
});

// Informations détaillées d'un système
app.get("/api/systems/:id", (req, res) => {

  const systems = {

    climatisation: {
      name: "Climatisation",
      icon: "❄️",

      equipment: [
        {
          name: "Daikin Perfera",
          model: "FTXM35R",
          installed: "12/06/2023",
          warranty: "12/06/2026"
        },
        {
          name: "Daikin Perfera",
          model: "FTXM25R",
          installed: "12/06/2023",
          warranty: "12/06/2026"
        },
        {
          name: "Daikin Perfera",
          model: "FTXM25R",
          installed: "12/06/2023",
          warranty: "12/06/2026"
        }
      ],

      lastMaintenance: "12/06/2026",
      nextMaintenance: "12/06/2027",

      documents: [
        "Facture installation.pdf",
        "Notice Daikin.pdf",
        "Garantie.pdf"
      ]
    },

    piscine: {
      name: "Piscine",
      icon: "🏊",

      equipment: [
        {
          name: "Pompe",
          model: "Hayward",
          installed: "15/05/2021"
        },
        {
          name: "Filtre",
          model: "Pentair",
          installed: "15/05/2021"
        },
        {
          name: "Robot",
          model: "Dolphin",
          installed: "20/05/2021"
        },
        {
          name: "Traitement",
          model: "Électrolyseur",
          installed: "15/05/2021"
        },
        {
          name: "PAC",
          model: "Zodiac",
          installed: "15/05/2021"
        }
      ],

      lastMaintenance: "18/08/2026",
      nextMaintenance: "15/10/2026",

      documents: [
        "Plan hydraulique.pdf",
        "Facture installation.pdf",
        "Notice pompe.pdf"
      ]
    }

  };

  const system = systems[req.params.id];

  if (!system) {
    return res.status(404).json({
      error: "Système introuvable"
    });
  }

  res.json(system);
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`HOME ID fonctionne sur le port ${PORT}`);
});
