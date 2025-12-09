// اتصال Supabase
const SUPABASE_URL = "https://scxntlerjrxfmibnuqvc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vX81waCjj0Y0iQoDdadqTw_TqWPdGaY";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_PASSWORD = "alfaris123";

function showAlert(el, msg, type) {
  el.textContent = msg;
  el.style.display = "block";
  el.className = "alert " + (type === "error" ? "alert-error" : "alert-success");
}

function getSessionEmail() {
  return localStorage.getItem("alfaris_email") || null;
}

function setSessionEmail(email) {
  localStorage.setItem("alfaris_email", email);
}

function clearSession() {
  localStorage.removeItem("alfaris_email");
}

function calcPerAdReward(totalDeposit) {
  if (!totalDeposit || totalDeposit <= 0) return 0;
  return (totalDeposit / 100) * 3;
}

async function fetchCurrentUser() {
  const email = getSessionEmail();
  if (!email) return null;
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (error) {
    console.error("fetchCurrentUser error", error);
    return null;
  }
  return data;
}

// صفحة الدخول/التسجيل
function initAuthPage() {
  const modeSelect = document.getElementById("auth-mode");
  const nameGroup = document.getElementById("name-group");
  const emailInput = document.getElementById("email");
  const passInput = document.getElementById("password");
  const submitBtn = document.getElementById("auth-submit");
  const errBox = document.getElementById("auth-error");
  const okBox = document.getElementById("auth-success");

  function setMode() {
    const mode = modeSelect.value;
    nameGroup.style.display = mode === "register" ? "block" : "none";
    errBox.style.display = "none";
    okBox.style.display = "none";
  }

  modeSelect.addEventListener("change", setMode);
  setMode();

  submitBtn.addEventListener("click", async () => {
    const mode = modeSelect.value;
    const email = (emailInput.value || "").trim().toLowerCase();
    const pass = (passInput.value || "").trim();
    const name = (document.getElementById("name").value || "").trim();

    errBox.style.display = "none";
    okBox.style.display = "none";

    if (!email || !pass || (mode === "register" && !name)) {
      showAlert(errBox, "يرجى تعبئة جميع الحقول.", "error");
      return;
    }

    if (mode === "register") {
      const existing = await supabase.from("users").select("id").eq("email", email).maybeSingle();
      if (existing.data) {
        showAlert(errBox, "يوجد حساب بهذا البريد بالفعل.", "error");
        return;
      }
      const { error } = await supabase.from("users").insert({
        name,
        email,
        password: pass,
        balance: 0,
        total_deposit: 0
      });
      if (error) {
        console.error(error);
        showAlert(errBox, "خطأ أثناء إنشاء الحساب.", "error");
        return;
      }
      showAlert(okBox, "تم إنشاء الحساب بنجاح، يمكنك الآن تسجيل الدخول.", "success");
      modeSelect.value = "login";
      setMode();
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .eq("password", pass)
      .maybeSingle();
    if (error || !data) {
      showAlert(errBox, "البريد أو كلمة المرور غير صحيحة.", "error");
      return;
    }
    setSessionEmail(email);
    window.location.href = "dashboard.html";
  });

  if (getSessionEmail()) {
    window.location.href = "dashboard.html";
  }
}

function logout() {
  clearSession();
  window.location.href = "index.html";
}

async function initDashboard() {
  const user = await fetchCurrentUser();
  if (!user) {
    clearSession();
    window.location.href = "index.html";
    return;
  }
  document.getElementById("d-name").textContent = user.name || "";
  document.getElementById("d-email").textContent = user.email || "";

  const total = Number(user.total_deposit || 0);
  const balance = Number(user.balance || 0);
  document.getElementById("d-total").textContent = total.toFixed(2);
  document.getElementById("d-balance").textContent = balance.toFixed(2);
  document.getElementById("d-per-ad").textContent = calcPerAdReward(total).toFixed(2);
  document.getElementById("d-ads").textContent = "0 / 2 (واجهة فقط حالياً)";

  const { data: deps } = await supabase
    .from("deposits")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const list = document.getElementById("d-last-deposits");
  list.innerHTML = "";
  if (!deps || deps.length === 0) {
    const p = document.createElement("p");
    p.className = "small";
    p.textContent = "لا يوجد شحنات حتى الآن.";
    list.appendChild(p);
  } else {
    deps.forEach((d) => {
      const div = document.createElement("div");
      div.className = "list-item";
      const statusClass =
        d.status === "pending" ? "badge-pending" :
        d.status === "confirmed" ? "badge-approved" : "badge-rejected";
      const statusLabel =
        d.status === "pending" ? "قيد المراجعة" :
        d.status === "confirmed" ? "مؤكد" : "مرفوض";
      div.innerHTML = `
        <span>${d.amount} USDT<br/><span class="small">${new Date(d.created_at).toLocaleString()}</span></span>
        <span class="badge-status ${statusClass}">${statusLabel}</span>
      `;
      list.appendChild(div);
    });
  }
}

async function initDepositPage() {
  const user = await fetchCurrentUser();
  if (!user) {
    clearSession();
    window.location.href = "index.html";
    return;
  }

  const amountInput = document.getElementById("amount");
  const txInput = document.getElementById("txid");
  const msgBox = document.getElementById("dep-msg");
  const btn = document.getElementById("dep-submit");
  const list = document.getElementById("dep-list");

  async function loadDeposits() {
    const { data } = await supabase
      .from("deposits")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    list.innerHTML = "";
    if (!data || data.length === 0) {
      const p = document.createElement("p");
      p.className = "small";
      p.textContent = "لا يوجد طلبات شحن بعد.";
      list.appendChild(p);
      return;
    }
    data.forEach((d) => {
      const div = document.createElement("div");
      div.className = "list-item";
      const statusClass =
        d.status === "pending" ? "badge-pending" :
        d.status === "confirmed" ? "badge-approved" : "badge-rejected";
      const statusLabel =
        d.status === "pending" ? "قيد المراجعة" :
        d.status === "confirmed" ? "مؤكد" : "مرفوض";
      div.innerHTML = `
        <span>${d.amount} USDT<br/><span class="small">TXID: ${d.txid || "-"}</span></span>
        <span class="badge-status ${statusClass}">${statusLabel}</span>
      `;
      list.appendChild(div);
    });
  }

  btn.addEventListener("click", async () => {
    msgBox.style.display = "none";
    const amount = Number(amountInput.value || "0");
    const txid = txInput.value.trim();
    if (!amount || amount < 20) {
      showAlert(msgBox, "أقل مبلغ للشحن هو 20 USDT.", "error");
      return;
    }
    if (!txid) {
      showAlert(msgBox, "يرجى إدخال TXID للتحويل.", "error");
      return;
    }

    const { error } = await supabase.from("deposits").insert({
      user_id: user.id,
      amount,
      txid,
      status: "pending"
    });
    if (error) {
      console.error(error);
      showAlert(msgBox, "حدث خطأ أثناء إرسال طلب الشحن.", "error");
      return;
    }
    showAlert(msgBox, "تم إرسال طلب الشحن وهو الآن قيد المراجعة من الإدارة.", "success");
    amountInput.value = "20";
    txInput.value = "";
    await loadDeposits();
  });

  await loadDeposits();
}

async function initWithdrawPage() {
  const user = await fetchCurrentUser();
  if (!user) {
    clearSession();
    window.location.href = "index.html";
    return;
  }

  const balInput = document.getElementById("wd-balance");
  const amountInput = document.getElementById("wd-amount");
  const walletInput = document.getElementById("wd-wallet");
  const msgBox = document.getElementById("wd-msg");
  const btn = document.getElementById("wd-submit");
  const list = document.getElementById("wd-list");

  const balance = Number(user.balance || 0);
  balInput.value = balance.toFixed(2) + " $";

  async function loadWithdrawals() {
    const { data } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    list.innerHTML = "";
    if (!data || data.length === 0) {
      const p = document.createElement("p");
      p.className = "small";
      p.textContent = "لا يوجد طلبات سحب.";
      list.appendChild(p);
      return;
    }
    data.forEach((w) => {
      const div = document.createElement("div");
      div.className = "list-item";
      const statusClass =
        w.status === "pending" ? "badge-pending" :
        w.status === "approved" ? "badge-approved" : "badge-rejected";
      const statusLabel =
        w.status === "pending" ? "قيد المراجعة" :
        w.status === "approved" ? "مقبول" : "مرفوض";
      div.innerHTML = `
        <span>${w.amount} $<br/><span class="small">${new Date(w.created_at).toLocaleString()}</span></span>
        <span class="badge-status ${statusClass}">${statusLabel}</span>
      `;
      list.appendChild(div);
    });
  }

  btn.addEventListener("click", async () => {
    msgBox.style.display = "none";
    const amount = Number(amountInput.value || "0");
    const wallet = walletInput.value.trim();

    if (!amount || amount <= 0) {
      showAlert(msgBox, "يرجى إدخال مبلغ صحيح.", "error");
      return;
    }
    if (amount > balance) {
      showAlert(msgBox, "المبلغ المطلوب أكبر من رصيدك.", "error");
      return;
    }
    if (!wallet) {
      showAlert(msgBox, "يرجى إدخال عنوان محفظتك.", "error");
      return;
    }

    const { error } = await supabase.from("withdrawals").insert({
      user_id: user.id,
      amount,
      wallet,
      status: "pending"
    });
    if (error) {
      console.error(error);
      showAlert(msgBox, "حدث خطأ أثناء إرسال طلب السحب.", "error");
      return;
    }
    showAlert(msgBox, "تم إرسال طلب السحب وهو الآن قيد المراجعة من الإدارة.", "success");
    amountInput.value = "";
    walletInput.value = "";
    await loadWithdrawals();
  });

  await loadWithdrawals();
}

async function initAdminPage() {
  const loginBox = document.getElementById("admin-login");
  const panel = document.getElementById("admin-panel");
  const passInput = document.getElementById("admin-pass");
  const msgBox = document.getElementById("admin-msg");
  const loginBtn = document.getElementById("admin-login-btn");
  const depList = document.getElementById("admin-dep-list");
  const wdList = document.getElementById("admin-wd-list");

  async function loadData() {
    const depsRes = await supabase
      .from("deposits")
      .select("*, users(name,email)")
      .order("created_at", { ascending: false });
    const wdsRes = await supabase
      .from("withdrawals")
      .select("*, users(name,email)")
      .order("created_at", { ascending: false });

    depList.innerHTML = "";
    if (!depsRes.data || depsRes.data.length === 0) {
      const p = document.createElement("p");
      p.className = "small";
      p.textContent = "لا يوجد طلبات شحن.";
      depList.appendChild(p);
    } else {
      depsRes.data.forEach((d) => {
        const div = document.createElement("div");
        div.className = "list-item";
        const statusClass =
          d.status === "pending" ? "badge-pending" :
          d.status === "confirmed" ? "badge-approved" : "badge-rejected";
        const statusLabel =
          d.status === "pending" ? "قيد المراجعة" :
          d.status === "confirmed" ? "مؤكد" : "مرفوض";
        div.innerHTML = `
          <span>
            ${d.amount} USDT<br/>
            <span class="small">${d.users?.name || ""} ( ${d.users?.email || ""} )</span><br/>
            <span class="small">TXID: ${d.txid || "-"}</span>
          </span>
          <span>
            <span class="badge-status ${statusClass}" style="display:block;margin-bottom:4px;">${statusLabel}</span>
            <button class="btn btn-outline" data-type="dep" data-action="confirm" data-id="${d.id}" style="font-size:11px;padding:4px 8px;">قبول</button>
            <button class="btn btn-outline" data-type="dep" data-action="reject" data-id="${d.id}" style="font-size:11px;padding:4px 8px;">رفض</button>
          </span>
        `;
        depList.appendChild(div);
      });
    }

    wdList.innerHTML = "";
    if (!wdsRes.data || wdsRes.data.length === 0) {
      const p = document.createElement("p");
      p.className = "small";
      p.textContent = "لا يوجد طلبات سحب.";
      wdList.appendChild(p);
    } else {
      wdsRes.data.forEach((w) => {
        const div = document.createElement("div");
        div.className = "list-item";
        const statusClass =
          w.status === "pending" ? "badge-pending" :
          w.status === "approved" ? "badge-approved" : "badge-rejected";
        const statusLabel =
          w.status === "pending" ? "قيد المراجعة" :
          w.status === "approved" ? "مقبول" : "مرفوض";
        div.innerHTML = `
          <span>
            ${w.amount} $<br/>
            <span class="small">${w.users?.name || ""} ( ${w.users?.email || ""} )</span><br/>
            <span class="small">${w.wallet}</span>
          </span>
          <span>
            <span class="badge-status ${statusClass}" style="display:block;margin-bottom:4px;">${statusLabel}</span>
            <button class="btn btn-outline" data-type="wd" data-action="approve" data-id="${w.id}" style="font-size:11px;padding:4px 8px;">قبول</button>
            <button class="btn btn-outline" data-type="wd" data-action="reject" data-id="${w.id}" style="font-size:11px;padding:4px 8px;">رفض</button>
          </span>
        `;
        wdList.appendChild(div);
      });
    }
  }

  depList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");
    if (!id) return;

    const depRes = await supabase.from("deposits").select("*").eq("id", id).maybeSingle();
    if (!depRes.data) return;
    const dep = depRes.data;

    if (action === "confirm") {
      const userRes = await supabase.from("users").select("*").eq("id", dep.user_id).maybeSingle();
      if (!userRes.data) return;
      const user = userRes.data;
      const newTotal = Number(user.total_deposit || 0) + Number(dep.amount || 0);
      const newBalance = Number(user.balance || 0) + Number(dep.amount || 0);
      await supabase.from("users").update({
        total_deposit: newTotal,
        balance: newBalance
      }).eq("id", user.id);
      await supabase.from("deposits").update({ status: "confirmed" }).eq("id", id);
    } else if (action === "reject") {
      await supabase.from("deposits").update({ status: "rejected" }).eq("id", id);
    }
    await loadData();
  });

  wdList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");
    if (!id) return;

    const wdRes = await supabase.from("withdrawals").select("*").eq("id", id).maybeSingle();
    if (!wdRes.data) return;
    const wd = wdRes.data;

    if (action === "approve") {
      const userRes = await supabase.from("users").select("*").eq("id", wd.user_id).maybeSingle();
      if (userRes.data) {
        const user = userRes.data;
        const newBalance = Math.max(0, Number(user.balance || 0) - Number(wd.amount || 0));
        await supabase.from("users").update({ balance: newBalance }).eq("id", user.id);
      }
      await supabase.from("withdrawals").update({ status: "approved" }).eq("id", id);
    } else if (action === "reject") {
      await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", id);
    }
    await loadData();
  });

  loginBtn.addEventListener("click", async () => {
    msgBox.style.display = "none";
    const pass = passInput.value || "";
    if (pass !== ADMIN_PASSWORD) {
      showAlert(msgBox, "كلمة مرور الإدارة غير صحيحة.", "error");
      return;
    }
    loginBox.style.display = "none";
    panel.style.display = "block";
    await loadData();
  });
}

