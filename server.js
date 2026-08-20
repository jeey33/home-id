const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Base de données temporaire en mémoire
let homeDatabase = {
  id: "HID-DEMO-001",
  name: "Ma Maison",
  year: 1987,
  surface: 185,
  land: 1200,

  systems: [
    { id: "electricite", name: "Électricité", icon: "⚡", status: "À jour", color: "green", equipment: 3 },
    { id: "eau", name: "Eau", icon: "💧", status: "À jour", color: "green", equipment: 2 },
    { id: "chauffage", name: "Chauffage", icon: "🔥", status: "À jour", color: "green", equipment: 1 },
    { id: "climatisation", name: "Climatisation", icon: "❄️", status: "Entretien", color: "orange", equipment: 3 },
    { id: "piscine", name: "Piscine", icon: "🏊", status: "Entretien", color: "orange", equipment: 5 },
    { id: "exterieur", name: "Extérieur", icon: "🌳", status: "À jour", color: "green", equipment: 4 }
  ],

  alerts: [
    { id: 1, title: "Climatisation", text: "Entretien recommandé", date: "30/09/2026" },
    { id: 2, title: "Piscine", text: "Préparer l'hivernage", date: "15/10/2026" },
    { id: 3, title: "Cheminée", text: "Ramonage annuel", date: "01/11/2026" }
  ],

  professionals: [
    { name: "Martin Clim", domain: "Climatisation", access: "Actif", expires: "30/09/2026" },
    { name: "Piscines XYZ", domain: "Piscine", access: "Actif", expires: "31/12/2026" },
    { name: "Dupont Électricité", domain: "Électricité", access: "Actif", expires: "15/10/2026" }
  ],

  details: {
    electricite: {
      name: "Électricité",
      icon: "⚡",
      equipment: [
        { name: "Tableau électrique principal", model: "Schneider Resi9", installed: "10/01/2020", warranty: "10/01/2030" }
      ],
      lastMaintenance: "15/10/2025",
      nextMaintenance: "15/10/2026",
      documents: ["Schéma unifilaire.pdf", "Attestation Consuel.pdf"]
    },
    eau: {
      name: "Eau & Plomberie",
      icon: "💧",
      equipment: [
        { name: "Adoucisseur d'eau", model: "Culligan Avenew", installed: "05/04/2022", warranty: "05/04/2027" }
      ],
      lastMaintenance: "10/01/2026",
      nextMaintenance: "10/01/2027",
      documents: ["Facture adoucisseur.pdf"]
    },
    chauffage: {
      name: "Chauffage",
      icon: "🔥",
      equipment: [
        { name: "Chaudière à gaz", model: "Frisquet Hydromotrix", installed: "14/11/2019", warranty: "Expirée" }
      ],
      lastMaintenance: "20/11/2025",
      nextMaintenance: "20/11/2026",
      documents: ["Attestation entretien annuel.pdf"]
    },
    climatisation: {
      name: "Climatisation",
      icon: "❄️",
      equipment: [
        { name: "Daikin Perfera", model: "FTXM35R", installed: "12/06/2023", warranty: "12/06/2026" },
        { name: "Daikin Perfera", model: "FTXM25R", installed: "12/06/2023", warranty: "12/06/2026" },
        { name: "Daikin Perfera", model: "FTXM25R", installed: "12/06/2023", warranty: "12/06/2026" }
      ],
      lastMaintenance: "12/06/2025",
      nextMaintenance: "30/09/2026",
      documents: ["Facture installation.pdf", "Notice Daikin.pdf", "Garantie.pdf"]
    },
    piscine: {
      name: "Piscine",
      icon: "🏊",
      equipment: [
        { name: "Pompe", model: "Hayward", installed: "15/05/2021" },
        { name: "Filtre", model: "Pentair", installed: "15/05/2021" },
        { name: "Robot", model: "Dolphin", installed: "20/05/2021" },
        { name: "Traitement", model: "Électrolyseur", installed: "15/05/2021" },
        { name: "PAC", model: "Zodiac", installed: "15/05/2021" }
      ],
      lastMaintenance: "18/08/2025",
      nextMaintenance: "15/10/2026",
      documents: ["Plan hydraulique.pdf", "Facture installation.pdf", "Notice pompe.pdf"]
    },
    exterieur: {
      name: "Extérieur",
      icon: "🌳",
      equipment: [
        { name: "Arrosage automatique", model: "Rain Bird", installed: "01/06/2022" }
      ],
      lastMaintenance: "01/04/2025",
      nextMaintenance: "01/04/2027",
      documents: ["Plan réseau arrosage.pdf"]
    }
  }
};

// Healthcheck
app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "HOME ID", version: "0.1.0" });
});

// Récupérer les informations générales (supporte le paramètre ?role=)
app.get("/api/home", (req, res) => {
  const role = req.query.role || "owner";

  let filteredSystems = homeDatabase.systems;

  // Simulation des restrictions d'accès QR code par rôle
  if (role === "electricien") {
    filteredSystems = homeDatabase.systems.filter(s => s.id === "electricite");
  } else if (role === "pisciniste") {
    filteredSystems = homeDatabase.systems.filter(s => s.id === "piscine");
  } else if (role === "clim") {
    filteredSystems = homeDatabase.systems.filter(s => s.id === "climatisation");
  }

  res.json({
    id: homeDatabase.id,
    name: homeDatabase.name,
    year: homeDatabase.year,
    surface: homeDatabase.surface,
    land: homeDatabase.land,
    role: role,
    systems: filteredSystems,
    alerts: homeDatabase.alerts,
    professionals: homeDatabase.professionals
  });
});

// Récupérer les détails d'un système
app.get("/api/systems/:id", (req, res) => {
  const system = homeDatabase.details[req.params.id];
  if (!system) {
    return res.status(404).json({ error: "Système introuvable" });
  }
  res.json(system);
});

// Route API pour ajouter un équipement dans un système
app.post("/api/equipment", (req, res) => {
  const { systemId, name, model, installed, warranty } = req.body;

  if (!systemId || !name || !homeDatabase.details[systemId]) {
    return res.status(400).json({ error: "Données invalides" });
  }

  const newEquip = { name, model: model || "", installed: installed || "", warranty: warranty || "" };
  homeDatabase.details[systemId].equipment.push(newEquip);

  // Mettre à jour le compteur d'équipements sur la carte
  const sysCard = homeDatabase.systems.find(s => s.id === systemId);
  if (sysCard) {
    sysCard.equipment = homeDatabase.details[systemId].equipment.length;
  }

  res.json({ ok: true, equipment: newEquip });
});

// Route API pour ajouter un nouvel entretien / rappel
app.post("/api/alerts", (req, res) => {
  const { title, text, date } = req.body;
  if (!title || !text || !date) {
    return res.status(400).json({ error: "Données invalides" });
  }

  const newAlert = { id: Date.now(), title, text, date };
  homeDatabase.alerts.unshift(newAlert);

  res.json({ ok: true, alert: newAlert });
});

app.listen(PORT, () => {
  console.log(`HOME ID fonctionne sur le port ${PORT}`);
});
