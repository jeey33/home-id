/* ============================================================
   HOME ID — APPLICATION JAVASCRIPT GLOBALE
   ============================================================ */

let homeData = null;
let currentHomeId = null; 
window.isDragging = false; 
let sessionVaultPin = null; 

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

/* ============================================================
   SÉCURITÉ & CHARGEMENT
   ============================================================ */
function openLoginModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">SÉCURITÉ</div><h2>Déverrouiller la maison</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitLogin(event); return false;" style="display:flex; flex-direction:column; gap:15px; margin-top:20px;">
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
  const password = document.getElementById("login-password").value;
  const errDiv = document.getElementById("login-error");
  try {
    const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: currentHomeId, password: password }) });
    if (response.ok) {
      sessionStorage.setItem("homeid_session", currentHomeId);
      document.getElementById("modal").classList.add("hidden");
      const closeBtn = document.querySelector('.close');
      if (closeBtn) closeBtn.style.display = 'block'; 
      loadHomeData();
    } else { errDiv.textContent = "Mot de passe incorrect."; errDiv.style.display = "block"; }
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
    
    document.getElementById("main-content").style.display = "block";

    populateHouseInfo();
    displaySystems();
    displayAlerts();
    displayProfessionals();
    
    // Ajoute ces deux lignes ici !
    displayDiagnostics();
    displayCustomWidgets();
    displayCadastre();
     
  } catch (error) { showMessage("Impossible de charger les données."); }
}

function populateHouseInfo() {
  document.getElementById("display-house-name").textContent = homeData.name || "Ma Maison";
  document.getElementById("display-house-id").textContent = `Maison #${homeData.id}`;
  document.getElementById("display-house-year").textContent = homeData.year || "—";
  document.getElementById("display-house-surface").textContent = homeData.surface ? `${homeData.surface} m²` : "—";
  document.getElementById("display-house-land").textContent = homeData.land ? `${homeData.land} m²` : "—";

  const gallery = document.getElementById("plans-gallery");
  const docPlans = document.getElementById("doc-plans");
  const docNotices = document.getElementById("doc-notices");
  const plans = homeData.plans || [];
  
  if (gallery) {
    if (plans.length === 0) {
      gallery.innerHTML = `<p style="font-size:12px; color:#77827a; margin: 10px 0;">Aucun plan enregistré pour le moment.</p>`;
    } else {
      gallery.innerHTML = plans.map(p => `
        <div class="plan-thumbnail" onclick="viewPlanFullscreen('${p.image}', '${escapeHTML(p.name)}')">
          <img src="${p.image}" class="plan-img" alt="Plan ${escapeHTML(p.name)}">
          <div class="plan-name">${escapeHTML(p.name)}</div>
        </div>
      `).join("");
    }
  }
  if (docPlans) docPlans.innerText = `${plans.length} fichier(s)`;
  if (docNotices && homeData.systems) {
    const totalEquip = homeData.systems.reduce((acc, sys) => acc + (sys.equipment || 0), 0);
    docNotices.textContent = `${totalEquip} fichier(s)`;
  }
}

/* ============================================================
   COFFRE FORT DE MOTS DE PASSE (Ultra-Sécurisé)
   ============================================================ */
async function openVaultCheck() {
  try {
    const response = await fetch("/api/vault/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ homeId: currentHomeId }) });
    const data = await response.json();
    
    if (!data.isSetup) {
      document.getElementById("modal-content").innerHTML = `
        <div class="eyebrow" style="color:#d93025;">SÉCURITÉ EXTRÊME</div>
        <h2>Initialiser le Coffre-Fort</h2>
        <p style="font-size:13px; color:#59645d; line-height:1.4;">Vos mots de passe seront <strong>chiffrés (AES-256)</strong>. Créez un Code PIN unique pour les verrouiller.</p>
        <form action="javascript:void(0);" onsubmit="event.preventDefault(); setupVault(); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:20px;">
          <input type="password" id="vault-setup-pin" inputmode="numeric" pattern="[0-9]*" placeholder="Code PIN (ex: 1234)" required style="padding:15px; border-radius:8px; border:2px solid #1e362d; font-size:24px; text-align:center; letter-spacing:8px;">
          <button type="submit" class="button primary pointer" style="padding:15px; font-size:16px;">Créer le Coffre</button>
        </form>
      `;
      openModal();
    } else {
      if (!sessionVaultPin) showVaultUnlock();
      else loadVaultDashboard();
    }
  } catch(e) { showMessage("Erreur de connexion au coffre."); }
}

async function setupVault() {
  const pin = document.getElementById("vault-setup-pin").value;
  try {
    const res = await fetch("/api/vault/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ homeId: currentHomeId, pin }) });
    if(res.ok) { sessionVaultPin = pin; showMessage("Coffre-fort créé !"); loadVaultDashboard(); }
  } catch(e) { showMessage("Erreur réseau."); }
}

function showVaultUnlock() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow" style="color:#d93025;">🔐 COFFRE-FORT</div>
    <h2>Déverrouillage requis</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); unlockVault(); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:20px;">
      <input type="password" id="vault-unlock-pin" autocomplete="current-password" inputmode="numeric" placeholder="Code PIN" required style="padding:15px; border-radius:8px; border:2px solid #1e362d; font-size:24px; text-align:center; letter-spacing:8px;">
      <div style="display:flex; gap:10px;">
        <button type="button" class="button secondary pointer" style="flex:1; padding:15px; font-size:16px; background:#e3e8e4;" onclick="triggerBiometricUnlock()">👁️ / 👆 Biométrie</button>
        <button type="submit" class="button primary pointer" style="flex:1; padding:15px; font-size:16px;">Déverrouiller</button>
      </div>
    </form>
    <div id="vault-error" style="color:#d93025; font-size:13px; margin-top:15px; display:none; font-weight:bold; text-align:center;"></div>
  `;
  openModal();
}

function triggerBiometricUnlock() {
  document.getElementById("vault-unlock-pin").focus();
}

async function unlockVault() {
  const pin = document.getElementById("vault-unlock-pin").value;
  const errDiv = document.getElementById("vault-error");
  try {
    const res = await fetch("/api/vault/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ homeId: currentHomeId, pin }) });
    if(res.ok) { sessionVaultPin = pin; loadVaultDashboard(); } 
    else { errDiv.textContent = "Code PIN incorrect."; errDiv.style.display = "block"; }
  } catch(e) { errDiv.textContent = "Erreur réseau."; errDiv.style.display = "block"; }
}

async function loadVaultDashboard() {
  try {
    const res = await fetch("/api/vault/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ homeId: currentHomeId, pin: sessionVaultPin }) });
    if(!res.ok) { sessionVaultPin = null; openVaultCheck(); return; }
    
    const data = await res.json();
    const items = data.items || [];
    
    let itemsHTML = "";
    if (items.length === 0) {
      itemsHTML = `<div style="text-align:center; padding:30px; background:#f4f6f5; border-radius:12px;"><span style="font-size:30px;">👻</span><p style="color:#77827a; font-size:13px;">Le coffre est vide.</p></div>`;
    } else {
      itemsHTML = items.map(item => `
        <div style="background:#fff; border:1px solid #e3e8e4; border-radius:12px; padding:15px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
          <div style="flex:1;">
            <strong style="display:block; color:#17211c; font-size:15px;">${escapeHTML(item.title)}</strong>
            ${item.login ? `<span style="font-size:12px; color:#59645d; display:block; margin-top:2px;">ID: ${escapeHTML(item.login)}</span>` : ''}
            <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
              <input type="password" value="${escapeHTML(item.password)}" id="pwd-${item.id}" readonly style="border:none; background:transparent; font-family:monospace; font-size:14px; width:120px; outline:none; pointer-events:none;">
              <button onclick="togglePwdVisibility('pwd-${item.id}')" style="background:none; border:none; cursor:pointer; font-size:12px; color:#4b9b69; font-weight:bold;">Afficher</button>
              <button onclick="copyToClipboard('${escapeHTML(item.password)}')" style="background:none; border:none; cursor:pointer; font-size:12px; color:#4b9b69; font-weight:bold;">Copier</button>
            </div>
          </div>
          <button onclick="deleteVaultItem(${item.id})" style="background:none; border:none; cursor:pointer; font-size:16px; color:#d93025; padding:10px;">🗑️</button>
        </div>
      `).join("");
    }

    document.getElementById("modal-content").innerHTML = `
      <div class="eyebrow" style="color:#d93025;">🔐 COFFRE-FORT DÉVERROUILLÉ</div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <h2 style="margin:0;">Mots de passe</h2>
        <button class="button secondary pointer" style="padding:6px 12px; font-size:12px;" onclick="sessionVaultPin=null; openVaultCheck();">🔒 Verrouiller</button>
      </div>
      <div style="max-height:50vh; overflow-y:auto; padding-right:5px; margin-bottom:15px;">${itemsHTML}</div>
      <button class="button primary pointer" style="width:100%; padding:12px;" onclick="openAddVaultItemModal()">+ Nouveau mot de passe</button>
    `;
  } catch(e) { showMessage("Erreur réseau"); }
}

function togglePwdVisibility(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === "password" ? "text" : "password";
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showMessage("Mot de passe copié !"));
}

function openAddVaultItemModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow" style="color:#d93025;">🔐 COFFRE-FORT</div>
    <h2>Ajouter un accès</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitVaultItem(event); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Nom (Ex: Wi-Fi, Alarme, Netflix...)</label>
      <input type="text" id="vault-add-title" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Identifiant / Email (Optionnel)</label>
      <input type="text" id="vault-add-login" style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Mot de passe secret *</label>
      <input type="text" id="vault-add-pwd" required style="padding:10px; border-radius:8px; border:1px solid #ccc; font-family:monospace;">
      <div style="display:flex; gap:10px; margin-top:10px;">
        <button type="button" class="button secondary pointer" style="flex:1;" onclick="loadVaultDashboard()">Annuler</button>
        <button type="submit" class="button primary pointer" style="flex:2;">Chiffrer et Enregistrer</button>
      </div>
    </form>
  `;
}

async function submitVaultItem(event) {
  const payload = {
    homeId: currentHomeId, pin: sessionVaultPin, title: document.getElementById("vault-add-title").value,
    login: document.getElementById("vault-add-login").value, password: document.getElementById("vault-add-pwd").value
  };
  try {
    const res = await fetch("/api/vault/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { showMessage("Mot de passe sécurisé !"); loadVaultDashboard(); }
    else { showMessage("Erreur d'authentification."); sessionVaultPin = null; openVaultCheck(); }
  } catch(e) { showMessage("Erreur réseau"); }
}

async function deleteVaultItem(itemId) {
  if(!confirm("Supprimer ce mot de passe définitivement ?")) return;
  try {
    const res = await fetch("/api/vault/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ homeId: currentHomeId, pin: sessionVaultPin, itemId }) });
    if(res.ok) { showMessage("Mot de passe supprimé."); loadVaultDashboard(); }
  } catch(e) { showMessage("Erreur réseau"); }
}

/* ============================================================
   AFFICHAGE SYSTÈMES ET GLISSER-DÉPOSER
   ============================================================ */
function displaySystems() {
  const container = document.getElementById("systems");
  if (!container) return;
  const systems = homeData.systems || [];
  if (systems.length === 0) { container.innerHTML = `<p>Aucun système.</p>`; return; }

  container.innerHTML = systems.map(system => {
    const equipmentCount = Number(system.equipment || 0);
    const equipmentHTML = equipmentCount > 0 ? `<div style="font-size:11px; color:#77827a; margin-top:4px;">${equipmentCount} équipement(s)</div>` : `<div style="font-size:11px; color:#a26b28; margin-top:4px;">À configurer</div>`;
    return `
      <div class="system pointer" draggable="true" data-id="${system.id}" onclick="if(!window.isDragging) openSystem('${system.id}')">
        <div class="system-icon">${system.icon || "🏠"}</div>
        <div class="system-name">${escapeHTML(system.name)}</div>
        <div class="status ${system.color || "orange"}"><span class="dot"></span>${escapeHTML(system.status || "À configurer")}</div>
        ${equipmentHTML}
      </div>`;
  }).join("");

  let draggedItem = null;
  const draggables = container.querySelectorAll('.system');
  
  draggables.forEach(item => {
    item.addEventListener('dragstart', function(e) {
      window.isDragging = true; draggedItem = this;
      setTimeout(() => this.classList.add('dragging'), 0);
    });
    item.addEventListener('dragend', async function() {
      this.classList.remove('dragging'); draggedItem = null;
      setTimeout(() => window.isDragging = false, 100);
      const orderData = [...container.querySelectorAll('.system')].map((el, index) => ({ id: el.getAttribute('data-id'), order: index }));
      try { await fetch('/api/systems/reorder', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({orderData}) }); } catch(e) {}
    });
    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      if (this !== draggedItem && draggedItem) {
        const bounding = this.getBoundingClientRect();
        const offset = e.clientX - bounding.left - (bounding.width / 2);
        if (offset > 0) this.after(draggedItem); else this.before(draggedItem);
      }
    });
  });
}

/* ============================================================
   ARTISANS (AFFICHAGE, AJOUT, MODIF ET SUPPRESSION)
   ============================================================ */
function displayProfessionals() { 
  const container = document.getElementById("professionals");
  if (!container) return;
  const pros = homeData.professionals || [];
  if (pros.length === 0) { container.innerHTML = "<p style='font-size:13px; color:#77827a;'>Aucun artisan enregistré.</p>"; return; }

  container.innerHTML = pros.map(p => {
    const pJSON = encodeURIComponent(JSON.stringify(p));
    let notesHtml = p.notes ? `<div style="margin-top:6px; font-size:11px; color:#59645d; background:#f4f6f5; padding:6px; border-radius:4px; border-left:2px solid #4b9b69;"><i>"${escapeHTML(p.notes)}"</i></div>` : "";
    
    return `
    <div class="pro" style="position:relative;">
      <span class="access-active">Intervenu</span>
      <button onclick="openEditProModal('${pJSON}')" style="position:absolute; right:0; top:10px; background:none; border:none; cursor:pointer; font-size:14px; color:#77827a; transition:0.2s;" onmouseover="this.style.color='#1e362d'" onmouseout="this.style.color='#77827a'">✏️</button>
      <strong>${escapeHTML(p.name)}</strong>
      <p style="margin:2px 0;">${escapeHTML(p.domain)}</p>
      ${notesHtml}
      <div style="display:flex; gap:10px; margin-top:8px;">
        ${p.phone ? `<a href="tel:${escapeHTML(p.phone)}" style="display:inline-flex; align-items:center; gap:5px; font-size:11px; color:#1e362d; background:#eef2ef; padding:4px 8px; border-radius:6px; text-decoration:none;">📞 Appeler</a>` : ''}
        ${p.email ? `<a href="mailto:${escapeHTML(p.email)}" style="display:inline-flex; align-items:center; gap:5px; font-size:11px; color:#1e362d; background:#eef2ef; padding:4px 8px; border-radius:6px; text-decoration:none;">✉️ Email</a>` : ''}
      </div>
    </div>
  `}).join("");
}

function openAddProModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">NOUVEL ARTISAN</div>
    <h2>Ajouter un professionnel</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitPro(event); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="add-pro-name" placeholder="Nom de l'entreprise ou artisan *" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="text" id="add-pro-domain" placeholder="Spécialité (Ex: Plombier, Chauffagiste...) *" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <div style="display:flex; gap:10px;">
        <input type="tel" id="add-pro-phone" placeholder="N° Téléphone" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
        <input type="email" id="add-pro-email" placeholder="Adresse Email" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
      </div>
      <textarea id="add-pro-notes" placeholder="Avis, tarifs, commentaires (ex: Très bon plombier...)" style="padding:10px; border-radius:8px; border:1px solid #ccc; resize:vertical; min-height:60px;"></textarea>
      <button type="submit" class="button primary pointer" style="margin-top:10px;">Enregistrer l'artisan</button>
    </form>`;
  openModal();
}

async function submitPro(event) {
  const payload = { homeId: currentHomeId, name: document.getElementById("add-pro-name").value, domain: document.getElementById("add-pro-domain").value, phone: document.getElementById("add-pro-phone").value, email: document.getElementById("add-pro-email").value, notes: document.getElementById("add-pro-notes").value };
  try {
    const response = await fetch("/api/professionals/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { showMessage("Artisan ajouté !"); closeModal(); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

function openEditProModal(encodedPro) {
  const pro = JSON.parse(decodeURIComponent(encodedPro));
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">MODIFICATION ARTISAN</div>
    <h2>Modifier ${escapeHTML(pro.name)}</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitEditPro(event, ${pro.id}); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Nom et Spécialité</label>
      <input type="text" id="edit-pro-name" value="${escapeHTML(pro.name)}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="text" id="edit-pro-domain" value="${escapeHTML(pro.domain)}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Contacts</label>
      <div style="display:flex; gap:10px;">
        <input type="tel" id="edit-pro-phone" value="${escapeHTML(pro.phone || '')}" placeholder="N° Téléphone" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
        <input type="email" id="edit-pro-email" value="${escapeHTML(pro.email || '')}" placeholder="Adresse Email" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
      </div>
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Avis / Notes</label>
      <textarea id="edit-pro-notes" placeholder="Avis, tarifs, commentaires..." style="padding:10px; border-radius:8px; border:1px solid #ccc; resize:vertical; min-height:60px;">${escapeHTML(pro.notes || '')}</textarea>
      <div style="display:flex; gap:10px; margin-top:10px;">
        <button type="submit" class="button primary pointer" style="flex:1;">Enregistrer</button>
        <button type="button" class="button secondary pointer" style="color:#d93025; border:1px solid #fce8e6; background:#fffafa;" onclick="deletePro(${pro.id})">🗑️ Supprimer</button>
      </div>
    </form>`;
  openModal();
}

async function submitEditPro(event, proId) {
  const payload = { id: proId, name: document.getElementById("edit-pro-name").value, domain: document.getElementById("edit-pro-domain").value, phone: document.getElementById("edit-pro-phone").value, email: document.getElementById("edit-pro-email").value, notes: document.getElementById("edit-pro-notes").value };
  try {
    const response = await fetch("/api/professionals/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { showMessage("Artisan modifié !"); closeModal(); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

async function deletePro(proId) {
  if (!confirm("Voulez-vous vraiment supprimer cet artisan de votre carnet ?")) return;
  try {
    const response = await fetch("/api/professionals/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: proId }) });
    if (response.ok) { showMessage("Artisan supprimé."); closeModal(); loadHomeData(); }
  } catch (e) { showMessage("Erreur"); }
}

/* ============================================================
   ALERTES ET ARCHIVAGE
   ============================================================ */
function displayAlerts() {
  const container = document.getElementById("alerts");
  if (!container) return;
  const alerts = homeData.alerts || [];

  const todo = alerts.filter(a => !a.is_done);
  const done = alerts.filter(a => a.is_done);
  
  let html = "";
  
  if (todo.length === 0) {
    html += "<p style='font-size:13px; color:#77827a;'>Aucun rappel à faire.</p>";
  } else {
    html += todo.map(a => {
      let isOverdue = false;
      let dateStr = escapeHTML(a.date);
      if (a.date && a.date.includes('-')) {
        const taskDate = new Date(`${a.date}T00:00:00`);
        const today = new Date(); today.setHours(0,0,0,0);
        if (taskDate < today) isOverdue = true;
        dateStr = taskDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      }
      const overdueBadge = isOverdue ? `<span style="color:#d93025; font-size:10px; margin-left:5px;">⚠️ Dépassé</span>` : "";
      const alertJSON = encodeURIComponent(JSON.stringify(a));
      
      return `
        <div class="alert" style="position:relative; display:flex; align-items:flex-start; gap:12px;">
          <button onclick="openEditAlertModal('${alertJSON}')" style="position:absolute; right:0; top:10px; background:none; border:none; cursor:pointer; font-size:14px; color:#77827a; transition:0.2s;">✏️</button>
          <input type="checkbox" onclick="toggleAlert(${a.id}, true)" style="margin-top:4px; transform:scale(1.2); cursor:pointer;">
          <div style="padding-right:25px;">
            <span class="date" style="background:#e3e8e4; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold;">${dateStr}</span>
            ${overdueBadge}
            <strong style="display:block; margin-top:5px; color:${isOverdue ? '#d93025' : 'inherit'}">${escapeHTML(a.title)}</strong>
            <p style="margin-top:2px; font-size:12px;">${escapeHTML(a.text)}</p>
          </div>
        </div>`;
    }).join("");
  }

  if (done.length > 0) {
    html += `
      <details style="margin-top:15px; border-top:1px solid #e3e8e4; padding-top:10px;">
        <summary style="font-size:12px; color:#77827a; cursor:pointer; font-weight:bold;">Historique des réalisations (${done.length})</summary>
        <div style="margin-top:10px; opacity:0.6;">
          ${done.map(a => `
            <div class="alert" style="position:relative; display:flex; align-items:flex-start; gap:12px;">
              <button onclick="deleteAlert(${a.id})" style="position:absolute; right:0; top:10px; background:none; border:none; cursor:pointer; font-size:14px; color:#d93025; transition:0.2s;">🗑️</button>
              <input type="checkbox" checked onclick="toggleAlert(${a.id}, false)" style="margin-top:4px; transform:scale(1.2); cursor:pointer;">
              <div style="padding-right:25px;">
                <strong style="display:block; text-decoration:line-through;">${escapeHTML(a.title)}</strong>
                <p style="margin-top:2px; font-size:12px; text-decoration:line-through;">Fait : ${escapeHTML(a.text)}</p>
              </div>
            </div>`).join("")}
        </div>
      </details>`;
  }
  container.innerHTML = html;
}

async function toggleAlert(id, isDone) {
  try {
    await fetch("/api/alerts/toggle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_done: isDone }) });
    loadHomeData(); 
  } catch (error) { showMessage("Erreur."); }
}

function openAddAlertModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">NOUVEL ENTRETIEN</div><h2>Ajouter un rappel</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitAlert(event); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="add-alert-title" placeholder="Titre (Ex: Nettoyage Filtres Climatisation)" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="date" id="add-alert-date" required style="padding:10px; border-radius:8px; border:1px solid #ccc; font-family:inherit;">
      <textarea id="add-alert-text" placeholder="Détails (Optionnel)..." style="padding:10px; border-radius:8px; border:1px solid #ccc; resize:vertical; min-height:60px;"></textarea>
      <button type="submit" class="button primary pointer" style="margin-top:10px;">Programmer le rappel</button>
    </form>`;
  openModal();
}

async function submitAlert(event) {
  const payload = { homeId: currentHomeId, title: document.getElementById("add-alert-title").value, date: document.getElementById("add-alert-date").value, text: document.getElementById("add-alert-text").value };
  try {
    const response = await fetch("/api/alerts/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { showMessage("Rappel programmé !"); closeModal(); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

function openEditAlertModal(encodedAlert) {
  const alert = JSON.parse(decodeURIComponent(encodedAlert));
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">MODIFICATION ENTRETIEN</div><h2>Modifier le rappel</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitEditAlert(event, ${alert.id}); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Titre de l'entretien</label>
      <input type="text" id="edit-alert-title" value="${escapeHTML(alert.title)}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Date limite</label>
      <input type="date" id="edit-alert-date" value="${escapeHTML(alert.date)}" required style="padding:10px; border-radius:8px; border:1px solid #ccc; font-family:inherit;">
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Détails (Optionnel)</label>
      <textarea id="edit-alert-text" style="padding:10px; border-radius:8px; border:1px solid #ccc; resize:vertical; min-height:60px;">${escapeHTML(alert.text || '')}</textarea>
      <div style="display:flex; gap:10px; margin-top:10px;">
        <button type="submit" class="button primary pointer" style="flex:1;">Enregistrer</button>
        <button type="button" class="button secondary pointer" style="color:#d93025; border:1px solid #fce8e6; background:#fffafa;" onclick="deleteAlert(${alert.id})">🗑️ Supprimer</button>
      </div>
    </form>`;
  openModal();
}

async function submitEditAlert(event, alertId) {
  const payload = { id: alertId, title: document.getElementById("edit-alert-title").value, date: document.getElementById("edit-alert-date").value, text: document.getElementById("edit-alert-text").value };
  try {
    const response = await fetch("/api/alerts/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { showMessage("Entretien modifié !"); closeModal(); loadHomeData(); }
  } catch (e) { showMessage("Erreur"); }
}

async function deleteAlert(alertId) {
  if (!confirm("Voulez-vous vraiment supprimer cet entretien ?")) return;
  try {
    const response = await fetch("/api/alerts/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: alertId }) });
    if (response.ok) { showMessage("Entretien supprimé."); closeModal(); loadHomeData(); }
  } catch (e) { showMessage("Erreur"); }
}

/* ============================================================
   AFFICHAGE SYSTÈMES ET ÉQUIPEMENTS
   ============================================================ */
async function openSystem(systemId) {
  try {
    const response = await fetch(`/api/systems/${encodeURIComponent(systemId)}`);
    if (!response.ok) throw new Error("Système introuvable");
    const system = await response.json();

    let generalSpecsHTML = "";
    if (system.specs && Object.keys(system.specs).length > 0) {
      generalSpecsHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:#f4f6f5; padding:15px; border-radius:8px; margin-top:15px;">` + 
        Object.entries(system.specs).map(([key, value]) => `<div><span style="font-size:11px; color:#77827a; display:block;">${escapeHTML(key)}</span><strong style="font-size:14px; color:#1e362d;">${escapeHTML(value)}</strong></div>`).join("") + `</div>`;
    }

    let equipmentHTML = "";
    if (system.equipment && system.equipment.length > 0) {
      equipmentHTML = system.equipment.map(item => {
        let specsHTML = "";
        if (item.specs && Object.keys(item.specs).length > 0) {
          specsHTML = `<div class="specs-grid" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">` + Object.entries(item.specs).filter(([k, v]) => v).map(([key, value]) => `<div class="spec-tag" style="background:#eef2ef; color:#3b453f; font-size:11px; padding:5px 10px; border-radius:8px; display:inline-block; border:1px solid #dce2dd;"><strong>${escapeHTML(key)}</strong>: ${escapeHTML(String(value))}</div>`).join("") + `</div>`;
        }
        let noticeBtn = item.model ? `<a href="https://www.google.com/search?q=${encodeURIComponent(`notice utilisation pdf ${item.name} ${item.model}`)}" target="_blank" style="color:#d18a35; text-decoration:none; font-size:11px; font-weight:bold; margin-right:8px;">🔍 Notice</a>` : '';
        let notesHTML = item.notes ? `<div style="background:#f8f9f7; border-left:3px solid #d18a35; padding:8px 12px; margin-top:10px; border-radius:4px; font-size:12px; color:#59645d; line-height:1.4;"><strong>📌 Info :</strong> ${escapeHTML(item.notes)}</div>` : "";
        const itemJSON = encodeURIComponent(JSON.stringify(item));

        return `<div class="equipment-deep" style="background:#ffffff; border:1px solid #e3e8e4; border-radius:12px; padding:16px; margin-bottom:12px;">
            <div class="equip-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div><strong style="display:block; font-size:15px; color:#17211c;">${escapeHTML(item.name)}</strong><span style="font-size:12px; color:#77827a; font-family:monospace; background:#f4f6f3; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px;">${item.model ? escapeHTML(item.model) : "Modèle non précisé"}</span></div>
            </div>${specsHTML}${notesHTML}
            <div class="equip-footer" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-top:12px; padding-top:10px; border-top:1px solid #e3e8e4;">
              <span style="font-size:11px; color:#77827a;">Installé : ${escapeHTML(item.installed || "—")}</span>
              <div style="display:flex; align-items:center; gap:6px;">${noticeBtn}<button class="button secondary pointer" style="padding:4px 8px; font-size:11px;" onclick="openEditEquipmentModal('${itemJSON}', '${system.id}')">✏️ Éditer</button><button class="button secondary pointer" style="padding:4px 8px; font-size:11px; color:#d93025; border-color:#fce8e6; background:#fffafa;" onclick="deleteEquipment('${item.id}', '${system.id}')">🗑️</button></div>
            </div></div>`;
      }).join("");
    } else {
      equipmentHTML = `<div style="background:#f8f9f7; padding:20px; text-align:center; border-radius:12px; margin-top:10px;"><p style="color:#707a74; font-size:13px; margin:0;">Aucun équipement enregistré.</p></div>`;
    }

    document.getElementById("modal-content").innerHTML = `
      <div class="eyebrow">${system.icon || "🏠"} SYSTÈME</div>
      <div style="display:flex; justify-content:space-between; align-items:center;"><h2 style="margin:0;">${escapeHTML(system.name)}</h2><div style="display:flex; gap:5px;"><button class="button secondary pointer" style="padding:6px 8px; font-size:12px;" onclick="openEditSystemModal('${system.id}', '${escapeHTML(system.name)}', '${escapeHTML(system.icon)}')">✏️</button><button class="button secondary pointer" style="padding:6px 8px; font-size:12px; color:#d93025; background:#fffafa; border-color:#fce8e6;" onclick="deleteSystem('${system.id}')">🗑️</button><button class="button secondary pointer" style="padding:6px 12px; font-size:12px;" onclick="openConfigSystemModal('${system.id}', '${escapeHTML(system.name)}')">⚙️ Config.</button></div></div>
      ${generalSpecsHTML}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:30px; border-bottom:1px solid #e3e8e4; padding-bottom:10px;"><h3 style="margin:0;">Équipements</h3><button class="button secondary pointer" style="padding:4px 10px; font-size:12px;" onclick="openAddEqModal('${system.id}')">+ Ajouter</button></div>
      <div style="margin-top:15px;">${equipmentHTML}</div>
    `;
    openModal();
  } catch (error) { showMessage("Erreur d'ouverture"); }
}

function openAddMenu() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">ACTION RAPIDE</div>
    <h2>Que voulez-vous ajouter ?</h2>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px;">
      <button class="button secondary pointer" style="padding:15px; text-align:center; height:100px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;" onclick="openAddSystemModal()"><span style="font-size:24px;">⚙️</span><strong>Nouveau<br>Système</strong></button>
      <button class="button secondary pointer" style="padding:15px; text-align:center; height:100px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;" onclick="openAddEqModal()"><span style="font-size:24px;">🔌</span><strong>Nouvel<br>Équipement</strong></button>
      <button class="button secondary pointer" style="padding:15px; text-align:center; height:100px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;" onclick="openAddAlertModal()"><span style="font-size:24px;">📅</span><strong>Rappel<br>d'Entretien</strong></button>
      <button class="button secondary pointer" style="padding:15px; text-align:center; height:100px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;" onclick="openAddProModal()"><span style="font-size:24px;">👷</span><strong>Nouvel<br>Artisan</strong></button>
    </div>`;
  openModal();
}

function openAddSystemModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">NOUVEAU SYSTÈME</div><h2>Ajouter un système</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitNewSystem(event); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="add-sys-name" placeholder="Nom du système (Ex: Panneaux Solaires)" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="text" id="add-sys-icon" placeholder="Émoji / Icône (Ex: ☀️, 📹...)" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <button type="submit" class="button primary pointer" style="margin-top:10px;">Créer le système</button>
    </form>`;
  openModal();
}
async function submitNewSystem(event) {
  const payload = { homeId: currentHomeId, name: document.getElementById("add-sys-name").value, icon: document.getElementById("add-sys-icon").value };
  try {
    const response = await fetch("/api/systems/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { showMessage("Système créé !"); closeModal(); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

function openEditSystemModal(id, currentName, currentIcon) {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">MODIFICATION</div><h2>Modifier le système</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitEditSystem(event, '${id}'); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="edit-sys-name" value="${currentName}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="text" id="edit-sys-icon" value="${currentIcon}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <button type="submit" class="button primary pointer" style="margin-top:10px;">Sauvegarder</button>
    </form>`;
}
async function submitEditSystem(event, id) {
  const payload = { id, name: document.getElementById("edit-sys-name").value, icon: document.getElementById("edit-sys-icon").value };
  try {
    const response = await fetch("/api/systems/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { showMessage("Système modifié !"); openSystem(id); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

async function deleteSystem(id) {
  if (!confirm("Voulez-vous supprimer ce système ? TOUS les équipements à l'intérieur seront effacés.")) return;
  try {
    const response = await fetch("/api/systems/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (response.ok) { showMessage("Système supprimé."); closeModal(); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

function openConfigSystemModal(systemId, systemName) {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">CONFIGURATION</div><h2>Général : ${systemName}</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitSystemConfig(event, '${systemId}'); return false;" style="margin-top:20px;">
      <input type="text" data-key="Note Générale" placeholder="Informations globales (ex: Année de rénovation...)" class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing: border-box;">
      <button type="submit" class="button primary pointer" style="width:100%; margin-top:20px;">Enregistrer</button>
    </form>`;
}
async function submitSystemConfig(event, systemId) {
  const specs = {};
  document.querySelectorAll(".sys-spec-input").forEach(input => { if (input.value) specs[input.getAttribute("data-key")] = input.value; });
  try {
    const response = await fetch("/api/systems/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ systemId, specs }) });
    if (response.ok) { showMessage("Configuration enregistrée !"); openSystem(systemId); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

function openAddEqModal(preselectedSystem = "") {
  const systemOptions = (homeData.systems || []).map(sys => `<option value="${escapeHTML(sys.id)}" ${sys.id === preselectedSystem ? "selected" : ""}>${escapeHTML(sys.name)}</option>`).join("");
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">NOUVEL ÉQUIPEMENT</div><h2>Ajouter un équipement</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitEquipment(event); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <select id="form-sys-id" required style="padding:10px; border-radius:8px; border:1px solid #ccc;" onchange="renderDynamicFields()"><option value="" disabled ${preselectedSystem ? "" : "selected"}>-- Choisissez la catégorie --</option>${systemOptions}</select>
      <input type="text" id="form-name" placeholder="Nom (Ex : Pompe, Climatiseur...)" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="text" id="form-model" placeholder="Marque & Modèle (Crucial pour la notice)" style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <div id="dynamic-fields-container" style="display:flex; flex-direction:column; gap:10px;"></div>
      <textarea id="form-notes" placeholder="Commentaire, position, ou particularité d'utilisation..." style="padding:10px; border-radius:8px; border:1px solid #ccc; resize:vertical; min-height:60px;"></textarea>
      <button type="submit" class="button primary pointer" style="margin-top:10px;">Sauvegarder l'appareil</button>
    </form>`;
  if (preselectedSystem) renderDynamicFields();
}

function renderDynamicFields() {
  const sysId = document.getElementById("form-sys-id").value;
  const container = document.getElementById("dynamic-fields-container");
  if (!container) return;
  
  if (sysId.includes("piscine")) {
    container.innerHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;"><input type="text" data-key="Puissance/Débit" placeholder="Puissance/Débit (ex: 14m3/h)" class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing:border-box;"><select data-key="Type Filtre" class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing:border-box;"><option value="">-- Filtre --</option><option value="Sable/Verre">Sable/Verre</option><option value="Cartouche">Cartouche</option></select><input type="text" data-key="Charge filtrante" placeholder="Média (ex: Verre 150kg)" class="eq-spec-input" style="grid-column: 1/-1; padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing:border-box;"></div>`;
  } else if (sysId.includes("elec")) {
    container.innerHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;"><input type="text" data-key="Protection" placeholder="Ampérage (ex: 16A, 32A)" class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing:border-box;"><input type="text" data-key="Type Câble" placeholder="Section (ex: 3G2.5)" class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing:border-box;"></div>`;
  } else if (sysId.includes("eau") || sysId.includes("plomberie") || sysId.includes("chauffe") || sysId.includes("clim")) {
    container.innerHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;"><input type="text" data-key="Caractéristique" placeholder="Info clé (ex: 200L, 12kW...)" class="eq-spec-input" style="grid-column: 1/-1; padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing:border-box;"></div>`;
  } else if (sysId.includes("domo") || sysId.includes("reseau")) {
    container.innerHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;"><select data-key="Protocole" class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing:border-box;"><option value="">-- Protocole --</option><option value="Wi-Fi">Wi-Fi</option><option value="Zigbee">Zigbee</option><option value="RJ45">Filaire (RJ45)</option><option value="Radio (RTS/IO)">Radio RTS/IO</option></select><select data-key="Secours" class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing:border-box;"><option value="">-- Batterie Secours --</option><option value="Oui">Oui (Batterie)</option><option value="Non">Non</option></select></div>`;
  } else if (sysId.includes("ext")) {
    container.innerHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;"><select data-key="Alimentation" class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing:border-box;"><option value="">-- Alimentation --</option><option value="Secteur 230V">Secteur 230V</option><option value="Solaire / Batterie">Solaire / Batterie</option></select><input type="text" data-key="Mécanisme" placeholder="Méca (ex: Vérin)" class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing:border-box;"></div>`;
  } else {
    container.innerHTML = `<input type="text" data-key="Info clé" placeholder="Caractéristique principale..." class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing:border-box;">`;
  }
}

async function submitEquipment(event) {
  const payload = { systemId: document.getElementById("form-sys-id").value, name: document.getElementById("form-name").value, model: document.getElementById("form-model").value, notes: document.getElementById("form-notes").value, specs: {}, notice: null };
  document.querySelectorAll(".eq-spec-input").forEach(input => { if (input.value) payload.specs[input.getAttribute("data-key")] = input.value; });
  try {
    const response = await fetch("/api/equipment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { showMessage("Équipement ajouté !"); openSystem(payload.systemId); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

function openEditEquipmentModal(itemEncoded, systemId) {
  const item = JSON.parse(decodeURIComponent(itemEncoded));
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">MODIFICATION</div><h2>Modifier l'équipement</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitEditEquipment(event, '${item.id}', '${systemId}'); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="edit-eq-name" value="${escapeHTML(item.name)}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="text" id="edit-eq-model" value="${escapeHTML(item.model)}" style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="text" id="edit-eq-installed" value="${escapeHTML(item.installed)}" placeholder="ex: 12/05/2023" style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <textarea id="edit-eq-notes" placeholder="Informations particulières..." style="padding:10px; border-radius:8px; border:1px solid #ccc; resize:vertical; min-height:60px;">${escapeHTML(item.notes || '')}</textarea>
      <button type="submit" class="button primary pointer" style="margin-top:10px;">Enregistrer</button>
    </form>`;
  openModal();
}

async function submitEditEquipment(event, eqId, systemId) {
  const name = document.getElementById("edit-eq-name").value; const model = document.getElementById("edit-eq-model").value; const installed = document.getElementById("edit-eq-installed").value; const notes = document.getElementById("edit-eq-notes").value; 
  try {
    const response = await fetch("/api/equipment/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: eqId, name, model, installed, specs: {}, notes }) });
    if (response.ok) { showMessage("Équipement modifié !"); openSystem(systemId); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

async function deleteEquipment(eqId, systemId) {
  if (!confirm("Supprimer cet équipement ?")) return;
  try {
    const response = await fetch("/api/equipment/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: eqId }) });
    if (response.ok) { showMessage("Équipement supprimé."); openSystem(systemId); loadHomeData(); }
  } catch (e) { showMessage("Erreur"); }
}

/* ============================================================
   OUTILS DE COMPRESSION ET AFFICHAGE PLEIN ECRAN
   ============================================================ */
function compressImage(base64Str, maxWidth = 1200, maxHeight = 1200) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
      } else {
        if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7)); 
    };
  });
}

function viewPlanFullscreen(imageSrc, docName) {
  document.getElementById("modal-content").innerHTML = `
    <div style="display:flex; flex-direction:column; height: 75vh;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
        <h2 style="margin:0; font-size:18px;">${escapeHTML(docName)}</h2>
        <button class="button secondary pointer" style="padding:4px 10px; font-size:11px;" onclick="togglePlanZoom()">🔍 Zoomer</button>
      </div>
      <div style="flex:1; overflow:auto; background:#f4f6f5; border-radius:8px; border:1px solid #e3e8e4; text-align:center;">
        <img id="fullscreen-plan-img" src="${imageSrc}" style="max-width:100%; height:auto; transition: width 0.3s ease; cursor: zoom-in;" onclick="togglePlanZoom()">
      </div>
    </div>`;
  openModal();
}

function viewDocumentFullscreen(imageSrc, docName) {
  viewPlanFullscreen(imageSrc, docName);
}

function togglePlanZoom() {
  const img = document.getElementById("fullscreen-plan-img");
  if (img.style.maxWidth === "100%") { img.style.maxWidth = "none"; img.style.width = "200%"; img.style.cursor = "zoom-out"; } 
  else { img.style.maxWidth = "100%"; img.style.width = "auto"; img.style.cursor = "zoom-in"; }
}

function triggerNewPlan() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">CARTOGRAPHIE</div><h2>Ajouter un plan</h2>
    <div style="margin-top:20px;">
      <input type="text" id="new-plan-name" placeholder="Nom du plan (ex: RDC)" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; margin-bottom:15px; box-sizing: border-box;">
      <button class="button primary pointer" style="width:100%;" onclick="openFileSelector()">Sélectionner l'image</button>
      <input type="file" id="plan-upload-input" accept="image/*" style="display: none;" onchange="handlePlanUpload(event)">
    </div>`;
  openModal();
}

function openFileSelector() {
  if (!document.getElementById("new-plan-name").value.trim()) { showMessage("Donnez un nom au plan."); return; }
  document.getElementById("plan-upload-input").click();
}

function handlePlanUpload(event) {
  const file = event.target.files[0]; if (!file) return;
  const planName = document.getElementById("new-plan-name").value.trim();
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      showMessage("Sauvegarde en cours...");
      const compressed = await compressImage(e.target.result);
      const response = await fetch("/api/home/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: currentHomeId, name: planName, image: compressed }) });
      if (response.ok) { showMessage("Plan ajouté !"); closeModal(); loadHomeData(); } else { showMessage("Erreur"); }
    } catch (err) { showMessage("Erreur réseau."); }
  };
  reader.readAsDataURL(file);
}

function openProfileModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">PROFIL</div><h2>Modifier ma maison</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitProfileEdit(event); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="edit-name" value="${escapeHTML(homeData.name)}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="number" id="edit-year" value="${escapeHTML(String(homeData.year))}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <div style="display:flex; gap:10px;">
        <input type="number" id="edit-surface" value="${escapeHTML(String(homeData.surface))}" placeholder="Surface" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
        <input type="number" id="edit-land" value="${escapeHTML(String(homeData.land))}" placeholder="Terrain" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
      </div>
      <input type="password" id="edit-password" required placeholder="Mot de passe actuel *" style="padding:10px; border-radius:8px; border:1px solid #ccc; border-left:4px solid #d93025;">
      <button type="submit" class="button primary pointer">Enregistrer</button>
    </form>
    
    <div style="margin-top: 30px; border-top: 1px solid #e3e8e4; padding-top: 15px; text-align: center;">
      <button class="button secondary pointer" onclick="generateMyQrCard()">🖨️ Imprimer la plaque de ma maison</button>
    </div>
  `;
  openModal();
}

async function submitProfileEdit(event) {
  const payload = { id: currentHomeId, name: document.getElementById("edit-name").value, year: document.getElementById("edit-year").value, surface: document.getElementById("edit-surface").value, land: document.getElementById("edit-land").value, currentPassword: document.getElementById("edit-password").value };
  try {
    const res = await fetch("/api/home/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { closeModal(); showMessage("Mise à jour réussie !"); loadHomeData(); } else { showMessage("Mot de passe incorrect."); }
  } catch(e) { showMessage("Erreur"); }
}

function generateMyQrCard() {
  const qrUrl = `https://home-id.onrender.com/scan/${currentHomeId}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}&margin=0`;

  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow" style="color:#4b9b69;">VOTRE PLAQUE OFFICIELLE</div>
    <h2>Votre QR Code Unique</h2>
    <p style="font-size:13px; color:#59645d;">Voici la plaque officielle de votre maison. Vous pouvez l'imprimer pour la coller dans votre tableau électrique.</p>
    
    <div style="display:flex; justify-content:center; margin:25px 0;">
      <div id="print-plaque" style="width: 320px; background: #ffffff; border-radius: 20px; box-shadow: 0 15px 35px rgba(23, 33, 28, 0.15); border: 4px solid #17211c; display: flex; flex-direction: column; align-items: center; padding: 25px 20px; text-align: center; position: relative; overflow: hidden; box-sizing: border-box;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 110px; background: #17211c; border-bottom: 5px solid #4b9b69;"></div>
        <div style="font-size: 40px; background: white; width: 80px; height: 80px; display: flex; justify-content: center; align-items: center; border-radius: 50%; border: 4px solid #4b9b69; z-index: 10; margin-top: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">🏠</div>
        <div style="margin-top: 15px; font-size: 24px; color: #17211c; font-weight: 800; letter-spacing: 2px;">HOME ID</div>
        <div style="font-size: 11px; color: #77827a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; font-weight: 700;">${escapeHTML(homeData.name)}</div>
        <div style="background: white; padding: 12px; border-radius: 16px; border: 2px dashed #cdd4ce;">
          <img src="${qrApiUrl}" style="width: 140px; height: 140px; display: block;">
        </div>
        <div style="font-family: monospace; background: #f4f6f5; padding: 6px 12px; border-radius: 8px; margin-top: 15px; font-size: 12px; color: #1e362d; border: 1px solid #e3e8e4; font-weight: bold; letter-spacing: 1px;">
          ID: ${currentHomeId}
        </div>
      </div>
    </div>
    <div style="display:flex; gap:10px;">
      <button class="button secondary pointer" style="flex:1;" onclick="closeModal()">Fermer</button>
      <button class="button primary pointer" style="flex:2;" onclick="printPlaque()">🖨️ Imprimer la plaque</button>
    </div>
  `;
}

function printPlaque() {
  const plaqueHtml = document.getElementById("print-plaque").outerHTML;
  const printWindow = window.open('', '', 'height=800,width=600');
  printWindow.document.write('<html><head><title>Impression Plaque HOME ID</title>');
  printWindow.document.write('<style>body { display:flex; justify-content:center; align-items:center; height:100vh; margin:0; font-family:sans-serif; background:white; }</style>');
  printWindow.document.write('</head><body>');
  printWindow.document.write(plaqueHtml);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 500);
}

function openQrSimulatorModal() { window.open(`/scan/${currentHomeId}`, "_blank"); }

/* ============================================================
   DIAGNOSTICS IMMOBILIERS (LISTE VERTICALE)
   ============================================================ */
function displayDiagnostics() {
  const container = document.getElementById("diagnostics-container");
  if (!container) return;
  const diags = homeData.diagnostics || [];
  
  if (diags.length === 0) {
    container.innerHTML = `<p style="font-size:13px; color:#77827a;">Aucun diagnostic enregistré.</p>`;
    return;
  }

  const dpeColors = { 'A':'#009c6d', 'B':'#52b153', 'C':'#a5cc74', 'D':'#f4d35e', 'E':'#f0ac4c', 'F':'#eb8235', 'G':'#d7352b' };

  container.innerHTML = diags.map((d, index) => {
    let resultVisual = `<strong>${escapeHTML(d.result)}</strong>`;
    if (d.name.toUpperCase().includes("DPE") && dpeColors[d.result.toUpperCase()]) {
      resultVisual = `<span style="background:${dpeColors[d.result.toUpperCase()]}; color:white; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:16px;">${d.result.toUpperCase()}</span>`;
    }

    let imgHtml = d.image 
      ? `<img src="${d.image}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; cursor: pointer; border: 1px solid #cdd4ce; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="viewDocumentFullscreen('${d.image}', '${escapeHTML(d.name)}')">`
      : `<div style="width: 50px; height: 50px; border-radius: 8px; background: #f4f6f5; border: 1px dashed #cdd4ce; display: flex; align-items: center; justify-content: center; font-size: 20px;">📄</div>`;

    return `
      <div style="background:#ffffff; border:1px solid #e3e8e4; border-radius:10px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:12px;">
          ${imgHtml}
          <div>
            <strong style="display:block; color:#17211c; font-size:13px; text-transform:uppercase;">${escapeHTML(d.name)}</strong>
            <span style="font-size:11px; color:#77827a;">Fait le : ${escapeHTML(d.date || "Inconnue")}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:15px;">
          ${resultVisual}
          <button onclick="deleteDiagnostic(${index})" style="background:none; border:none; cursor:pointer; font-size:12px; color:#d93025; padding:5px;">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

function openAddDiagModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">DIAGNOSTIC</div>
    <h2>Ajouter un document</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); processDiagSubmit(); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <select id="diag-name" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
        <option value="DPE (Énergie)">DPE (Énergie)</option>
        <option value="GES (Climat)">GES (Climat)</option>
        <option value="Amiante">Amiante</option>
        <option value="Électricité">Électricité</option>
        <option value="Plomb">Plomb</option>
        <option value="Termites">Termites</option>
        <option value="ERP / Risques">ERP / Risques</option>
        <option value="Assainissement">Assainissement</option>
        <option value="Mérule">Mérule</option>
        <option value="Audit Énergétique">Audit Énergétique</option>
        <option value="Autre Diagnostic">Autre Diagnostic...</option>
      </select>
      <div style="display:flex; gap:10px;">
        <input type="text" id="diag-result" placeholder="Résultat (Ex: A, B, Néant...)" required style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
        <input type="date" id="diag-date" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
      </div>
      <div style="background:#f4f6f5; padding:15px; border-radius:8px; border:1px dashed #cdd4ce; margin-top:5px;">
        <label style="font-size:12px; font-weight:bold; color:#59645d; display:block; margin-bottom:8px;">📸 Joindre le document (Photo ou capture)</label>
        <input type="file" id="diag-image" accept="image/*" required style="width:100%; font-size:13px;">
      </div>
      <button type="submit" class="button primary pointer" style="margin-top:10px;">Enregistrer le diagnostic</button>
    </form>`;
  openModal();
}

function processDiagSubmit() {
  const name = document.getElementById("diag-name").value;
  const result = document.getElementById("diag-result").value;
  const date = document.getElementById("diag-date").value;
  const fileInput = document.getElementById("diag-image");

  if (fileInput.files.length === 0) return;
  showMessage("⏳ Traitement de l'image...");
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const compressed = await compressImage(e.target.result);
      submitDiagnosticData({ name, result, date, image: compressed });
    } catch(err) { showMessage("Erreur compression."); }
  };
  reader.readAsDataURL(fileInput.files[0]);
}

async function submitDiagnosticData(newDiag) {
  showMessage("Sauvegarde en cours...");
  const diags = homeData.diagnostics || [];
  diags.push(newDiag);
  try {
    const res = await fetch("/api/home/update-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: currentHomeId, diagnostics: diags }) });
    if (res.ok) { closeModal(); loadHomeData(); showMessage("Diagnostic ajouté !"); }
  } catch(e) { showMessage("Erreur réseau"); }
}

async function deleteDiagnostic(index) {
  if(!confirm("Voulez-vous vraiment supprimer ce diagnostic et son image associée ?")) return;
  const diags = homeData.diagnostics;
  diags.splice(index, 1);
  try {
    await fetch("/api/home/update-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: currentHomeId, diagnostics: diags }) });
    loadHomeData();
    showMessage("Diagnostic supprimé.");
  } catch(e) { showMessage("Erreur"); }
}

/* ============================================================
   CADASTRE - PHILOSOPHIE JUMELLE (LISTE VERTICALE)
   ============================================================ */
function displayCadastre() {
  const container = document.getElementById("cadastre-container");
  if (!container) return;
  const cadastreItems = homeData.cadastre || [];
  
  if (cadastreItems.length === 0) {
    container.innerHTML = `<p style="font-size:13px; color:#77827a;">Aucun document cadastral enregistré.</p>`;
    return;
  }

  container.innerHTML = cadastreItems.map((c, index) => {
    let imgHtml = c.image 
      ? `<img src="${c.image}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; cursor: pointer; border: 1px solid #cdd4ce; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="viewDocumentFullscreen('${c.image}', '${escapeHTML(c.name)}')">`
      : `<div style="width: 50px; height: 50px; border-radius: 8px; background: #f4f6f5; border: 1px dashed #cdd4ce; display: flex; align-items: center; justify-content: center; font-size: 20px;">🗺️</div>`;

    return `
      <div style="background:#ffffff; border:1px solid #e3e8e4; border-radius:10px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:12px;">
          ${imgHtml}
          <div>
            <strong style="display:block; color:#17211c; font-size:13px; text-transform:uppercase;">${escapeHTML(c.name)}</strong>
            <span style="font-size:11px; color:#77827a;">Section/Parcelle : ${escapeHTML(c.info || "Non renseigné")}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:15px;">
          <span style="font-size:11px; color:#77827a;">${escapeHTML(c.date || "")}</span>
          <button onclick="deleteCadastreItem(${index})" style="background:none; border:none; cursor:pointer; font-size:12px; color:#d93025; padding:5px;">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

function openAddCadastreModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">FONCIER</div>
    <h2>Ajouter un plan</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); processCadastreSubmit();" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <select id="cad-name" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
        <option value="Plan Cadastral">Plan Cadastral</option>
        <option value="Vue Satellite">Vue Satellite</option>
        <option value="Photo Terrain">Photo Terrain</option>
        <option value="Plan de Masse">Plan de Masse</option>
        <option value="Plan de Situation">Plan de Situation</option>
        <option value="Règlement PLU">Règlement PLU / Foncier</option>
        <option value="Bornage Géomètre">Bornage Géomètre</option>
        <option value="Servitudes">Servitudes</option>
        <option value="Autre Plan">Autre Plan...</option>
      </select>
      <div style="display:flex; gap:10px;">
        <input type="text" id="cad-info" placeholder="Section (ex: AH 123)" required style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
        <input type="date" id="cad-date" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
      </div>
      <div style="background:#f4f6f5; padding:15px; border-radius:8px; border:1px dashed #cdd4ce; margin-top:5px;">
        <label style="font-size:12px; font-weight:bold; color:#59645d; display:block; margin-bottom:8px;">📸 Joindre le document (Photo ou capture)</label>
        <input type="file" id="cad-image" accept="image/*" required style="width:100%; font-size:13px;">
      </div>
      <button type="submit" class="button primary pointer" style="margin-top:10px;">Sauvegarder le plan</button>
    </form>`;
  openModal();
}

function processCadastreSubmit() {
  const name = document.getElementById("cad-name").value;
  const info = document.getElementById("cad-info").value;
  const date = document.getElementById("cad-date").value;
  const fileInput = document.getElementById("cad-image");
  
  if (fileInput.files.length === 0) return;
  showMessage("⏳ Traitement...");
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const compressed = await compressImage(e.target.result);
      submitCadastreSave({ name, info, date, image: compressed });
    } catch(err) { showMessage("Erreur compression."); }
  };
  reader.readAsDataURL(fileInput.files[0]);
}

async function submitCadastreSave(newCadItem) {
  showMessage("Sauvegarde...");
  const cadastreArray = homeData.cadastre || [];
  cadastreArray.push(newCadItem);
  try {
    const res = await fetch("/api/home/update-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: currentHomeId, cadastre: cadastreArray }) });
    if (res.ok) { closeModal(); loadHomeData(); showMessage("Plan ajouté !"); }
  } catch(e) { showMessage("Erreur."); }
}

async function deleteCadastreItem(index) {
  if(!confirm("Supprimer ce plan cadastral ?")) return;
  const cadastreArray = homeData.cadastre;
  cadastreArray.splice(index, 1);
  try {
    await fetch("/api/home/update-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: currentHomeId, cadastre: cadastreArray }) });
    loadHomeData();
  } catch(e) { showMessage("Erreur"); }
}

/* ============================================================
   ESPACES PERSONNALISÉS (WIDGETS DANS LA BIBLIOTHÈQUE)
   ============================================================ */
function displayCustomWidgets() {
  const container = document.getElementById("custom-widgets-container");
  if (!container) return;
  const widgets = homeData.customWidgets || [];

  container.innerHTML = widgets.map((w, index) => {
    const textFormatted = escapeHTML(w.content).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#4b9b69; text-decoration:underline; font-weight:bold;">Ouvrir le lien 🔗</a>');
    return `
      <div class="document" style="flex: 1; min-width: 200px; position: relative;">
        <button onclick="deleteCustomWidget(${index})" style="position:absolute; right:10px; top:10px; background:none; border:none; cursor:pointer; font-size:12px; color:#d93025; padding:5px;">🗑️</button>
        <div class="document-icon">📌</div>
        <strong>${escapeHTML(w.title)}</strong>
        <span style="font-size:11px; margin-top:5px; white-space:pre-wrap; color:#59645d;">${textFormatted}</span>
      </div>
    `;
  }).join("");
}

function openAddCustomWidgetModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">BIBLIOTHÈQUE</div>
    <h2>Créer un Widget</h2>
    <form action="javascript:void(0);" onsubmit="event.preventDefault(); submitCustomWidget(); return false;" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="widget-title" placeholder="Titre (ex: Lien Google Drive, Portail...)" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <textarea id="widget-content" placeholder="Collez un lien internet, ou tapez votre texte ici..." required style="padding:10px; border-radius:8px; border:1px solid #ccc; min-height:80px; resize:vertical;"></textarea>
      <button type="submit" class="button primary pointer" style="margin-top:10px;">Ajouter le widget</button>
    </form>`;
  openModal();
}

async function submitCustomWidget() {
  const newWidget = {
    title: document.getElementById("widget-title").value,
    content: document.getElementById("widget-content").value
  };
  const widgets = homeData.customWidgets || [];
  widgets.push(newWidget);

  try {
    const res = await fetch("/api/home/update-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: currentHomeId, customWidgets: widgets }) });
    if (res.ok) { closeModal(); loadHomeData(); }
  } catch(e) { showMessage("Erreur réseau"); }
}

async function deleteCustomWidget(index) {
  if(!confirm("Supprimer ce widget ?")) return;
  const widgets = homeData.customWidgets;
  widgets.splice(index, 1);
  try {
    await fetch("/api/home/update-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: currentHomeId, customWidgets: widgets }) });
    loadHomeData();
  } catch(e) { showMessage("Erreur"); }
}

init();
