/* ============================================================
   HOME ID — APPLICATION JAVASCRIPT GLOBALE
   ============================================================ */

let homeData = null;
let currentHomeId = null; 
window.isDragging = false; 

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
    populateHouseInfo();
    displaySystems();
    displayAlerts();
    displayProfessionals();
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
      window.isDragging = true;
      draggedItem = this;
      setTimeout(() => this.classList.add('dragging'), 0);
    });

    item.addEventListener('dragend', async function() {
      this.classList.remove('dragging');
      draggedItem = null;
      setTimeout(() => window.isDragging = false, 100);

      const orderData = [...container.querySelectorAll('.system')].map((el, index) => ({
        id: el.getAttribute('data-id'), order: index
      }));
      try {
        await fetch('/api/systems/reorder', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({orderData}) });
      } catch(e) { console.error("Erreur de sauvegarde de l'ordre"); }
    });

    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      if (this !== draggedItem && draggedItem) {
        const bounding = this.getBoundingClientRect();
        const offset = e.clientX - bounding.left - (bounding.width / 2);
        if (offset > 0) this.after(draggedItem);
        else this.before(draggedItem);
      }
    });
  });
}

/* ============================================================
   AFFICHAGE ALERTES & ARCHIVAGE
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
      
      return `
        <div class="alert" style="display:flex; align-items:flex-start; gap:12px;">
          <input type="checkbox" onclick="toggleAlert(${a.id}, true)" style="margin-top:4px; transform:scale(1.2); cursor:pointer;">
          <div>
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
            <div class="alert" style="display:flex; align-items:flex-start; gap:12px;">
              <input type="checkbox" checked onclick="toggleAlert(${a.id}, false)" style="margin-top:4px; transform:scale(1.2); cursor:pointer;">
              <div>
                <strong style="display:block; text-decoration:line-through;">${escapeHTML(a.title)}</strong>
                <p style="margin-top:2px; font-size:12px; text-decoration:line-through;">Fait : ${escapeHTML(a.text)}</p>
              </div>
            </div>
          `).join("")}
        </div>
      </details>`;
  }

  container.innerHTML = html;
}

async function toggleAlert(id, isDone) {
  try {
    await fetch("/api/alerts/toggle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_done: isDone }) });
    loadHomeData(); 
  } catch (error) { showMessage("Erreur lors de la sauvegarde."); }
}

/* ============================================================
   AFFICHAGE ARTISANS (AVEC AVIS/NOTES ET BOUTON ÉDITION)
   ============================================================ */
function displayProfessionals() { 
  const container = document.getElementById("professionals");
  if (!container) return;
  const pros = homeData.professionals || [];
  if (pros.length === 0) { container.innerHTML = "<p style='font-size:13px; color:#77827a;'>Aucun artisan.</p>"; return; }

  container.innerHTML = pros.map(p => {
    const pJSON = encodeURIComponent(JSON.stringify(p));
    // Affichage conditionnel de la note / avis
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

/* ============================================================
   MENU "AJOUTER" GLOBAL
   ============================================================ */
function openAddMenu() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">ACTION RAPIDE</div>
    <h2>Que voulez-vous ajouter ?</h2>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px;">
      <button class="button secondary pointer" style="padding:15px; text-align:center; height:100px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;" onclick="openAddSystemModal()">
        <span style="font-size:24px;">⚙️</span><strong>Nouveau<br>Système</strong>
      </button>
      <button class="button secondary pointer" style="padding:15px; text-align:center; height:100px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;" onclick="openAddEquipmentModal()">
        <span style="font-size:24px;">🔌</span><strong>Nouvel<br>Équipement</strong>
      </button>
      <button class="button secondary pointer" style="padding:15px; text-align:center; height:100px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;" onclick="openAddAlertModal()">
        <span style="font-size:24px;">📅</span><strong>Rappel<br>d'Entretien</strong>
      </button>
      <button class="button secondary pointer" style="padding:15px; text-align:center; height:100px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;" onclick="openAddProModal()">
        <span style="font-size:24px;">👷</span><strong>Nouvel<br>Artisan</strong>
      </button>
    </div>
  `;
  openModal();
}

/* ============================================================
   ARTISANS : AJOUT, MODIFICATION ET SUPPRESSION
   ============================================================ */
function openAddProModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">NOUVEL ARTISAN</div>
    <h2>Ajouter un professionnel</h2>
    <form onsubmit="submitPro(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="add-pro-name" placeholder="Nom de l'entreprise ou artisan *" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="text" id="add-pro-domain" placeholder="Spécialité (Ex: Plombier, Chauffagiste...) *" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      
      <div style="display:flex; gap:10px;">
        <input type="tel" id="add-pro-phone" placeholder="N° Téléphone" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
        <input type="email" id="add-pro-email" placeholder="Adresse Email" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
      </div>

      <textarea id="add-pro-notes" placeholder="Avis, tarifs, commentaires (ex: Très bon plombier, tarif honnête...)" style="padding:10px; border-radius:8px; border:1px solid #ccc; resize:vertical; min-height:60px;"></textarea>

      <button type="submit" class="button primary pointer" style="margin-top:10px;">Enregistrer l'artisan</button>
    </form>`;
  openModal();
}

async function submitPro(event) {
  event.preventDefault();
  const payload = { 
    homeId: currentHomeId, 
    name: document.getElementById("add-pro-name").value, 
    domain: document.getElementById("add-pro-domain").value,
    phone: document.getElementById("add-pro-phone").value,
    email: document.getElementById("add-pro-email").value,
    notes: document.getElementById("add-pro-notes").value
  };
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
    <form onsubmit="submitEditPro(event, ${pro.id})" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Nom et Spécialité</label>
      <input type="text" id="edit-pro-name" value="${escapeHTML(pro.name)}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="text" id="edit-pro-domain" value="${escapeHTML(pro.domain)}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Contacts</label>
      <div style="display:flex; gap:10px;">
        <input type="tel" id="edit-pro-phone" value="${escapeHTML(pro.phone || '')}" placeholder="N° Téléphone" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
        <input type="email" id="edit-pro-email" value="${escapeHTML(pro.email || '')}" placeholder="Adresse Email" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
      </div>

      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Avis / Notes</label>
      <textarea id="edit-pro-notes" placeholder="Avis, tarifs, commentaires (ex: Très bon plombier, tarif honnête...)" style="padding:10px; border-radius:8px; border:1px solid #ccc; resize:vertical; min-height:60px;">${escapeHTML(pro.notes || '')}</textarea>

      <div style="display:flex; gap:10px; margin-top:10px;">
        <button type="submit" class="button primary pointer" style="flex:1;">Enregistrer</button>
        <button type="button" class="button secondary pointer" style="color:#d93025; border:1px solid #fce8e6; background:#fffafa;" onclick="deletePro(${pro.id})">🗑️ Supprimer</button>
      </div>
    </form>`;
  openModal();
}

async function submitEditPro(event, proId) {
  event.preventDefault();
  const payload = { 
    id: proId, 
    name: document.getElementById("edit-pro-name").value, 
    domain: document.getElementById("edit-pro-domain").value,
    phone: document.getElementById("edit-pro-phone").value,
    email: document.getElementById("edit-pro-email").value,
    notes: document.getElementById("edit-pro-notes").value
  };
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
   RESTE DES FONCTIONS : ENTRETIENS, SYSTÈMES ET ÉQUIPEMENTS
   ============================================================ */

function openAddAlertModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">NOUVEL ENTRETIEN</div>
    <h2>Ajouter un rappel</h2>
    <form onsubmit="submitAlert(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="add-alert-title" placeholder="Titre (Ex: Nettoyage Filtres Climatisation)" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="date" id="add-alert-date" required style="padding:10px; border-radius:8px; border:1px solid #ccc; font-family:inherit;">
      <textarea id="add-alert-text" placeholder="Détails (Optionnel)..." style="padding:10px; border-radius:8px; border:1px solid #ccc; resize:vertical; min-height:60px;"></textarea>
      <button type="submit" class="button primary pointer" style="margin-top:10px;">Programmer le rappel</button>
    </form>`;
  openModal();
}

async function submitAlert(event) {
  event.preventDefault();
  const payload = { homeId: currentHomeId, title: document.getElementById("add-alert-title").value, date: document.getElementById("add-alert-date").value, text: document.getElementById("add-alert-text").value };
  try {
    const response = await fetch("/api/alerts/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { showMessage("Rappel programmé !"); closeModal(); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

async function openSystem(systemId) {
  try {
    const response = await fetch(`/api/systems/${encodeURIComponent(systemId)}`);
    if (!response.ok) throw new Error("Système introuvable");
    const system = await response.json();

    let generalSpecsHTML = "";
    if (system.specs && Object.keys(system.specs).length > 0) {
      generalSpecsHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:#f4f6f5; padding:15px; border-radius:8px; margin-top:15px;">` + 
        Object.entries(system.specs).map(([key, value]) => `
          <div><span style="font-size:11px; color:#77827a; display:block;">${escapeHTML(key)}</span><strong style="font-size:14px; color:#1e362d;">${escapeHTML(value)}</strong></div>
        `).join("") + `</div>`;
    } else {
      generalSpecsHTML = `<div style="background:#fff3cd; color:#856404; padding:10px; border-radius:8px; font-size:12px; margin-top:15px;">Les caractéristiques générales ne sont pas encore renseignées.</div>`;
    }

    let equipmentHTML = "";
    if (system.equipment && system.equipment.length > 0) {
      equipmentHTML = system.equipment.map(item => {
        let specsHTML = "";
        if (item.specs && Object.keys(item.specs).length > 0) {
          specsHTML = `<div class="specs-grid">` + Object.entries(item.specs).filter(([k, v]) => v).map(([key, value]) => `<div class="spec-tag" style="background:#eef2ef; color:#3b453f; font-size:11px; padding:5px 10px; border-radius:8px; display:inline-block; border:1px solid #dce2dd; margin-right:5px; margin-top:5px;"><strong>${escapeHTML(key)}</strong>: ${escapeHTML(String(value))}</div>`).join("") + `</div>`;
        }
        
        let noticeBtn = '';
        if (item.model) {
          const query = encodeURIComponent(`notice utilisation pdf ${item.name} ${item.model}`);
          noticeBtn = `<a href="https://www.google.com/search?q=${query}" target="_blank" style="color:#d18a35; text-decoration:none; font-size:11px; font-weight:bold; margin-right:8px;">🔍 Notice</a>`;
        }

        let notesHTML = "";
        if (item.notes) {
          notesHTML = `<div style="background:#f8f9f7; border-left:3px solid #d18a35; padding:8px 12px; margin-top:10px; border-radius:4px; font-size:12px; color:#59645d; line-height:1.4;"><strong>📌 Info :</strong> ${escapeHTML(item.notes)}</div>`;
        }
        
        const itemJSON = encodeURIComponent(JSON.stringify(item));

        return `
          <div class="equipment-deep" style="border:1px solid #e3e8e4; border-radius:12px; padding:16px; margin-bottom:12px;">
            <div class="equip-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <strong style="display:block; font-size:15px; color:#17211c;">${escapeHTML(item.name)}</strong>
                <span class="equip-model" style="font-size:12px; color:#77827a; font-family:monospace; background:#f4f6f3; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px;">${item.model ? escapeHTML(item.model) : "Modèle non précisé"}</span>
              </div>
            </div>
            ${specsHTML}
            ${notesHTML}
            
            <div class="equip-footer" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-top:12px; padding-top:10px; border-top:1px solid #e3e8e4;">
              <span style="font-size:11px; color:#77827a;">Installé le : ${escapeHTML(item.installed || "—")}</span>
              <div style="display:flex; align-items:center; gap:6px;">
                ${noticeBtn}
                <button class="button secondary pointer" style="padding:4px 8px; font-size:11px;" onclick="openEditEquipmentModal('${itemJSON}', '${system.id}')">✏️ Éditer</button>
                <button class="button secondary pointer" style="padding:4px 8px; font-size:11px; color:#d93025; border-color:#fce8e6; background:#fffafa;" onclick="deleteEquipment('${item.id}', '${system.id}')">🗑️</button>
              </div>
            </div>
          </div>`;
      }).join("");
    } else {
      equipmentHTML = `<div style="background:#f8f9f7; padding:20px; text-align:center; border-radius:12px; margin-top:10px;"><p style="color:#707a74; font-size:13px; margin:0;">Aucun équipement enregistré.</p></div>`;
    }

    document.getElementById("modal-content").innerHTML = `
      <div class="eyebrow">${system.icon || "🏠"} SYSTÈME</div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 style="margin:0;">${escapeHTML(system.name)}</h2>
        
        <div style="display:flex; gap:5px;">
          <button class="button secondary pointer" style="padding:6px 8px; font-size:12px;" onclick="openEditSystemModal('${system.id}', '${escapeHTML(system.name)}', '${escapeHTML(system.icon)}')">✏️</button>
          <button class="button secondary pointer" style="padding:6px 8px; font-size:12px; color:#d93025; background:#fffafa; border-color:#fce8e6;" onclick="deleteSystem('${system.id}')">🗑️</button>
          <button class="button secondary pointer" style="padding:6px 12px; font-size:12px;" onclick="openConfigSystemModal('${system.id}', '${escapeHTML(system.name)}')">⚙️ Config.</button>
        </div>

      </div>
      ${generalSpecsHTML}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:30px; border-bottom:1px solid #e3e8e4; padding-bottom:10px;">
        <h3 style="margin:0;">Équipements</h3>
        <button class="button secondary pointer" style="padding:4px 10px; font-size:12px;" onclick="openAddEquipmentModal('${system.id}')">+ Ajouter</button>
      </div>
      <div style="margin-top:15px;">${equipmentHTML}</div>
    `;
    openModal();
  } catch (error) { showMessage("Erreur d'ouverture"); }
}

function openAddSystemModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">NOUVEAU SYSTÈME</div>
    <h2>Ajouter un système</h2>
    <form onsubmit="submitNewSystem(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="add-sys-name" placeholder="Nom du système (Ex: Panneaux Solaires)" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="text" id="add-sys-icon" placeholder="Émoji / Icône (Ex: ☀️, 📹...)" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <button type="submit" class="button primary pointer" style="margin-top:10px;">Créer le système</button>
    </form>`;
  openModal();
}

async function submitNewSystem(event) {
  event.preventDefault();
  const payload = { homeId: currentHomeId, name: document.getElementById("add-sys-name").value, icon: document.getElementById("add-sys-icon").value };
  try {
    const response = await fetch("/api/systems/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { showMessage("Système créé !"); closeModal(); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

function openEditSystemModal(id, currentName, currentIcon) {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">MODIFICATION</div>
    <h2>Modifier le système</h2>
    <form onsubmit="submitEditSystem(event, '${id}')" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Nom du système</label>
      <input type="text" id="edit-sys-name" value="${currentName}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Icône (Émoji)</label>
      <input type="text" id="edit-sys-icon" value="${currentIcon}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <button type="submit" class="button primary pointer" style="margin-top:10px;">Sauvegarder</button>
    </form>`;
}

async function submitEditSystem(event, id) {
  event.preventDefault();
  const payload = { id, name: document.getElementById("edit-sys-name").value, icon: document.getElementById("edit-sys-icon").value };
  try {
    const response = await fetch("/api/systems/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { showMessage("Système modifié !"); openSystem(id); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

async function deleteSystem(id) {
  if (!confirm("Voulez-vous vraiment supprimer ce système ? TOUS les équipements à l'intérieur seront effacés définitivement.")) return;
  try {
    const response = await fetch("/api/systems/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (response.ok) { showMessage("Système supprimé."); closeModal(); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

function openConfigSystemModal(systemId, systemName) {
  let fieldsHTML = "";
  if (systemId.includes("piscine")) {
    fieldsHTML = `
      <input type="text" data-key="Volume" placeholder="Volume (ex: 45m³)" class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; margin-bottom:10px; box-sizing: border-box;">
      <select data-key="Traitement" class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; margin-bottom:10px; box-sizing: border-box;">
        <option value="">-- Traitement --</option><option value="Au Sel">Au Sel</option><option value="Chlore">Chlore</option><option value="Brome">Brome</option>
      </select>
      <input type="text" data-key="Revêtement" placeholder="Ex: Liner, Coque..." class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing: border-box;">
    `;
  } else if (systemId.includes("elec")) {
    fieldsHTML = `
      <select data-key="Abonnement" class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; margin-bottom:10px; box-sizing: border-box;">
        <option value="">-- Phase --</option><option value="Monophasé">Monophasé</option><option value="Triphasé">Triphasé</option>
      </select>
      <input type="text" data-key="Puissance Souscrite" placeholder="Ex: 9 kVA" class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; margin-bottom:10px; box-sizing: border-box;">
      <input type="text" data-key="PDL / PRM" placeholder="Numéro PDL (14 chiffres)" class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing: border-box;">
    `;
  } else {
    fieldsHTML = `<p style="font-size:13px; color:#77827a;">Configuration standard pour ${systemName}.</p>
    <input type="text" data-key="Note" placeholder="Informations générales..." class="sys-spec-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; box-sizing: border-box;">`;
  }

  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">CONFIGURATION</div>
    <h2>Général : ${systemName}</h2>
    <form onsubmit="submitSystemConfig(event, '${systemId}')" style="margin-top:20px;">
      ${fieldsHTML}
      <button type="submit" class="button primary pointer" style="width:100%; margin-top:20px;">Enregistrer les paramètres</button>
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
  let html = "";
  if (sysId.includes("piscine")) html = `<input type="text" data-key="Puissance/Débit" placeholder="Ex: 1.5 CV / 14m3/h" class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc;">`;
  else if (sysId.includes("elec")) html = `<input type="text" data-key="Protection" placeholder="Ampérage (ex: 16A)" class="eq-spec-input" style="padding:10px; border-radius:8px; border:1px solid #ccc;">`;
  container.innerHTML = html;
}

async function submitEquipment(event) {
  event.preventDefault();
  const payload = {
    systemId: document.getElementById("form-sys-id").value,
    name: document.getElementById("form-name").value,
    model: document.getElementById("form-model").value,
    notes: document.getElementById("form-notes").value,
    specs: {},
    notice: null
  };
  document.querySelectorAll(".eq-spec-input").forEach(input => { if (input.value) payload.specs[input.getAttribute("data-key")] = input.value; });

  try {
    const response = await fetch("/api/equipment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { showMessage("Équipement ajouté !"); openSystem(payload.systemId); loadHomeData(); }
  } catch (e) { showMessage("Erreur réseau"); }
}

function openEditEquipmentModal(itemEncoded, systemId) {
  const item = JSON.parse(decodeURIComponent(itemEncoded));
  let dynamicFieldsHTML = "";
  if (systemId.includes("piscine")) {
    dynamicFieldsHTML = `<input type="text" data-key="Puissance/Débit" value="${escapeHTML(item.specs['Puissance/Débit'] || '')}" placeholder="Ex: 1.5 CV / 14m3/h" class="eq-spec-input-edit" style="padding:10px; border-radius:8px; border:1px solid #ccc;">`;
  } else if (systemId.includes("elec")) {
    dynamicFieldsHTML = `<input type="text" data-key="Protection" value="${escapeHTML(item.specs['Protection'] || '')}" placeholder="Ampérage (ex: 16A)" class="eq-spec-input-edit" style="padding:10px; border-radius:8px; border:1px solid #ccc;">`;
  }

  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">MODIFICATION</div>
    <h2>Modifier l'équipement</h2>
    <form onsubmit="submitEditEquipment(event, '${item.id}', '${systemId}')" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Nom de l'appareil</label>
      <input type="text" id="edit-eq-name" value="${escapeHTML(item.name)}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Marque & Modèle</label>
      <input type="text" id="edit-eq-model" value="${escapeHTML(item.model)}" style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      
      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Date d'installation</label>
      <input type="text" id="edit-eq-installed" value="${escapeHTML(item.installed)}" placeholder="ex: 12/05/2023" style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:5px;">${dynamicFieldsHTML}</div>

      <label style="font-size:11px; font-weight:bold; color:#59645d; margin-bottom:-8px;">Commentaire / Position</label>
      <textarea id="edit-eq-notes" placeholder="Informations particulières..." style="padding:10px; border-radius:8px; border:1px solid #ccc; resize:vertical; min-height:60px;">${escapeHTML(item.notes || '')}</textarea>

      <button type="submit" class="button primary pointer" style="margin-top:10px;">Enregistrer les modifications</button>
    </form>`;
  openModal();
}

async function submitEditEquipment(event, eqId, systemId) {
  event.preventDefault();
  const name = document.getElementById("edit-eq-name").value;
  const model = document.getElementById("edit-eq-model").value;
  const installed = document.getElementById("edit-eq-installed").value;
  const notes = document.getElementById("edit-eq-notes").value; 
  
  const specs = {};
  document.querySelectorAll(".eq-spec-input-edit").forEach(input => { 
    if (input.value) specs[input.getAttribute("data-key")] = input.value; 
  });

  try {
    const response = await fetch("/api/equipment/update", { 
      method: "POST", headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ id: eqId, name, model, installed, specs, notes }) 
    });
    if (response.ok) { 
      showMessage("Équipement modifié !"); 
      openSystem(systemId); 
      loadHomeData(); 
    }
  } catch (e) { showMessage("Erreur réseau"); }
}

async function deleteEquipment(eqId, systemId) {
  if (!confirm("Voulez-vous vraiment supprimer cet équipement ? Cette action est irréversible.")) return;
  try {
    const response = await fetch("/api/equipment/delete", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: eqId })
    });
    if (response.ok) {
      showMessage("Équipement supprimé.");
      openSystem(systemId); 
      loadHomeData(); 
    }
  } catch (e) { showMessage("Erreur"); }
}

/* ============================================================
   GESTION DES PLANS
   ============================================================ */
function triggerNewPlan() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">CARTOGRAPHIE</div>
    <h2>Ajouter un plan</h2>
    <div style="margin-top:20px;">
      <input type="text" id="new-plan-name" placeholder="Nom du plan (ex: RDC, Étage 1...)" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc; margin-bottom:15px; box-sizing: border-box;">
      <button class="button primary pointer" style="width:100%;" onclick="openFileSelector()">Sélectionner l'image</button>
      <input type="file" id="plan-upload-input" accept="image/*" style="display: none;" onchange="handlePlanUpload(event)">
    </div>
  `;
  openModal();
}

function openFileSelector() {
  const nameInput = document.getElementById("new-plan-name").value.trim();
  if (!nameInput) { showMessage("Veuillez d'abord donner un nom à ce plan."); return; }
  document.getElementById("plan-upload-input").click();
}

function handlePlanUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const planName = document.getElementById("new-plan-name").value.trim();
  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64Image = e.target.result;
    try {
      showMessage("Sauvegarde du plan en cours...");
      const response = await fetch("/api/home/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentHomeId, name: planName, image: base64Image })
      });
      if (response.ok) {
        showMessage("Plan ajouté avec succès !"); closeModal(); loadHomeData();
      } else { showMessage("Erreur lors de la sauvegarde."); }
    } catch (err) { showMessage("Erreur réseau."); }
  };
  reader.readAsDataURL(file);
}

function viewPlanFullscreen(imageSrc, planName) {
  document.getElementById("modal-content").innerHTML = `
    <div style="display:flex; flex-direction:column; height: 75vh;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
        <h2 style="margin:0; font-size:18px;">Plan : ${escapeHTML(planName)}</h2>
        <button class="button secondary pointer" style="padding:4px 10px; font-size:11px;" onclick="togglePlanZoom()">🔍 Zoomer</button>
      </div>
      <div style="flex:1; overflow:auto; background:#f4f6f5; border-radius:8px; border:1px solid #e3e8e4; text-align:center;">
        <img id="fullscreen-plan-img" src="${imageSrc}" style="max-width:100%; height:auto; transition: width 0.3s ease; cursor: zoom-in;" onclick="togglePlanZoom()">
      </div>
      <p style="font-size:11px; color:#77827a; text-align:center; margin-top:10px;">Cliquez sur l'image pour zoomer et déplacez-vous avec le doigt/souris.</p>
    </div>
  `;
  openModal();
}

function togglePlanZoom() {
  const img = document.getElementById("fullscreen-plan-img");
  if (img.style.maxWidth === "100%") {
    img.style.maxWidth = "none";
    img.style.width = "200%"; // 2x Zoom
    img.style.cursor = "zoom-out";
  } else {
    img.style.maxWidth = "100%";
    img.style.width = "auto";
    img.style.cursor = "zoom-in";
  }
}

/* ============================================================
   PROFIL PROPRIÉTAIRE
   ============================================================ */
function openProfileModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">PROFIL</div><h2>Modifier ma maison</h2>
    <form onsubmit="submitProfileEdit(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="edit-name" value="${escapeHTML(homeData.name)}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <input type="number" id="edit-year" value="${escapeHTML(String(homeData.year))}" required style="padding:10px; border-radius:8px; border:1px solid #ccc;">
      <div style="display:flex; gap:10px;">
        <input type="number" id="edit-surface" value="${escapeHTML(String(homeData.surface))}" placeholder="Surface" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
        <input type="number" id="edit-land" value="${escapeHTML(String(homeData.land))}" placeholder="Terrain" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">
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
function openQrSimulatorModal() { window.open(`/scan/${currentHomeId}`, "_blank"); }

init();
