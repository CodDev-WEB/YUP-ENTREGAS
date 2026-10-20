/**
 * YUP-ENTREGAS — API inicial para Google Planilhas.
 * Configure Script Properties: SPREADSHEET_ID, ADMIN_EMAIL, ADMIN_PASSWORD.
 * Implante como Web App (executar como proprietário). Todas as ações, exceto login,
 * exigem token de sessão; nunca coloque senhas ou segredos no frontend.
 */
const YUP = {
  sheets: {
    Journeys: ["id", "createdAt", "updatedAt", "createdBy", "payload"],
    Deliveries: ["id", "createdAt", "updatedAt", "createdBy", "payload"],
    Fuel: ["id", "createdAt", "updatedAt", "createdBy", "payload"],
    Maintenance: ["id", "createdAt", "updatedAt", "createdBy", "payload"],
    DeliveryEvents: ["id", "createdAt", "updatedAt", "createdBy", "payload"],
    Users: ["email", "displayName", "role", "driverId", "salt", "passwordHash", "active", "createdAt"]
  },
  recordCollections: ["Journeys", "Deliveries", "Fuel", "Maintenance", "DeliveryEvents"],
  tokenTtlSeconds: 21600
};

function doGet() {
  return json_({ ok: true, service: "YUP-ENTREGAS API", message: "API disponível. Envie POST para executar ações." });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(body.action || "");
    if (action === "login") return json_(login_(body.email, body.password));
    if (action === "health") return json_({ ok: true, service: "YUP-ENTREGAS API" });

    const session = requireSession_(body.token);
    if (action === "list") return json_(listRecords_(session, body.collection));
    if (action === "insert") return json_(insertRecord_(session, body.collection, body.record));
    if (action === "update") return json_(updateRecord_(session, body.collection, body.id, body.record));
    if (action === "logout") {
      CacheService.getScriptCache().remove("session:" + String(body.token || ""));
      return json_({ ok: true });
    }
    return json_({ ok: false, error: "Ação não reconhecida." });
  } catch (err) {
    return json_({ ok: false, error: err && err.message ? err.message : "Erro interno." });
  }
}

function setupYupDatabase() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty("SPREADSHEET_ID");
  if (!spreadsheetId) throw new Error("Configure SPREADSHEET_ID nas propriedades do script.");
  const ss = SpreadsheetApp.openById(spreadsheetId);
  Object.keys(YUP.sheets).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = YUP.sheets[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    } else {
      const current = sh.getRange(1, 1, 1, headers.length).getValues()[0];
      if (headers.some((h, i) => current[i] !== h)) {
        throw new Error("Cabeçalho inesperado na aba " + name + ". Não sobrescrevi os dados existentes.");
      }
    }
  });
  const email = String(props.getProperty("ADMIN_EMAIL") || "").trim().toLowerCase();
  const password = props.getProperty("ADMIN_PASSWORD") || "";
  if (email && password) {
    const users = ss.getSheetByName("Users");
    if (!findUser_(users, email)) {
      const salt = Utilities.getUuid();
      users.appendRow([email, "Administrador", "admin", "", salt, hashPassword_(password, salt), true, new Date().toISOString()]);
    }
    props.deleteProperty("ADMIN_PASSWORD");
  }
  return "Estrutura criada/verificada. Se ADMIN_EMAIL e ADMIN_PASSWORD estavam configurados, a conta inicial foi criada e a senha temporária removida das propriedades.";
}

function createConfiguredUser() {
  // Configure NEW_USER_EMAIL, NEW_USER_PASSWORD, NEW_USER_NAME, NEW_USER_ROLE
  // e NEW_USER_DRIVER_ID nas Script Properties. A senha é removida após uso.
  const props = PropertiesService.getScriptProperties();
  const email = String(props.getProperty("NEW_USER_EMAIL") || "").trim().toLowerCase();
  const password = props.getProperty("NEW_USER_PASSWORD") || "";
  const displayName = String(props.getProperty("NEW_USER_NAME") || "").trim();
  const role = String(props.getProperty("NEW_USER_ROLE") || "driver");
  const driverId = String(props.getProperty("NEW_USER_DRIVER_ID") || "").trim();
  if (!email || password.length < 12 || !displayName) {
    throw new Error("Configure NEW_USER_EMAIL, NEW_USER_NAME e uma NEW_USER_PASSWORD com pelo menos 12 caracteres.");
  }
  if (!["admin", "manager", "driver"].includes(role)) throw new Error("Perfil inválido.");
  if (role === "driver" && !driverId) throw new Error("Informe NEW_USER_DRIVER_ID para o perfil driver.");
  const sh = openDb_().getSheetByName("Users");
  if (findUser_(sh, email)) throw new Error("Já existe uma conta com esse e-mail.");
  const salt = Utilities.getUuid();
  sh.appendRow([email, displayName, role, role === "driver" ? driverId : "", salt, hashPassword_(password, salt), true, new Date().toISOString()]);
  props.deleteProperty("NEW_USER_PASSWORD");
  return "Conta criada. A propriedade NEW_USER_PASSWORD foi removida; remova também as demais propriedades NEW_USER_* se não for criar outra conta agora.";
}

function login_(email, password) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || !password) return { ok: false, error: "Informe e-mail e senha." };
  const cache = CacheService.getScriptCache();
  const throttleKey = "login-attempts:" + hashText_(normalized);
  const attempts = Number(cache.get(throttleKey) || 0);
  if (attempts >= 8) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  const user = findUser_(openDb_().getSheetByName("Users"), normalized);
  if (!user || String(user.active).toLowerCase() !== "true" || hashPassword_(String(password), user.salt) !== user.passwordHash) {
    cache.put(throttleKey, String(attempts + 1), 300);
    return { ok: false, error: "E-mail ou senha inválidos." };
  }
  cache.remove(throttleKey);
  const token = Utilities.getUuid() + Utilities.getUuid();
  const session = { email: user.email, displayName: user.displayName, role: user.role, driverId: user.driverId || "" };
  cache.put("session:" + token, JSON.stringify(session), YUP.tokenTtlSeconds);
  return { ok: true, token: token, profile: session, expiresIn: YUP.tokenTtlSeconds };
}

function requireSession_(token) {
  if (!token || typeof token !== "string") throw new Error("Sessão ausente. Entre novamente.");
  const value = CacheService.getScriptCache().get("session:" + token);
  if (!value) throw new Error("Sessão expirada. Entre novamente.");
  return JSON.parse(value);
}

function listRecords_(session, collection) {
  const sh = getCollection_(collection);
  const values = sh.getDataRange().getValues();
  const rows = values.slice(1).filter(r => r[0]).map(r => ({
    id: String(r[0]), createdAt: String(r[1]), updatedAt: String(r[2]), createdBy: String(r[3]),
    ...parsePayload_(r[4])
  }));
  if (session.role === "admin" || session.role === "manager") return { ok: true, records: rows };
  return { ok: true, records: rows.filter(r => r.createdBy === session.email || r.driverId === session.driverId) };
}

function insertRecord_(session, collection, record) {
  assertCollectionPermission_(session, collection, "insert");
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Registro inválido.");
  const id = String(record.id || Utilities.getUuid());
  const now = new Date().toISOString();
  const payload = Object.assign({}, record, { id: id });
  if (session.role === "driver") payload.driverId = session.driverId;
  delete payload.createdBy;
  const sh = getCollection_(collection);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (findRecordRow_(sh, id)) throw new Error("Este registro já existe.");
    sh.appendRow([id, now, now, session.email, JSON.stringify(payload)]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, record: Object.assign({}, payload, { createdAt: now, updatedAt: now, createdBy: session.email }) };
}

function updateRecord_(session, collection, id, record) {
  assertCollectionPermission_(session, collection, "update");
  if (!id || !record || typeof record !== "object" || Array.isArray(record)) throw new Error("Registro inválido.");
  const sh = getCollection_(collection);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const row = findRecordRow_(sh, String(id));
    if (!row) throw new Error("Registro não encontrado.");
    const creator = String(sh.getRange(row, 4).getValue());
    const existing = parsePayload_(sh.getRange(row, 5).getValue());
    if (session.role === "driver" && creator !== session.email && existing.driverId !== session.driverId) {
      throw new Error("Você não tem permissão para alterar este registro.");
    }
    const merged = Object.assign({}, existing, record, { id: String(id) });
    if (session.role === "driver") merged.driverId = session.driverId;
    delete merged.createdBy;
    const now = new Date().toISOString();
    sh.getRange(row, 3).setValue(now);
    sh.getRange(row, 5).setValue(JSON.stringify(merged));
    return { ok: true, record: Object.assign({}, merged, { createdAt: sh.getRange(row, 2).getValue(), updatedAt: now, createdBy: creator }) };
  } finally {
    lock.releaseLock();
  }
}

function assertCollectionPermission_(session, collection, operation) {
  getCollection_(collection);
  if (session.role === "driver" && ["Fuel", "Maintenance"].includes(collection)) {
    // Entregadores podem registrar abastecimento; manutenção é restrita à administração.
    if (collection === "Maintenance" || operation === "update" && collection === "Fuel") {
      throw new Error("Seu perfil não tem permissão para esta ação.");
    }
  }
  if (session.role === "manager" && collection === "Maintenance" && operation !== "insert") {
    throw new Error("Seu perfil não tem permissão para esta ação.");
  }
}

function getCollection_(name) {
  if (!YUP.recordCollections.includes(name)) throw new Error("Coleção inválida.");
  const sh = openDb_().getSheetByName(name);
  if (!sh) throw new Error("Banco não inicializado. Execute setupYupDatabase().");
  return sh;
}

function findRecordRow_(sh, id) {
  if (sh.getLastRow() < 2) return 0;
  const found = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
  return found ? found.getRow() : 0;
}

function findUser_(sh, email) {
  if (!sh || sh.getLastRow() < 2) return null;
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, YUP.sheets.Users.length).getValues();
  for (const row of values) {
    if (String(row[0]).trim().toLowerCase() === email) {
      return { email: String(row[0]), displayName: String(row[1]), role: String(row[2]), driverId: String(row[3] || ""), salt: String(row[4]), passwordHash: String(row[5]), active: row[6] };
    }
  }
  return null;
}

function openDb_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("Configure SPREADSHEET_ID nas propriedades do script.");
  return SpreadsheetApp.openById(id);
}

function parsePayload_(value) {
  try { return JSON.parse(String(value || "{}")); } catch (_) { return {}; }
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + ":" + String(password), Utilities.Charset.UTF_8);
  return bytes.map(b => ("0" + ((b + 256) % 256).toString(16)).slice(-2)).join("");
}

function hashText_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return bytes.map(b => ("0" + ((b + 256) % 256).toString(16)).slice(-2)).join("");
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
