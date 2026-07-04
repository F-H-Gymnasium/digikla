// 1. Firebase Konfiguration - ERSETZE DIESE WERTE MIT DEINEN EIGENEN AUS FIREBASE
const firebaseConfig = {
    apiKey: "DEIN_API_KEY",
    authDomain: "DEIN_PROJEKT.firebaseapp.com",
    projectId: "DEIN_PROJEKT",
    storageBucket: "DEIN_PROJEKT.appspot.com",
    messagingSenderId: "DEINE_MESSAGING_ID",
    appId: "DEINE_APP_ID"
};

// Firebase initialisieren
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Globale Variablen für den Programmzustand
let aktuelleRolle = "Lehrer"; 
let gewaehlteStundeNummer = null;

// Feste Stamm-Daten (Für ein Roblox-Rollenspiel vollkommen ausreichend)
const StandardSchueler = ["Lasse Neumann", "Klara Schuhmacher", "Maximilian Weber", "Emma Fischer"];
const StundenPlanStruktur = [
    { std: 1, zeit: "07:20 - 08:05", fach: "DE / Deu", lehrer: "ROIT" },
    { std: 2, zeit: "08:15 - 09:00", fach: "DE / Deu", lehrer: "ROIT" },
    { std: 3, zeit: "09:00 - 09:45", fach: "MA / Mat", lehrer: "ROIT" },
    { std: 4, zeit: "10:00 - 10:45", fach: "MA / Mat", lehrer: "ROIT" },
    { std: 5, zeit: "10:45 - 11:30", fach: "INF", lehrer: "FINN" }
];

// Firebase Beobachter: Prüft live, ob jemand ein- oder ausgeloggt ist
auth.onAuthStateChanged(user => {
    if (user) {
        // Angemeldet -> App zeigen, Login verstecken
        document.getElementById("loginView").style.display = "none";
        document.getElementById("appView").style.display = "block";
        document.getElementById("angemeldeterUser").innerText = user.email;
        
        // Datum standardmäßig auf heute setzen
        if (!document.getElementById("aktuellesDatum").value) {
            document.getElementById("aktuellesDatum").valueAsDate = new Date();
        }
        
        // Rolle des Accounts aus Firestore auslesen
        db.collection("users").doc(user.uid).get().then(doc => {
            if (doc.exists && doc.data().rolle) {
                aktuelleRolle = doc.data().rolle;
            } else {
                aktuelleRolle = "Lehrer"; // Rückfall-Option
            }
            document.getElementById("userRolleBadge").innerText = aktuelleRolle;
            datenLadenAndRendern();
        }).catch(err => {
            console.error("Fehler beim Laden der Rolle:", err);
            datenLadenAndRendern();
        });
    } else {
        // Nicht angemeldet -> Login zeigen, App verstecken
        document.getElementById("loginView").style.display = "block";
        document.getElementById("appView").style.display = "none";
    }
});

// Login absenden
function login() {
    const email = document.getElementById("loginEmail").value;
    const pass = document.getElementById("loginPassword").value;
    const errorText = document.getElementById("loginError");
    
    errorText.innerText = "";

    if (!email || !pass) {
        errorText.innerText = "Bitte Felder ausfüllen.";
        return;
    }

    auth.signInWithEmailAndPassword(email, pass).catch(error => {
        errorText.innerText = "Fehler: " + error.message;
    });
}

// Ausloggen
function logout() {
    auth.signOut();
}

// Holt Daten für die Tagesübersicht live aus der Cloud
function datenLadenAndRendern() {
    const datum = document.getElementById("aktuellesDatum").value;
    const tbody = document.getElementById("tagesStundenBody");
    tbody.innerHTML = "";

    if (!datum) return;

    StundenPlanStruktur.forEach(stunde => {
        const key = `${datum}_Std${stunde.std}`;
        
        db.collection("klassenbuch").doc(key).get().then(doc => {
            const stundenDaten = doc.exists ? doc.data() : { thema: "", hausaufgaben: "" };
            
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${stunde.std}</strong> <br><small style="color:var(--border);">${stunde.zeit}</small></td>
                <td><span class="btn btn-secondary" style="cursor:default;">${stunde.fach}</span></td>
                <td>${stundenDaten.thema || "<span style='color:var(--border);'>Kein Eintrag</span>"}</td>
                <td>${stundenDaten.hausaufgaben || "-"}</td>
                <td>${stunde.lehrer}</td>
                <td><button class="btn btn-primary" onclick="oeffneStunde(${stunde.std})">Bearbeiten</button></td>
            `;
            tbody.appendChild(row);
        }).catch(err => {
            console.error("Fehler beim Laden der Zeile:", err);
        });
    });
}

// Wechselt in die Detailansicht einer spezifischen Stunde
function oeffneStunde(stdNummer) {
    gewaehlteStundeNummer = stdNummer;
    const datum = document.getElementById("aktuellesDatum").value;
    const stundenInfo = StundenPlanStruktur.find(s => s.std === stdNummer);
    
    document.getElementById("detailStundeTitel").innerText = `${stundenInfo.std}. Stunde - ${stundenInfo.fach}`;
    
    const key = `${datum}_Std${stdNummer}`;
    
    db.collection("klassenbuch").doc(key).get().then(doc => {
        const detail = doc.exists ? doc.data() : { thema: "", hausaufgaben: "", anwesenheit: {} };
        if (!detail.anwesenheit) detail.anwesenheit = {};

        // Felder befüllen
        document.getElementById("unterrichtsInhalt").value = detail.thema || "";
        document.getElementById("hausaufgabenInhalt").value = detail.hausaufgaben || "";
        
        // Schülerliste generieren
        const listeUl = document.getElementById("schuelerDetailListe");
        listeUl.innerHTML = "";
        
        StandardSchueler.forEach(name => {
            const aktuellerStatus = detail.anwesenheit[name] || "Anwesend";
            const li = document.createElement("li");
            li.className = "schueler-item";
            
            // Standard-Optionen für jeden Lehrer
            let optionen = `
                <option value="Anwesend" ${aktuellerStatus === 'Anwesend' ? 'selected' : ''}>Anwesend</option>
                <option value="Unentschuldigt" ${aktuellerStatus === 'Unentschuldigt' ? 'selected' : ''}>Unentschuldigt fehlt</option>
                <option value="Verspätet" ${aktuellerStatus === 'Verspätet' ? 'selected' : ''}>Verspätet</option>
            `;
            
            // Sonder-Rechteprüfung für Klassenleiter und Sekretariat
            if (aktuelleRolle === "Klassenleiter" || aktuelleRolle === "Sekretariat") {
                optionen += `
                    <option value="Entschuldigt" ${aktuellerStatus === 'Entschuldigt' ? 'selected' : ''}>Entschuldigt</option>
                    <option value="Freigestellt" ${aktuellerStatus === 'Freigestellt' ? 'selected' : ''}>Freigestellt</option>
                `;
            } else {
                // Wenn bereits entschuldigt/freigestellt, darf ein normaler Lehrer dies nicht ändern (gesperrt)
                if (aktuellerStatus === "Entschuldigt" || aktuellerStatus === "Freigestellt") {
                    optionen += `<option value="${aktuellerStatus}" selected disabled>${aktuellerStatus} (gesperrt)</option>`;
                }
            }

            li.innerHTML = `
                <span><strong>${name}</strong></span>
                <select class="status-select" onchange="statusDirektSpeichern('${name}', this.value)">
                    ${optionen}
                </select>
            `;
            listeUl.appendChild(li);
        });

        // Ansicht umschalten
        document.getElementById("dashboardView").style.display = "none";
        document.getElementById("detailView").style.display = "block";
    });
}

// Speichert den Status eines Schülers bei Klick sofort in der Cloud
function statusDirektSpeichern(schuelerName, neuerStatus) {
    const datum = document.getElementById("aktuellesDatum").value;
    const key = `${datum}_Std${gewaehlteStundeNummer}`;
    
    const updateObj = {};
    updateObj[`anwesenheit.${schuelerName}`] = neuerStatus;

    db.collection("klassenbuch").doc(key).update(updateObj).catch(() => {
        // Falls das Dokument am heutigen Tag noch gar nicht existiert, erstellen wir es neu
        const initial = { anwesenheit: {} };
        initial.anwesenheit[schuelerName] = neuerStatus;
        db.collection("klassenbuch").doc(key).set(initial, { merge: true });
    });
}

// Speichert Thema/Hausaufgaben und kehrt zum Dashboard zurück
function stundeSpeichernUndSchliessen() {
    const datum = document.getElementById("aktuellesDatum").value;
    const key = `${datum}_Std${gewaehlteStundeNummer}`;
    
    const daten = {
        thema: document.getElementById("unterrichtsInhalt").value,
        hausaufgaben: document.getElementById("hausaufgabenInhalt").value
    };
    
    db.collection("klassenbuch").doc(key).set(daten, { merge: true }).then(() => {
        zeigeDashboard();
    }).catch(err => {
        console.error("Fehler beim Signieren:", err);
    });
}

// Zurück-Funktion fürs Dashboard
function zeigeDashboard() {
    document.getElementById("detailView").style.display = "none";
    document.getElementById("dashboardView").style.display = "block";
    datenLadenAndRendern();
}
