let homeData = null;

async function init() {
  try {
    // Vérifie si un paramètre "role" est présent dans l'URL (ex: ?role=pisciniste)
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get("role") || "";

    const response = await fetch(`/api/home?role=${roleParam}`);

    if (!response.ok) {
      throw new Error("Impossible de récupérer la maison");
    }

    homeData = await response.json();

    updateUserBadge(homeData.role);
    displaySystems();
    displayAlerts();
    displayProfessionals();

  } catch (error) {
    console.error(error);
    showMessage("Impossible de charger HOME ID.");
  }
}

function updateUserBadge(role) {
  const label = document.getElementById("user-role-label");
  if (!label) return;

  if (role === "electricien") label.textContent = "Accès Électricien";
  else if (role === "pisciniste") label.textContent = "Accès Pisciniste";
  else if (role === "clim") label.textContent = "Accès Climatisation";
  else label.textContent = "Propriétaire";
}

function displaySystems() {
  const container = document.getElementById("systems");
  if (!container) return;

  if (homeData.systems.length === 0) {
    container.innerHTML = "<p style='grid-column:1/-1; color:#77827a;'>Aucun système accessible pour cet accès.</p>";
    return;
  }

  container.innerHTML = homeData.systems.map(system => {
    return `
      <div class="system" onclick="openSystem('${system.id}')">
        <div class="system-icon">${system.icon}</div>
        <div class="system-name">${system.name}</div>
        <div class="status ${system.color}">
          <span class="dot"></span>
          ${system.status}
        </div>
      </div>
    `;
  }).join("");
}

function displayAlerts() {
  const container = document.getElementById("alerts");
  if (!container) return;

  container.innerHTML = homeData.alerts.map(alert => {
    return `
      <div class="alert">
        <span class="date">${alert.date}</span>
        <strong>${alert.title}</strong>
        <p>${alert.text}</p>
      </div>
    `;
  }).join("");
}

function displayProfessionals() {
  const container = document.getElementById("professionals");
  if (!container) return;

  container.innerHTML = homeData.professionals.map(pro => {
    return `
      <div class="pro">
        <span class="access-active">${pro.access}</span>
        <strong>${pro.name}</strong>
        <p>${pro.domain} · accès jusqu'au ${pro.expires}</p>
      </div>
    `;
  }).join("");
}

async function openSystem(systemId) {
  try {
    const response = await fetch(`/api/systems/${systemId}`);

    if (!response.ok) {
      throw new Error("Système introuvable");
    }

    const system = await response.json();

    let equipmentHTML = "";
    if (system.equipment && system.equipment.length > 0) {
      equipmentHTML = system.equipment.map(item => {
        return `
          <div class="equipment">
            <strong>${item.name}</strong>
            <span>
              ${item.model ? item.model + " · " : ""}
              ${item.installed ? "Installé le " + item.installed : ""}
              ${item.warranty ? " · Garantie " + item.warranty : ""}
            </span>
          </div>
        `;
      }).join("");
    } else {
      equipmentHTML = "<p style='color:#707a74; font-size:13px;'>Aucun équipement enregistré.</p>";
    }

    let documentsHTML = "";
    if (system.documents && system.documents.length > 0) {
      documentsHTML = system.documents.map(document => {
        return `<div class="equipment">📄 ${document}</div>`;
      }).join("");
    } else {
      documentsHTML = "<p style='color:#707a74; font-size:13px;'>Aucun document.</p>";
    }

    const modalContent = document.getElementById("modal-content");
    modalContent.innerHTML = `
      <div class="eyebrow">${system.icon} SYSTÈME</div>
      <h2>${system.name}</h2>
      <p style="color:#737c76; font-size:13px;">
        Dernier entretien : ${system.lastMaintenance || "—"} <br>
        Prochain entretien : ${system.nextMaintenance || "—"}
      </p>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
        <h3 style="margin:0;">Équipements</h3>
        <button class="button secondary" style="padding:4px 10px; font-size:12px;" onclick="openAddEquipmentModal('${systemId}')">+ Ajouter</button>
      </div>
      ${equipmentHTML}

      <h3>Documents</h3>
      ${documentsHTML}
    `;

    openModal();

  } catch (error) {
    console.error(error);
    showMessage("Impossible d'ouvrir ce système.");
  }
}

// MENU GÉNÉRAL "+" (BOUTON DU HAUT)
function openAddMenu() {
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <div class="eyebrow">ACTION RAPIDE</div>
    <h2>Que voulez-vous ajouter ?</h2>
    <div style="display:flex; flex-direction:column; gap:12px; margin-top:20px;">
      <button class="button secondary" style="text-align:left; padding:16px;" onclick="openAddEquipmentModal()">
        ➕ <strong>Un équipement</strong><br>
        <small style="color:#6d7771;">Ajouter une pompe, une clim, un tableau...</small>
      </button>
      <button class="button secondary" style="text-align:left; padding:16px;" onclick="openAddAlertModal()">
        📅 <strong>Un entretien ou un rappel</strong><br>
        <small style="color:#6d7771;">Programmer un ramonage, un hivernage...</small>
      </button>
      <button class="button secondary" style="text-align:left; padding:16px;" onclick="openImportModal()">
        📄 <strong>Un document ou une facture</strong><br>
        <small style="color:#6d7771;">Ajouter une notice, un plan PDF...</small>
      </button>
    </div>
  `;
  openModal();
}

// AJOUTER UN ÉQUIPEMENT
function openAddEquipmentModal(preselectedSystem = "") {
  const modalContent = document.getElementById("modal-content");

  const systemOptions = homeData.systems.map(sys => {
    const selected = sys.id === preselectedSystem ? "selected" : "";
    return `<option value="${sys.id}" ${selected}>${sys.name}</option>`;
  }).join("");

  modalContent.innerHTML = `
    <div class="eyebrow">NOUVEL ÉQUIPEMENT</div>
    <h2>Ajouter un équipement</h2>

    <!-- BOUTON SCAN IA -->
    <div style="background:#eef4f0; border:2px dashed #4b9b69; border-radius:16px; padding:20px; text-align:center; margin-top:15px;">
      <div style="font-size:32px; margin-bottom:8px;">📷</div>
      <strong>Scanner la plaque signalétique</strong><br>
      <small style="color:#59645d;">Prenez en photo l'étiquette de l'appareil, l'IA s'occupe du reste.</small>
      <br><br>
      <label class="button primary" style="display:inline-block; cursor:pointer;">
        ⚡ Prenez une photo
        <input type="file" accept="image/*" capture="environment" id="camera-input" style="display:none;" onchange="handlePhotoScan(event)">
      </label>
    </div>

    <div style="text-align:center; margin:15px 0; color:#77827a; font-size:12px; font-weight:700;">OU SAISIE MANUELLE</div>

    <form onsubmit="submitEquipment(event)" style="display:flex; flex-direction:column; gap:12px;">
      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d;">Système concerné</label>
        <select id="form-sys-id" required style="width:100%; padding:10px; border-radius:10px; border:1px solid #cdd4ce;">
          ${systemOptions}
        </select>
      </div>

      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d;">Nom de l'équipement *</label>
        <input type="text" id="form-name" placeholder="ex: Pompe à chaleur" required style="width:100%; padding:10px; border-radius:10px; border:1px solid #cdd4ce;">
      </div>

      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d;">Marque et Modèle</label>
        <input type="text" id="form-model" placeholder="ex: Daikin FTXM35R" style="width:100%; padding:10px; border-radius:10px; border:1px solid #cdd4ce;">
      </div>

      <button type="submit" class="button secondary" style="margin-top:5px;">Enregistrer manuellement</button>
    </form>
  `;
  openModal();
}

// Fonction de simulation de l'analyse IA de la photo
function handlePhotoScan(event) {
  const file = event.target.files[0];
  if (!file) return;

  showMessage("Analyse de la plaque signalétique par l'IA...");

  // Simulation de la réponse de l'IA après 2 secondes
  setTimeout(() => {
    document.getElementById("form-name").value = "Climatiseur Murale";
    document.getElementById("form-model").value = "Daikin FTXM35R";
    showMessage("Équipement identifié ! Notice associée.");
  }, 2000);
}

async function submitEquipment(event) {
  event.preventDefault();

  const payload = {
    systemId: document.getElementById("form-sys-id").value,
    name: document.getElementById("form-name").value,
    model: document.getElementById("form-model").value,
    installed: document.getElementById("form-installed").value,
    warranty: document.getElementById("form-warranty").value
  };

  try {
    const response = await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      closeModal();
      showMessage("Équipement ajouté avec succès !");
      init();
    } else {
      showMessage("Erreur lors de l'enregistrement.");
    }
  } catch (error) {
    console.error(error);
    showMessage("Erreur réseau.");
  }
}

// AJOUTER UN RAPPEL D'ENTRETIEN
function openAddAlertModal() {
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <div class="eyebrow">NOUVEAU RAPPEL</div>
    <h2>Programmer un entretien</h2>
    <form onsubmit="submitAlert(event)" style="display:flex; flex-direction:column; gap:14px; margin-top:18px;">
      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d;">Titre *</label>
        <input type="text" id="alert-title" placeholder="ex: Chaudière" required style="width:100%; padding:10px; border-radius:10px; border:1px solid #cdd4ce; margin-top:4px;">
      </div>

      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d;">Description *</label>
        <input type="text" id="alert-text" placeholder="ex: Ramonage du conduit de cheminée" required style="width:100%; padding:10px; border-radius:10px; border:1px solid #cdd4ce; margin-top:4px;">
      </div>

      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d;">Date limite *</label>
        <input type="text" id="alert-date" placeholder="ex: 15/11/2026" required style="width:100%; padding:10px; border-radius:10px; border:1px solid #cdd4ce; margin-top:4px;">
      </div>

      <button type="submit" class="button primary" style="margin-top:10px;">Ajouter le rappel</button>
    </form>
  `;
  openModal();
}

async function submitAlert(event) {
  event.preventDefault();

  const payload = {
    title: document.getElementById("alert-title").value,
    text: document.getElementById("alert-text").value,
    date: document.getElementById("alert-date").value
  };

  try {
    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      closeModal();
      showMessage("Rappel d'entretien ajouté !");
      init();
    } else {
      showMessage("Erreur lors de la sauvegarde.");
    }
  } catch (error) {
    console.error(error);
    showMessage("Erreur réseau.");
  }
}

// SIMULATION QR CODE PRO
function openQrSimulatorModal() {
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <div class="eyebrow">TEST SIMULATION QR CODE</div>
    <h2>Scanner en tant que...</h2>
    <p style="color:#737c76; font-size:13px;">
      Simulez ce que verra chaque professionnel lorsqu'il scannera la plaque QR de la maison.
    </p>

    <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
      <a href="/" class="button secondary" style="text-decoration:none; text-align:center;">👤 Vue Propriétaire (Tout voir)</a>
      <a href="/?role=electricien" class="button secondary" style="text-decoration:none; text-align:center;">⚡ Scanner Électricien (Électricité uniquement)</a>
      <a href="/?role=pisciniste" class="button secondary" style="text-decoration:none; text-align:center;">🏊 Scanner Pisciniste (Piscine uniquement)</a>
      <a href="/?role=clim" class="button secondary" style="text-decoration:none; text-align:center;">❄️ Scanner Climaticien (Climatisation uniquement)</a>
    </div>
  `;
  openModal();
}

// IMPORT DOCUMENT
function openImportModal() {
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <div class="eyebrow">BIBLIOTHÈQUE</div>
    <h2>Importer un document</h2>
    <div style="border:2px dashed #cdd4ce; border-radius:16px; padding:30px; text-align:center; background:#f8f9f7; margin-top:15px;">
      <div style="font-size:36px; margin-bottom:10px;">📄</div>
      <strong>Glissez votre fichier PDF ici</strong><br>
      <small style="color:#7c867f;">Facture, notice, garantie, attestation...</small>
      <br><br>
      <button class="button primary" onclick="showMessage('Fichier reçu. Traitement OCR simulé.'); closeModal();">Parcourir les fichiers</button>
    </div>
  `;
  openModal();
}

function openPlan() {
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <div class="eyebrow">CARTOGRAPHIE</div>
    <h2>Plan de la maison</h2>
    <p style="color:#737c76; font-size:13px;">Emplacement interactif de vos équipements et réseaux.</p>

    <div style="height:260px; border:1px dashed #cdd4ce; border-radius:16px; display:grid; place-items:center; background:#f8f9f7; margin-top:15px; text-align:center;">
      <div>
        <div style="font-size:42px; margin-bottom:12px;">🗺️</div>
        <strong>Plan interactif de la propriété</strong><br>
        <small style="color:#7c867f;">Import PDF / JPG puis positionnement des équipements.</small>
      </div>
    </div>
  `;
  openModal();
}

function openModal() {
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.classList.add("hidden");
}

document.addEventListener("click", function(event) {
  const modal = document.getElementById("modal");
  if (event.target === modal) {
    closeModal();
  }
});

function showMessage(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

init();
