/* ============================================================
   HOME ID — APPLICATION JAVASCRIPT GLOBALE
   ============================================================ */

let homeData = null;
let currentHomeId = null; 

/* ============================================================
   1. INITIALISATION & SÉCURITÉ
   ============================================================ */
async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  currentHomeId = urlParams.get("id");

  // Si pas d'ID dans l'URL, on bloque.
  if (!currentHomeId) {
    document.body.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; height:100vh; flex-direction:column; background:#f4f6f5;">
        <div style="font-size:40px; margin-bottom:15px;">📱</div>
        <h2 style="font-family:sans-serif; color:#1e362d; margin:0;">Veuillez scanner un QR Code</h2>
        <p style="color:#77827a; font-family:sans-serif;">Pour accéder à un HOME ID.</p>
      </div>`;
    return;
  }

  // Vérification de la session (si on vient de se connecter ou de créer)
  const activeSession = sessionStorage.getItem("homeid_session");
  
  if (activeSession === currentHomeId) {
    loadHomeData(); // OK, on charge les données
  } else {
    openLoginModal(); // Pas de session, on demande le mot de passe
  }
}

/* ============================================================
   2. POPUP DE CONNEXION (DÉVERROUILLAGE)
   ============================================================ */
function openLoginModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">SÉCURITÉ</div>
    <h2>Déverrouiller la maison</h2>
    <p style="font-size:13px; color:#77827a;">Entrez le mot de passe propriétaire pour accéder au carnet.</p>
    
    <form onsubmit="submitLogin(event)" style="display:flex; flex-direction:column; gap:15px; margin-top:20px;">
      <input type="password" id="login-password" required placeholder="Votre mot de passe" style="width:100%; padding:12px; border-radius:8px; border:1px solid #cdd4ce;">
      <button type="submit" class="button primary" style="padding:12px;">Accéder au tableau de bord</button>
    </form>
    
    <div id="login-error" style="color:#d93025; font-size:13px; margin-top:15px; display:none; font-weight:bold;"></div>
  `;
  
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
  
  // Désactiver la fermeture pour forcer la connexion
  modal.onclick = null; 
  const closeBtn = document.querySelector('.close');
  if (closeBtn) closeBtn.style.display = 'none'; 
}

async function submitLogin(event) {
  event.preventDefault();
  const password = document.getElementById("login-password").value;
  const errDiv = document.getElementById("login-error");

  try {
    const response = await fetch("/api/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentHomeId, password: password })
    });

    if (response.ok) {
      sessionStorage.setItem("homeid_session", currentHomeId); // Sauvegarde session
      document.getElementById("modal").classList.add("hidden");
      const closeBtn = document.querySelector('.close');
      if (closeBtn) closeBtn.style.display = 'block'; 
      loadHomeData();
    } else {
      errDiv.textContent = "Mot de passe incorrect.";
      errDiv.style.display = "block";
    }
  } catch (error) {
    errDiv.textContent = "Erreur de connexion au serveur.";
    errDiv.style.display = "block";
  }
}

/* ============================================================
   3. CHARGEMENT RÉEL DES DONNÉES
   ============================================================ */
async function loadHomeData() {
  try {
    const response = await fetch(`/api/home?id=${currentHomeId}`);
    if (!response.ok) throw new Error("Erreur récupération.");
    
    homeData = await response.json();
    
    updateUserBadge(homeData.role);
    populateHouseInfo();
    displaySystems();
    displayAlerts();
    displayProfessionals();
  } catch (error) {
    showMessage("Impossible de charger les données de la maison.");
  }
}

function populateHouseInfo() {
  document.getElementById("display-house-name").textContent = homeData.name || "Ma Maison";
  document.getElementById("display-house-id").textContent = `Maison #${homeData.id}`;
  document.getElementById("display-house-year").textContent = homeData.year || "—";
  document.getElementById("display-house-surface").textContent = homeData.surface ? `${homeData.surface} m²` : "—";
  document.getElementById("display-house-land").textContent = homeData.land ? `${homeData.land} m²` : "—";
}

function updateUserBadge(role) {
  const label = document.getElementById("user-role-label");
  if (!label) return;
  if (role === "electricien") label.textContent = "Accès Électricien";
  else if (role === "pisciniste") label.textContent = "Accès Pisciniste";
  else if (role === "clim") label.textContent = "Accès Clim / Chauffage";
  else label.textContent = "Propriétaire";
}

function displaySystems() {
  const container = document.getElementById("systems");
  if (!container) return;
  const systems = homeData.systems || [];
  
  if (systems.length === 0) {
    container.innerHTML = `<p style="grid-column:1/-1; color:#77827a;">Aucun système accessible.</p>`;
    return;
  }

  container.innerHTML = systems.map(system => {
    const equipmentCount = Number(system.equipment || 0);
    const equipmentHTML = equipmentCount > 0
      ? `<div style="font-size:11px; color:#77827a; margin-top:4px;">${equipmentCount} équipement(s)</div>`
      : `<div style="font-size:11px; color:#a26b28; margin-top:4px;">À configurer</div>`;

    return `
      <div class="system" onclick="openSystem('${system.id}')">
        <div class="system-icon">${system.icon || "🏠"}</div>
        <div class="system-name">${escapeHTML(system.name)}</div>
        <div class="status ${system.color || "orange"}"><span class="dot"></span>${escapeHTML(system.status || "À configurer")}</div>
        ${equipmentHTML}
      </div>`;
  }).join("");
}

function displayAlerts() {
  const container = document.getElementById("alerts");
  if (!container) return;
  const alerts = homeData.alerts || [];
  if (alerts.length === 0) {
    container.innerHTML = `<p style="color:#77827a; font-size:13px;">Aucun rappel de prévu.</p>`;
    return;
  }
  container.innerHTML = alerts.map(alert => `
    <div class="alert"><span class="date">${escapeHTML(alert.date || "")}</span><strong>${escapeHTML(alert.title || "")}</strong><p>${escapeHTML(alert.text || "")}</p></div>
  `).join("");
}

function displayProfessionals() {
  const container = document.getElementById("professionals");
  if (!container) return;
  const professionals = homeData.professionals || [];
  if (professionals.length === 0) {
    container.innerHTML = `<p style="color:#77827a; font-size:13px;">Aucun artisan enregistré.</p>`;
    return;
  }
  container.innerHTML = professionals.map(pro => `
    <div class="pro"><span class="access-active">${escapeHTML(pro.access || "Intervenu")}</span><strong>${escapeHTML(pro.name || "")}</strong><p>${escapeHTML(pro.domain || "")}</p></div>
  `).join("");
}

async function openSystem(systemId) {
  try {
    const response = await fetch(`/api/systems/${encodeURIComponent(systemId)}`);
    if (!response.ok) throw new Error("Système introuvable");
    const system = await response.json();

    let equipmentHTML = "";
    if (system.equipment && system.equipment.length > 0) {
      equipmentHTML = system.equipment.map(item => {
        let specsHTML = "";
        if (item.specs && typeof item.specs === "object" && Object.keys(item.specs).length > 0) {
          specsHTML = `<div class="specs-grid">` + 
            Object.entries(item.specs).filter(([k, v]) => v).map(([key, value]) => `
              <div class="spec-tag"><strong>${escapeHTML(key)}</strong>: ${escapeHTML(String(value))}</div>
            `).join("") + `</div>`;
        }
        return `
          <div class="equipment-deep">
            <div class="equip-header">
              <strong>${escapeHTML(item.name)}</strong>
              <span class="equip-model">${item.model ? escapeHTML(item.model) : "Modèle non précisé"}</span>
            </div>
            ${specsHTML}
            <div class="equip-footer" style="display:flex; justify-content:space-between;">
              <span>Enregistré le : ${escapeHTML(item.installed || "—")}</span>
              ${item.notice ? `<span style="color:#2a7049; cursor:pointer;" onclick="showMessage('Ouverture notice : ${item.notice}')">📄 Voir Notice</span>` : ''}
            </div>
          </div>`;
      }).join("");
    } else {
      equipmentHTML = `<div style="background:#f8f9f7; padding:20px; text-align:center; border-radius:12px; margin-top:10px;"><p style="color:#707a74; font-size:13px; margin:0;">Aucun équipement enregistré.</p></div>`;
    }

    document.getElementById("modal-content").innerHTML = `
      <div class="eyebrow">${system.icon || "🏠"} SYSTÈME</div>
      <h2>${escapeHTML(system.name)}</h2>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-bottom:1px solid #e3e8e4; padding-bottom:10px; gap:10px;">
        <h3 style="margin:0;">Équipements</h3>
        <button class="button secondary" style="padding:4px 10px; font-size:12px;" onclick="openAddEquipmentModal('${system.id}')">+ Ajouter</button>
      </div>
      <div style="margin-top:15px;">${equipmentHTML}</div>
    `;
    openModal();
  } catch (error) {
    showMessage("Impossible d'ouvrir ce système.");
  }
}

/* ============================================================
   4. MENUS D'AJOUT ET FORMULAIRES (Votre logique préservée)
   ============================================================ */
function openAddMenu() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">ACTION RAPIDE</div>
    <h2>Que voulez-vous ajouter ?</h2>
    <div style="display:flex; flex-direction:column; gap:12px; margin-top:20px;">
      <button class="button secondary" style="text-align:left; padding:16px;" onclick="openAddEquipmentModal()">
        ➕ <strong>Un équipement / appareil</strong><br><small style="color:#6d7771;">Pompe, portail, climatisation, compteur...</small>
      </button>
      <button class="button secondary" style="text-align:left; padding:16px;" onclick="openAddAlertModal()">
        📅 <strong>Un entretien ou rappel</strong><br><small style="color:#6d7771;">Ramonage, vidange, remplacement filtre...</small>
      </button>
    </div>`;
  openModal();
}

function openAddEquipmentModal(preselectedSystem = "") {
  const systems = homeData.systems || [];
  const systemOptions = systems.map(sys => `
    <option value="${escapeHTML(sys.id)}" ${sys.id === preselectedSystem ? "selected" : ""}>
      ${escapeHTML(sys.name)}
    </option>`).join("");

  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">NOUVEL ÉQUIPEMENT</div>
    <h2>Ajouter un équipement</h2>
    <form onsubmit="submitEquipment(event)" style="display:flex; flex-direction:column; gap:15px; margin-top:15px;">
      <div style="background:#f8f9f7; padding:15px; border-radius:12px; border:1px solid #e3e8e4;">
        <label style="font-size:12px; font-weight:700; color:#59645d; display:block; margin-bottom:5px;">Catégorie</label>
        <select id="form-sys-id" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #cdd4ce;" onchange="renderDynamicFields()">
          <option value="" disabled ${preselectedSystem ? "" : "selected"}>-- Choisissez une catégorie --</option>
          ${systemOptions}
        </select>
      </div>
      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d; display:block; margin-bottom:5px;">Nom de l'appareil *</label>
        <input type="text" id="form-name" placeholder="Ex : Pompe piscine" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      </div>
      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d; display:block; margin-bottom:5px;">Marque / Modèle (pour Notice auto)</label>
        <input type="text" id="form-model" placeholder="Ex : Hayward" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      </div>
      <div id="dynamic-fields-container" style="display:flex; flex-direction:column; gap:10px;"></div>
      <button type="submit" class="button primary" style="margin-top:10px;">Sauvegarder l'appareil</button>
    </form>`;
  openModal();
  if (preselectedSystem) renderDynamicFields();
}

// VOTRE GÉNÉRATEUR DYNAMIQUE (J'ai conservé votre logique exacte)
function renderDynamicFields() {
  const select = document.getElementById("form-sys-id");
  const container = document.getElementById("dynamic-fields-container");
  if (!select || !container) return;
  
  // On détecte la catégorie (l'ID ressemble à elec_HID-1234, on cherche s'il contient 'elec', 'piscine' etc.)
  const sysId = select.value;
  let html = "";

  if (sysId.includes("piscine")) {
    html = `
      <div style="border-left:3px solid #d18a35; padding-left:10px;">
        <h4 style="margin:0 0 10px; font-size:13px; color:#d18a35;">Fiche technique</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <input type="text" data-key="Volume" placeholder="Volume (ex: 45m³)" class="spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc;">
          <select data-key="Traitement" class="spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc;"><option value="">-- Traitement --</option><option value="Sel">Sel</option><option value="Chlore">Chlore</option></select>
        </div>
      </div>`;
  } else if (sysId.includes("elec")) {
    html = `
      <div style="border-left:3px solid #4b9b69; padding-left:10px;">
        <h4 style="margin:0 0 10px; font-size:13px; color:#4b9b69;">Appareil Électrique</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <input type="text" data-key="Protection" placeholder="Ampérage (ex: 16A)" class="spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc;">
        </div>
      </div>`;
  }
  container.innerHTML = html;
}

async function submitEquipment(event) {
  event.preventDefault();
  const systemId = document.getElementById("form-sys-id").value;
  const name = document.getElementById("form-name").value.trim();
  const model = document.getElementById("form-model").value.trim();
  const specs = {};

  document.querySelectorAll(".spec-input").forEach(input => {
    if (input.value) specs[input.getAttribute("data-key")] = input.value;
  });

  const payload = {
    systemId, name, model, specs,
    notice: model ? `Notice_${model.replace(/\s+/g, '_')}.pdf` : null
  };

  try {
    const response = await fetch("/api/equipment", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error();
    
    closeModal();
    showMessage("Équipement enregistré !");
    loadHomeData(); // Met à jour l'interface automatiquement
  } catch (error) {
    showMessage("Erreur réseau.");
  }
}

/* ============================================================
   UTILITAIRES (Modale, Échappement, Toasts)
   ============================================================ */
function openModal() { const m = document.getElementById("modal"); if (m) m.classList.remove("hidden"); }
function closeModal() { const m = document.getElementById("modal"); if (m) m.classList.add("hidden"); }
document.addEventListener("click", function(e) { const m = document.getElementById("modal"); if (m && e.target === m) closeModal(); });

function showMessage(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function openQrSimulatorModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">DÉMO</div>
    <h2>Lien QR Code généré</h2>
    <p>Ce lien est collé dans votre maison. Testez-le dans une page de navigation privée :</p>
    <a href="/scan/${currentHomeId}" target="_blank" style="color:blue; word-break:break-all;">https://home-id.onrender.com/scan/${currentHomeId}</a>
  `;
  openModal();
}

function openPlan() { document.getElementById("toast").innerText = "Plan à venir !"; document.getElementById("toast").classList.add("show"); setTimeout(() => document.getElementById("toast").classList.remove("show"), 2000); }
function openAddAlertModal() { showMessage("Fonction entretien bientôt active !"); }

init();
