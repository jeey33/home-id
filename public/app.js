/* ============================================
IDENTIFIANT DE LA MAISON — JAVASCRIPT
=========================================== */

soit homeData = null;


/* ============================================
INITIALISATION
=========================================== */

fonction asynchrone init() {

essayer {

const réponse = await fetch("/api/home");

si (!response.ok) {
throw new Error("Impossible de récupérer la maison");
}

homeData = await response.json();

afficherSystèmes();

afficherAlertes();

afficherProfessionnels();

} attraper (erreur) {

console.error(erreur);

afficherMessage(
"Impossible de charger HOME ID."
);

}

}


/* ============================================
AFFICHER LES SYSTÈMES
=========================================== */

fonction displaySystems() {

const conteneur =
document.getElementById("systems");

si (!conteneur) retourner;


container.innerHTML =
homeData.systems.map(system => {

retourner `

<div
classe="système"
onclick="openSystem('${ system.id }')"
>

<div class="system-icon">
${system.icon}
</div>

<div class="system-name">
${ system.name }
</div>

<div class="statut ${system.color}">

<span class="dot"></span>

${system.status}

</div>

</div>

`;

}).rejoindre("");

}


/* ============================================
AFFICHER LES ENTRETIENS
=========================================== */

fonction afficherAlertes() {

const conteneur =
document.getElementById("alertes");

si (!conteneur) retourner;


container.innerHTML =
homeData.alerts.map(alert => {

retourner `

<div class="alerte">

<span class="date">
${alerte.date}
</span>

<strong>
${alerte.titre}
</strong>

<p>
${alerte.text}
</p>

</div>

`;

}).rejoindre("");

}


/* ============================================
AFFICHER LES PROFESSIONNELS
=========================================== */

fonction afficherProfessionnels() {

const conteneur =
document.getElementById("professionals");

si (!conteneur) retourner;


container.innerHTML =
homeData.professionals.map(pro => {

retourner `

<div class="pro">

<span class="access-active">
${pro.access}
</span>

<strong>
${ pro.name }
</strong>

<p>
${pro.domain}
· accès jusqu'au
${pro.expires}
</p>

</div>

`;

}).rejoindre("");

}


/* ============================================
OUVRIR UN SYSTÈME
=========================================== */

fonction asynchrone openSystem(systemId) {

essayer {

réponse constante =
attendre la récupération(
`/api/systems/${systemId}`
);

si (!response.ok) {

lancer une nouvelle erreur(
"Système introuvable"
);

}

système constant =
attendre la réponse.json();


let equipmentHTML = "";

si (
système.équipement &&
longueur de l'équipement du système > 0
) {

équipementHTML =
système.équipement.map(élément => {

retourner `

<div class="équipement">

<strong>
${ item.name }
</strong>

<span>

${
objet.modèle
? item.model + " · "
: ""
}

${
élément installé
? "Installé le " +
élément installé
: ""
}

${
article.garantie
? " · Garantie " +
article.garantie
: ""
}

</span>

</div>

`;

}).rejoindre("");

} autre {

équipementHTML =
"<p>Aucun équipement enregistré.</p>";

}


let documentsHTML = "";

si (
système.documents &&
system.documents.length > 0
) {

documentsHTML =
système.documents.map(document => {

retourner `

<div class="équipement">

📄 ${document}

</div>

`;

}).rejoindre("");

} autre {

documentsHTML =
"<p>Document Aucun.</p>";

}


const modalContent =
document.getElementById(
"contenu modal"
);


modalContent.innerHTML = `

<div class="eyebrow">
${system.icon} SYSTÈME
</div>

<h2>
${ system.name }
</h2>


<p style="
couleur : #737c76 ;
taille de police : 13 px ;
">

Dernier entretien :
${system.lastMaintenance || "—"}

<br>

Prochain entretien :
${system.nextMaintenance || "—"}

</p>


<h3>
Équipements
</h3>

${equipmentHTML}


<h3>
Documents
</h3>

${documentsHTML}

`;


ouvrirModal();

} attraper (erreur) {

console.error(erreur);

afficherMessage(
"Impossible d'ouvrir ce système."
);

}

}


/* ============================================
PLAN DE LA MAISON
=========================================== */

fonction openPlan() {

const modalContent =
document.getElementById(
"contenu modal"
);


modalContent.innerHTML = `

<div class="eyebrow">
CARTOGRAPHIE
</div>

<h2>
Plan de la maison
</h2>

<p style="
couleur : #737c76 ;
taille de police : 13 px ;
">

Cette fonctionnalité sera l'une
des prochaines grandes fonctions
de l'identifiant HOME.

</p>


<div style="
hauteur : 300 px ;
bordure:1px pointillée #cdd4ce;
bordure-radius:16px;
affichage : grille ;
placer-éléments:centre;
arrière-plan : #f8f9f7 ;
marge supérieure : 20 px ;
alignement du texte : centré ;
">

<div>

<div style="
taille de police : 42 px ;
marge inférieure : 12 px ;
">
🗺️
</div>

<strong>
Plan interactif
</strong>

<br>

<small style="
couleur : #7c867f ;
">

Importer PDF / JPG / PNG

<br>

puisposition
des équipements.

</small>

</div>

</div>

`;


ouvrirModal();

}


/* ============================================
OUVRIR / FERMER LA MODALE
=========================================== */

fonction openModal() {

const modal =
document.getElementById("modal");

modal.classList.remove("hidden");

}


fonction closeModal() {

const modal =
document.getElementById("modal");

modal.classList.add("hidden");

}


/* ============================================
FERMER EN CLIQUANT À CÔTÉ
=========================================== */

document.addEventListener(
"clic",
fonction(événement) {

const modal =
document.getElementById("modal");

si (
event.target === modal
) {

fermerModal();

}

}
);


/* ============================================
MESSAGE
=========================================== */

fonction afficherMessage(message) {

const toast =
document.getElementById("toast");


toast.textContent =
message;


toast.classList.add("show");


définirTimeout(
() => {

toast.classList.remove("show");

},
2500
);

}


/* ============================================
DÉMARRAGE
=========================================== */

init();
