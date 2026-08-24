const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ======================================================
// BASE DE DONNÉES TEMPORAIRE
// ======================================================

let homeDatabase = {
  isSetup: false,

  id: "HID-" + Math.random().toString(36).substring(2, 8).toUpperCase(),

  name: "",
  year: null,
  surface: null,
  land: null,

  systems: [],
  alerts: [],
  professionals: [],

  details: {}
};


// ======================================================
// REDIRECTION SETUP
// ======================================================

app.use((req, res, next) => {

  if (
    (req.path === "/" || req.path === "/index.html") &&
    !homeDatabase.isSetup
  ) {
    return res.redirect("/setup.html");
  }

  if (
    req.path === "/setup.html" &&
    homeDatabase.isSetup
  ) {
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

app.post("/api/setup", (req, res) => {

  if (homeDatabase.isSetup) {
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
      error: "Le nom et l'année sont obligatoires."
    });
  }

  homeDatabase.isSetup = true;

  homeDatabase.name = name;
  homeDatabase.year = parseInt(year);
  homeDatabase.surface = parseInt(surface) || 0;
  homeDatabase.land = parseInt(land) || 0;


  // ====================================================
  // SYSTÈMES DE LA MAISON
  // ====================================================

  homeDatabase.systems = [

    {
      id: "electricite",
      name: "Électricité",
      icon: "⚡",
      status: "À configurer",
      color: "orange",
      equipment: 0
    },

    {
      id: "eau",
      name: "Plomberie & Eau",
      icon: "💧",
      status: "À configurer",
      color: "orange",
      equipment: 0
    },

    {
      id: "chauffage",
      name: "Chauffage",
      icon: "🔥",
      status: "À configurer",
      color: "orange",
      equipment: 0
    },

    {
      id: "climatisation",
      name: "Clim & VMC",
      icon: "❄️",
      status: "À configurer",
      color: "orange",
      equipment: 0
    },

    {
      id: "piscine",
      name: "Piscine & Spa",
      icon: "🏊",
      status: "À configurer",
      color: "orange",
      equipment: 0
    },

    {
      id: "exterieur",
      name: "Extérieur & Fermetures",
      icon: "🌳",
      status: "À configurer",
      color: "orange",
      equipment: 0
    },

    {
      id: "domotique",
      name: "Réseau & Sécurité",
      icon: "📡",
      status: "À configurer",
      color: "orange",
      equipment: 0
    }

  ];


  // ====================================================
  // CRÉATION DES FICHES DÉTAILLÉES
  // ====================================================

  homeDatabase.systems.forEach(system => {

    homeDatabase.details[system.id] = {

      id: system.id,

      name: system.name,

      icon: system.icon,

      equipment: [],

      documents: [],

      lastMaintenance: null,

      nextMaintenance: null

    };

  });


  res.json({
    ok: true,
    id: homeDatabase.id
  });

});


// ======================================================
// INFOS MAISON
// ======================================================

app.get("/api/home", (req, res) => {

  if (!homeDatabase.isSetup) {

    return res.status(403).json({
      error: "Maison non configurée."
    });

  }

  const role = req.query.role || "owner";

  let filteredSystems = homeDatabase.systems;


  // Vue électricien
  if (role === "electricien") {

    filteredSystems =
      homeDatabase.systems.filter(system =>
        ["electricite", "domotique"].includes(system.id)
      );

  }


  // Vue pisciniste
  else if (role === "pisciniste") {

    filteredSystems =
      homeDatabase.systems.filter(system =>
        system.id === "piscine"
      );

  }


  // Vue climatisation
  else if (role === "clim") {

    filteredSystems =
      homeDatabase.systems.filter(system =>
        ["climatisation", "chauffage"].includes(system.id)
      );

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


// ======================================================
// OUVRIR UN SYSTÈME
// ======================================================

app.get("/api/systems/:id", (req, res) => {

  const systemId = req.params.id;

  console.log("Ouverture système :", systemId);


  // Vérifie d'abord que le système existe
  const system = homeDatabase.systems.find(
    s => s.id === systemId
  );


  if (!system) {

    console.log("Système introuvable :", systemId);

    return res.status(404).json({

      error: "Système introuvable",

      systemId: systemId

    });

  }


  // Si jamais la fiche detail n'existe pas,
  // on la recrée automatiquement.
  if (!homeDatabase.details[systemId]) {

    homeDatabase.details[systemId] = {

      id: system.id,

      name: system.name,

      icon: system.icon,

      equipment: [],

      documents: [],

      lastMaintenance: null,

      nextMaintenance: null

    };

  }


  const details = homeDatabase.details[systemId];


  res.json({

    id: system.id,

    name: system.name,

    icon: system.icon,

    equipment: details.equipment || [],

    documents: details.documents || [],

    lastMaintenance: details.lastMaintenance || null,

    nextMaintenance: details.nextMaintenance || null

  });

});


// ======================================================
// AJOUT D'UN ÉQUIPEMENT
// ======================================================

app.post("/api/equipment", (req, res) => {

  const {
    systemId,
    name,
    model,
    specs
  } = req.body;


  console.log("Ajout équipement :", req.body);


  if (!systemId || !name) {

    return res.status(400).json({

      error: "Le système et le nom sont obligatoires."

    });

  }


  // Vérifie que le système existe
  const system = homeDatabase.systems.find(
    s => s.id === systemId
  );


  if (!system) {

    return res.status(404).json({

      error: "Système introuvable."

    });

  }


  // Sécurité : création automatique de details
  if (!homeDatabase.details[systemId]) {

    homeDatabase.details[systemId] = {

      id: system.id,

      name: system.name,

      icon: system.icon,

      equipment: [],

      documents: [],

      lastMaintenance: null,

      nextMaintenance: null

    };

  }


  const newEquipment = {

    id: "EQ-" +
      Date.now().toString(36).toUpperCase(),

    name: name,

    model: model || "",

    installed: new Date().toLocaleDateString("fr-FR"),

    specs: specs || {}

  };


  homeDatabase.details[systemId].equipment.push(
    newEquipment
  );


  // Mise à jour du compteur
  system.equipment =
    homeDatabase.details[systemId].equipment.length;


  // Le système passe automatiquement
  // de "À configurer" à "À jour"
  system.status = "À jour";
  system.color = "green";


  res.json({

    ok: true,

    equipment: newEquipment,

    system: system

  });

});


// ======================================================
// AJOUT D'UN RAPPEL
// ======================================================

app.post("/api/alerts", (req, res) => {

  const {
    title,
    text,
    date
  } = req.body;


  if (!title || !text || !date) {

    return res.status(400).json({

      error: "Titre, action et date obligatoires."

    });

  }


  const alert = {

    id: Date.now(),

    title: title,

    text: text,

    date: date

  };


  homeDatabase.alerts.unshift(alert);


  res.json({

    ok: true,

    alert: alert

  });

});


// ======================================================
// AJOUT DOCUMENT
// ======================================================

app.post("/api/documents", (req, res) => {

  const {
    systemId,
    name
  } = req.body;


  if (!systemId || !name) {

    return res.status(400).json({

      error: "Système et nom du document obligatoires."

    });

  }


  if (!homeDatabase.details[systemId]) {

    return res.status(404).json({

      error: "Système introuvable."

    });

  }


  const document = {

    id: "DOC-" +
      Date.now().toString(36).toUpperCase(),

    name: name,

    added: new Date().toLocaleDateString("fr-FR")

  };


  homeDatabase.details[systemId].documents.push(
    document
  );


  res.json({

    ok: true,

    document: document

  });

});


// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/api/health", (req, res) => {

  res.json({

    ok: true,

    app: "HOME ID",

    version: "0.2.0",

    database: "memory",

    setup: homeDatabase.isSetup,

    systems: homeDatabase.systems.length

  });

});


// ======================================================
// DÉMARRAGE
// ======================================================

app.listen(PORT, () => {

  console.log(
    `HOME ID fonctionne sur le port ${PORT}`
  );

});