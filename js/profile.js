// js/profile.js — 프로필 사진(Supabase) / 닉네임·아이디 / 엔트리 스프라이트
import { db } from "./firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { supabase, AVATAR_BUCKET } from "./supabase.js";
import { avatarPath, resizeImage } from "./avatar.js";
import { spriteFor } from "./pokemon.js";
import {
  $, esc, icon, hydrateIcons, requireAuth, ready, getUser, renderShell, avatarSrc,
  patchCachedUser, toast, errMsg, fmt, logout,
} from "./common.js";

const TYPE_COLORS = {
  노말: "#9fa19f", 불꽃: "#e62829", 물: "#2980ef", 풀: "#3fa129", 전기: "#fac000", 얼음: "#3dcef3",
  격투: "#ff8000", 독: "#9141cb", 땅: "#915121", 비행: "#81b9ef", 에스퍼: "#ef4179", 벌레: "#91a119",
  바위: "#afa981", 고스트: "#704170", 드래곤: "#5060e1", 악: "#624d4e", 강철: "#60a1b8", 페어리: "#ef70ef",
};

init();

async function init() {
  hydrateIcons();
  const authUser = await requireAuth();
  const targetUid = new URLSearchParams(location.search).get("uid") || authUser.uid;
  const isMe = targetUid === authUser.uid;

  let user = null, me = null;
  try {
    user = await getUser(targetUid, { fresh: isMe }); // 내 프로필은 최신 값(PEACE 등)으로
    me = isMe ? user : await getUser(authUser.uid);
  } catch (e) { console.error(e); }

  renderShell(isMe ? "profile" : null, me);
  ready();

  if (!user) {
    $("#profile").innerHTML = `<div class="empty">${icon("user")}<b>사용자를 찾을 수 없어요</b></div>`;
    $(".entry-section").hidden = true;
    return;
  }

  document.title = `${user.nickname} (@${user.id}) · UTOPIA`;
  $("#headTitle").textContent = user.nickname;
  $("#pAvatar").src = avatarSrc(user);
  $("#pName").textContent = user.nickname;
  $("#pHandle").textContent = `@${user.id}`;

  if (isMe) {
    $("#peaceChip").hidden = false;
    $("#peaceVal").textContent = fmt(user.peace);
    $("#readonlyNote").hidden = false;
    $("#avatarEdit").hidden = false;
    $("#mLogout").hidden = false;
    $("#mLogout").addEventListener("click", logout);
    $("#avatarInput").addEventListener("change", (e) => onAvatarPicked(e, authUser.uid));
  }

  renderEntry(user.entry || []);
}

/* ───────────────────────── 프로필 사진 변경 ───────────────────────── */
async function onAvatarPicked(e, uid) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("이미지 파일만 올릴 수 있어요", "error");
  if (file.size > 15 * 1024 * 1024) return toast("15MB 이하의 이미지를 골라주세요", "error");

  const loading = $("#avatarLoading");
  loading.hidden = false;
  try {
    const blob = await resizeImage(file, 400);
    const path = avatarPath(uid);
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: "31536000" });
    if (error) throw error;

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`; // 캐시 무효화용 버전
    await updateDoc(doc(db, "users", uid), { profileImage: url });

    patchCachedUser(uid, { profileImage: url });
    $("#pAvatar").src = url;
    document.querySelectorAll(".me-card .avatar").forEach((img) => (img.src = url));
    toast("프로필 사진을 바꿨어요");
  } catch (err) {
    console.error(err);
    toast(err?.message ? `업로드 실패: ${err.message}` : errMsg(err), "error");
  } finally {
    loading.hidden = true;
  }
}

/* ───────────────────────── 엔트리 ───────────────────────── */
function renderEntry(entry) {
  const list = entry.slice(0, 6);
  $("#entryCount").textContent = `${list.length} / 6`;
  const grid = $("#entryGrid");
  const slots = [...list, ...Array(6 - list.length).fill(null)];
  grid.innerHTML = slots.map((p, i) => (p ? monHTML(p, i) : emptySlot())).join("");

  list.forEach(async (p, i) => {
    const img = grid.querySelector(`[data-slot="${i}"] .sprite`);
    try {
      const url = await spriteFor(p);
      if (url) { img.src = url; return; }
    } catch (e) { console.warn(e); }
    if (p.portrait) img.src = p.portrait;
    else img.closest(".sprite-box").classList.add("missing");
  });

  grid.addEventListener("error", (e) => {
    if (e.target.classList?.contains("sprite")) e.target.closest(".sprite-box").classList.add("missing");
  }, true);
}

function monHTML(p, i) {
  const types = Array.isArray(p.type) ? p.type : p.type ? [p.type] : [];
  const c1 = TYPE_COLORS[types[0]] || "#9b84ff";
  const c2 = TYPE_COLORS[types[1]] || c1;
  const label = p.cardName || p.name;
  const form = p.cardName && p.cardName !== p.name ? (p.cardName.match(/\(([^)]*)\)/) || [])[1] : "";
  const moves = (p.moves || []).slice(0, 4);
  return `
  <article class="mon" data-slot="${i}" style="--c1:${c1};--c2:${c2}">
    <div class="sprite-box">
      <img class="sprite" alt="${esc(label)}" decoding="async">
      <span class="sprite-ph">${icon("pokeball")}</span>
    </div>
    <div class="mon-info">
      <h4 class="mon-name">${esc(p.name)}</h4>
      ${form ? `<p class="mon-form">${esc(form)}</p>` : ""}
      <div class="types">${types.map((t) => `<span class="type" style="--tc:${TYPE_COLORS[t] || "#888"}">${esc(t)}</span>`).join("")}</div>
    </div>
    <dl class="stats">
      <div><dt>HP</dt><dd>${fmt(p.hp)}</dd></div>
      <div><dt>공격</dt><dd>${fmt(p.atk)}</dd></div>
      <div><dt>방어</dt><dd>${fmt(p.def)}</dd></div>
      <div><dt>스피드</dt><dd>${fmt(p.spd)}</dd></div>
    </dl>
    ${moves.length ? `
    <details class="moves">
      <summary>기술 ${moves.length}개 ${icon("chevron")}</summary>
      <ul>${moves.map((m) => `<li><span>${esc(m.name)}</span><small>PP ${esc(m.pp)}</small></li>`).join("")}</ul>
    </details>` : ""}
  </article>`;
}

function emptySlot() {
  return `<div class="mon empty-slot">${icon("pokeball")}<span>빈 슬롯</span></div>`;
}
