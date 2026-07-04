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

let MeinLehrerProfil = { name: "Unbekannter Lehrer", kuerzel: "KST" };
let GlobalSchuljahrConfig = { start: "", end: "", text: "" };
let GlobalUnterrichtsZeiten = [];
let AlleLehrerCache = {}; 

// Hilfsfunktion: Berechnet Kalenderwoche nach DIN ISO 8601
function getKalenderWoche(dateString) {
    const d = new Date(dateString);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

auth.onAuthStateChanged(user => {
    if (user) {
        currentUserUID = user.uid;
        document.getElementById("loginView").style.display = "none";
        document.getElementById("appView").style.display = "block";
        
        Promise.all([
            ladeGrundeinstellungenVonCloud(),
            ladeAlleLehrerProfile()
        ]).then(() => {
            if (AlleLehrerCache[user.uid]) {
                MeinLehrerProfil = AlleLehrerCache[user.uid];
            }
            document.getElementById("angemeldeterUser").innerText = `${MeinLehrerProfil.name} (${MeinLehrerProfil.kuerzel})`;
            
            db.collection("users").doc(user.uid).get().then(doc => {
                aktuelleRolle = doc.exists ? (doc.data().rolle || "Lehrer") : "Lehrer";
                document.getElementById("userRolleBadge").innerText = aktuelleRolle;
                
                if (aktuelleRolle === "Admin") {
                    document.getElementById("adminPanelBtn").style.display = "inline-block";
                }
                if(!document.getElementById("aktuellesDatum").value) {
                    document.getElementById("aktuellesDatum").value = new Date().toISOString().split('T')[0];
                }
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

function ladeGrundeinstellungenVonCloud() {
    return db.collection("einstellungen").doc("allgemein").get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            GlobalSchuljahrConfig = { text: data.schuljahr || "", start: data.startDatum || "", end: data.endDatum || "" };
            GlobalUnterrichtsZeiten = data.zeiten || [];
            document.getElementById("schuljahrAnzeige").innerText = GlobalSchuljahrConfig.text ? `Sj. ${GlobalSchuljahrConfig.text}` : "";
        }
    });
}

function ladeAlleLehrerProfile() {
    return db.collection("lehrerProfile").get().then(snapshot => {
        AlleLehrerCache = {};
        snapshot.forEach(doc => { AlleLehrerCache[doc.id] = doc.data(); });
    });
}

function klassenDropdownLaden() {
    const dropdownOben = document.getElementById("klassenAuswahl");
    const dropdownDashboard = document.getElementById("klassenAuswahlDashboard");
    const schnellzugriffContainer = document.getElementById("meineKlassenLinks");
    
    dropdownOben.innerHTML = "";
    schnellzugriffContainer.innerHTML = "";
    if(dropdownDashboard) dropdownDashboard.innerHTML = '<option value="">-- Klasse wählen --</option>';

    db.collection("klassen").get().then(snapshot => {
        if(snapshot.empty) return;
        
        let ersteKlasse = null;

        snapshot.forEach(doc => {
            const klID = doc.id;
            const data = doc.data();
            if(!ersteKlasse) ersteKlasse = klID;

            // 1. Oben unsichtbares Menü
            let opt1 = document.createElement("option");
            opt1.value = klID;
            opt1.innerText = "Klasse " + klID;
            dropdownOben.appendChild(opt1);

            // 2. Rechter Reiter (Stundenplan anderer Klassen)
            if(dropdownDashboard) {
                let opt2 = document.createElement("option");
                opt2.value = klID;
                opt2.innerText = "Klasse " + klID;
                dropdownDashboard.appendChild(opt2);
            }

            // 3. Linker Reiter (Eigene Klassen) -> Filtert nach Klassenleiter-UID oder Klassenbesitz
            if(data.klassenleiter === currentUserUID || aktuelleRolle === "Admin" || klID === "8rt") {
                let btn = document.createElement("button");
                btn.className = "btn btn-secondary class-panel-btn";
                btn.innerHTML = `📘 Klasse ${klID}`;
                btn.onclick = () => waehleKlasseDirekt(klID);
                schnellzugriffContainer.appendChild(btn);
            }
        });

        // Falls kein Schnellzugriff befüllt wurde, Standard-Button einblenden
        if(schnellzugriffContainer.children.length === 0 && ersteKlasse) {
            schnellzugriffContainer.innerHTML = `<button class="btn btn-secondary class-panel-btn" onclick="waehleKlasseDirekt('${ersteKlasse}')">📘 Klasse ${ersteKlasse}</button>`;
        }

        // Standardmäßig die erste Klasse im Speicher aktivieren
        dropdownOben.value = ersteKlasse;
        datenLadenAndRendern();
    });
}

function waehleKlasseDirekt(klasse) {
    document.getElementById("klassenAuswahl").value = klasse;
    datenLadenAndRendern();
}

function oeffneFremdeKlasse() {
    const wahl = document.getElementById("klassenAuswahlDashboard").value;
    if(!wahl) {
        alert("Bitte wähle zuerst eine Klasse aus!");
        return;
    }
    waehleKlasseDirekt(wahl);
}

function datenLadenAndRendern() {
    const klasse = document.getElementById("klassenAuswahl").value;
    const datumString = document.getElementById("aktuellesDatum").value;
    const tbody = document.getElementById("tagesStundenBody");
    
    // Listen leeren
    tbody.innerHTML = "";
    document.getElementById("listeEntschuldigt").innerHTML = "<li>Lade...</li>";
    document.getElementById("listeAbgemeldet").innerHTML = "<li>Lade...</li>";
    document.getElementById("listeUnentschuldigt").innerHTML = "<li>Lade...</li>";

    if (!klasse || !datumString) return;

    if (GlobalSchuljahrConfig.start && GlobalSchuljahrConfig.end) {
        if (datumString < GlobalSchuljahrConfig.start || datumString > GlobalSchuljahrConfig.end) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:var(--danger); font-weight:bold;'>Datum liegt außerhalb des Schuljahres!</td></tr>";
            return;
        }
    }

    // A/B-Wochen Ermittlung
    const kw = getKalenderWoche(datumString);
    const wochenTyp = (kw % 2 !== 0) ? "A" : "B";
    document.getElementById("wochenTypAnzeige").innerText = `${wochenTyp}-Woche (KW ${kw})`;

    db.collection("klassen").doc(klasse).get().then(doc => {
        if(doc.exists) {
            const klUID = doc.data().klassenleiter || "";
            let klName = "Keiner";
            if (AlleLehrerCache[klUID]) klName = AlleLehrerCache[klUID].name;
            document.getElementById("klassenleiterInfo").innerText = `Klasse: ${klasse} | Klassenleiter: ${klName}`;
            
            if (aktuelleRolle === "Admin" || currentUserUID === klUID) {
                document.getElementById("stundenplanEditBtn").style.display = "inline-block";
            } else {
                document.getElementById("stundenplanEditBtn").style.display = "none";
            }
        }
    });

    // Abwesenheiten & Schüler verarbeiten
    db.collection("schueler").where("klasse", "==", klasse).get().then(snapshot => {
        GeladeneSchueler = [];
        let entList = "", abgList = "", uneList = "";
        let pendingChecks = snapshot.size;

        if(snapshot.empty) {
            document.getElementById("listeEntschuldigt").innerHTML = "<li style='color:#64748b;'>Keine Schüler</li>";
            document.getElementById("listeAbgemeldet").innerHTML = "<li style='color:#64748b;'>Keine Schüler</li>";
            document.getElementById("listeUnentschuldigt").innerHTML = "<li style='color:#64748b;'>Keine Schüler</li>";
        }

        snapshot.forEach(d => {
            const name = d.data().name;
            GeladeneSchueler.push(name);

            // Prüfe den globalen Tagesstatus (Erste Stunde des Tages repräsentativ)
            const checkKey = `${klasse}_${datumString}_Std1`;
            db.collection("klassenbuch").doc(checkKey).get().then(bDoc => {
                const status = (bDoc.exists && bDoc.data().anwesenheit) ? (bDoc.data().anwesenheit[name] || "Anwesend") : "Anwesend";
                
                if(status === "Entschuldigt") entList += `<li><span>${name}</span> <small>Ganztägig</small></li>`;
                if(status === "Freigestellt" || status === "Verspätet") abgList += `<li><span>${name}</span> <small>${status}</small></li>`;
                if(status === "Unentschuldigt") uneList += `<li><span>${name}</span> <small>Fehlt unentsch.</small></li>`;
                
                pendingChecks--;
                if(pendingChecks === 0) {
                    document.getElementById("listeEntschuldigt").innerHTML = entList || "<li style='color:#64748b; font-style:italic;'>Keine Einträge</li>";
                    document.getElementById("listeAbgemeldet").innerHTML = abgList || "<li style='color:#64748b; font-style:italic;'>Keine Einträge</li>";
                    document.getElementById("listeUnentschuldigt").innerHTML = uneList || "<li style='color:#64748b; font-style:italic;'>Keine Einträge</li>";
                }
            }).catch(() => {
                pendingChecks--;
            });
        });
    });

    const wochentag = new Date(datumString).getDay(); 
    if (wochentag === 0 || wochentag === 6) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:var(--border);'>Wochenende</td></tr>";
        return;
    }

    const planDokumentId = `${wochentag}_${wochenTyp}`;

    db.collection("klassen").doc(klasse).collection("stundenplaene").doc(planDokumentId).get().then(doc => {
        AktuellerTagesPlan = doc.exists ? (doc.data().stunden || []) : [];
        
        if(AktuellerTagesPlan.length === 0) {
            tbody.innerHTML = `<tr><td colspan='5' style='text-align:center; color:var(--border);'>Kein Plan für die ${wochenTyp}-Woche definiert.</td></tr>`;
            return;
        }

        let unsigniertCounter = 0;
        let rowsProcessed = 0;

        AktuellerTagesPlan.forEach(stunde => {
            const key = `${klasse}_${datumString}_Std${stunde.std}`;
            db.collection("klassenbuch").doc(key).get().then(bDoc => {
                const sDaten = bDoc.exists ? bDoc.data() : {};
                
                let HTMLFachAnzeige = "";
                let aktuellerLehrer = sDaten.vLehrer || stunde.lehrer;
                
                if(!sDaten.isSigniert && stunde.fach) {
                    unsigniertCounter++;
                }

                if (sDaten.istAusfall) {
                    HTMLFachAnzeige = `<div class="fach-haupttext" style="color:var(--danger); text-decoration:line-through;">${stunde.fach}</div><div class="ausfall-text">(Ausfall)</div>`;
                    aktuellerLehrer = "-";
                } else if (sDaten.vFach && sDaten.vFach !== stunde.fach) {
                    HTMLFachAnzeige = `<div class="fach-haupttext">${sDaten.vFach}</div><div class="vertretung-subtext">statt ${stunde.fach}</div>`;
                } else {
                    HTMLFachAnzeige = `<div class="fach-haupttext">${stunde.fach}</div>`;
                }

                const buttonHTML = `<button class="btn btn-primary" style="padding:4px 8px; font-size:12px;" onclick="oeffneStunde(${stunde.std})">Öffnen</button>`;

                const row = document.createElement("tr");
                if(sDaten.isSigniert) row.style.opacity = "0.7";

                row.innerHTML = `
                    <td><strong>${stunde.std}</strong> <small style="color:#64748b; display:block;">${stunde.zeit}</small></td>
                    <td>${HTMLFachAnzeige}</td>
                    <td>${sDaten.thema || "<em style='color:#64748b;'>Kein Eintrag</em>"}</td>
                    <td><strong>${aktuellerLehrer}</strong> ${sDaten.isSigniert ? "🔒" : ""}</td>
                    <td>${buttonHTML}</td>
                `;
                tbody.appendChild(row);
                
                rowsProcessed++;
                if(rowsProcessed === AktuellerTagesPlan.length) {
                    document.getElementById("countUnsigniert").innerText = unsigniertCounter;
                }
            });
        });
    });
}

function oeffneStunde(stdNummer) {
    gewaehlteStundeNummer = stdNummer;
    const klasse = document.getElementById("klassenAuswahl").value;
    const datum = document.getElementById("aktuellesDatum").value;
    const stundenInfo = AktuellerTagesPlan.find(s => s.std === stdNummer);
    const key = `${klasse}_${datum}_Std${stdNummer}`;
    
    db.collection("klassenbuch").doc(key).get().then(doc => {
        const detail = doc.exists ? doc.data() : { thema: "", hausaufgaben: "", anwesenheit: {} };
        if (!detail.anwesenheit) detail.anwesenheit = {};

        let stundenLehrer = detail.vLehrer || stundenInfo.lehrer;
        let istAusfall = detail.istAusfall || false;
        let isSigniert = detail.isSigniert || false;

        let binBerechtigt = (aktuelleRolle === "Admin" || (stundenLehrer === MeinLehrerProfil.kuerzel && !istAusfall));
        let schreibgesperrt = isSigniert || !binBerechtigt;

        document.getElementById("unterrichtsInhalt").value = detail.thema || "";
        document.getElementById("unterrichtsInhalt").disabled = schreibgesperrt;
        document.getElementById("hausaufgabenInhalt").value = detail.hausaufgaben || "";
        document.getElementById("hausaufgabenInhalt").disabled = schreibgesperrt;

        let anzeigeFach = detail.vFach || stundenInfo.fach;
        document.getElementById("detailStundeTitel").innerText = `${stundenInfo.std}. Stunde - ${anzeigeFach} (${stundenLehrer})`;

        const hinweis = document.getElementById("statusHinweisBox");
        if (isSigniert) {
            hinweis.style.display = "block";
            hinweis.style.backgroundColor = "var(--success)";
            hinweis.innerText = "Gesperrt: Diese Stunde wurde elektronisch signiert.";
        } else if (!binBerechtigt) {
            hinweis.style.display = "block";
            hinweis.style.backgroundColor = "var(--bg-input)";
            hinweis.innerText = "Schreibgeschützt: Nicht dein Fachlehrer-Kürzel. Übernimm die Stunde, um Daten einzutragen.";
        } else {
            hinweis.style.display = "none";
        }

        if (isSigniert) {
            document.getElementById("btnUnterrichtAendern").style.display = "none";
            document.getElementById("btnUnterrichtUebernehmen").style.display = "none";
            document.getElementById("btnUnterrichtSignieren").style.display = "none";
            document.getElementById("btnSignumZuruecknehmen").style.display = binBerechtigt ? "inline-block" : "none";
        } else {
            document.getElementById("btnUnterrichtAendern").style.display = "inline-block";
            document.getElementById("btnUnterrichtUebernehmen").style.display = "inline-block";
            document.getElementById("btnUnterrichtSignieren").style.display = binBerechtigt ? "inline-block" : "none";
            document.getElementById("btnSignumZuruecknehmen").style.display = "none";
        }

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
                <option value="Entschuldigt" ${aktuellerStatus === 'Entschuldigt' ? 'selected' : ''}>Entschuldigt</option>
                <option value="Freigestellt" ${aktuellerStatus === 'Freigestellt' ? 'selected' : ''}>Freigestellt</option>
            `;

            li.innerHTML = `<span><strong>${name}</strong></span>
                <select class="status-select" ${schreibgesperrt ? 'disabled' : ''} onchange="statusDirektSpeichern('${name}', this.value)">${optionen}</select>`;
            listeUl.appendChild(li);
        });

        hideAllViews();
        document.getElementById("detailView").style.display = "block";
    });
}

function unterrichtAendernDialog() {
    const wahl = prompt("Neues Fachkürzel eingeben (oder 'AUSFALL' für Stundenausfall):");
    if (wahl === null) return;

    const klasse = document.getElementById("klassenAuswahl").value;
    const datum = document.getElementById("aktuellesDatum").value;
    const key = `${klasse}_${datum}_Std${gewaehlteStundeNummer}`;

    if (wahl.trim().toUpperCase() === "AUSFALL") {
        db.collection("klassenbuch").doc(key).set({ istAusfall: true, vFach: "", vLehrer: "" }, { merge: true }).then(() => oeffneStunde(gewaehlteStundeNummer));
    } else if (wahl.trim()) {
        const neuerLehrer = prompt("Welcher Lehrer hält die Vertretung? (Kürzel)");
        if (!neuerLehrer) return;
        db.collection("klassenbuch").doc(key).set({ istAusfall: false, vFach: wahl.trim().toUpperCase(), vLehrer: neuerLehrer.trim().toUpperCase() }, { merge: true }).then(() => oeffneStunde(gewaehlteStundeNummer));
    }
}

function unterrichtUebernehmenDialog() {
    const klasse = document.getElementById("klassenAuswahl").value;
    const datum = document.getElementById("aktuellesDatum").value;
    const stundenInfo = AktuellerTagesPlan.find(s => s.std === gewaehlteStundeNummer);
    const key = `${klasse}_${datum}_Std${gewaehlteStundeNummer}`;

    const beibehalten = confirm(`Möchtest du das aktuelle Fach (${stundenInfo.fach}) beibehalten?`);
    let neuesFach = stundenInfo.fach;

    if (!beibehalten) {
        let f = prompt("Welches Fach unterrichtest du?");
        if (!f) return;
        neuesFach = f.trim().toUpperCase();
    }

    db.collection("klassenbuch").doc(key).set({ istAusfall: false, vFach: neuesFach, vLehrer: MeinLehrerProfil.kuerzel }, { merge: true }).then(() => {
        oeffneStunde(gewaehlteStundeNummer);
    });
}

function stundeSignieren() {
    const klasse = document.getElementById("klassenAuswahl").value;
    const datum = document.getElementById("aktuellesDatum").value;
    const key = `${klasse}_${datum}_Std${gewaehlteStundeNummer}`;

    db.collection("klassenbuch").doc(key).set({
        thema: document.getElementById("unterrichtsInhalt").value,
        hausaufgaben: document.getElementById("hausaufgabenInhalt").value,
        isSigniert: true
    }, { merge: true }).then(() => {
        oeffneStunde(gewaehlteStundeNummer);
    });
}

function signumZuruecknehmen() {
    const klasse = document.getElementById("klassenAuswahl").value;
    const datum = document.getElementById("aktuellesDatum").value;
    const key = `${klasse}_${datum}_Std${gewaehlteStundeNummer}`;

    db.collection("klassenbuch").doc(key).set({ isSigniert: false }, { merge: true }).then(() => {
        oeffneStunde(gewaehlteStundeNummer);
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

function zeigeStundenplanEditor() {
    hideAllViews();
    document.getElementById("stundenplanEditorView").style.display = "block";
    document.getElementById("editWochentag").value = "1";
    document.getElementById("editWochenTyp").value = "A";
    ladeEditorPlanForDay();
}

function ladeEditorPlanForDay() {
    const klasse = document.getElementById("klassenAuswahl").value;
    const tag = document.getElementById("editWochentag").value;
    const typ = document.getElementById("editWochenTyp").value;
    const tbody = document.getElementById("editorStundenBody");
    tbody.innerHTML = "";

    const anzahlStunden = Math.max(GlobalUnterrichtsZeiten.length, 6);
    const planId = `${tag}_${typ}`;

    db.collection("klassen").doc(klasse).collection("stundenplaene").doc(planId).get().then(doc => {
        const existierenderPlan = doc.exists ? (doc.data().stunden || []) : [];
        
        for (let i = 1; i <= anzahlStunden; i++) {
            let vordefinierteZeit = GlobalUnterrichtsZeiten[i-1] || "";
            let alteStd = existierenderPlan.find(s => s.std === i) || { fach: "", lehrer: "", zeit: vordefinierteZeit };
            
            let row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${i}</strong></td>
                <td><span id="editZeitAnzeige${i}" style="font-weight:600; color:#94a3b8;">${vordefinierteZeit || "Nicht definiert"}</span></td>
                <td><input type="text" id="editFach${i}" value="${alteStd.fach}"></td>
                <td><input type="text" id="editLehrer${i}" value="${alteStd.lehrer}"></td>
            `;
            tbody.appendChild(row);
        }
    });
}

function speichereStundenplan() {
    const klasse = document.getElementById("klassenAuswahl").value;
    const tag = document.getElementById("editWochentag").value;
    const typ = document.getElementById("editWochenTyp").value;
    const planId = `${tag}_${typ}`;
    
    let neueStunden = [];
    const anzahlStunden = Math.max(GlobalUnterrichtsZeiten.length, 6);

    for(let i = 1; i <= anzahlStunden; i++) {
        let fachVal = document.getElementById(`editFach${i}`).value.trim();
        let lehrerVal = document.getElementById(`editLehrer${i}`).value.trim().toUpperCase();
        let zeitVal = document.getElementById(`editZeitAnzeige${i}`).innerText;
        
        if(fachVal && zeitVal !== "Nicht definiert") {
            neueStunden.push({ std: i, zeit: zeitVal, fach: fachVal, lehrer: lehrerVal });
        }
    }

    db.collection("klassen").doc(klasse).collection("stundenplaene").doc(planId).set({
        stunden: neueStunden
    }).then(() => {
        alert("Stundenplan gespeichert!");
        zeigeDashboard();
    });
}

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
            <td><input type="text" id="setupZeitSpanne${i}" value="${alteZeit}"></td>
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
        zeitenArray.push(val);
    }

    db.collection("einstellungen").doc("allgemein").set({
        schuljahr: sj, startDatum: start, endDatum: end, zeiten: zeitenArray
    }).then(() => {
        alert("Grundeinstellungen gesichert!");
        ladeGrundeinstellungenVonCloud().then(() => zeigeDashboard());
    });
}

function adminLehrerAnlegen() {
    const name = document.getElementById("setupLehrerName").value.trim();
    const kuerzel = document.getElementById("setupLehrerKuerzel").value.trim().toUpperCase();
    const uid = document.getElementById("setupLehrerUID").value.trim();

    if (!name || !kuerzel || !uid) return;

    db.collection("lehrerProfile").doc(uid).set({ name: name, kuerzel: kuerzel }).then(() => {
        alert(`Profil für ${name} angelegt!`);
        ladeAlleLehrerProfile().then(() => datenLadenAndRendern());
    });
}

function adminKlasseErstellen() {
    const name = document.getElementById("adminKlassenName").value.trim();
    const leiter = document.getElementById("adminKlassenleiterUID").value.trim();
    if(!name) return;

    db.collection("klassen").doc(name).set({ klassenleiter: leiter }, { merge: true }).then(() => {
        alert(`Klasse ${name} erstellt.`);
        klassenDropdownLaden();
    });
}

function adminSchuelerAnlegen() {
    const name = document.getElementById("adminSchuelerName").value.trim();
    const klasse = document.getElementById("adminSchuelerKlasse").value.trim();
    if(!name || !klasse) return;

    db.collection("schueler").doc(name).set({ name: name, klasse: klasse }).then(() => {
        alert(`Schüler ${name} registriert.`);
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
