const firebaseConfig = {
    apiKey: "AIzaSyDca_7n2rtIBVVUEMep4l_D610mZKaK0uw",
    authDomain: "digikla.firebaseapp.com",
    projectId: "digikla",
    storageBucket: "digikla.firebasestorage.app",
    messagingSenderId: "640958457111",
    appId: "1:640958457111:web:d0be4e9e598d0675148352",
    measurementId: "G-CNPR7H4YKP"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let aktuelleRolle = "Lehrer"; 
let currentUserUID = null;
let gewaehlteStundeNummer = null;
let AktuellerTagesPlan = [];
let GeladeneSchueler = [];

// Globale Speicher für geladene Grundeinstellungen
let GlobalSchuljahrConfig = { start: "", end: "", text: "" };
let GlobalUnterrichtsZeiten = []; // Array von Strings ["07:20 - 08:05", ...]

auth.onAuthStateChanged(user => {
    if (user) {
        currentUserUID = user.uid;
        document.getElementById("loginView").style.display = "none";
        document.getElementById("appView").style.display = "block";
        document.getElementById("angemeldeterUser").innerText = user.email;
        
        if (!document.getElementById("aktuellesDatum").value) {
            document.getElementById("aktuellesDatum").valueAsDate = new Date();
        }
        
        // 1. Grundeinstellungen aus Cloud laden
        ladeGrundeinstellungenVonCloud().then(() => {
            // 2. Rolle laden
            db.collection("users").doc(user.uid).get().then(doc => {
                aktuelleRolle = doc.exists ? (doc.data().rolle || "Lehrer") : "Lehrer";
                document.getElementById("userRolleBadge").innerText = aktuelleRolle;
                
                if (aktuelleRolle === "Admin") {
                    document.getElementById("adminPanelBtn").style.display = "inline-block";
                }
                
                // 3. Klassen laden
                klassenDropdownLaden();
            });
        });
    } else {
        document.getElementById("loginView").style.display = "block";
        document.getElementById("appView").style.display = "none";
    }
});

function login() {
    const email = document.getElementById("loginEmail").value;
    const pass = document.getElementById("loginPassword").value;
    auth.signInWithEmailAndPassword(email, pass).catch(err => {
        document.getElementById("loginError").innerText = "Fehler: " + err.message;
    });
}

function logout() { auth.signOut(); }

// Holt Schuljahr und Zeiten aus Firestore
function ladeGrundeinstellungenVonCloud() {
    return db.collection("einstellungen").doc("allgemein").get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            GlobalSchuljahrConfig = {
                text: data.schuljahr || "",
                start: data.startDatum || "",
                end: data.endDatum || ""
            };
            GlobalUnterrichtsZeiten = data.zeiten || [];
            
            // Header Anzeige befüllen
            document.getElementById("schuljahrAnzeige").innerText = GlobalSchuljahrConfig.text ? `Sj. ${GlobalSchuljahrConfig.text}` : "";
        }
    });
}

function klassenDropdownLaden() {
    const dropdown = document.getElementById("klassenAuswahl");
    dropdown.innerHTML = "";
    
    db.collection("klassen").get().then(snapshot => {
        if(snapshot.empty) return;
        dropdown.style.display = "inline-block";
        
        snapshot.forEach(doc => {
            let opt = document.createElement("option");
            opt.value = doc.id;
            opt.innerText = "Klasse " + doc.id;
            dropdown.appendChild(opt);
        });
        
        datenLadenAndRendern();
    });
}

function datenLadenAndRendern() {
    const klasse = document.getElementById("klassenAuswahl").value;
    const datumString = document.getElementById("aktuellesDatum").value;
    const tbody = document.getElementById("tagesStundenBody");
    tbody.innerHTML = "";

    if (!klasse || !datumString) return;

    // Datumsprüfung (Liegt es im Schuljahr?)
    if (GlobalSchuljahrConfig.start && GlobalSchuljahrConfig.end) {
        if (datumString < GlobalSchuljahrConfig.start || datumString > GlobalSchuljahrConfig.end) {
            tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:var(--danger); font-weight:bold;'>Datum liegt außerhalb des konfigurierten Schuljahres!</td></tr>";
            return;
        }
    }

    document.getElementById("klassenTitel").innerText = `Tagesübersicht - Klasse ${klasse}`;

    db.collection("klassen").doc(klasse).get().then(doc => {
        if(doc.exists) {
            const klUID = doc.data().klassenleiter || "";
            document.getElementById("klassenleiterInfo").innerHTML = `<strong>Klassenleiter-UID:</strong> ${klUID}`;
            
            if (aktuelleRolle === "Admin" || currentUserUID === klUID) {
                document.getElementById("stundenplanEditBtn").style.display = "inline-block";
            } else {
                document.getElementById("stundenplanEditBtn").style.display = "none";
            }
        }
    });

    db.collection("schueler").where("klasse", "==", klasse).get().then(snapshot => {
        GeladeneSchueler = [];
        snapshot.forEach(d => GeladeneSchueler.push(d.data().name));
    });

    const wochentag = new Date(datumString).getDay(); 
    if (wochentag === 0 || wochentag === 6) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:var(--border);'>Wochenende</td></tr>";
        return;
    }

    db.collection("klassen").doc(klasse).collection("stundenplaene").doc(String(wochentag)).get().then(doc => {
        AktuellerTagesPlan = doc.exists ? (doc.data().stunden || []) : [];
        
        if(AktuellerTagesPlan.length === 0) {
            tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:var(--border);'>Kein Stundenplan für diesen Tag definiert.</td></tr>";
            return;
        }

        AktuellerTagesPlan.forEach(stunde => {
            const key = `${klasse}_${datumString}_Std${stunde.std}`;
            db.collection("klassenbuch").doc(key).get().then(bDoc => {
                const sDaten = bDoc.exists ? bDoc.data() : { thema: "", hausaufgaben: "" };
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td><strong>${stunde.std}</strong> <br><small style="color:var(--border);">${stunde.zeit}</small></td>
                    <td><span class="btn btn-secondary" style="cursor:default;">${stunde.fach}</span></td>
                    <td>${sDaten.thema || "<em>Kein Eintrag</em>"}</td>
                    <td>${sDaten.hausaufgaben || "-"}</td>
                    <td>${stunde.lehrer}</td>
                    <td><button class="btn btn-primary" onclick="oeffneStunde(${stunde.std})">Bearbeiten</button></td>
                `;
                tbody.appendChild(row);
            });
        });
    });
}

function oeffneStunde(stdNummer) {
    gewaehlteStundeNummer = stdNummer;
    const klasse = document.getElementById("klassenAuswahl").value;
    const datum = document.getElementById("aktuellesDatum").value;
    const stundenInfo = AktuellerTagesPlan.find(s => s.std === stdNummer);
    
    document.getElementById("detailStundeTitel").innerText = `${stundenInfo.std}. Stunde - ${stundenInfo.fach}`;
    const key = `${klasse}_${datum}_Std${stdNummer}`;
    
    db.collection("klassenbuch").doc(key).get().then(doc => {
        const detail = doc.exists ? doc.data() : { thema: "", hausaufgaben: "", anwesenheit: {} };
        if (!detail.anwesenheit) detail.anwesenheit = {};

        document.getElementById("unterrichtsInhalt").value = detail.thema || "";
        document.getElementById("hausaufgabenInhalt").value = detail.hausaufgaben || "";
        
        const listeUl = document.getElementById("schuelerDetailListe");
        listeUl.innerHTML = "";
        
        GeladeneSchueler.forEach(name => {
            const aktuellerStatus = detail.anwesenheit[name] || "Anwesend";
            const li = document.createElement("li");
            li.className = "schueler-item";
            
            let optionen = `
                <option value="Anwesend" ${aktuellerStatus === 'Anwesend' ? 'selected' : ''}>Anwesend</option>
                <option value="Unentschuldigt" ${aktuellerStatus === 'Unentschuldigt' ? 'selected' : ''}>Unentschuldigt fehlt</option>
                <option value="Verspätet" ${aktuellerStatus === 'Verspätet' ? 'selected' : ''}>Verspätet</option>
            `;
            
            if (aktuelleRolle === "Klassenleiter" || aktuelleRolle === "Sekretariat" || aktuelleRolle === "Admin") {
                optionen += `
                    <option value="Entschuldigt" ${aktuellerStatus === 'Entschuldigt' ? 'selected' : ''}>Entschuldigt</option>
                    <option value="Freigestellt" ${aktuellerStatus === 'Freigestellt' ? 'selected' : ''}>Freigestellt</option>
                `;
            } else if (aktuellerStatus === "Entschuldigt" || aktuellerStatus === "Freigestellt") {
                optionen += `<option value="${aktuellerStatus}" selected disabled>${aktuellerStatus} (gesperrt)</option>`;
            }

            li.innerHTML = `<span><strong>${name}</strong></span>
                <select class="status-select" onchange="statusDirektSpeichern('${name}', this.value)">${optionen}</select>`;
            listeUl.appendChild(li);
        });

        hideAllViews();
        document.getElementById("detailView").style.display = "block";
    });
}

function statusDirektSpeichern(schuelerName, neuerStatus) {
    const klasse = document.getElementById("klassenAuswahl").value;
    const datum = document.getElementById("aktuellesDatum").value;
    const key = `${klasse}_${datum}_Std${gewaehlteStundeNummer}`;
    
    let updateObj = {};
    updateObj[`anwesenheit.${schuelerName}`] = neuerStatus;

    db.collection("klassenbuch").doc(key).update(updateObj).catch(() => {
        let initial = { anwesenheit: {} };
        initial.anwesenheit[schuelerName] = neuerStatus;
        db.collection("klassenbuch").doc(key).set(initial, { merge: true });
    });
}

function stundeSpeichernUndSchliessen() {
    const klasse = document.getElementById("klassenAuswahl").value;
    const datum = document.getElementById("aktuellesDatum").value;
    const key = `${klasse}_${datum}_Std${gewaehlteStundeNummer}`;
    
    db.collection("klassenbuch").doc(key).set({
        thema: document.getElementById("unterrichtsInhalt").value,
        hausaufgaben: document.getElementById("hausaufgabenInhalt").value
    }, { merge: true }).then(() => zeigeDashboard());
}

// STUNDENPLAN-EDITOR (Zieht sich jetzt die vordefinierten Zeiten)
function zeigeStundenplanEditor() {
    hideAllViews();
    document.getElementById("stundenplanEditorView").style.display = "block";
    document.getElementById("editWochentag").value = "1";
    ladeEditorPlanForDay();
}

function ladeEditorPlanForDay() {
    const klasse = document.getElementById("klassenAuswahl").value;
    const tag = document.getElementById("editWochentag").value;
    const tbody = document.getElementById("editorStundenBody");
    tbody.innerHTML = "";

    // Falls der Admin weniger als 8 Stunden definiert hat, füllen wir auf
    const anzahlStunden = Math.max(GlobalUnterrichtsZeiten.length, 6);

    db.collection("klassen").doc(klasse).collection("stundenplaene").doc(tag).get().then(doc => {
        const existierenderPlan = doc.exists ? (doc.data().stunden || []) : [];
        
        for (let i = 1; i <= anzahlStunden; i++) {
            let vordefinierteZeit = GlobalUnterrichtsZeiten[i-1] || "";
            let alteStd = existierenderPlan.find(s => s.std === i) || { fach: "", lehrer: "", zeit: vordefinierteZeit };
            
            let row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${i}</strong></td>
                <td><span id="editZeitAnzeige${i}" style="font-weight:600; color:#94a3b8;">${vordefinierteZeit || "Nicht definiert"}</span></td>
                <td><input type="text" id="editFach${i}" value="${alteStd.fach}" placeholder="z.B. MA"></td>
                <td><input type="text" id="editLehrer${i}" value="${alteStd.lehrer}" placeholder="z.B. FINN"></td>
            `;
            tbody.appendChild(row);
        }
    });
}

function speichereStundenplan() {
    const klasse = document.getElementById("klassenAuswahl").value;
    const tag = document.getElementById("editWochentag").value;
    
    let neueStunden = [];
    const anzahlStunden = Math.max(GlobalUnterrichtsZeiten.length, 6);

    for(let i = 1; i <= anzahlStunden; i++) {
        let fachVal = document.getElementById(`editFach${i}`).value.trim();
        let lehrerVal = document.getElementById(`editLehrer${i}`).value.trim();
        let zeitVal = document.getElementById(`editZeitAnzeige${i}`).innerText;
        
        if(fachVal && zeitVal !== "Nicht definiert") {
            neueStunden.push({ std: i, zeit: zeitVal, fach: fachVal, lehrer: lehrerVal });
        }
    }

    db.collection("klassen").doc(klasse).collection("stundenplaene").doc(tag).set({
        stunden: neueStunden
    }).then(() => {
        alert("Stundenplan erfolgreich gespeichert!");
        zeigeDashboard();
    });
}

// ADMIN PANEL TABS & GRUNDEINSTELLUNGEN
function zeigeAdminPanel() {
    hideAllViews();
    document.getElementById("adminPanelView").style.display = "block";
    wechsleAdminTab('klassen');
    baueAdminZeitenSetupTabelle();
}

function wechsleAdminTab(tabName) {
    if(tabName === 'klassen') {
        document.getElementById("adminTabKlassen").style.display = "grid";
        document.getElementById("adminTabEinstellungen").style.display = "none";
        document.getElementById("btnTabKlassen").className = "btn btn-primary";
        document.getElementById("btnTabEinstellungen").className = "btn btn-secondary";
    } else {
        document.getElementById("adminTabKlassen").style.display = "none";
        document.getElementById("adminTabEinstellungen").style.display = "block";
        document.getElementById("btnTabKlassen").className = "btn btn-secondary";
        document.getElementById("btnTabEinstellungen").className = "btn btn-primary";
        
        // Werte in Inputs laden
        document.getElementById("setupSchuljahr").value = GlobalSchuljahrConfig.text;
        document.getElementById("setupStartDatum").value = GlobalSchuljahrConfig.start;
        document.getElementById("setupEndDatum").value = GlobalSchuljahrConfig.end;
    }
}

function baueAdminZeitenSetupTabelle() {
    const tbody = document.getElementById("setupZeitenBody");
    tbody.innerHTML = "";
    for(let i = 1; i <= 8; i++) {
        let alteZeit = GlobalUnterrichtsZeiten[i-1] || "";
        let row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${i}. Stunde</strong></td>
            <td><input type="text" id="setupZeitSpanne${i}" value="${alteZeit}" placeholder="z.B. 07:20 - 08:05"></td>
        `;
        tbody.appendChild(row);
    }
}

function speichereGrundeinstellungen() {
    const sj = document.getElementById("setupSchuljahr").value.trim();
    const start = document.getElementById("setupStartDatum").value;
    const end = document.getElementById("setupEndDatum").value;
    
    let zeitenArray = [];
    for(let i = 1; i <= 8; i++) {
        let val = document.getElementById(`setupZeitSpanne${i}`).value.trim();
        zeitenArray.push(val); // Wir pushen auch leere, filtern sie beim Laden oder lassen sie unbesetzt
    }

    db.collection("einstellungen").doc("allgemein").set({
        schuljahr: sj,
        startDatum: start,
        endDatum: end,
        zeiten: zeitenArray
    }).then(() => {
        alert("Grundeinstellungen erfolgreich in der Cloud gespeichert!");
        ladeGrundeinstellungenVonCloud().then(() => zeigeDashboard());
    });
}

function adminKlasseErstellen() {
    const name = document.getElementById("adminKlassenName").value.trim();
    const leiter = document.getElementById("adminKlassenleiterUID").value.trim();
    if(!name) return;

    db.collection("klassen").doc(name).set({ klassenleiter: leiter }, { merge: true }).then(() => {
        alert(`Klasse ${name} wurde angelegt.`);
        klassenDropdownLaden();
    });
}

function adminSchuelerAnlegen() {
    const name = document.getElementById("adminSchuelerName").value.trim();
    const klasse = document.getElementById("adminSchuelerKlasse").value.trim();
    if(!name || !klasse) return;

    db.collection("schueler").doc(name).set({ name: name, klasse: klasse }).then(() => {
        alert(`Schüler ${name} wurde der Klasse ${klasse} hinzugefügt.`);
        datenLadenAndRendern();
    });
}

function hideAllViews() {
    document.getElementById("dashboardView").style.display = "none";
    document.getElementById("detailView").style.display = "none";
    document.getElementById("stundenplanEditorView").style.display = "none";
    document.getElementById("adminPanelView").style.display = "none";
}

function zeigeDashboard() {
    hideAllViews();
    document.getElementById("dashboardView").style.display = "block";
    datenLadenAndRendern();
}
