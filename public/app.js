/* ============================================================
   HOME ID — APPLICATION JAVASCRIPT GLOBALE
   ============================================================ */

let homeData = null;
let currentHomeId = null; 

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  currentHomeId = urlParams.get("id");

  if (!currentHomeId) {
    document.body.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; flex-direction:column; background:#f4f6f5;">
        <div style="font-size:40px; margin-bottom:15px;">📱</div><h2 style="font-family:sans-serif; color:#1e362d; margin:0;">Veuillez scanner un QR Code</h2></div>`;
    return;
  }

  const activeSession = sessionStorage.getItem("homeid_session");
  if (activeSession === currentHomeId) loadHomeData();
  else openLoginModal();
}

function openLoginModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">SÉCURITÉ</div><h2>Déverrouiller la maison</h2>
    <form onsubmit="submitLogin(event)" style="display:flex; flex-direction:column; gap:15px; margin-top:20px;">
      <input type="password" id="login-password" required placeholder="Votre mot de passe" style="width:100%; padding:12px; border-radius:8px; border:1px solid #cdd4ce;">
      <button type="submit" class="button primary" style="padding:12px;">Accéder au tableau de bord</button>
    </form>
    <div id="login-error" style="color:#d93025; font-size:13px; margin-top:15px; display:none; font-weight:bold;"></div>
  `;
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
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
      sessionStorage.setItem("homeid_session", currentHomeId);
      document.getElementById("modal").classList.add("hidden");
      const closeBtn = document.querySelector('.close');
      if (closeBtn) closeBtn.style.display = 'block'; 
      loadHomeData();
    } else {
      errDiv.textContent = "Mot de passe incorrect.";
      errDiv.style.display = "block";
    }
  } catch (error) { errDiv.textContent = "Erreur serveur."; errDiv.style.display = "block"; }
}

async function loadHomeData() {
  try {
    const response = await fetch(`/api/home?id=${currentHomeId}`);
    if (response.status === 404) {
      sessionStorage.removeItem("homeid_session");
      window.location.href = `/scan/${currentHomeId}`;
      return;
    }
    if (!response.ok) throw new Error("Erreur");
    
    homeData = await response.json();
    document.getElementById("display-house-name").textContent = homeData.name || "Ma Maison";
    document.getElementById("display-house-id").textContent = `Maison #${homeData.id}`;
    document.getElementById("display-house-year").textContent = homeData.year || "—";
    document.getElementById("display-house-surface").textContent = homeData.surface ? `${homeData.surface} m²` : "—";
    document.getElementById("display-house-land").textContent = homeData.land ? `${homeData.land} m²` : "—";

    displaySystems();
    displayAlerts();
    displayProfessionals();
  } catch (error) { showMessage("Impossible de charger les données."); }
}

function displaySystems() {
  const container = document.getElementById("systems");
  if (!container) return;
  const systems = homeData.systems || [];
  if (systems.length === 0) { container.innerHTML = `<p>Aucun système.</p>`; return; }

  container.innerHTML = systems.map(system => {
    const equipmentCount = Number(system.equipment || 0);
    const equipmentHTML = equipmentCount > 0 ? `<div style="font-size:11px; color:#77827a; margin-top:4px;">${equipmentCount} équipement(s)</div>` : `<div style="font-size:11px; color:#a26b28; margin-top:4px;">À configurer</div>`;
    return `
      <div class="system" onclick="openSystem('${system.id}')">
        <div class="system-icon">${system.icon || "🏠"}</div>
        <div class="system-name">${escapeHTML(system.name)}</div>
        <div class="status ${system.color || "orange"}"><span class="dot"></span>${escapeHTML(system.status || "À configurer")}</div>
        ${equipmentHTML}
      </div>`;
  }).join("");
}

// ... Les fonctions displayAlerts et displayProfessionals restent identiques
function displayAlerts() { document.getElementById("alerts").innerHTML = (homeData.alerts || []).map(a => `<div class="alert"><span class="date">${escapeHTML(a.date)}</span><strong>${escapeHTML(a.title)}</strong><p>${escapeHTML(a.text)}</p></div>`).join("") || "<p style='font-size:13px; color:#77827a;'>Aucun rappel.</p>"; }
function displayProfessionals() { document.getElementById("professionals").innerHTML = (homeData.professionals || []).map(p => `<div class="pro"><span class="access-active">Intervenu</span><strong>${escapeHTML(p.name)}</strong><p>${escapeHTML(p.domain)}</p></div>`).join("") || "<p style='font-size:13px; color:#77827a;'>Aucun artisan.</p>"; }

/* ============================================================
   L'AFFICHAGE DU SYSTÈME SÉPARÉ (Général vs Équipements)
   ============================================================ */
async function openSystem(systemId) {
  try {
    const response = await fetch(`/api/systems/${encodeURIComponent(systemId)}`);
    if (!response.ok) throw new Error("Système introuvable");
    const system = await response.json();

    // 1. BLOC INFOS GÉNÉRALES
    let generalSpecsHTML = "";
    if (system.specs && Object.keys(system.specs).length > 0) {
      generalSpecsHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:#f4f6f5; padding:15px; border-radius:8px; margin-top:15px;">` + 
        Object.entries(system.specs).map(([key, value]) => `
          <div><span style="font-size:11px; color:#77827a; display:block;">${escapeHTML(key)}</span><strong style="font-size:14px; color:#1e362d;">${escapeHTML(value)}</strong></div>
        `).join("") + `</div>`;
    } else {
      generalSpecsHTML = `<div style="background:#fff3cd; color:#856404; padding:10px; border-radius:8px; font-size:12px; margin-top:15px;">Les caractéristiques générales ne sont pas encore renseignées.</div>`;
    }

    // 2. BLOC ÉQUIPEMENTS
    let equipmentHTML = "";
    if (system.equipment && system.equipment.length > 0) {
      equipmentHTML = system.equipment.map(item => {
        let specsHTML = "";
        if (item.specs && Object.keys(item.specs).length > 0) {
          specsHTML = `<div class="specs-grid">` + Object.entries(item.specs).filter(([k, v]) => v).map(([key, value]) => `<div class="spec-tag"><strong>${escapeHTML(key)}</strong>: ${escapeHTML(String(value))}</div>`).join("") + `</div>`;
        }
        return `
          <div class="equipment-deep">
            <div class="equip-header"><strong>${escapeHTML(item.name)}</strong><span class="equip-model">${item.model ? escapeHTML(item.model) : "Modèle non précisé"}</span></div>
            ${specsHTML}
            <div class="equip-footer" style="display:flex; justify-content:space-between;">
              <span>Enregistré le : ${escapeHTML(item.installed || "—")}</span>
              ${item.notice ? `<span style="color:#2a7049; cursor:pointer;" onclick="showMessage('Notice : ${item.notice}')">📄 Voir Notice</span>` : ''}
            </div>
          </div>`;
      }).join("");
    } else {
      equipmentHTML = `<div style="background:#f8f9f7; padding:20px; text-align:center; border-radius:12px; margin-top:10px;"><p style="color:#707a74; font-size:13px; margin:0;">Aucun équipement enregistré.</p></div>`;
    }

    // MODALE COMPLÈTE
    document.getElementById("modal-content").innerHTML = `
      <div class="eyebrow">${system.icon || "🏠"} SYSTÈME</div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 style="margin:0;">${escapeHTML(system.name)}</h2>
        <button class="button secondary" style="padding:6px 12px; font-size:12px;" onclick="openConfigSystemModal('${system.id}', '${escapeHTML(system.name)}')">⚙️ Configurer</button>
      </div>
      
      ${generalSpecsHTML}

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:30px; border-bottom:1px solid #e3e8e4; padding-bottom:10px;">
        <h3 style="margin:0;">Équipements</h3>
        <button class="button secondary" style="padding:4px 10px; font-size:12px;" onclick="openAddEquipmentModal('${system.id}')">+ Ajouter</button>
      </div>
      <div style="margin-top:15px;">${equipmentHTML}</div>
    `;
    openModal();
  } catch (error) { showMessage("Erreur d'ouverture"); }
}

/* ============================================================
   CONFIGURATION GÉNÉRALE DU SYSTÈME (Ex: Volume Piscine)
   ============================================================ */
function openConfigSystemModal(systemId, systemName) {
  let fieldsHTML = "";
  
  if (systemId.includes("piscine")) {
    fieldsHTML = `
      <input type="text" data-key="Volume" placeholder="Volume (ex: 45m³)" class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; margin-bottom:10px;">
      <select data-key="Traitement" class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; margin-bottom:10px;">
        <option value="">-- Traitement --</option><option value="Au Sel">Au Sel</option><option value="Chlore">Chlore</option><option value="Brome">Brome</option>
      </select>
      <input type="text" data-key="Revêtement" placeholder="Ex: Liner, Coque..." class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc;">
    `;
  } else if (systemId.includes("elec")) {
    fieldsHTML = `
      <select data-key="Abonnement" class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; margin-bottom:10px;">
        <option value="">-- Phase --</option><option value="Monophasé">Monophasé</option><option value="Triphasé">Triphasé</option>
      </select>
      <input type="text" data-key="Puissance Souscrite" placeholder="Ex: 9 kVA" class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; margin-bottom:10px;">
      <input type="text" data-key="PDL / PRM" placeholder="Numéro PDL (14 chiffres)" class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc;">
    `;
  } else {
    fieldsHTML = `<p style="font-size:13px; color:#77827a;">Configuration standard pour ${systemName}.</p>
    <input type="text" data-key="Note" placeholder="Informations générales..." class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc;">`;
  }

  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">CONFIGURATION</div>
    <h2>Général : ${systemName}</h2>
    <form onsubmit="submitSystemConfig(event, '${systemId}')" style="margin-top:20px;">
      ${fieldsHTML}
      <button type="submit" class="button primary" style="width:100%; margin-top:20px;">Enregistrer les paramètres</button>
    </form>
  `;
}

async function submitSystemConfig(event, systemId) {
  event.preventDefault();
  const specs = {};
  document.querySelectorAll(".sys-spec-input").forEach(input => { if (input.value) specs[input.getAttribute("data-key")] = input.value; });

  try {
    const response = await fetch("/api/systems/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ systemId, specs }) });
    if (response.ok) { showMessage("Configuration enregistrée !"); openSystem(systemId); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

/* ============================================================
   AJOUT D'ÉQUIPEMENT (Formulaire allégé)
   ============================================================ */
function openAddMenu() { openAddEquipmentModal(); }

function openAddEquipmentModal(preselectedSystem = "") {
  const systemOptions = (homeData.systems || []).map(sys => `<option value="${escapeHTML(sys.id)}" ${sys.id === preselectedSystem ? "selected" : ""}>${escapeHTML(sys.name)}</option>`).join("");
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">NOUVEL ÉQUIPEMENT</div>
    <h2>Ajouter un équipement</h2>
    <form onsubmit="submitEquipment(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <select id="form-sys-id" required style="padding:10px; border-radius:8px; border:1px solid #ccc;" onchange="renderDynamicFields()">
        <option value="" disabled ${preselectedSystem ? "" : "selected"}>-- Choisissez la catégorie --</option>
        ${systemOptions}
      </select>
      <input type="text" id="form-name" placeholder="Nom (Ex : Pompe, Disjoncteur...)" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="text" id="form-model" placeholder="Marque / Modèle" style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <div id="dynamic-fields-container" style="display:flex; flex-direction:column; gap:10px;"></div>
      <button type="submit" class="button primary" style="margin-top:10px;">Sauvegarder l'appareil</button>
    </form>`;
  if (preselectedSystem) renderDynamicFields();
}

// Le formulaire pour l'équipement est désormais allégé des infos globales !
function renderDynamicFields() {
  const sysId = document.getElementById("form-sys-id").value;
  const container = document.getElementById("dynamic-fields-container");
  if (!container) return;
  
  let html = "";
  if (sysId.includes("piscine")) {
    html = `<input type="text" data-key="Puissance/Débit" placeholder="Ex: 1.5 CV / 14m3/h" class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc;">`;
  } else if (sysId.includes("elec")) {
    html = `<input type="text" data-key="Protection" placeholder="Ampérage (ex: 16A)" class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc;">`;
  }
  container.innerHTML = html;
}

async function submitEquipment(event) {
  event.preventDefault();
  const payload = {
    systemId: document.getElementById("form-sys-id").value,
    name: document.getElementById("form-name").value,
    model: document.getElementById("form-model").value,
    specs: {},
    notice: document.getElementById("form-model").value ? `Notice_${document.getElementById("form-model").value.replace(/\s+/g, '_')}.pdf` : null
  };
  document.querySelectorAll(".eq-spec-input").forEach(input => { if (input.value) payload.specs[input.getAttribute("data-key")] = input.value; });

  try {
    const response = await fetch("/api/equipment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { showMessage("Équipement ajouté !"); openSystem(payload.systemId); loadHomeData(); }
  } catch (e) { showMessage("Erreur"); }
}

/* ============================================================
   PROFIL PROPRIÉTAIRE
   ============================================================ */
function openProfileModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">PROFIL</div><h2>Modifier ma maison</h2>
    <form onsubmit="submitProfileEdit(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="edit-name" value="${homeData.name}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="number" id="edit-year" value="${homeData.year}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <div style="display:flex; gap:10px;">
        <input type="number" id="edit-surface" value="${homeData.surface}" placeholder="Surface" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
        <input type="number" id="edit-land" value="${homeData.land}" placeholder="Terrain" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
      </div>
      <input type="password" id="edit-password" required placeholder="Mot de passe actuel *" style="padding:10px; border-radius:8px; border:1px solid #ccc; border-left:4px solid #d93025;">
      <button type="submit" class="button primary">Enregistrer</button>
    </form>`;
  openModal();
}

async function submitProfileEdit(event) {
  event.preventDefault();
  const payload = {
    id: currentHomeId, name: document.getElementById("edit-name").value, year: document.getElementById("edit-year").value,
    surface: document.getElementById("edit-surface").value, land: document.getElementById("edit-land").value, currentPassword: document.getElementById("edit-password").value
  };
  try {
    const res = await fetch("/api/home/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { closeModal(); showMessage("Mise à jour réussie !"); loadHomeData(); } else { showMessage("Mot de passe incorrect."); }
  } catch(e) { showMessage("Erreur"); }
}

/* ============================================================
   UTILITAIRES
   ============================================================ */
function openModal() { document.getElementById("modal").classList.remove("hidden"); }
function closeModal() { document.getElementById("modal").classList.add("hidden"); }
document.addEventListener("click", e => { const m = document.getElementById("modal"); if (m && e.target === m) closeModal(); });
function showMessage(msg) { const t = document.getElementById("toast"); if(!t) return; t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2500); }
function escapeHTML(str) { return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function openPlan() { document.getElementById('plan-upload') ? document.getElementById('plan-upload').click() : showMessage("Plan bientôt dispo"); }
function openQrSimulatorModal() { window.open(`/scan/${currentHomeId}`, "_blank"); }

init();
